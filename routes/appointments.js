const express = require('express');
const { body, validationResult } = require('express-validator');
const { getPool } = require('../database/connection');
const { authenticateToken, checkBarbershopAccess, checkBarberAccess } = require('../middleware/auth');

const router = express.Router();

function calculateEstimatedTime(queueNumber, serviceDurationMinutes, startTime) {
  const start = new Date(`1970-01-01T${startTime}:00`);
  // Para el primer turno (queueNumber=1), no hay espera
  // Para el segundo turno (queueNumber=2), espera 1 servicio, etc.
  const estimatedMinutes = (queueNumber - 1) * serviceDurationMinutes;
  const estimatedTime = new Date(start.getTime() + estimatedMinutes * 60000);
  return estimatedTime.toTimeString().slice(0, 5);
}

function calculateWaitTime(queuePosition, serviceDurationMinutes) {
  // queuePosition 1 = sin espera, queuePosition 2 = 1 servicio de espera, etc.
  return (queuePosition - 1) * serviceDurationMinutes;
}

async function recalculateQueuePositions(pool, barberId, appointmentDate) {
  try {
    // Get all remaining appointments for this barber on this date (excluding completed/cancelled)
    const [appointments] = await pool.execute(`
      SELECT id, queue_number, estimated_time
      FROM appointments
      WHERE barber_id = ? AND appointment_date = ?
      AND status IN ('waiting', 'in_progress')
      ORDER BY queue_number ASC
    `, [barberId, appointmentDate]);

    if (appointments.length === 0) {
      return; // No appointments to recalculate
    }

    // Get barber's service duration
    const [barberInfo] = await pool.execute(`
      SELECT service_duration_minutes
      FROM barbers
      WHERE id = ?
    `, [barberId]);

    const serviceDurationMinutes = barberInfo[0]?.service_duration_minutes || 30;

    // Recalculate positions and estimated times
    for (let i = 0; i < appointments.length; i++) {
      const newQueueNumber = i + 1;
      const newEstimatedTime = calculateEstimatedTime(newQueueNumber, serviceDurationMinutes, '09:00');

      // Update appointment with new position and estimated time
      await pool.execute(`
        UPDATE appointments
        SET queue_number = ?, estimated_time = ?
        WHERE id = ?
      `, [newQueueNumber, newEstimatedTime, appointments[i].id]);
    }

    console.log(`Recalculadas ${appointments.length} posiciones para barbero ${barberId} en fecha ${appointmentDate}`);

  } catch (error) {
    console.error('Error recalculando posiciones de cola:', error);
    throw error;
  }
}

