const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, checkBarbershopAccess } = require('../middleware/auth');
const whatsappService = require('../services/whatsappService');
const { getPool } = require('../database/connection');

const router = express.Router();

router.post('/init/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;

    // Verificar si ya está conectado con información completa
    if (whatsappService.isClientReady(barbershopId)) {
      const connectedClients = whatsappService.getAllConnectedClients();
      const clientInfo = connectedClients.find(c => c.barbershop_id == barbershopId);
      return res.json({
        status: 'already_connected',
        phone: clientInfo?.phone || 'Conectado',
        message: 'WhatsApp ya está conectado'
      });
    }

    // Verificar si hay un cliente en proceso pero no listo
    const hasClient = whatsappService.hasClient(barbershopId);
    if (hasClient) {
      const qrCode = whatsappService.getQRCode(barbershopId);
      if (qrCode) {
        return res.json({
          status: 'qr_available',
          qr_code: qrCode,
          message: 'Escanea el código QR para conectar WhatsApp'
        });
      }

      return res.json({
        status: 'initializing',
        message: 'WhatsApp inicializándose. El código QR aparecerá pronto.'
      });
    }

    // Solo inicializar si no hay cliente existente
    await whatsappService.initializeClient(parseInt(barbershopId));

    res.json({
      status: 'initializing',
      message: 'Inicializando WhatsApp. El código QR aparecerá automáticamente cuando esté listo.'
    });

  } catch (error) {
    console.error('Error inicializando WhatsApp:', error);
    res.status(500).json({ error: 'Error inicializando WhatsApp' });
  }
});

router.get('/status/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const barbershopIdNum = parseInt(barbershopId); // Convertir a número

    const isReady = whatsappService.isClientReady(barbershopIdNum);
    const qrCode = whatsappService.getQRCode(barbershopIdNum);

    let status = 'disconnected';
    let data = {};

    if (isReady) {
      status = 'connected';
      const connectedClients = whatsappService.getAllConnectedClients();
      const clientInfo = connectedClients.find(c => c.barbershop_id == barbershopIdNum);
      if (clientInfo) {
        data.phone = clientInfo.phone;
      }
    } else if (qrCode) {
      status = 'waiting_qr';
      data.qr_code = qrCode;
    }

    res.json({
      status,
      ...data
    });

  } catch (error) {
    console.error('Error obteniendo estado de WhatsApp:', error);
    res.status(500).json({ error: 'Error obteniendo estado' });
  }
});

router.post('/disconnect/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    
    await whatsappService.disconnectClient(parseInt(barbershopId));
    
    res.json({ 
      status: 'disconnected',
      message: 'WhatsApp desconectado exitosamente' 
    });

  } catch (error) {
    console.error('Error desconectando WhatsApp:', error);
    res.status(500).json({ error: 'Error desconectando WhatsApp' });
  }
});

