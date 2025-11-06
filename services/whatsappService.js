const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { getPool } = require('../database/connection');

class WhatsAppService {
  constructor() {
    this.clients = new Map();
    this.qrCodes = new Map();
    this.reconnectAttempts = new Map();
    this.reconnectTimeouts = new Map();
    this.sessionPath = process.env.WHATSAPP_SESSION_PATH || './whatsapp-sessions';

    // Sistema de bloqueo por errores
    this.userErrors = new Map(); // clientPhone -> { count: number, lastError: Date }
    this.blockedUsers = new Map(); // clientPhone -> Date (cuando se desbloqueará)
    this.maxErrors = 7;

    // Sistema de sesiones para conversaciones
    this.userSessions = new Map(); // 'barbershopId_phone' -> timestamp de última interacción
    this.blockDurationMinutes = 10;
    
    if (!fs.existsSync(this.sessionPath)) {
      fs.mkdirSync(this.sessionPath, { recursive: true });
    }

    // Configuración de reconexión
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 30000; // 30 segundos
    this.maxReconnectDelay = 300000; // 5 minutos máximo
  }

  async initializeClient(barbershopId) {
    try {
      if (this.clients.has(barbershopId)) {
        return this.clients.get(barbershopId);
      }

      // Emitir evento de inicio de inicialización
      const io = global.io;
      if (io) {
        console.log(`Emitiendo whatsapp_initializing para barbería ${barbershopId}`);
        io.to(`barbershop_${barbershopId}`).emit('whatsapp_initializing', {
          status: 'initializing',
          message: 'Iniciando WhatsApp...'
        });
      }

      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: `barbershop_${barbershopId}`,
          dataPath: this.sessionPath
        }),
        puppeteer: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--no-first-run',
            '--disable-gpu'
          ],
          timeout: 60000 // 60 segundos timeout
        }
      });

      client.on('qr', async (qr) => {
        // Verificar si el cliente ya está conectado antes de generar QR
        if (this.isClientReady(barbershopId)) {
          console.log(`Cliente ya conectado para barbería ${barbershopId}, ignorando QR`);
          return;
        }

        console.log(`QR Code generado para barbería ${barbershopId}`);
        console.log(`QR string length: ${qr.length}`);
        try {
          const qrCodeDataUrl = await qrcode.toDataURL(qr);
          this.qrCodes.set(barbershopId, qrCodeDataUrl);
          console.log(`QR Code almacenado para barbería ${barbershopId}`);
          console.log(`QR DataURL length: ${qrCodeDataUrl.length}`);

          const io = global.io;
          if (io) {
            console.log(`Enviando QR via socket a barbershop_${barbershopId}`);
            console.log(`Clientes en sala barbershop_${barbershopId}:`, io.sockets.adapter.rooms.get(`barbershop_${barbershopId}`)?.size || 0);

            io.to(`barbershop_${barbershopId}`).emit('whatsapp_qr', {
              qr: qrCodeDataUrl,
              status: 'qr_generated',
              timestamp: new Date().toISOString()
            });
            console.log(`Evento whatsapp_qr emitido para barbershop_${barbershopId}`);
          } else {
            console.log('Socket.io global no disponible');
          }
        } catch (error) {
          console.error('Error generando QR code:', error);
        }
      });

      client.on('ready', async () => {
        console.log(`WhatsApp cliente listo para barbería ${barbershopId}`);

        // Limpiar QR al conectarse exitosamente
        this.qrCodes.delete(barbershopId);

        const io = global.io;
        if (io) {
          console.log(`Emitiendo whatsapp_ready para barbería ${barbershopId}`);
          console.log(`Número: ${client.info.wid.user}`);

          // Agregar delay para asegurar que el cliente esté completamente conectado
          setTimeout(() => {
            // Verificar que el cliente siga conectado antes de emitir ready
            if (this.isClientReady(barbershopId)) {
              io.to(`barbershop_${barbershopId}`).emit('whatsapp_ready', {
                status: 'connected',
                number: client.info.wid.user
              });
              console.log(`Evento whatsapp_ready emitido para barbershop_${barbershopId}`);

              // Emitir evento adicional para limpiar QR del frontend
              io.to(`barbershop_${barbershopId}`).emit('whatsapp_qr_clear', {
                status: 'connected',
                message: 'QR ya no es necesario'
              });
            } else {
              console.log(`Cliente ya no está listo para barbería ${barbershopId}, no se emite evento ready`);
            }
          }, 2000); // 2 segundos de delay para mayor estabilidad
        } else {
          console.log('Socket.io global no disponible para whatsapp_ready');
        }

        // Procesar notificaciones pendientes
        setTimeout(async () => {
          try {
            const appointmentsRouter = require('../routes/appointments');
            await appointmentsRouter.processPendingNotifications(barbershopId);
          } catch (error) {
            console.error('Error procesando notificaciones pendientes:', error);
          }
        }, 3000); // Esperar 3 segundos para asegurar que la conexión esté estable
      });

      client.on('authenticated', () => {
        console.log(`WhatsApp autenticado para barbería ${barbershopId}`);
        console.log(`Esperando evento 'ready' para barbería ${barbershopId}...`);
      });

      client.on('auth_failure', (msg) => {
        console.error(`Error de autenticación WhatsApp para barbería ${barbershopId}:`, msg);
        
        const io = global.io;
        if (io) {
          io.to(`barbershop_${barbershopId}`).emit('whatsapp_error', {
            status: 'auth_failure',
            message: msg
          });
        }
      });

      client.on('disconnected', (reason) => {
        console.log(`WhatsApp desconectado para barbería ${barbershopId}:`, reason);
        console.log(`Estado del cliente antes de desconexión:`, {
          hasInfo: !!client.info,
          isReady: this.isClientReady(barbershopId),
          clientExists: this.clients.has(barbershopId)
        });
        
        this.clients.delete(barbershopId);
        
        const io = global.io;
        if (io) {
          io.to(`barbershop_${barbershopId}`).emit('whatsapp_disconnected', {
            status: 'disconnected',
            reason
          });
        }

        // Iniciar proceso de reconexión automática
        this.scheduleReconnect(barbershopId, reason);
      });

      client.on('message', async (msg) => {
        await this.handleIncomingMessage(barbershopId, msg);
      });

      // Agregar manejador de errores genérico
      client.on('error', (error) => {
        console.error(`Error en cliente WhatsApp para barbería ${barbershopId}:`, error);
      });

      // Agregar listener para cambios de estado
      client.on('change_state', (state) => {
        console.log(`Cambio de estado WhatsApp para barbería ${barbershopId}:`, state);
      });

      this.clients.set(barbershopId, client);
      
      console.log(`Inicializando cliente WhatsApp para barbería ${barbershopId}...`);
      
      try {
        await client.initialize();
        console.log(`Cliente WhatsApp inicializado exitosamente para barbería ${barbershopId}`);
      } catch (initError) {
        console.error(`Error durante inicialización de WhatsApp para barbería ${barbershopId}:`, initError);
        
        // Limpiar cliente fallido
        if (this.clients.has(barbershopId)) {
          this.clients.delete(barbershopId);
        }
        
        // Emitir error via socket
        const io = global.io;
        if (io) {
          io.to(`barbershop_${barbershopId}`).emit('whatsapp_error', {
            status: 'initialization_failed',
            message: 'Error inicializando WhatsApp. Intenta de nuevo.'
          });
        }
        
        throw initError;
      }

      return client;
    } catch (error) {
      console.error(`Error general inicializando cliente WhatsApp para barbería ${barbershopId}:`, error);
      throw error;
    }
  }

  async handleIncomingMessage(barbershopId, msg) {
    try {
      if (msg.from.endsWith('@c.us') && !msg.fromMe) {
        const clientPhone = msg.from.replace('@c.us', '');
        const messageText = msg.body.toLowerCase().trim();

        // Verificar si el usuario está bloqueado
        if (this.isUserBlocked(clientPhone)) {
          return; // No responder si está bloqueado
        }

        const pool = getPool();

        const [barbershopRows] = await pool.execute(
          'SELECT id, name FROM barbershops WHERE id = ? AND is_active = TRUE AND is_suspended = FALSE',
          [barbershopId]
        );

        if (barbershopRows.length === 0) {
          return;
        }

        const barbershop = barbershopRows[0];

        // Verificar si es una nueva conversación usando sesiones en memoria
        const sessionKey = `${barbershopId}_${clientPhone}`;
        const lastInteraction = this.userSessions.get(sessionKey);
        const sessionTimeout = 5 * 60 * 1000; // 5 minutos en milisegundos

        // Si es usuario nuevo O han pasado más de 24 horas desde la última interacción, es una nueva conversación
        const isNewConversation = !lastInteraction || (Date.now() - lastInteraction) > sessionTimeout;

        if (isNewConversation) {
          console.log(`Nueva conversación iniciada por ${clientPhone} para barbería ${barbershopId}, enviando menú de bienvenida`);
          this.userSessions.set(sessionKey, Date.now()); // Registrar esta interacción
          await this.sendMainMenu(barbershopId, clientPhone, barbershop.name);
          this.resetUserErrors(clientPhone);
          return; // Salir después de enviar el menú de bienvenida
        }

        // Actualizar timestamp de última interacción
        this.userSessions.set(sessionKey, Date.now());

        let messageProcessed = false;

        if (messageText === 'menu' || messageText === 'hola' || messageText === 'inicio') {
          await this.sendMainMenu(barbershopId, clientPhone, barbershop.name);
          this.resetUserErrors(clientPhone); // Resetear errores en comandos válidos
          messageProcessed = true;
        } else if (messageText === '1' || messageText === 'turnos') {
          await this.sendAppointmentMenu(barbershopId, clientPhone);
          this.resetUserErrors(clientPhone);
          messageProcessed = true;
        } else if (messageText === '2' || messageText === 'consultar') {
          await this.sendAppointmentCheck(barbershopId, clientPhone);
          this.resetUserErrors(clientPhone);
          messageProcessed = true;
        } else if (messageText === '3' || messageText === 'barberos') {
          await this.sendAvailableBarbers(barbershopId, clientPhone);
          this.resetUserErrors(clientPhone);
          messageProcessed = true;
        } else if (messageText === '4' || messageText === 'estado') {
          await this.sendCurrentQueue(barbershopId, clientPhone);
          this.resetUserErrors(clientPhone);
          messageProcessed = true;
        } else if (messageText === '5' || messageText === 'cancelar') {
          await this.sendCancelAppointmentMenu(barbershopId, clientPhone);
          this.resetUserErrors(clientPhone);
          messageProcessed = true;
        } else if (messageText === 'si' || messageText === 'confirmar_cancelar' || messageText === 'si_cancelar') {
          await this.processCancelAppointment(barbershopId, clientPhone);
          this.resetUserErrors(clientPhone);
          messageProcessed = true;
        } else if (messageText === 'no' || messageText === 'no_cancelar') {
          await this.sendMessage(barbershopId, clientPhone, '✅ Cancelación anulada. Tu turno sigue activo.\n\nEscribe *menu* para volver al inicio.');
          this.resetUserErrors(clientPhone);
          messageProcessed = true;
        } else if (messageText === 'ayuda' || messageText === 'help' || messageText === '?') {
          await this.sendHelpMessage(barbershopId, clientPhone);
          this.resetUserErrors(clientPhone);
          messageProcessed = true;
        } else if (messageText === 'contacto' || messageText === 'info') {
          await this.sendContactInfo(barbershopId, clientPhone);
          this.resetUserErrors(clientPhone);
          messageProcessed = true;
        } else if (/^[a-zA-Z]$/.test(messageText)) {
          // Si es una sola letra, intentar reservar turno con ese barbero
          await this.handleAppointmentBookingByLetter(barbershopId, clientPhone, messageText.toUpperCase());
          // No resetear errores aquí, se manejará en la función individual
          messageProcessed = true;
        } else if (/^\d+$/.test(messageText)) {
          // Si es solo un número, intentar reservar turno con ese barbero (mantener compatibilidad)
          await this.handleAppointmentBooking(barbershopId, clientPhone, messageText);
          // No resetear errores aquí, se manejará en la función individual
          messageProcessed = true;
        } else {
          // Mensaje no reconocido, incrementar errores
          const wasBlocked = this.incrementUserError(clientPhone);
          
          if (wasBlocked) {
            const blockMinutes = this.blockDurationMinutes;
            await this.sendMessage(barbershopId, clientPhone, 
              `⚠️ *Temporalmente sin respuesta*\n\n` +
              `Has enviado demasiados mensajes incorrectos. El sistema no responderá durante ${blockMinutes} minutos.\n\n` +
              `Intenta nuevamente más tarde escribiendo *menu*.`
            );
          } else {
            const errorCount = this.userErrors.get(clientPhone)?.count || 0;
            const remaining = this.maxErrors - errorCount;
            await this.sendMessage(barbershopId, clientPhone, 
              `❌ Mensaje no reconocido.\n\n` +
              `Escribe *menu* para ver las opciones disponibles.\n\n` +
              `_Avisos restantes antes del bloqueo temporal: ${remaining}_`
            );
          }
          messageProcessed = true;
        }
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  }

  // Métodos para el sistema de bloqueo por errores
  isUserBlocked(clientPhone) {
    const blockUntil = this.blockedUsers.get(clientPhone);
    if (!blockUntil) return false;
    
    if (new Date() >= blockUntil) {
      // El bloqueo ha expirado, limpiar
      this.blockedUsers.delete(clientPhone);
      this.userErrors.delete(clientPhone);
      return false;
    }
    
    return true;
  }

  incrementUserError(clientPhone) {
    const now = new Date();
    const userError = this.userErrors.get(clientPhone) || { count: 0, lastError: null };
    
    // Resetear contador si han pasado más de 30 minutos desde el último error
    if (userError.lastError && now - userError.lastError > 30 * 60 * 1000) {
      userError.count = 0;
    }
    
    userError.count++;
    userError.lastError = now;
    this.userErrors.set(clientPhone, userError);
    
    // Si alcanza el máximo de errores, bloquear
    if (userError.count >= this.maxErrors) {
      const blockUntil = new Date(now.getTime() + this.blockDurationMinutes * 60 * 1000);
      this.blockedUsers.set(clientPhone, blockUntil);
      return true; // Indica que fue bloqueado
    }
    
    return false;
  }

  resetUserErrors(clientPhone) {
    this.userErrors.delete(clientPhone);
  }

  async sendMainMenu(barbershopId, clientPhone, barbershopName) {
    const menuMessage = `¡Hola! Bienvenido a *${barbershopName}* ✂️

Selecciona una opción:

*1* - 📅 Reservar turno
*2* - 🔍 Consultar mi turno
*3* - 👨‍💼 Ver barberos disponibles
*4* - ⏰ Estado de la cola
*5* - ❌ Cancelar mi turno

Escribe el número de la opción que deseas o escribe *menu* en cualquier momento para volver aquí.`;

    await this.sendMessage(barbershopId, clientPhone, menuMessage);
  }

  async sendAppointmentMenu(barbershopId, clientPhone) {
    try {
      const pool = getPool();
      const today = new Date().toISOString().split('T')[0];

      // Obtener barberos que están trabajando ahora (tienen sesión activa)
      const availableBarbers = await this.getActiveWorkingBarbers(barbershopId);

      if (availableBarbers.length === 0) {
        await this.sendMessage(barbershopId, clientPhone,
          '⏸️ *No hay barberos trabajando en este momento*\n\n' +
          'Los barberos deben iniciar su jornada laboral para poder recibir turnos.\n\n' +
          'Por favor intenta más tarde o escribe *menu* para volver al inicio.');
        return;
      }

      // Mostrar barberos disponibles ahora
      let message = '📅 *Barberos disponibles:*\n\n';

      for (let i = 0; i < availableBarbers.length; i++) {
        const barber = availableBarbers[i];
        const letter = String.fromCharCode(65 + i); // A, B, C, D, etc.

        const [queueCount] = await pool.execute(`
          SELECT COUNT(*) as count FROM appointments
          WHERE barber_id = ? AND appointment_date = ? AND status = 'waiting'
        `, [barber.id, today]);

        // Calcular tiempo estimado de atención
        const waitingClients = queueCount[0].count;
        const estimatedWait = waitingClients * barber.service_duration_minutes;
        const now = new Date();
        const estimatedTime = new Date(now.getTime() + estimatedWait * 60000);
        const formattedTime = `${estimatedTime.getHours().toString().padStart(2,'0')}:${estimatedTime.getMinutes().toString().padStart(2,'0')}`;

        message += `*${letter}) ${barber.name}* ✅\n`;
        message += `👥 ${waitingClients} personas en cola\n`;
        if (waitingClients === 0) {
          message += `🎯 *¡Disponible ahora! Sin espera*\n`;
        } else {
          message += `⏰ Tiempo espera: ~${estimatedWait} min\n`;
          message += `🕐 Te atendería: ~${formattedTime}\n`;
        }
        message += `Para reservar: escribe *${letter}*\n\n`;
      }

      message += 'Escribe *menu* para volver al inicio.';
      await this.sendMessage(barbershopId, clientPhone, message);

    } catch (error) {
      console.error('Error enviando menú de turnos:', error);
      await this.sendMessage(barbershopId, clientPhone, 'Error obteniendo información. Escribe *menu* para intentar de nuevo.');
    }
  }

  async sendAppointmentCheck(barbershopId, clientPhone) {
    try {
      const pool = getPool();
      const today = new Date().toISOString().split('T')[0];
      
      const [appointments] = await pool.execute(`
        SELECT a.id, a.queue_number, a.status, a.estimated_time,
               b.name as barber_name, b.service_duration_minutes
        FROM appointments a
        JOIN barbers b ON a.barber_id = b.id
        WHERE a.barbershop_id = ? AND a.client_phone = ? AND a.appointment_date = ? 
        AND a.status IN ('waiting', 'in_progress')
        ORDER BY a.created_at DESC
        LIMIT 1
      `, [barbershopId, clientPhone, today]);

      if (appointments.length === 0) {
        await this.sendMessage(barbershopId, clientPhone, 
          '❌ No tienes turnos pendientes para hoy.\n\nEscribe *1* para reservar un turno o *menu* para volver al inicio.');
        return;
      }

      const appointment = appointments[0];
      
      if (appointment.status === 'waiting') {
        const [queuePosition] = await pool.execute(`
          SELECT COUNT(*) as position FROM appointments 
          WHERE barber_id = (SELECT barber_id FROM appointments WHERE id = ?) 
          AND appointment_date = ? AND status = 'waiting' AND queue_number < ?
        `, [appointment.id, today, appointment.queue_number]);

        const position = queuePosition[0].position + 1;
        const waitTime = (position - 1) * appointment.service_duration_minutes;

        let message = `📋 *Estado de tu turno:*\n\n`;
        message += `👨‍💼 Barbero: *${appointment.barber_name}*\n`;
        message += `📍 Tu posición en la cola: *${position}*\n`;
        if (waitTime === 0) {
          message += `🎯 *¡Eres el siguiente!* - Sin espera\n`;
        } else if (waitTime <= 15) {
          message += `🟢 Tiempo de espera: *${waitTime} minutos* (Muy pronto)\n`;
        } else if (waitTime <= 45) {
          message += `🟡 Tiempo de espera: *${waitTime} minutos* (Moderado)\n`;
        } else {
          message += `🔴 Tiempo de espera: *${waitTime} minutos* (Largo)\n`;
        }
        message += `🕐 Hora estimada: *${appointment.estimated_time}*\n`;
        message += `📅 Fecha: ${today}\n\n`;
        message += `*Opciones:*\n`;
        message += `*4* - ⏰ Ver estado general de colas\n`;
        message += `*5* - ❌ Cancelar mi turno\n`;
        message += `*menu* - 🏠 Volver al inicio`;

        await this.sendMessage(barbershopId, clientPhone, message);
      } else {
        await this.sendMessage(barbershopId, clientPhone, 
          `🎉 ¡Tu turno con *${appointment.barber_name}* está siendo atendido ahora!\n\nEscribe *menu* para volver al inicio.`);
      }

    } catch (error) {
      console.error('Error consultando turno:', error);
      await this.sendMessage(barbershopId, clientPhone, 'Error consultando tu turno. Escribe *menu* para intentar de nuevo.');
    }
  }

  async sendAvailableBarbers(barbershopId, clientPhone) {
    try {
      const pool = getPool();
      const today = new Date().toISOString().split('T')[0];

      // Obtener barberos que están trabajando ahora
      const availableBarbers = await this.getActiveWorkingBarbers(barbershopId);

      if (availableBarbers.length === 0) {
        await this.sendMessage(barbershopId, clientPhone,
          '⏸️ *No hay barberos trabajando en este momento*\n\n' +
          'Los barberos deben iniciar su jornada laboral para estar disponibles.\n\n' +
          'Por favor intenta más tarde o escribe *menu* para volver al inicio.');
        return;
      }

      // Mostrar barberos disponibles ahora con opción de reserva
      let message = '👨‍💼 *Barberos trabajando AHORA:*\n\n';

      for (let i = 0; i < availableBarbers.length; i++) {
        const barber = availableBarbers[i];
        const letter = String.fromCharCode(65 + i); // A, B, C, D, etc.

        // Obtener cantidad de turnos pendientes
        const [queueCount] = await pool.execute(`
          SELECT COUNT(*) as count FROM appointments
          WHERE barber_id = ? AND appointment_date = ? AND status = 'waiting'
        `, [barber.id, today]);

        // Calcular tiempo estimado de atención
        const waitingClients = queueCount[0].count;
        const estimatedWait = waitingClients * barber.service_duration_minutes;
        const now = new Date();
        const estimatedTime = new Date(now.getTime() + estimatedWait * 60000);
        const formattedTime = `${estimatedTime.getHours().toString().padStart(2,'0')}:${estimatedTime.getMinutes().toString().padStart(2,'0')}`;

        message += `*${letter}) ${barber.name}* ✅\n`;
        message += `👥 ${waitingClients} personas en cola\n`;
        if (waitingClients === 0) {
          message += `🎯 *¡Disponible ahora! Sin espera*\n`;
        } else {
          message += `⏰ Tiempo espera: ~${estimatedWait} min\n`;
          message += `🕐 Te atendería: ~${formattedTime}\n`;
        }
        message += `Para reservar: escribe *${letter}*\n\n`;
      }

      message += 'También puedes escribir *1* para ver más detalles o *menu* para volver al inicio.';
      await this.sendMessage(barbershopId, clientPhone, message);

    } catch (error) {
      console.error('Error enviando barberos:', error);
      await this.sendMessage(barbershopId, clientPhone, 'Error obteniendo información. Escribe *menu* para intentar de nuevo.');
    }
  }

  async handleAppointmentBookingByLetter(barbershopId, clientPhone, letter) {
    try {
      // Obtener barberos que están trabajando ahora
      const availableBarbers = await this.getActiveWorkingBarbers(barbershopId);

      if (availableBarbers.length === 0) {
        await this.sendMessage(barbershopId, clientPhone,
          '⏸️ *No hay barberos trabajando en este momento*\n\nEscribe *1* para ver opciones o *menu* para volver al inicio.');
        return;
      }

      // Convertir letra a índice (A=0, B=1, C=2, etc.) usando solo barberos disponibles
      const letterIndex = letter.charCodeAt(0) - 65;

      if (letterIndex < 0 || letterIndex >= availableBarbers.length) {
        const wasBlocked = this.incrementUserError(clientPhone);

        if (wasBlocked) {
          const blockMinutes = this.blockDurationMinutes;
          await this.sendMessage(barbershopId, clientPhone,
            `⚠️ *Temporalmente sin respuesta*\n\n` +
            `Has enviado demasiados mensajes incorrectos. El sistema no responderá durante ${blockMinutes} minutos.\n\n` +
            `Intenta nuevamente más tarde escribiendo *menu*.`
          );
        } else {
          const errorCount = this.userErrors.get(clientPhone)?.count || 0;
          const remaining = this.maxErrors - errorCount;
          await this.sendMessage(barbershopId, clientPhone,
            `❌ Letra no válida.\n\n` +
            `Escribe *1* para ver barberos disponibles o *menu* para volver al inicio.\n\n` +
            `_Avisos restantes antes del bloqueo temporal: ${remaining}_`
          );
        }
        return;
      }

      const selectedBarber = availableBarbers[letterIndex];
      this.resetUserErrors(clientPhone); // Resetear errores en selección válida
      await this.handleAppointmentBooking(barbershopId, clientPhone, selectedBarber.id.toString());

    } catch (error) {
      console.error('Error procesando selección por letra:', error);
      await this.sendMessage(barbershopId, clientPhone, 'Error procesando tu selección. Escribe *menu* para intentar de nuevo.');
    }
  }

  async handleAppointmentBooking(barbershopId, clientPhone, messageText) {
    try {
      const barberId = messageText; // Ahora messageText ya es solo el número
      const pool = getPool();
      const today = new Date().toISOString().split('T')[0];

      const [barberRows] = await pool.execute(`
        SELECT b.id, b.name, b.service_duration_minutes, bs.is_suspended
        FROM barbers b 
        JOIN barbershops bs ON b.barbershop_id = bs.id
        WHERE b.id = ? AND b.barbershop_id = ? AND b.is_active = TRUE AND bs.is_active = TRUE
      `, [barberId, barbershopId]);

      if (barberRows.length === 0 || barberRows[0].is_suspended) {
        const wasBlocked = this.incrementUserError(clientPhone);
        
        if (wasBlocked) {
          const blockMinutes = this.blockDurationMinutes;
          await this.sendMessage(barbershopId, clientPhone, 
            `⚠️ *Temporalmente sin respuesta*\n\n` +
            `Has enviado demasiados mensajes incorrectos. El sistema no responderá durante ${blockMinutes} minutos.\n\n` +
            `Intenta nuevamente más tarde escribiendo *menu*.`
          );
        } else {
          const errorCount = this.userErrors.get(clientPhone)?.count || 0;
          const remaining = this.maxErrors - errorCount;
          await this.sendMessage(barbershopId, clientPhone, 
            `❌ Barbero no disponible.\n\n` +
            `Escribe *1* para ver barberos disponibles o *menu* para volver al inicio.\n\n` +
            `_Avisos restantes antes del bloqueo temporal: ${remaining}_`
          );
        }
        return;
      }

      const [existingAppointment] = await pool.execute(`
        SELECT id, status FROM appointments
        WHERE barbershop_id = ? AND client_phone = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
      `, [barbershopId, clientPhone, today]);

      if (existingAppointment.length > 0) {
        const status = existingAppointment[0].status === 'in_progress' ? 'siendo atendido' : 'en espera';
        await this.sendMessage(barbershopId, clientPhone,
          `⚠️ Ya tienes un turno *${status}* para hoy.\n\n` +
          `*2* - 🔍 Consultar mi turno\n` +
          `*5* - ❌ Cancelar mi turno\n` +
          `*menu* - 🏠 Volver al inicio`);
        return;
      }

      // Verificar si el barbero tiene una sesión activa
      const [workSession] = await pool.execute(`
        SELECT id, start_time FROM work_sessions
        WHERE barber_id = ? AND work_date = ? AND is_active = TRUE
      `, [barberId, today]);

      if (workSession.length === 0) {
        await this.sendMessage(barbershopId, clientPhone,
          `⏸️ *El barbero no está trabajando en este momento*\n\n` +
          `El barbero *${barberRows[0].name}* debe iniciar su jornada laboral para recibir turnos.\n\n` +
          `*1* - 📅 Ver otros barberos disponibles\n` +
          `*menu* - 🏠 Volver al inicio`);
        return;
      }

      // Estrategia simplificada para WhatsApp: insertar y renumerar
      const serviceDuration = barberRows[0].service_duration_minutes;
      const now = new Date();
      
      // Insertar con número temporal alto
      const [result] = await pool.execute(`
        INSERT INTO appointments (barbershop_id, barber_id, client_name, client_phone, appointment_date, queue_number, estimated_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [barbershopId, barberId, 'Cliente WhatsApp', clientPhone, today, 9999, '23:59:00']);
      
      // Renumerar cola completa
      await pool.execute('SET @row_number = 0');
      await pool.execute(`
        UPDATE appointments 
        SET queue_number = (@row_number := @row_number + 1)
        WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
        ORDER BY CASE WHEN id = ? THEN 999999 ELSE created_at END
      `, [barberId, today, result.insertId]);
      
      // Obtener número asignado
      const [updatedAppointment] = await pool.execute(`
        SELECT queue_number FROM appointments WHERE id = ?
      `, [result.insertId]);
      
      const nextQueueNumber = updatedAppointment[0].queue_number;

      // Calcular tiempo estimado basado en la hora actual
      const currentTimeForEstimate = now.getHours() * 60 + now.getMinutes(); // minutos desde medianoche
      const estimatedMinutes = (nextQueueNumber - 1) * serviceDuration;
      const totalMinutes = currentTimeForEstimate + estimatedMinutes;

      const estimatedHours = Math.floor(totalMinutes / 60);
      const estimatedMins = totalMinutes % 60;
      const estimatedTimeString = `${estimatedHours.toString().padStart(2, '0')}:${estimatedMins.toString().padStart(2, '0')}`;
      
      // Actualizar tiempo estimado
      await pool.execute(`
        UPDATE appointments SET estimated_time = ? WHERE id = ?
      `, [estimatedTimeString, result.insertId]);

      const waitTime = (nextQueueNumber - 1) * serviceDuration;

      let confirmMessage = `✅ *Turno reservado exitosamente*\n\n`;
      confirmMessage += `👨‍💼 Barbero: *${barberRows[0].name}*\n`;
      confirmMessage += `📍 Tu posición en la cola: *${nextQueueNumber}*\n`;
      if (waitTime === 0) {
        confirmMessage += `🎯 *¡Eres el siguiente!* - Sin espera\n`;
      } else {
        confirmMessage += `⏱️ Tiempo estimado de espera: *${waitTime} minutos*\n`;
      }
      confirmMessage += `🕐 Hora aproximada de atención: *${estimatedTimeString}*\n`;
      confirmMessage += `📅 Fecha: ${today}\n\n`;
      confirmMessage += `*Importante:*\n`;
      confirmMessage += `• Mantente cerca del local\n`;
      confirmMessage += `• Recibirás notificaciones de avances\n`;
      confirmMessage += `• Escribe *estado* para consultar la cola\n\n`;
      confirmMessage += `*2* - 🔍 Consultar mi turno\n`;
      confirmMessage += `*5* - ❌ Cancelar mi turno\n`;
      confirmMessage += `*menu* - 🏠 Volver al inicio`;

      await this.sendMessage(barbershopId, clientPhone, confirmMessage);
      this.resetUserErrors(clientPhone); // Resetear errores en reserva exitosa

      const io = global.io;
      if (io) {
        io.to(`barber_${barberId}`).emit('new_appointment', {
          id: result.insertId,
          queue_number: nextQueueNumber,
          client_name: 'Cliente WhatsApp',
          client_phone: clientPhone,
          appointment_date: today,
          estimated_time: estimatedTimeString,
          status: 'waiting'
        });
      }

    } catch (error) {
      console.error('Error reservando turno:', error);
      
      // Manejo específico de errores para WhatsApp
      let errorMessage = 'Error reservando el turno. Escribe *menu* para intentar de nuevo.';
      
      if (error.code === 'ER_DUP_ENTRY') {
        errorMessage = '⚠️ Ya existe un turno en esa posición. La cola se actualizó, intenta reservar de nuevo.\n\nEscribe *1* para ver barberos disponibles.';
      } else if (error.message && error.message.includes('connection')) {
        errorMessage = '🔄 Problema temporal de conexión. Espera un momento e intenta de nuevo.\n\nEscribe *menu* cuando estés listo.';
      } else if (error.message && error.message.includes('duplicate')) {
        errorMessage = '⚠️ Ya tienes un turno activo para hoy.\n\nEscribe *2* para consultar tu turno o *5* para cancelarlo.';
      } else if (!this.isClientReady(barbershopId)) {
        errorMessage = '📱 Sistema WhatsApp desconectado. Se está reconectando...\n\nIntenta en unos minutos o contáctanos directamente.';
      }
      
      await this.sendMessage(barbershopId, clientPhone, errorMessage);
      
      // Registrar error detallado en logs
      console.error('Detalles del error de reserva WhatsApp:', {
        barbershopId,
        clientPhone: clientPhone.substring(0, 4) + '****', // Proteger privacidad
        errorCode: error.code,
        errorMessage: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  async sendCurrentQueue(barbershopId, clientPhone) {
    try {
      const pool = getPool();
      const today = new Date().toISOString().split('T')[0];
      
      const [appointments] = await pool.execute(`
        SELECT a.queue_number, a.status, b.name as barber_name, b.service_duration_minutes,
               COUNT(*) OVER (PARTITION BY a.barber_id) as total_queue
        FROM appointments a
        JOIN barbers b ON a.barber_id = b.id
        WHERE a.barbershop_id = ? AND a.appointment_date = ? 
        AND a.status IN ('waiting', 'in_progress')
        ORDER BY b.name, a.queue_number
      `, [barbershopId, today]);

      if (appointments.length === 0) {
        await this.sendMessage(barbershopId, clientPhone, 
          '✅ No hay cola en este momento. ¡Perfecto para reservar!\n\nEscribe *1* para reservar turno o *menu* para volver al inicio.');
        return;
      }

      const barberQueues = {};
      appointments.forEach(apt => {
        if (!barberQueues[apt.barber_name]) {
          barberQueues[apt.barber_name] = {
            waiting: 0,
            in_progress: 0,
            service_duration: apt.service_duration_minutes
          };
        }
        if (apt.status === 'waiting') barberQueues[apt.barber_name].waiting++;
        if (apt.status === 'in_progress') barberQueues[apt.barber_name].in_progress++;
      });

      let message = '📊 *Estado actual de las colas:*\n\n';
      
      for (let [barberName, queue] of Object.entries(barberQueues)) {
        message += `👨‍💼 *${barberName}*\n`;
        message += `👥 En espera: ${queue.waiting}\n`;
        if (queue.in_progress > 0) {
          message += `🔄 Atendiendo: ${queue.in_progress}\n`;
        }
        if (queue.waiting > 0) {
          const waitTime = queue.waiting * queue.service_duration;
          message += `⏱️ Tiempo de espera aprox: ${waitTime} min\n`;
        }
        message += '\n';
      }

      message += 'Escribe *1* para reservar turno o *menu* para volver al inicio.';
      await this.sendMessage(barbershopId, clientPhone, message);

    } catch (error) {
      console.error('Error consultando estado de colas:', error);
      await this.sendMessage(barbershopId, clientPhone, 'Error consultando estado. Escribe *menu* para intentar de nuevo.');
    }
  }

  async sendCancelAppointmentMenu(barbershopId, clientPhone) {
    try {
      const pool = getPool();
      const today = new Date().toISOString().split('T')[0];
      
      // Buscar turno activo del cliente
      const [appointments] = await pool.execute(`
        SELECT a.id, a.queue_number, a.status, a.estimated_time,
               b.name as barber_name
        FROM appointments a
        JOIN barbers b ON a.barber_id = b.id
        WHERE a.barbershop_id = ? AND a.client_phone = ? AND a.appointment_date = ? 
        AND a.status IN ('waiting', 'in_progress')
        ORDER BY a.created_at DESC
        LIMIT 1
      `, [barbershopId, clientPhone, today]);

      if (appointments.length === 0) {
        await this.sendMessage(barbershopId, clientPhone, 
          '❌ *No tienes turnos activos para cancelar hoy*\n\n' +
          'Escribe *1* para reservar un turno o *menu* para volver al inicio.');
        return;
      }

      const appointment = appointments[0];
      
      if (appointment.status === 'in_progress') {
        await this.sendMessage(barbershopId, clientPhone, 
          '⚠️ *Tu turno está siendo atendido ahora*\n\n' +
          'No puedes cancelar un turno que ya está en progreso. ' +
          'Si necesitas irte, habla directamente con el barbero.\n\n' +
          'Escribe *menu* para volver al inicio.');
        return;
      }

      let message = `⚠️ *¿Seguro que quieres cancelar tu turno?*\n\n`;
      message += `👨‍💼 Barbero: *${appointment.barber_name}*\n`;
      message += `📍 Tu posición: *${appointment.queue_number}*\n`;
      message += `🕐 Hora estimada: *${appointment.estimated_time}*\n\n`;
      message += `*¡IMPORTANTE!* Una vez cancelado no podrás recuperar tu lugar en la cola.\n\n`;
      message += `*si* - ❌ Sí, cancelar mi turno\n`;
      message += `*no* - ✅ No, mantener mi turno\n\n`;
      message += `Escribe *menu* para volver al inicio.`;

      await this.sendMessage(barbershopId, clientPhone, message);

    } catch (error) {
      console.error('Error enviando menú de cancelación:', error);
      await this.sendMessage(barbershopId, clientPhone, 'Error accediendo a tu turno. Escribe *menu* para intentar de nuevo.');
    }
  }

  async processCancelAppointment(barbershopId, clientPhone) {
    try {
      const pool = getPool();
      const today = new Date().toISOString().split('T')[0];
      
      // Buscar y cancelar el turno
      const [appointments] = await pool.execute(`
        SELECT a.id, a.barber_id, a.queue_number, a.appointment_date, a.client_name,
               b.name as barber_name
        FROM appointments a
        JOIN barbers b ON a.barber_id = b.id
        WHERE a.barbershop_id = ? AND a.client_phone = ? AND a.appointment_date = ? 
        AND a.status = 'waiting'
        ORDER BY a.created_at DESC
        LIMIT 1
      `, [barbershopId, clientPhone, today]);

      if (appointments.length === 0) {
        await this.sendMessage(barbershopId, clientPhone, 
          '❌ *No se encontró tu turno activo*\n\n' +
          'Es posible que ya haya sido cancelado o esté siendo atendido.\n\n' +
          'Escribe *2* para consultar tu estado o *menu* para volver al inicio.');
        return;
      }

      const appointment = appointments[0];
      
      // Marcar como cancelado
      await pool.execute('UPDATE appointments SET status = "cancelled" WHERE id = ?', [appointment.id]);

      // Reordenar cola - bajar números de turnos posteriores
      await pool.execute(`
        UPDATE appointments 
        SET queue_number = queue_number - 1 
        WHERE barber_id = ? AND appointment_date = ? AND queue_number > ? AND status != 'cancelled'
      `, [appointment.barber_id, appointment.appointment_date, appointment.queue_number]);

      // Enviar confirmación
      let confirmMessage = `✅ *Turno cancelado exitosamente*\n\n`;
      confirmMessage += `👨‍💼 Barbero: *${appointment.barber_name}*\n`;
      confirmMessage += `📅 Fecha: ${today}\n\n`;
      confirmMessage += `Tu turno ha sido liberado y la cola se ha reorganizado.\n\n`;
      confirmMessage += `Escribe *1* si quieres reservar otro turno o *menu* para volver al inicio.`;

      await this.sendMessage(barbershopId, clientPhone, confirmMessage);

      // Emitir eventos WebSocket para actualizar interfaces
      if (global.io) {
        global.io.to(`barber_${appointment.barber_id}`).emit('appointment_cancelled', {
          id: appointment.id,
          client_name: appointment.client_name || 'Cliente WhatsApp'
        });
        global.io.to(`barbershop_${barbershopId}`).emit('appointment_cancelled', {
          id: appointment.id,
          barber_id: appointment.barber_id,
          client_name: appointment.client_name || 'Cliente WhatsApp'
        });

        // Obtener cola actualizada
        const [updatedQueue] = await pool.execute(`
          SELECT a.id, a.queue_number, a.client_name, a.client_phone, a.estimated_time, b.service_duration_minutes
          FROM appointments a
          JOIN barbers b ON a.barber_id = b.id
          WHERE a.barber_id = ? AND a.appointment_date = ? AND a.status = 'waiting'
          ORDER BY a.queue_number
        `, [appointment.barber_id, appointment.appointment_date]);
        
        global.io.emit('queue_reordered', {
          barber_id: appointment.barber_id,
          appointment_date: appointment.appointment_date,
          updated_queue: updatedQueue
        });

        // Notificar a otros clientes que avanzaron en la cola
        try {
          const appointmentsRouter = require('../routes/appointments');
          await appointmentsRouter.notifyQueueReorder(barbershopId, appointment.barber_id, appointment.appointment_date, updatedQueue);
        } catch (error) {
          console.error('Error notificando reordenamiento después de cancelación WhatsApp:', error);
        }
      }

      console.log(`Turno cancelado via WhatsApp: Cliente ${clientPhone}, Barbería ${barbershopId}, Turno ${appointment.id}`);

    } catch (error) {
      console.error('Error procesando cancelación de turno:', error);
      await this.sendMessage(barbershopId, clientPhone, 'Error cancelando el turno. Escribe *menu* para intentar de nuevo.');
    }
  }

  async sendHelpMessage(barbershopId, clientPhone) {
    const helpMessage = `🆘 *Ayuda - Cómo usar este chatbot*\n\n` +
      `*Comandos principales:*\n` +
      `*menu* - Ver menú principal\n` +
      `*1* o *turnos* - Reservar turno\n` +
      `*2* o *consultar* - Ver mi turno\n` +
      `*3* o *barberos* - Ver barberos\n` +
      `*4* o *estado* - Ver estado de colas\n` +
      `*5* o *cancelar* - Cancelar mi turno\n\n` +
      `*Comandos rápidos:*\n` +
      `*A, B, C...* - Reservar con barbero específico\n` +
      `*ayuda* - Ver esta ayuda\n` +
      `*contacto* - Información de contacto\n\n` +
      `*Proceso de reserva:*\n` +
      `1. Escribe *1* para ver barberos disponibles\n` +
      `2. Escribe la letra del barbero (A, B, C...)\n` +
      `3. Confirma tu reserva\n\n` +
      `*Notificaciones automáticas:*\n` +
      `• Recibirás avisos cuando avance la cola\n` +
      `• Te notificaremos cuando seas el siguiente\n` +
      `• Puedes consultar tu estado en cualquier momento\n\n` +
      `Escribe *menu* para volver al inicio.`;

    await this.sendMessage(barbershopId, clientPhone, helpMessage);
  }

  async sendContactInfo(barbershopId, clientPhone) {
    try {
      const pool = getPool();
      const [barbershopInfo] = await pool.execute(`
        SELECT name, address, phone, email, 
               COALESCE(opening_hours, 'Consultar horarios') as hours
        FROM barbershops 
        WHERE id = ? AND is_active = TRUE
      `, [barbershopId]);

      if (barbershopInfo.length === 0) {
        await this.sendMessage(barbershopId, clientPhone, 
          'Error obteniendo información de contacto. Escribe *menu* para volver al inicio.');
        return;
      }

      const info = barbershopInfo[0];
      let contactMessage = `📞 *Información de Contacto*\n\n`;
      contactMessage += `🏪 *${info.name}*\n\n`;
      
      if (info.address) {
        contactMessage += `📍 *Dirección:*\n${info.address}\n\n`;
      }
      
      if (info.phone) {
        contactMessage += `📞 *Teléfono:* ${info.phone}\n`;
      }
      
      if (info.email) {
        contactMessage += `📧 *Email:* ${info.email}\n`;
      }
      
      contactMessage += `\n🕒 *Horarios:* ${info.hours}\n\n`;
      contactMessage += `*Este chatbot te permite:*\n`;
      contactMessage += `• Reservar turnos 24/7\n`;
      contactMessage += `• Consultar el estado de la cola\n`;
      contactMessage += `• Recibir notificaciones automáticas\n\n`;
      contactMessage += `Escribe *menu* para volver al inicio.`;

      await this.sendMessage(barbershopId, clientPhone, contactMessage);

    } catch (error) {
      console.error('Error enviando información de contacto:', error);
      await this.sendMessage(barbershopId, clientPhone, 'Error obteniendo información. Escribe *menu* para intentar de nuevo.');
    }
  }

  async sendMessage(barbershopId, clientPhone, message) {
    try {
      const client = this.clients.get(barbershopId);
      if (!client || !client.info) {
        console.error(`Cliente WhatsApp no encontrado o no conectado para barbería ${barbershopId}`);
        
        // Intentar reconectar automáticamente
        try {
          console.log(`Intentando reconectar WhatsApp para enviar mensaje a ${clientPhone}...`);
          await this.initializeClient(parseInt(barbershopId));
          
          // Esperar un momento para que se establezca la conexión
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const reconnectedClient = this.clients.get(barbershopId);
          if (reconnectedClient && reconnectedClient.info) {
            const chatId = `${clientPhone}@c.us`;
            await reconnectedClient.sendMessage(chatId, message);
            console.log(`Mensaje enviado a ${clientPhone} después de reconexión`);
            return true;
          }
        } catch (reconnectError) {
          console.error('Error intentando reconectar para enviar mensaje:', reconnectError);
        }
        
        return false;
      }

      const chatId = `${clientPhone}@c.us`;
      await client.sendMessage(chatId, message);
      console.log(`Mensaje enviado a ${clientPhone} desde barbería ${barbershopId}`);
      return true;
      
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      
      // Si hay error de conexión, programar reconexión
      if (error.message.includes('not connected') || error.message.includes('PHONE_DISCONNECTED')) {
        console.log(`Error de conexión detectado, programando reconexión para barbería ${barbershopId}`);
        this.scheduleReconnect(barbershopId, 'CONNECTION_ERROR');
      }
      
      return false;
    }
  }

  async sendBulkMessage(barbershopId, phoneNumbers, message) {
    const results = [];
    const client = this.clients.get(barbershopId);
    
    if (!client || !client.info) {
      console.error(`Cliente WhatsApp no encontrado para barbería ${barbershopId}`);
      return results;
    }

    for (let phone of phoneNumbers) {
      try {
        const chatId = `${phone}@c.us`;
        await client.sendMessage(chatId, message);
        results.push({ phone, status: 'sent' });
        console.log(`Mensaje masivo enviado a ${phone}`);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error enviando mensaje a ${phone}:`, error);
        results.push({ phone, status: 'failed', error: error.message });
      }
    }

    return results;
  }

  getCurrentDayName() {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[new Date().getDay()];
  }

  // Nueva función para obtener barberos con sesión activa
  async getActiveWorkingBarbers(barbershopId) {
    const pool = getPool();
    const today = new Date().toISOString().split('T')[0];

    const [workingBarbers] = await pool.execute(`
      SELECT b.id, b.name, b.service_duration_minutes,
             ws.start_time, ws.is_active
      FROM barbers b
      JOIN work_sessions ws ON b.id = ws.barber_id
      WHERE b.barbershop_id = ?
        AND b.is_active = TRUE
        AND ws.work_date = ?
        AND ws.is_active = TRUE
      ORDER BY b.name
    `, [barbershopId, today]);

    return workingBarbers;
  }

  getQRCode(barbershopId) {
    return this.qrCodes.get(barbershopId);
  }

  isClientReady(barbershopId) {
    const client = this.clients.get(barbershopId);
    return client && client.info;
  }

  hasClient(barbershopId) {
    return this.clients.has(barbershopId);
  }

  async disconnectClient(barbershopId) {
    const client = this.clients.get(barbershopId);
    if (client) {
      await client.destroy();
      this.clients.delete(barbershopId);
      this.qrCodes.delete(barbershopId);
      console.log(`Cliente WhatsApp desconectado para barbería ${barbershopId}`);
    }
  }

  getAllConnectedClients() {
    const connected = [];
    for (let [barbershopId, client] of this.clients.entries()) {
      connected.push({
        barbershop_id: barbershopId,
        is_ready: client && client.info,
        phone: client && client.info ? client.info.wid.user : null,
        reconnect_attempts: this.reconnectAttempts.get(barbershopId) || 0
      });
    }
    return connected;
  }

  scheduleReconnect(barbershopId, reason) {
    // No reconectar si fue desconexión intencional por logout
    if (reason === 'LOGOUT' || reason === 'UNPAIRED') {
      console.log(`No se reconectará WhatsApp para barbería ${barbershopId} - desconexión intencional:`, reason);
      return;
    }

    // No reconectar si se desconectó muy pronto después de autenticación (posible problema de inicialización)
    if (reason === 'NAVIGATION') {
      console.log(`Desconexión por navegación detectada para barbería ${barbershopId} - esperando antes de reconectar`);
      // Esperar más tiempo antes de reconectar en caso de problemas de navegación
    }

    const attempts = this.reconnectAttempts.get(barbershopId) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      console.log(`Máximo número de intentos de reconexión alcanzado para barbería ${barbershopId}`);
      this.reconnectAttempts.delete(barbershopId);
      
      const io = global.io;
      if (io) {
        io.to(`barbershop_${barbershopId}`).emit('whatsapp_reconnect_failed', {
          status: 'max_attempts_reached',
          attempts: attempts
        });
      }
      return;
    }

    const delay = Math.min(this.reconnectDelay * Math.pow(2, attempts), this.maxReconnectDelay);
    
    console.log(`Programando reconexión WhatsApp para barbería ${barbershopId} en ${delay/1000} segundos (intento ${attempts + 1}/${this.maxReconnectAttempts})`);
    
    // Limpiar timeout anterior si existe
    if (this.reconnectTimeouts.has(barbershopId)) {
      clearTimeout(this.reconnectTimeouts.get(barbershopId));
    }

    const timeout = setTimeout(() => {
      this.attemptReconnect(barbershopId);
    }, delay);

    this.reconnectTimeouts.set(barbershopId, timeout);
  }

  async attemptReconnect(barbershopId) {
    try {
      console.log(`Intentando reconectar WhatsApp para barbería ${barbershopId}...`);
      
      const attempts = (this.reconnectAttempts.get(barbershopId) || 0) + 1;
      this.reconnectAttempts.set(barbershopId, attempts);
      
      const io = global.io;
      if (io) {
        io.to(`barbershop_${barbershopId}`).emit('whatsapp_reconnecting', {
          status: 'attempting_reconnect',
          attempt: attempts,
          max_attempts: this.maxReconnectAttempts
        });
      }

      await this.initializeClient(barbershopId);
      
      // Resetear contador de intentos si se conecta exitosamente
      setTimeout(async () => {
        if (this.isClientReady(barbershopId)) {
          console.log(`WhatsApp reconectado exitosamente para barbería ${barbershopId}`);
          this.reconnectAttempts.delete(barbershopId);
          this.reconnectTimeouts.delete(barbershopId);
          
          if (io) {
            io.to(`barbershop_${barbershopId}`).emit('whatsapp_reconnected', {
              status: 'reconnected',
              attempts: attempts
            });
          }

          // Procesar notificaciones pendientes después de reconectar
          try {
            const appointmentsRouter = require('../routes/appointments');
            await appointmentsRouter.processPendingNotifications(barbershopId);
          } catch (error) {
            console.error('Error procesando notificaciones pendientes después de reconectar:', error);
          }
        }
      }, 5000); // Dar tiempo para que se complete la conexión

    } catch (error) {
      console.error(`Error en intento de reconexión para barbería ${barbershopId}:`, error);
      
      // Programar siguiente intento si no se alcanzó el máximo
      const attempts = this.reconnectAttempts.get(barbershopId) || 0;
      if (attempts < this.maxReconnectAttempts) {
        this.scheduleReconnect(barbershopId, 'RECONNECT_FAILED');
      }
    }
  }

  cancelReconnect(barbershopId) {
    if (this.reconnectTimeouts.has(barbershopId)) {
      clearTimeout(this.reconnectTimeouts.get(barbershopId));
      this.reconnectTimeouts.delete(barbershopId);
    }
    this.reconnectAttempts.delete(barbershopId);
    console.log(`Reconexión cancelada para barbería ${barbershopId}`);
  }

  // Método para verificar y reconectar clientes inactivos
  async checkAndReconnectInactiveClients() {
    for (let [barbershopId, client] of this.clients.entries()) {
      if (!client.info) {
        console.log(`Detectado cliente inactivo para barbería ${barbershopId}, iniciando reconexión...`);
        this.scheduleReconnect(barbershopId, 'CLIENT_INACTIVE');
      }
    }
  }

  // Inicializar verificación periódica de clientes
  startPeriodicHealthCheck() {
    setInterval(() => {
      this.checkAndReconnectInactiveClients();
    }, 60000); // Verificar cada minuto
  }

  // Reconectar automáticamente todas las barberías activas al iniciar el servidor
  async autoReconnectAllBarbershops() {
    try {
      console.log('🔄 Iniciando reconexión automática de WhatsApp...');
      const { getPool } = require('../database/connection');
      const pool = getPool();
      
      const [barbershops] = await pool.execute(
        'SELECT id, name FROM barbershops WHERE is_active = TRUE AND is_suspended = FALSE'
      );
      
      console.log(`📱 Encontradas ${barbershops.length} barberías activas para reconectar`);
      
      if (barbershops.length === 0) {
        console.log('❌ No hay barberías activas para reconectar');
        return;
      }
      
      // Reconectar con delay entre conexiones para no sobrecargar el sistema
      for (let i = 0; i < barbershops.length; i++) {
        const barbershop = barbershops[i];
        
        console.log(`🔌 Intentando reconectar WhatsApp para ${barbershop.name} (ID: ${barbershop.id})`);
        
        try {
          // Solo intentar inicializar si no existe ya un cliente activo
          if (!this.isClientReady(barbershop.id)) {
            await this.initializeClient(parseInt(barbershop.id));
            console.log(`✅ WhatsApp inicializado para ${barbershop.name}`);
          } else {
            console.log(`ℹ️  WhatsApp ya conectado para ${barbershop.name}`);
          }
        } catch (error) {
          console.error(`❌ Error conectando WhatsApp para ${barbershop.name}:`, error.message);
          
          // Programar reintento más tarde para casos específicos
          if (error.message.includes('AppState') || error.message.includes('Evaluation failed')) {
            console.log(`🔄 Programando reintento para ${barbershop.name} en 5 minutos debido a error de compatibilidad`);
            setTimeout(async () => {
              try {
                await this.initializeClient(parseInt(barbershop.id));
                console.log(`✅ WhatsApp conectado en reintento para ${barbershop.name}`);
              } catch (retryError) {
                console.error(`❌ Reintento fallido para ${barbershop.name}:`, retryError.message);
              }
            }, 300000); // 5 minutos
          }
        }
        
        // Delay de 5 segundos entre conexiones para evitar sobrecarga
        if (i < barbershops.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      console.log('🎉 Proceso de reconexión automática completado');
      
    } catch (error) {
      console.error('❌ Error en reconexión automática de WhatsApp:', error);
    }
  }
}

const whatsappService = new WhatsAppService();

// Iniciar verificación periódica
setTimeout(() => {
  whatsappService.startPeriodicHealthCheck();
}, 30000); // Esperar 30 segundos antes de iniciar las verificaciones

// Iniciar reconexión automática después del arranque del servidor
setTimeout(() => {
  whatsappService.autoReconnectAllBarbershops();
}, 60000); // Esperar 60 segundos para que el servidor esté completamente cargado

module.exports = whatsappService;