router.post('/book',
  [
    body('barbershop_id').isInt().withMessage('ID de barbería requerido'),
    body('barber_id').isInt().withMessage('ID de barbero requerido'),
    body('client_name').notEmpty().withMessage('Nombre del cliente requerido'),
    body('client_phone').isMobilePhone('any').withMessage('Teléfono válido requerido'),
    body('appointment_date').isDate().withMessage('Fecha válida requerida')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { barbershop_id, barber_id, client_name, client_phone, appointment_date } = req.body;
      const pool = getPool();

      const [barberRows] = await pool.execute(`
        SELECT b.id, b.service_duration_minutes, bs.is_suspended
        FROM barbers b 
        JOIN barbershops bs ON b.barbershop_id = bs.id
        WHERE b.id = ? AND b.barbershop_id = ? AND b.is_active = TRUE AND bs.is_active = TRUE
      `, [barber_id, barbershop_id]);

      if (barberRows.length === 0) {
        return res.status(404).json({ error: 'Barbero no encontrado o no disponible' });
      }

      if (barberRows[0].is_suspended) {
        return res.status(400).json({ error: 'Servicio suspendido. No se pueden tomar turnos.' });
      }

      const appointmentDateObj = new Date(appointment_date);
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayOfWeek = dayNames[appointmentDateObj.getDay()];

      const [scheduleRows] = await pool.execute(`
        SELECT start_time, end_time, is_active
        FROM barber_schedules 
        WHERE barber_id = ? AND day_of_week = ? AND is_active = TRUE
      `, [barber_id, dayOfWeek]);

      if (scheduleRows.length === 0) {
        return res.status(400).json({ error: 'El barbero no atiende este día' });
      }

      // Estrategia simplificada: insertar con queue_number = 9999 y luego renumerar
      const serviceDuration = barberRows[0].service_duration_minutes;
      
      // Primero insertar con número temporal alto
      const tempQueueNumber = 9999;
      const [result] = await pool.execute(`
        INSERT INTO appointments (barbershop_id, barber_id, client_name, client_phone, appointment_date, queue_number, estimated_time)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [barbershop_id, barber_id, client_name, client_phone, appointment_date, tempQueueNumber, '23:59:00']);
      
      // Ahora renumerar toda la cola para este barbero/fecha
      await pool.execute('SET @row_number = 0');
      await pool.execute(`
        UPDATE appointments 
        SET queue_number = (@row_number := @row_number + 1)
        WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
        ORDER BY CASE WHEN id = ? THEN 999999 ELSE created_at END
      `, [barber_id, appointment_date, result.insertId]);
      
      // Obtener el número de cola asignado y calcular tiempo estimado
      const [updatedAppointment] = await pool.execute(`
        SELECT queue_number FROM appointments WHERE id = ?
      `, [result.insertId]);
      
      const nextQueueNumber = updatedAppointment[0].queue_number;
      const estimatedTime = calculateEstimatedTime(nextQueueNumber, serviceDuration, scheduleRows[0].start_time);
      
      // Actualizar tiempo estimado
      await pool.execute(`
        UPDATE appointments SET estimated_time = ? WHERE id = ?
      `, [estimatedTime, result.insertId]);

      const appointment = {
        id: result.insertId,
        queue_number: nextQueueNumber,
        client_name,
        client_phone,
        appointment_date,
        estimated_time,
        status: 'waiting',
        wait_time_minutes: calculateWaitTime(nextQueueNumber, serviceDuration)
      };

      const io = req.app.get('socketio');
      if (io) {
        io.to(`barber_${barber_id}`).emit('new_appointment', appointment);
        io.to(`barbershop_${barbershop_id}`).emit('queue_updated', { 
          barber_id, 
          appointment_date, 
          queue_length: nextQueueNumber 
        });
      }

      res.status(201).json({
        message: 'Turno reservado exitosamente',
        appointment
      });

    } catch (error) {
      console.error('Error reservando turno:', error);
      
      // Manejo específico de errores
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ 
          error: 'Ya existe un turno en esta posición. Intenta de nuevo.' 
        });
      }
      
      if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ 
          error: 'Barbero o barbería no válidos' 
        });
      }
      
      if (error.message && error.message.includes('connection')) {
        return res.status(503).json({ 
          error: 'Problema de conexión. Intenta en unos segundos.' 
        });
      }
      
      // Error genérico con más detalles para debugging
      console.error('Detalles del error:', {
        message: error.message,
        code: error.code,
        stack: error.stack,
        sqlState: error.sqlState
      });
      
      res.status(500).json({ 
        error: 'Error reservando turno. Por favor intenta nuevamente.',
        timestamp: new Date().toISOString()
      });
    }
  }
);

router.get('/barber/:barberId/:date', authenticateToken(), checkBarberAccess, async (req, res) => {
  try {
    const { barberId, date } = req.params;
    const pool = getPool();

    const [appointments] = await pool.execute(`
      SELECT id, client_name, client_phone, queue_number, status, estimated_time, 
             actual_start_time, actual_end_time, created_at
      FROM appointments 
      WHERE barber_id = ? AND appointment_date = ? AND status != 'cancelled'
      ORDER BY queue_number
    `, [barberId, date]);

    const [barberInfo] = await pool.execute(
      'SELECT service_duration_minutes FROM barbers WHERE id = ?',
      [barberId]
    );

    const serviceDuration = barberInfo[0]?.service_duration_minutes || 30;

    const appointmentsWithWaitTime = appointments.map((apt, index) => ({
      ...apt,
      wait_time_minutes: calculateWaitTime(index + 1, serviceDuration),
      position_in_queue: index + 1
    }));

    res.json({
      appointments: appointmentsWithWaitTime,
      total_appointments: appointments.length,
      waiting_count: appointments.filter(apt => apt.status === 'waiting').length,
      in_progress_count: appointments.filter(apt => apt.status === 'in_progress').length,
      completed_count: appointments.filter(apt => apt.status === 'completed').length
    });

  } catch (error) {
    console.error('Error obteniendo turnos del barbero:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/barbershop/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const { date, barber_id } = req.query;
    const pool = getPool();

    const targetDate = date || new Date().toISOString().split('T')[0];

    let appointmentQuery = `
      SELECT a.id, a.client_name, a.client_phone, a.queue_number, a.status,
             a.estimated_time, a.actual_start_time, a.actual_end_time, a.created_at,
             a.service_amount, a.notes,
             b.name as barber_name, b.id as barber_id
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.barbershop_id = ? AND a.appointment_date = ?
    `;

    const queryParams = [barbershopId, targetDate];

    if (barber_id) {
      appointmentQuery += ' AND a.barber_id = ?';
      queryParams.push(barber_id);
    }

    appointmentQuery += ' ORDER BY b.name, a.queue_number';

    const [appointments] = await pool.execute(appointmentQuery, queryParams);

    // Calculate statistics
    const stats = {
      total: appointments.length,
      completed: appointments.filter(apt => apt.status === 'completed').length,
      pending: appointments.filter(apt => apt.status === 'waiting').length + appointments.filter(apt => apt.status === 'in_progress').length,
      revenue: appointments
        .filter(apt => apt.status === 'completed' && apt.service_amount)
        .reduce((sum, apt) => sum + parseFloat(apt.service_amount), 0)
    };

    res.json({
      appointments: appointments,
      stats: stats
    });

  } catch (error) {
    console.error('Error obteniendo turnos de la barbería:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.patch('/:appointmentId/call-next', authenticateToken(), async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const pool = getPool();

    const [appointmentRows] = await pool.execute(
      'SELECT barber_id, barbershop_id, queue_number, appointment_date, status FROM appointments WHERE id = ?',
      [appointmentId]
    );

    if (appointmentRows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const appointment = appointmentRows[0];

    if (appointment.status !== 'waiting') {
      return res.status(400).json({ error: 'El turno no está en espera' });
    }

    if (req.user.role === 'barber' && req.user.id != appointment.barber_id) {
      return res.status(403).json({ error: 'No autorizado para este turno' });
    }

    if (req.user.role === 'barbershop') {
      const [barberRows] = await pool.execute(
        'SELECT barbershop_id FROM barbers WHERE id = ?',
        [appointment.barber_id]
      );
      
      if (barberRows.length === 0 || barberRows[0].barbershop_id != req.user.id) {
        return res.status(403).json({ error: 'No autorizado para este barbero' });
      }
    }

    await pool.execute(
      'UPDATE appointments SET status = "in_progress", actual_start_time = NOW() WHERE id = ?',
      [appointmentId]
    );

    // Recalculate queue positions for remaining appointments after calling this appointment
    await recalculateQueuePositions(pool, appointment.barber_id, appointment.appointment_date);

    const [updatedAppointment] = await pool.execute(`
      SELECT a.*, b.name as barber_name
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.id = ?
    `, [appointmentId]);

    const io = req.app.get('socketio');
    if (io) {
      io.to(`barber_${appointment.barber_id}`).emit('appointment_called', updatedAppointment[0]);
      io.to(`barbershop_${appointment.barbershop_id}`).emit('appointment_called', updatedAppointment[0]);
      
      const [remainingAppointments] = await pool.execute(`
        SELECT COUNT(*) as count FROM appointments 
        WHERE barber_id = ? AND appointment_date = ? AND status = 'waiting' AND queue_number > ?
      `, [appointment.barber_id, appointment.appointment_date, appointment.queue_number]);
      
      io.emit('queue_update', {
        barber_id: appointment.barber_id,
        appointment_date: appointment.appointment_date,
        remaining_clients: remainingAppointments[0].count
      });

      // Send queue refresh event to update all displays after position recalculation
      io.to(`barber_${appointment.barber_id}`).emit('queue_refresh');
      io.to(`barbershop_${appointment.barbershop_id}`).emit('queue_refresh');
    }

    // Enviar notificaciones WhatsApp
    try {
      const whatsappService = require('../services/whatsappService');
      
      // Verificar si WhatsApp está conectado, si no intentar reconectar
      if (!whatsappService.isClientReady(appointment.barbershop_id)) {
        console.log(`WhatsApp no conectado, intentando reconectar para barbería ${appointment.barbershop_id}...`);
        await whatsappService.initializeClient(parseInt(appointment.barbershop_id));
        
        // Dar tiempo para que se conecte
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      
      // Intentar enviar notificaciones
      if (whatsappService.isClientReady(appointment.barbershop_id)) {
        // 1. Notificar al cliente que está siendo llamado (el turno actual)
        await notifyCalledClient(appointment.barbershop_id, updatedAppointment[0]);
        
        // 2. Notificar a todos los demás clientes en espera sobre su nueva posición
        await notifyWaitingClients(appointment.barbershop_id, appointment.barber_id, appointment.appointment_date);
        
        console.log('Notificaciones enviadas exitosamente');
      } else {
        console.log('WhatsApp aún no está conectado, las notificaciones se enviarán cuando se reconecte');
        
        // Guardar las notificaciones pendientes para enviar cuando se conecte
        await scheduleDelayedNotifications(appointment.barbershop_id, appointment.barber_id, appointment.appointment_date, updatedAppointment[0]);
      }
    } catch (error) {
      console.error('Error enviando notificaciones WhatsApp:', error);
    }

    res.json({
      message: 'Turno llamado exitosamente',
      appointment: updatedAppointment[0]
    });

  } catch (error) {
    console.error('Error llamando turno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.patch('/:appointmentId/complete', authenticateToken(), async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const { service_amount, notes } = req.body;
    const pool = getPool();

    const [appointmentRows] = await pool.execute(
      'SELECT barber_id, barbershop_id, status FROM appointments WHERE id = ?',
      [appointmentId]
    );

    if (appointmentRows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const appointment = appointmentRows[0];

    if (appointment.status !== 'in_progress') {
      return res.status(400).json({ error: 'El turno no está en progreso' });
    }

    if (req.user.role === 'barber' && req.user.id != appointment.barber_id) {
      return res.status(403).json({ error: 'No autorizado para este turno' });
    }

    if (req.user.role === 'barbershop') {
      const [barberRows] = await pool.execute(
        'SELECT barbershop_id FROM barbers WHERE id = ?',
        [appointment.barber_id]
      );

      if (barberRows.length === 0 || barberRows[0].barbershop_id != req.user.id) {
        return res.status(403).json({ error: 'No autorizado para este barbero' });
      }
    }

    // Update appointment with service amount and notes
    // Convert undefined to null for MySQL compatibility
    await pool.execute(
      'UPDATE appointments SET status = "completed", actual_end_time = NOW(), service_amount = ?, notes = ? WHERE id = ?',
      [service_amount || null, notes || null, appointmentId]
    );

    // If service amount is provided, add to barbershop revenue and calculate distribution
    if (service_amount && service_amount > 0) {
      const [revenueResult] = await pool.execute(`
        INSERT INTO barbershop_revenue (barbershop_id, appointment_id, amount, revenue_date, description)
        VALUES (?, ?, ?, CURDATE(), 'Servicio completado')
      `, [appointment.barbershop_id, appointmentId, service_amount]);

      // Get barber commission percentage
      const [barberInfo] = await pool.execute(
        'SELECT commission_percentage FROM barbers WHERE id = ?',
        [appointment.barber_id]
      );

      const commissionPercentage = barberInfo[0]?.commission_percentage || 60.00;
      const barbershopPercentage = 100.00 - commissionPercentage;

      const barberAmount = (service_amount * commissionPercentage / 100).toFixed(2);
      const barbershopAmount = (service_amount * barbershopPercentage / 100).toFixed(2);

      // Create revenue distribution record
      await pool.execute(`
        INSERT INTO revenue_distribution (
          barbershop_revenue_id, barber_id, barbershop_id, total_amount,
          barber_amount, barbershop_amount, barber_percentage, barbershop_percentage,
          distribution_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE())
      `, [
        revenueResult.insertId, appointment.barber_id, appointment.barbershop_id,
        service_amount, barberAmount, barbershopAmount, commissionPercentage, barbershopPercentage
      ]);
    }

    // Get completed appointment details for position recalculation
    const [completedAppointment] = await pool.execute(`
      SELECT barber_id, appointment_date, queue_number
      FROM appointments
      WHERE id = ?
    `, [appointmentId]);

    // Recalculate queue positions for remaining appointments
    await recalculateQueuePositions(pool, completedAppointment[0].barber_id, completedAppointment[0].appointment_date);

    // Get all updated appointments for this barber to send notifications
    const [allUpdatedAppointments] = await pool.execute(`
      SELECT a.*, b.name as barber_name
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.barber_id = ? AND a.appointment_date = ?
      AND a.status IN ('waiting', 'in_progress')
      ORDER BY a.queue_number ASC
    `, [completedAppointment[0].barber_id, completedAppointment[0].appointment_date]);

    const [updatedAppointment] = await pool.execute(`
      SELECT a.*, b.name as barber_name
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.id = ?
    `, [appointmentId]);

    const io = req.app.get('socketio');
    if (io) {
      // Notify about the completed appointment
      io.to(`barber_${appointment.barber_id}`).emit('appointment_completed', updatedAppointment[0]);
      io.to(`barbershop_${appointment.barbershop_id}`).emit('appointment_completed', updatedAppointment[0]);

      // Notify about queue position updates for remaining appointments
      allUpdatedAppointments.forEach(apt => {
        io.to(`barber_${apt.barber_id}`).emit('queue_position_updated', {
          appointment_id: apt.id,
          new_queue_number: apt.queue_number,
          new_estimated_time: apt.estimated_time,
          client_phone: apt.client_phone
        });
        io.to(`barbershop_${appointment.barbershop_id}`).emit('queue_position_updated', {
          appointment_id: apt.id,
          new_queue_number: apt.queue_number,
          new_estimated_time: apt.estimated_time,
          client_phone: apt.client_phone
        });
      });

      // Send queue refresh event to update all displays
      io.to(`barber_${appointment.barber_id}`).emit('queue_refresh');
      io.to(`barbershop_${appointment.barbershop_id}`).emit('queue_refresh');
    }

    // Send thank you message to the client who just completed their appointment
    try {
      const whatsappService = require('../services/whatsappService');

      // Get barbershop details for the thank you message
      const [barbershopDetails] = await pool.execute(
        'SELECT name, whatsapp_number FROM barbershops WHERE id = ?',
        [appointment.barbershop_id]
      );

      if (barbershopDetails.length > 0 && updatedAppointment[0].client_phone) {
        const barbershopName = barbershopDetails[0].name;
        const whatsappNumber = barbershopDetails[0].whatsapp_number;

        const thankYouMessage = `🎉 *¡Muchas gracias por preferir ${barbershopName}!*\n\n` +
          `Esperamos que hayas disfrutado de nuestro servicio.\n\n` +
          `💡 *Para tu próxima visita:*\n` +
          `Escríbenos a este número de WhatsApp y agenda tu cita. ¡Así no tendrás que esperar tanto!\n\n` +
          `📱 WhatsApp: ${whatsappNumber}\n\n` +
          `¡Te esperamos pronto! 💈✨`;

        // Send thank you message
        const messageSent = await whatsappService.sendMessage(
          appointment.barbershop_id,
          updatedAppointment[0].client_phone,
          thankYouMessage
        );

        if (messageSent) {
          console.log(`Mensaje de agradecimiento enviado a ${updatedAppointment[0].client_phone}`);

          // Record the message
          await pool.execute(`
            INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
            VALUES (?, ?, ?, 'appointment', 'sent')
          `, [appointment.barbershop_id, updatedAppointment[0].client_phone, thankYouMessage]);
        } else {
          console.warn(`No se pudo enviar mensaje de agradecimiento a ${updatedAppointment[0].client_phone}`);
        }
      }
    } catch (error) {
      console.error('Error enviando mensaje de agradecimiento:', error);
    }

    // Send WhatsApp notifications to waiting clients about their new positions
    try {
      const whatsappService = require('../services/whatsappService');

      // Verificar si WhatsApp está conectado
      if (!whatsappService.isClientReady(appointment.barbershop_id)) {
        console.log(`WhatsApp no conectado, intentando reconectar para barbería ${appointment.barbershop_id}...`);
        await whatsappService.initializeClient(parseInt(appointment.barbershop_id));

        // Dar tiempo para que se conecte
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Intentar enviar notificaciones
      if (whatsappService.isClientReady(appointment.barbershop_id)) {
        await notifyWaitingClients(appointment.barbershop_id, completedAppointment[0].barber_id, completedAppointment[0].appointment_date);
        console.log('Notificaciones WhatsApp enviadas exitosamente después de completar turno');
      } else {
        console.log('WhatsApp aún no está conectado, programando notificaciones pendientes');
        // Programar notificaciones pendientes
        await scheduleDelayedNotifications(appointment.barbershop_id, completedAppointment[0].barber_id, completedAppointment[0].appointment_date, null, 'appointment_completed');
      }
    } catch (error) {
      console.error('Error enviando notificaciones WhatsApp después de completar turno:', error);
    }

    res.json({
      message: 'Turno completado exitosamente',
      appointment: updatedAppointment[0]
    });

  } catch (error) {
    console.error('Error completando turno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Start appointment
router.patch('/:appointmentId/start', authenticateToken(), async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const pool = getPool();

    const [appointmentRows] = await pool.execute(
      'SELECT barber_id, barbershop_id, status FROM appointments WHERE id = ?',
      [appointmentId]
    );

    if (appointmentRows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const appointment = appointmentRows[0];

    if (appointment.status !== 'waiting') {
      return res.status(400).json({ error: 'El turno no está esperando' });
    }

    if (req.user.role === 'barber' && req.user.id != appointment.barber_id) {
      return res.status(403).json({ error: 'No autorizado para este turno' });
    }

    if (req.user.role === 'barbershop') {
      const [barberRows] = await pool.execute(
        'SELECT barbershop_id FROM barbers WHERE id = ?',
        [appointment.barber_id]
      );

      if (barberRows.length === 0 || barberRows[0].barbershop_id != req.user.id) {
        return res.status(403).json({ error: 'No autorizado para este barbero' });
      }
    }

    await pool.execute(
      'UPDATE appointments SET status = "in_progress", actual_start_time = NOW() WHERE id = ?',
      [appointmentId]
    );

    const [updatedAppointment] = await pool.execute(`
      SELECT a.*, b.name as barber_name
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.id = ?
    `, [appointmentId]);

    const io = req.app.get('socketio');
    if (io) {
      io.to(`barber_${appointment.barber_id}`).emit('appointment_started', updatedAppointment[0]);
      io.to(`barbershop_${appointment.barbershop_id}`).emit('appointment_started', updatedAppointment[0]);
    }

    res.json({
      message: 'Turno iniciado exitosamente',
      appointment: updatedAppointment[0]
    });

  } catch (error) {
    console.error('Error iniciando turno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Cancel appointment
router.patch('/:appointmentId/cancel', authenticateToken(), async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const pool = getPool();

    const [appointmentRows] = await pool.execute(
      'SELECT barber_id, barbershop_id, status FROM appointments WHERE id = ?',
      [appointmentId]
    );

    if (appointmentRows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const appointment = appointmentRows[0];

    if (appointment.status === 'completed' || appointment.status === 'cancelled') {
      return res.status(400).json({ error: 'No se puede cancelar un turno completado o ya cancelado' });
    }

    if (req.user.role === 'barber' && req.user.id != appointment.barber_id) {
      return res.status(403).json({ error: 'No autorizado para este turno' });
    }

    if (req.user.role === 'barbershop') {
      const [barberRows] = await pool.execute(
        'SELECT barbershop_id FROM barbers WHERE id = ?',
        [appointment.barber_id]
      );

      if (barberRows.length === 0 || barberRows[0].barbershop_id != req.user.id) {
        return res.status(403).json({ error: 'No autorizado para este barbero' });
      }
    }

    // Get cancelled appointment details for position recalculation
    const [cancelledAppointment] = await pool.execute(`
      SELECT barber_id, appointment_date, queue_number
      FROM appointments
      WHERE id = ?
    `, [appointmentId]);

    await pool.execute(
      'UPDATE appointments SET status = "cancelled" WHERE id = ?',
      [appointmentId]
    );

    // Recalculate queue positions for remaining appointments
    await recalculateQueuePositions(pool, cancelledAppointment[0].barber_id, cancelledAppointment[0].appointment_date);

    // Get all updated appointments for this barber to send notifications
    const [allUpdatedAppointments] = await pool.execute(`
      SELECT a.*, b.name as barber_name
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.barber_id = ? AND a.appointment_date = ?
      AND a.status IN ('waiting', 'in_progress')
      ORDER BY a.queue_number ASC
    `, [cancelledAppointment[0].barber_id, cancelledAppointment[0].appointment_date]);

    const [updatedAppointment] = await pool.execute(`
      SELECT a.*, b.name as barber_name
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.id = ?
    `, [appointmentId]);

    const io = req.app.get('socketio');
    if (io) {
      // Notify about the cancelled appointment
      io.to(`barber_${appointment.barber_id}`).emit('appointment_cancelled', updatedAppointment[0]);
      io.to(`barbershop_${appointment.barbershop_id}`).emit('appointment_cancelled', updatedAppointment[0]);

      // Notify about queue position updates for remaining appointments
      allUpdatedAppointments.forEach(apt => {
        io.to(`barber_${apt.barber_id}`).emit('queue_position_updated', {
          appointment_id: apt.id,
          new_queue_number: apt.queue_number,
          new_estimated_time: apt.estimated_time,
          client_phone: apt.client_phone
        });
        io.to(`barbershop_${appointment.barbershop_id}`).emit('queue_position_updated', {
          appointment_id: apt.id,
          new_queue_number: apt.queue_number,
          new_estimated_time: apt.estimated_time,
          client_phone: apt.client_phone
        });
      });

      // Send queue refresh event to update all displays
      io.to(`barber_${appointment.barber_id}`).emit('queue_refresh');
      io.to(`barbershop_${appointment.barbershop_id}`).emit('queue_refresh');
    }

    // Send WhatsApp notifications to waiting clients about their new positions
    try {
      const whatsappService = require('../services/whatsappService');

      // Verificar si WhatsApp está conectado
      if (!whatsappService.isClientReady(appointment.barbershop_id)) {
        console.log(`WhatsApp no conectado, intentando reconectar para barbería ${appointment.barbershop_id}...`);
        await whatsappService.initializeClient(parseInt(appointment.barbershop_id));

        // Dar tiempo para que se conecte
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Intentar enviar notificaciones
      if (whatsappService.isClientReady(appointment.barbershop_id)) {
        await notifyWaitingClients(appointment.barbershop_id, cancelledAppointment[0].barber_id, cancelledAppointment[0].appointment_date);
        console.log('Notificaciones WhatsApp enviadas exitosamente después de cancelar turno');
      } else {
        console.log('WhatsApp aún no está conectado, programando notificaciones pendientes');
        // Programar notificaciones pendientes
        await scheduleDelayedNotifications(appointment.barbershop_id, cancelledAppointment[0].barber_id, cancelledAppointment[0].appointment_date, null, 'appointment_cancelled');
      }
    } catch (error) {
      console.error('Error enviando notificaciones WhatsApp después de cancelar turno:', error);
    }

    res.json({
      message: 'Turno cancelado exitosamente',
      appointment: updatedAppointment[0]
    });

  } catch (error) {
    console.error('Error cancelando turno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:appointmentId', authenticateToken(), async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const pool = getPool();

    const [appointmentRows] = await pool.execute(
      'SELECT barber_id, barbershop_id, client_name, queue_number, appointment_date, status FROM appointments WHERE id = ?',
      [appointmentId]
    );

    if (appointmentRows.length === 0) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }

    const appointment = appointmentRows[0];

    if (req.user.role === 'barber' && req.user.id != appointment.barber_id) {
      return res.status(403).json({ error: 'No autorizado para este turno' });
    }

    if (req.user.role === 'barbershop') {
      const [barberRows] = await pool.execute(
        'SELECT barbershop_id FROM barbers WHERE id = ?',
        [appointment.barber_id]
      );
      
      if (barberRows.length === 0 || barberRows[0].barbershop_id != req.user.id) {
        return res.status(403).json({ error: 'No autorizado para este barbero' });
      }
    }

    await pool.execute('UPDATE appointments SET status = "cancelled" WHERE id = ?', [appointmentId]);

    await pool.execute(`
      UPDATE appointments 
      SET queue_number = queue_number - 1 
      WHERE barber_id = ? AND appointment_date = ? AND queue_number > ? AND status != 'cancelled'
    `, [appointment.barber_id, appointment.appointment_date, appointment.queue_number]);

    const io = req.app.get('socketio');
    if (io) {
      io.to(`barber_${appointment.barber_id}`).emit('appointment_cancelled', {
        id: appointmentId,
        client_name: appointment.client_name
      });
      io.to(`barbershop_${appointment.barbershop_id}`).emit('appointment_cancelled', {
        id: appointmentId,
        barber_id: appointment.barber_id,
        client_name: appointment.client_name
      });
      
      const [updatedQueue] = await pool.execute(`
        SELECT a.id, a.queue_number, a.client_name, a.client_phone, a.estimated_time, b.service_duration_minutes
        FROM appointments a
        JOIN barbers b ON a.barber_id = b.id
        WHERE a.barber_id = ? AND a.appointment_date = ? AND a.status = 'waiting'
        ORDER BY a.queue_number
      `, [appointment.barber_id, appointment.appointment_date]);
      
      io.emit('queue_reordered', {
        barber_id: appointment.barber_id,
        appointment_date: appointment.appointment_date,
        updated_queue: updatedQueue
      });

      // Notificar a todos los clientes afectados por la cancelación
      try {
        await notifyQueueReorder(appointment.barbershop_id, appointment.barber_id, appointment.appointment_date, updatedQueue);
      } catch (error) {
        console.error('Error notificando reordenamiento de cola:', error);
      }
    }

    res.json({
      message: `Turno de ${appointment.client_name} cancelado exitosamente`
    });

  } catch (error) {
    console.error('Error cancelando turno:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/client/:clientPhone/:date', async (req, res) => {
  try {
    const { clientPhone, date } = req.params;
    const pool = getPool();

    const [appointments] = await pool.execute(`
      SELECT a.id, a.client_name, a.queue_number, a.status, a.estimated_time,
             a.actual_start_time, a.actual_end_time,
             b.name as barber_name, b.service_duration_minutes,
             bs.name as barbershop_name, bs.address, bs.phone as barbershop_phone
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      JOIN barbershops bs ON a.barbershop_id = bs.id
      WHERE a.client_phone = ? AND a.appointment_date = ? AND a.status != 'cancelled'
      ORDER BY a.created_at DESC
    `, [clientPhone, date]);

    if (appointments.length === 0) {
      return res.status(404).json({ error: 'No tienes turnos para esta fecha' });
    }

    const appointment = appointments[0];

    if (appointment.status === 'waiting') {
      const [queuePosition] = await pool.execute(`
        SELECT COUNT(*) + 1 as position
        FROM appointments 
        WHERE barber_id = (SELECT barber_id FROM appointments WHERE id = ?) 
        AND appointment_date = ? AND status = 'waiting' AND queue_number < ?
      `, [appointment.id, date, appointment.queue_number]);

      appointment.queue_position = queuePosition[0].position;
      appointment.estimated_wait_minutes = (queuePosition[0].position - 1) * appointment.service_duration_minutes;
    }

    res.json({
      appointment,
      message: appointment.status === 'waiting' ? 
        `Tu turno está en la posición ${appointment.queue_position}. Tiempo estimado de espera: ${appointment.estimated_wait_minutes} minutos.` :
        appointment.status === 'in_progress' ?
        'Tu turno está siendo atendido ahora.' :
        'Tu turno ha sido completado.'
    });

  } catch (error) {
    console.error('Error consultando turno del cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Función para notificar al cliente específico que está siendo llamado
async function notifyCalledClient(barbershopId, calledAppointment) {
  const whatsappService = require('../services/whatsappService');
  const pool = getPool();
  
  try {
    // Verificar que el cliente WhatsApp esté conectado
    if (!whatsappService.isClientReady(barbershopId)) {
      console.warn(`Cliente WhatsApp no conectado para barbería ${barbershopId}, guardando notificación pendiente`);
      
      const message = `🎯 *¡ES TU TURNO!*\n\n` +
        `👨‍💼 Barbero: *${calledAppointment.barber_name}*\n` +
        `📍 Tu turno está siendo llamado AHORA\n` +
        `🏃‍♂️ Dirígete inmediatamente al barbero\n\n` +
        `¡Tu espera ha terminado!`;

      // Guardar notificación pendiente
      await pool.execute(`
        INSERT INTO whatsapp_pending_notifications (barbershop_id, barber_id, appointment_date, notification_type)
        VALUES (?, ?, ?, 'client_called')
      `, [barbershopId, calledAppointment.barber_id, calledAppointment.appointment_date]);
      
      return;
    }

    const message = `🎯 *¡ES TU TURNO!*\n\n` +
      `👨‍💼 Barbero: *${calledAppointment.barber_name}*\n` +
      `📍 Tu turno está siendo llamado AHORA\n` +
      `🏃‍♂️ Dirígete inmediatamente al barbero\n\n` +
      `¡Tu espera ha terminado!`;

    const messageSent = await whatsappService.sendMessage(barbershopId, calledAppointment.client_phone, message);

    if (messageSent) {
      console.log(`Notificación de turno llamado enviada a ${calledAppointment.client_phone}`);

      // Registrar el mensaje en la base de datos
      await pool.execute(`
        INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
        VALUES (?, ?, ?, 'appointment', 'sent')
      `, [barbershopId, calledAppointment.client_phone, message]);
    } else {
      console.warn(`No se pudo enviar notificación de turno llamado a ${calledAppointment.client_phone}`);

      // Guardar como pendiente si no se pudo enviar
      await pool.execute(`
        INSERT INTO whatsapp_pending_notifications (barbershop_id, barber_id, appointment_date, notification_type)
        VALUES (?, ?, ?, 'client_called')
      `, [barbershopId, calledAppointment.barber_id, calledAppointment.appointment_date]);

      // Registrar como fallido
      await pool.execute(`
        INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
        VALUES (?, ?, ?, 'appointment', 'failed')
      `, [barbershopId, calledAppointment.client_phone, message]);
    }
    
    // Emitir evento de socket para actualización en tiempo real
    if (global.io) {
      global.io.emit('client_called', {
        client_phone: calledAppointment.client_phone,
        barber_id: calledAppointment.barber_id,
        appointment_id: calledAppointment.id,
        barber_name: calledAppointment.barber_name,
        message_sent: messageSent
      });
    }
    
  } catch (error) {
    console.error(`Error enviando notificación de turno llamado a ${calledAppointment.client_phone}:`, error);
    
    try {
      // Guardar notificación pendiente en caso de error
      const message = `🎯 *¡ES TU TURNO!*\n\n` +
        `👨‍💼 Barbero: *${calledAppointment.barber_name}*\n` +
        `📍 Tu turno está siendo llamado AHORA\n` +
        `🏃‍♂️ Dirígete inmediatamente al barbero\n\n` +
        `¡Tu espera ha terminado!`;

      await pool.execute(`
        INSERT INTO whatsapp_pending_notifications (barbershop_id, barber_id, appointment_date, notification_type)
        VALUES (?, ?, ?, 'client_called')
      `, [barbershopId, calledAppointment.barber_id, calledAppointment.appointment_date]);
      
      // Registrar como fallido
      await pool.execute(`
        INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
        VALUES (?, ?, ?, 'client_called', 'failed')
      `, [barbershopId, calledAppointment.client_phone, message]);
    } catch (dbError) {
      console.error('Error guardando notificación pendiente para cliente llamado:', dbError);
    }
  }
}

// Función para notificar a todos los clientes en espera cuando se llama un turno
async function notifyWaitingClients(barbershopId, barberId, appointmentDate) {
  const pool = getPool();
  const whatsappService = require('../services/whatsappService');
  
  // Obtener todos los clientes en espera para este barbero
  const [waitingAppointments] = await pool.execute(`
    SELECT a.client_phone, a.queue_number, a.estimated_time,
           b.name as barber_name, b.service_duration_minutes
    FROM appointments a
    JOIN barbers b ON a.barber_id = b.id
    WHERE a.barber_id = ? AND a.appointment_date = ? AND a.status = 'waiting'
    ORDER BY a.queue_number
  `, [barberId, appointmentDate]);

  if (waitingAppointments.length === 0) {
    return;
  }

  // Obtener información del barbero para calcular tiempos
  const [barberInfo] = await pool.execute(
    'SELECT name, service_duration_minutes FROM barbers WHERE id = ?',
    [barberId]
  );

  if (barberInfo.length === 0) {
    return;
  }

  const barberName = barberInfo[0].name;
  const serviceDuration = barberInfo[0].service_duration_minutes || 30;

  // Enviar notificación a cada cliente en espera con su nueva posición
  for (let i = 0; i < waitingAppointments.length; i++) {
    const appointment = waitingAppointments[i];
    const newPosition = i + 1; // Nueva posición después de que se llamó un turno
    const waitTimeMinutes = i * serviceDuration; // Tiempo de espera real (0 para el próximo)
    
    // Calcular hora estimada más precisa
    const now = new Date();
    const estimatedTime = new Date(now.getTime() + waitTimeMinutes * 60000);
    const estimatedTimeString = estimatedTime.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let message;
    if (newPosition === 1) {
      message = `🎯 *¡Es tu turno siguiente!*\n\n` +
        `👨‍💼 Barbero: *${barberName}*\n` +
        `📍 Eres el próximo en la cola\n` +
        `🚀 Tu turno será llamado muy pronto\n` +
        `🕐 Hora aproximada: *${estimatedTimeString}*\n\n` +
        `¡Mantente cerca! Escribe *estado* para más información.`;
    } else {
      message = `📢 *Nueva Posición en la Cola*\n\n` +
        `👨‍💼 Barbero: *${barberName}*\n` +
        `📍 Tu nueva posición: *${newPosition}*\n` +
        `⏱️ Tiempo estimado de espera: *${waitTimeMinutes} minutos*\n` +
        `🕐 Hora aproximada de atención: *${estimatedTimeString}*\n\n` +
        `La cola avanzó. Escribe *estado* para consultar tu turno.`;
    }

    try {
      // Verificar que el cliente WhatsApp esté conectado antes de enviar
      if (!whatsappService.isClientReady(barbershopId)) {
        console.warn(`Cliente WhatsApp no conectado para barbería ${barbershopId}, guardando notificación pendiente`);
        
        // Guardar notificación pendiente para procesar cuando se reconecte
        await pool.execute(`
          INSERT INTO whatsapp_pending_notifications (barbershop_id, barber_id, appointment_date, notification_type, client_phone, message)
          VALUES (?, ?, ?, 'position_update', ?, ?)
        `, [barbershopId, barberId, appointmentDate, appointment.client_phone, message]);
        
        continue; // Saltar al siguiente cliente
      }

      const messageSent = await whatsappService.sendMessage(barbershopId, appointment.client_phone, message);
      
      if (messageSent) {
        console.log(`Notificación de nueva posición enviada a ${appointment.client_phone} - Nueva posición: ${newPosition}`);
        
        // Registrar el mensaje en la base de datos
        await pool.execute(`
          INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
          VALUES (?, ?, ?, 'position_update', 'sent')
        `, [barbershopId, appointment.client_phone, message]);
      } else {
        console.warn(`No se pudo enviar notificación a ${appointment.client_phone}, guardando como pendiente`);
        
        // Guardar notificación pendiente
        await pool.execute(`
          INSERT INTO whatsapp_pending_notifications (barbershop_id, barber_id, appointment_date, notification_type, client_phone, message)
          VALUES (?, ?, ?, 'position_update', ?, ?)
        `, [barbershopId, barberId, appointmentDate, appointment.client_phone, message]);
        
        // Registrar como fallido en la base de datos
        await pool.execute(`
          INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
          VALUES (?, ?, ?, 'position_update', 'failed')
        `, [barbershopId, appointment.client_phone, message]);
      }
      
      // Emitir evento de socket para actualización en tiempo real
      if (global.io) {
        global.io.emit('position_updated', {
          client_phone: appointment.client_phone,
          barber_id: barberId,
          new_position: newPosition,
          wait_time_minutes: waitTimeMinutes,
          estimated_time: estimatedTimeString,
          message_sent: messageSent
        });
      }
      
    } catch (error) {
      console.error(`Error enviando notificación de nueva posición a ${appointment.client_phone}:`, error);
      
      try {
        // Guardar notificación pendiente en caso de error
        await pool.execute(`
          INSERT INTO whatsapp_pending_notifications (barbershop_id, barber_id, appointment_date, notification_type, client_phone, message)
          VALUES (?, ?, ?, 'position_update', ?, ?)
        `, [barbershopId, barberId, appointmentDate, appointment.client_phone, message]);
        
        // Registrar como fallido
        await pool.execute(`
          INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
          VALUES (?, ?, ?, 'position_update', 'failed')
        `, [barbershopId, appointment.client_phone, message]);
      } catch (dbError) {
        console.error('Error guardando notificación pendiente:', dbError);
      }
    }
    
    // Pequeña pausa entre mensajes para evitar spam
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

// Función para notificar cuando se reordena la cola (cancelación)
async function notifyQueueReorder(barbershopId, barberId, appointmentDate, updatedQueue) {
  if (!updatedQueue || updatedQueue.length === 0) {
    return;
  }

  const whatsappService = require('../services/whatsappService');
  const pool = getPool();
  
  // Obtener información del barbero
  const [barberInfo] = await pool.execute(
    'SELECT name FROM barbers WHERE id = ?',
    [barberId]
  );

  if (barberInfo.length === 0) {
    return;
  }

  const barberName = barberInfo[0].name;
  const serviceDuration = updatedQueue[0].service_duration_minutes || 30;

  // Enviar notificación a cada cliente en la nueva cola
  for (let i = 0; i < updatedQueue.length; i++) {
    const appointment = updatedQueue[i];
    const newPosition = i + 1;
    const waitTimeMinutes = i * serviceDuration;
    
    // Calcular hora estimada
    const now = new Date();
    const estimatedTime = new Date(now.getTime() + waitTimeMinutes * 60000);
    const estimatedTimeString = estimatedTime.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });

    let message;
    if (newPosition === 1) {
      message = `🎯 *¡Ahora eres el siguiente!*\n\n` +
        `👨‍💼 Barbero: *${barberName}*\n` +
        `📍 Tu nueva posición: *${newPosition}*\n` +
        `✨ Un turno fue cancelado, avanzaste en la cola\n` +
        `🕐 Hora aproximada: *${estimatedTimeString}*\n\n` +
        `¡Mantente cerca! Tu turno será pronto.`;
    } else {
      message = `📢 *Cola Actualizada - Avanzaste*\n\n` +
        `👨‍💼 Barbero: *${barberName}*\n` +
        `📍 Tu nueva posición: *${newPosition}*\n` +
        `⏱️ Tiempo estimado: *${waitTimeMinutes} minutos*\n` +
        `🕐 Hora aproximada: *${estimatedTimeString}*\n` +
        `✨ Un turno fue cancelado, la cola se actualizó\n\n` +
        `Escribe *estado* para más información.`;
    }

    try {
      await whatsappService.sendMessage(barbershopId, appointment.client_phone, message);
      console.log(`Notificación de reordenamiento enviada a ${appointment.client_phone} - Nueva posición: ${newPosition}`);
      
      // Registrar el mensaje en la base de datos
      await pool.execute(`
        INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
        VALUES (?, ?, ?, 'queue_reorder', 'sent')
      `, [barbershopId, appointment.client_phone, message]);
      
      // Emitir evento de socket para actualización en tiempo real
      if (global.io) {
        global.io.emit('position_updated', {
          client_phone: appointment.client_phone,
          barber_id: barberId,
          new_position: newPosition,
          wait_time_minutes: waitTimeMinutes,
          estimated_time: estimatedTimeString,
          reason: 'cancellation'
        });
      }
      
    } catch (error) {
      console.error(`Error enviando notificación de reordenamiento a ${appointment.client_phone}:`, error);
    }
    
    // Pausa entre mensajes
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

// Función para programar notificaciones cuando WhatsApp se reconecte
async function scheduleDelayedNotifications(barbershopId, barberId, appointmentDate) {
  const pool = getPool();
  
  try {
    // Guardar la notificación pendiente en la base de datos
    await pool.execute(`
      INSERT INTO whatsapp_pending_notifications (barbershop_id, barber_id, appointment_date, notification_type, created_at)
      VALUES (?, ?, ?, 'position_update', NOW())
      ON DUPLICATE KEY UPDATE created_at = NOW()
    `, [barbershopId, barberId, appointmentDate]);
    
    console.log(`Notificación pendiente guardada para barbería ${barbershopId}, barbero ${barberId}`);
  } catch (error) {
    console.error('Error guardando notificación pendiente:', error);
  }
}

// Función para procesar notificaciones pendientes cuando WhatsApp se conecta
async function processPendingNotifications(barbershopId) {
  const pool = getPool();
  const whatsappService = require('../services/whatsappService');
  
  if (!whatsappService.isClientReady(barbershopId)) {
    return;
  }
  
  try {
    // Obtener notificaciones pendientes
    const [pendingNotifications] = await pool.execute(`
      SELECT id, barber_id, appointment_date, notification_type
      FROM whatsapp_pending_notifications
      WHERE barbershop_id = ? AND processed = FALSE
      ORDER BY created_at ASC
    `, [barbershopId]);
    
    console.log(`Procesando ${pendingNotifications.length} notificaciones pendientes para barbería ${barbershopId}`);
    
    for (const notification of pendingNotifications) {
      try {
        if (notification.notification_type === 'position_update') {
          await notifyWaitingClients(barbershopId, notification.barber_id, notification.appointment_date);
        } else if (notification.notification_type === 'client_called') {
          // Para las notificaciones de cliente llamado, necesitamos el mensaje guardado
          const [messageRows] = await pool.execute(`
            SELECT client_phone, message FROM whatsapp_pending_notifications
            WHERE id = ?
          `, [notification.id]);
          
          if (messageRows.length > 0) {
            const messageSent = await whatsappService.sendMessage(barbershopId, messageRows[0].client_phone, messageRows[0].message);
            
            // Registrar en la base de datos
            await pool.execute(`
              INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type, status)
              VALUES (?, ?, ?, 'client_called', ?)
            `, [barbershopId, messageRows[0].client_phone, messageRows[0].message, messageSent ? 'sent' : 'failed']);
          }
        }
        
        // Marcar como procesada
        await pool.execute(`
          UPDATE whatsapp_pending_notifications 
          SET processed = TRUE, processed_at = NOW() 
          WHERE id = ?
        `, [notification.id]);
        
        console.log(`Notificación pendiente procesada: ${notification.id}`);
        
        // Pausa entre notificaciones
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error procesando notificación pendiente ${notification.id}:`, error);
      }
    }
    
    // Limpiar notificaciones viejas (más de 1 hora)
    await pool.execute(`
      DELETE FROM whatsapp_pending_notifications 
      WHERE barbershop_id = ? AND created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `, [barbershopId]);
    
  } catch (error) {
    console.error('Error procesando notificaciones pendientes:', error);
  }
}

// Get appointments by barber and date for stats
router.get('/barber/:barberId/:date', authenticateToken(), checkBarberAccess, async (req, res) => {
  try {
    const { barberId, date } = req.params;
    const pool = getPool();

    const [appointments] = await pool.execute(`
      SELECT a.*, b.name as barber_name
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.barber_id = ? AND a.appointment_date = ?
      ORDER BY a.queue_number
    `, [barberId, date]);

    const stats = {
      total_appointments: appointments.length,
      waiting_count: appointments.filter(apt => apt.status === 'waiting').length,
      in_progress_count: appointments.filter(apt => apt.status === 'in_progress').length,
      completed_count: appointments.filter(apt => apt.status === 'completed').length,
      cancelled_count: appointments.filter(apt => apt.status === 'cancelled').length,
      appointments: appointments
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching barber appointments:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Agregar las funciones al router para poder ser llamadas
router.notifyCalledClient = notifyCalledClient;
router.notifyWaitingClients = notifyWaitingClients;
router.notifyQueueReorder = notifyQueueReorder;
router.processPendingNotifications = processPendingNotifications;

module.exports = router;