router.post('/send-message/:barbershopId', 
  authenticateToken(), 
  checkBarbershopAccess,
  [
    body('phone').isMobilePhone('any').withMessage('Número de teléfono inválido'),
    body('message').notEmpty().withMessage('Mensaje requerido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { barbershopId } = req.params;
      const { phone, message } = req.body;

      if (!whatsappService.isClientReady(barbershopId)) {
        return res.status(400).json({ 
          error: 'WhatsApp no está conectado. Inicializa la conexión primero.' 
        });
      }

      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const success = await whatsappService.sendMessage(parseInt(barbershopId), cleanPhone, message);

      if (success) {
        const pool = getPool();
        await pool.execute(`
          INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
          VALUES (?, ?, ?, 'manual', 'sent')
        `, [barbershopId, cleanPhone, message]);

        res.json({ 
          status: 'sent',
          message: 'Mensaje enviado exitosamente' 
        });
      } else {
        res.status(500).json({ error: 'Error enviando mensaje' });
      }

    } catch (error) {
      console.error('Error enviando mensaje:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.post('/send-bulk-message/:barbershopId', 
  authenticateToken(), 
  checkBarbershopAccess,
  [
    body('phones').isArray({ min: 1 }).withMessage('Lista de teléfonos requerida'),
    body('phones.*').isMobilePhone('any').withMessage('Número de teléfono inválido'),
    body('message').notEmpty().withMessage('Mensaje requerido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { barbershopId } = req.params;
      const { phones, message } = req.body;

      if (!whatsappService.isClientReady(barbershopId)) {
        return res.status(400).json({ 
          error: 'WhatsApp no está conectado. Inicializa la conexión primero.' 
        });
      }

      const cleanPhones = phones.map(phone => phone.replace(/[^0-9]/g, ''));
      const results = await whatsappService.sendBulkMessage(parseInt(barbershopId), cleanPhones, message);

      const pool = getPool();
      for (let result of results) {
        await pool.execute(`
          INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
          VALUES (?, ?, ?, 'bulk', ?)
        `, [barbershopId, result.phone, message, result.status]);
      }

      const successCount = results.filter(r => r.status === 'sent').length;
      const failCount = results.filter(r => r.status === 'failed').length;

      res.json({ 
        status: 'completed',
        total_sent: successCount,
        total_failed: failCount,
        results,
        message: `Mensajes enviados: ${successCount}, Fallidos: ${failCount}`
      });

    } catch (error) {
      console.error('Error enviando mensajes masivos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.get('/messages/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const { limit = 50, offset = 0, type } = req.query;
    const pool = getPool();

    // Validar y convertir limit y offset a números enteros válidos
    const validLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 1000); // Entre 1 y 1000
    const validOffset = Math.max(parseInt(offset) || 0, 0); // Mínimo 0

    let whereClause = 'WHERE barbershop_id = ?';
    let params = [parseInt(barbershopId)];

    if (type && ['billing', 'reminder', 'suspension', 'payment_thanks', 'appointment', 'manual', 'bulk'].includes(type)) {
      whereClause += ' AND message_type = ?';
      params.push(type);
    }

    // Construir query dinámicamente con LIMIT y OFFSET seguros
    const query = `
      SELECT id, phone_number, message, message_type, status, sent_at
      FROM whatsapp_messages
      ${whereClause}
      ORDER BY sent_at DESC
      LIMIT ${validLimit} OFFSET ${validOffset}
    `;

    const [messages] = await pool.execute(query, params);

    // Para el conteo, solo usar los parámetros del WHERE clause
    const countParams = [parseInt(barbershopId)];
    if (type && ['billing', 'reminder', 'suspension', 'payment_thanks', 'appointment', 'manual', 'bulk'].includes(type)) {
      countParams.push(type);
    }

    const [totalCount] = await pool.execute(`
      SELECT COUNT(*) as total FROM whatsapp_messages ${whereClause}
    `, countParams);

    res.json({
      messages,
      total: totalCount[0].total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

  } catch (error) {
    console.error('Error obteniendo mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/client-appointments/:barbershopId/:clientPhone', async (req, res) => {
  try {
    const { barbershopId, clientPhone } = req.params;
    const today = new Date().toISOString().split('T')[0];
    const pool = getPool();

    const cleanPhone = clientPhone.replace(/[^0-9]/g, '');

    const [appointments] = await pool.execute(`
      SELECT a.id, a.queue_number, a.status, a.estimated_time,
             b.name as barber_name, b.service_duration_minutes,
             bs.name as barbershop_name
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      JOIN barbershops bs ON a.barbershop_id = bs.id
      WHERE a.barbershop_id = ? AND a.client_phone = ? AND a.appointment_date >= ?
      AND a.status != 'cancelled'
      ORDER BY a.appointment_date DESC, a.created_at DESC
      LIMIT 5
    `, [barbershopId, cleanPhone, today]);

    res.json({
      client_phone: cleanPhone,
      appointments,
      total: appointments.length
    });

  } catch (error) {
    console.error('Error obteniendo turnos del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/notify-queue-update/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const { barber_id, appointment_date, message_override } = req.body;

    // Intentar reconectar WhatsApp si no está conectado
    if (!whatsappService.isClientReady(barbershopId)) {
      console.log(`WhatsApp no conectado para barbería ${barbershopId}, intentando reconectar...`);
      try {
        await whatsappService.initializeClient(parseInt(barbershopId));
        // Dar tiempo para la conexión
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (!whatsappService.isClientReady(barbershopId)) {
          return res.status(400).json({ 
            error: 'WhatsApp no está conectado. Se está intentando reconectar, espera unos minutos e intenta de nuevo.' 
          });
        }
      } catch (error) {
        console.error('Error reconectando WhatsApp:', error);
        return res.status(400).json({ 
          error: 'Error conectando WhatsApp. Verifica la conexión.' 
        });
      }
    }

    const pool = getPool();
    
    const [appointments] = await pool.execute(`
      SELECT a.client_phone, a.queue_number, a.status, a.estimated_time,
             b.name as barber_name, b.service_duration_minutes
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.barbershop_id = ? AND a.barber_id = ? AND a.appointment_date = ?
      AND a.status = 'waiting'
      ORDER BY a.queue_number
    `, [barbershopId, barber_id, appointment_date]);

    if (appointments.length === 0) {
      return res.json({ 
        message: 'No hay clientes en espera para notificar',
        notified: 0 
      });
    }

    const results = [];
    
    for (let i = 0; i < appointments.length; i++) {
      const appointment = appointments[i];
      const position = i + 1;
      const waitTime = (position - 1) * appointment.service_duration_minutes;

      let message;
      if (message_override) {
        message = message_override;
      } else {
        message = `📢 *Actualización de cola*\n\n`;
        message += `👨‍💼 Barbero: *${appointment.barber_name}*\n`;
        message += `📍 Tu posición actual: *${position}*\n`;
        message += `⏱️ Tiempo estimado de espera: *${waitTime} minutos*\n`;
        message += `🕐 Hora aproximada: *${appointment.estimated_time}*\n\n`;
        message += `Escribe *2* para más info o *menu* para opciones.`;
      }

      const success = await whatsappService.sendMessage(
        parseInt(barbershopId), 
        appointment.client_phone, 
        message
      );

      results.push({
        phone: appointment.client_phone,
        queue_number: appointment.queue_number,
        status: success ? 'sent' : 'failed'
      });

      if (success) {
        await pool.execute(`
          INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
          VALUES (?, ?, ?, 'appointment', 'sent')
        `, [barbershopId, appointment.client_phone, message]);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successCount = results.filter(r => r.status === 'sent').length;

    res.json({
      message: `Notificaciones enviadas: ${successCount}/${results.length}`,
      notified: successCount,
      total: results.length,
      results
    });

  } catch (error) {
    console.error('Error notificando actualización de cola:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Endpoint para verificar estado y forzar reconexión
router.post('/check-connection/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const isConnected = whatsappService.isClientReady(barbershopId);
    
    if (!isConnected) {
      console.log(`Forzando reconexión WhatsApp para barbería ${barbershopId}...`);
      
      // Cancelar reconexiones anteriores
      whatsappService.cancelReconnect(barbershopId);
      
      // Iniciar nueva conexión
      setTimeout(async () => {
        try {
          await whatsappService.initializeClient(parseInt(barbershopId));
        } catch (error) {
          console.error('Error forzando reconexión:', error);
        }
      }, 1000);
      
      return res.json({
        connected: false,
        message: 'WhatsApp no conectado. Iniciando reconexión...',
        reconnecting: true
      });
    }
    
    res.json({
      connected: true,
      message: 'WhatsApp conectado correctamente',
      reconnecting: false
    });
    
  } catch (error) {
    console.error('Error verificando conexión WhatsApp:', error);
    res.status(500).json({ error: 'Error verificando estado' });
  }
});

router.get('/admin/all-connected', authenticateToken(['admin', 'super_admin']), async (req, res) => {
  try {
    const connectedClients = whatsappService.getAllConnectedClients();

    const pool = getPool();
    for (let client of connectedClients) {
      const [barbershop] = await pool.execute(
        'SELECT name FROM barbershops WHERE id = ?',
        [client.barbershop_id]
      );
      client.barbershop_name = barbershop[0]?.name || 'Desconocida';
    }

    res.json({
      connected_clients: connectedClients,
      total: connectedClients.length
    });

  } catch (error) {
    console.error('Error obteniendo clientes conectados:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Reconectar todas las barberías manualmente (solo admin)
router.post('/admin/reconnect-all', authenticateToken(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log('🔄 Iniciando reconexión manual de todas las barberías...');
    
    // Ejecutar reconexión en background
    whatsappService.autoReconnectAllBarbershops();
    
    res.json({
      status: 'success',
      message: 'Proceso de reconexión iniciado. Revisa los logs del servidor para ver el progreso.'
    });

  } catch (error) {
    console.error('Error iniciando reconexión manual:', error);
    res.status(500).json({ error: 'Error iniciando reconexión' });
  }
});

module.exports = router;