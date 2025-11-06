const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getPool } = require('../database/connection');
const { authenticateToken, checkBarbershopAccess, checkBarberAccess } = require('../middleware/auth');

const router = express.Router();

router.get('/barbershop/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const pool = getPool();
    
    const [rows] = await pool.execute(`
      SELECT b.id, b.name, b.email, b.phone, b.whatsapp_number, b.service_duration_minutes, 
             b.is_active, b.created_at,
             COUNT(DISTINCT bs.id) as schedule_days,
             COUNT(DISTINCT CASE WHEN a.appointment_date = CURDATE() AND a.status = 'waiting' THEN a.id END) as waiting_clients_today
      FROM barbers b
      LEFT JOIN barber_schedules bs ON b.id = bs.barber_id AND bs.is_active = TRUE
      LEFT JOIN appointments a ON b.id = a.barber_id
      WHERE b.barbershop_id = ?
      GROUP BY b.id
      ORDER BY b.name
    `, [barbershopId]);

    res.json(rows);
  } catch (error) {
    console.error('Error obteniendo barberos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:barberId', authenticateToken(), checkBarberAccess, async (req, res) => {
  try {
    const { barberId } = req.params;
    const pool = getPool();
    
    const [barberRows] = await pool.execute(`
      SELECT b.id, b.barbershop_id, b.name, b.email, b.phone, b.whatsapp_number, 
             b.service_duration_minutes, b.is_active, b.created_at,
             bs.name as barbershop_name
      FROM barbers b
      JOIN barbershops bs ON b.barbershop_id = bs.id
      WHERE b.id = ?
    `, [barberId]);

    if (barberRows.length === 0) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }

    const barber = barberRows[0];

    const [scheduleRows] = await pool.execute(`
      SELECT day_of_week, start_time, end_time, is_active
      FROM barber_schedules 
      WHERE barber_id = ?
      ORDER BY FIELD(day_of_week, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    `, [barberId]);

    barber.schedule = scheduleRows;

    const today = new Date().toISOString().split('T')[0];
    const [todayAppointments] = await pool.execute(`
      SELECT id, client_name, client_phone, queue_number, status, estimated_time, created_at
      FROM appointments 
      WHERE barber_id = ? AND appointment_date = ?
      ORDER BY queue_number
    `, [barberId, today]);

    barber.today_appointments = todayAppointments;

    res.json(barber);
  } catch (error) {
    console.error('Error obteniendo barbero:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/barbershop/:barbershopId', 
  authenticateToken(), 
  checkBarbershopAccess,
  [
    body('name').notEmpty().withMessage('Nombre del barbero requerido'),
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('phone').optional().isMobilePhone('any').withMessage('Teléfono inválido'),
    body('whatsapp_number').optional().isMobilePhone('any').withMessage('WhatsApp inválido'),
    body('service_duration_minutes').optional().isInt({ min: 5, max: 180 }).withMessage('Duración debe ser entre 5 y 180 minutos'),
    body('commission_percentage').optional().isFloat({ min: 0, max: 100 }).withMessage('Porcentaje de comisión debe estar entre 0 y 100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { barbershopId } = req.params;
      const { name, email, password, phone, whatsapp_number, service_duration_minutes, commission_percentage } = req.body;
      const pool = getPool();

      // Verificar límite de barberos según el plan de la barbería
      const [barbershopInfo] = await pool.execute(
        'SELECT max_barbers FROM barbershops WHERE id = ?',
        [barbershopId]
      );

      if (barbershopInfo.length === 0) {
        return res.status(404).json({ error: 'Barbería no encontrada' });
      }

      const maxBarbers = barbershopInfo[0].max_barbers || 1;

      // Contar barberos actuales de la barbería
      const [currentBarbers] = await pool.execute(
        'SELECT COUNT(*) as count FROM barbers WHERE barbershop_id = ?',
        [barbershopId]
      );

      const currentCount = currentBarbers[0].count;

      if (currentCount >= maxBarbers) {
        return res.status(403).json({
          error: 'Límite de barberos alcanzado',
          message: `Tu plan actual permite un máximo de ${maxBarbers} barbero(s). Para agregar más barberos, contacta a soporte para actualizar tu plan.`,
          max_barbers: maxBarbers,
          current_barbers: currentCount
        });
      }

      if (email) {
        const [existingBarber] = await pool.execute(
          'SELECT email FROM barbers WHERE email = ?',
          [email]
        );

        if (existingBarber.length > 0) {
          return res.status(400).json({ error: 'Email ya está en uso' });
        }
      }

      let hashedPassword = null;
      if (password) {
        if (password.length < 6) {
          return res.status(400).json({ error: 'Contraseña debe tener al menos 6 caracteres' });
        }
        hashedPassword = await bcrypt.hash(password, 10);
      }

      const [result] = await pool.execute(`
        INSERT INTO barbers (barbershop_id, name, email, password, phone, whatsapp_number, service_duration_minutes, commission_percentage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [barbershopId, name, email || null, hashedPassword || null, phone || null, whatsapp_number || null, service_duration_minutes || 30, commission_percentage || 60.00]);

      const [newBarber] = await pool.execute(
        'SELECT id, name, email, phone, whatsapp_number, service_duration_minutes, commission_percentage, created_at FROM barbers WHERE id = ?',
        [result.insertId]
      );

      res.status(201).json({
        message: 'Barbero creado exitosamente',
        barber: newBarber[0]
      });

    } catch (error) {
      console.error('Error creando barbero:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.patch('/:barberId/toggle-status', authenticateToken(), checkBarberAccess, async (req, res) => {
  try {
    const { barberId } = req.params;
    const { is_active } = req.body;
    const pool = getPool();

    await pool.execute(
      'UPDATE barbers SET is_active = ? WHERE id = ?',
      [is_active, barberId]
    );

    res.json({ 
      message: `Barbero ${is_active ? 'activado' : 'desactivado'} exitosamente` 
    });

  } catch (error) {
    console.error('Error cambiando estado de barbero:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.delete('/:barberId', authenticateToken(), checkBarberAccess, async (req, res) => {
  try {
    const { barberId } = req.params;
    const pool = getPool();

    const [barber] = await pool.execute(
      'SELECT name FROM barbers WHERE id = ?',
      [barberId]
    );

    if (barber.length === 0) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }

    const [pendingAppointments] = await pool.execute(
      'SELECT COUNT(*) as count FROM appointments WHERE barber_id = ? AND status = "waiting"',
      [barberId]
    );

    if (pendingAppointments[0].count > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar el barbero porque tiene turnos pendientes' 
      });
    }

    await pool.execute('DELETE FROM barbers WHERE id = ?', [barberId]);

    res.json({ 
      message: `Barbero "${barber[0].name}" eliminado exitosamente` 
    });

  } catch (error) {
    console.error('Error eliminando barbero:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:barberId/schedule', authenticateToken(), checkBarberAccess, async (req, res) => {
  try {
    const { barberId } = req.params;
    const pool = getPool();
    
    const [rows] = await pool.execute(`
      SELECT day_of_week, start_time, end_time, is_active
      FROM barber_schedules 
      WHERE barber_id = ?
      ORDER BY FIELD(day_of_week, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
    `, [barberId]);

    const schedule = {};
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    days.forEach(day => {
      const daySchedule = rows.find(row => row.day_of_week === day);
      schedule[day] = daySchedule || { 
        day_of_week: day, 
        start_time: null, 
        end_time: null, 
        is_active: false 
      };
    });

    res.json(schedule);
  } catch (error) {
    console.error('Error obteniendo horario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/:barberId/schedule', 
  authenticateToken(), 
  checkBarberAccess,
  [
    body('*.start_time').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      if (typeof value === 'string' && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return true;
      throw new Error('Formato de hora inválido (HH:MM)');
    }),
    body('*.end_time').optional({ nullable: true }).custom((value) => {
      if (value === null || value === undefined) return true;
      if (typeof value === 'string' && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) return true;
      throw new Error('Formato de hora inválido (HH:MM)');
    }),
    body('*.is_active').optional().isBoolean().withMessage('is_active debe ser booleano')
  ],
  async (req, res) => {
    try {
      console.log('PUT /schedule - barberId:', req.params.barberId);
      
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { barberId } = req.params;
      const schedule = req.body;
      const pool = getPool();

      const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      for (const [day, daySchedule] of Object.entries(schedule)) {
        if (!validDays.includes(day)) {
          return res.status(400).json({ error: `Día inválido: ${day}` });
        }

        // Validate active days require start and end times
        if (daySchedule.is_active && (!daySchedule.start_time || !daySchedule.end_time)) {
          return res.status(400).json({ 
            error: `Para el día ${day}: se requiere hora de inicio y fin cuando está activo` 
          });
        }

        // For inactive days, ensure times are set to null
        if (!daySchedule.is_active) {
          daySchedule.start_time = null;
          daySchedule.end_time = null;
        }

        // Validate time order only for active days with both times
        if (daySchedule.is_active && daySchedule.start_time && daySchedule.end_time) {
          const startTime = new Date(`1970-01-01T${daySchedule.start_time}:00`);
          const endTime = new Date(`1970-01-01T${daySchedule.end_time}:00`);
          
          if (startTime >= endTime) {
            return res.status(400).json({ 
              error: `Para el día ${day}: la hora de fin debe ser posterior a la hora de inicio` 
            });
          }
        }

        await pool.execute(`
          INSERT INTO barber_schedules (barber_id, day_of_week, start_time, end_time, is_active)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
          start_time = VALUES(start_time),
          end_time = VALUES(end_time),
          is_active = VALUES(is_active)
        `, [barberId, day, daySchedule.start_time, daySchedule.end_time, daySchedule.is_active || false]);
      }

      const [updatedSchedule] = await pool.execute(`
        SELECT day_of_week, start_time, end_time, is_active
        FROM barber_schedules 
        WHERE barber_id = ?
        ORDER BY FIELD(day_of_week, 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
      `, [barberId]);

      res.json({
        message: 'Horario actualizado exitosamente',
        schedule: updatedSchedule
      });

    } catch (error) {
      console.error('Error actualizando horario:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      res.status(500).json({ 
        error: 'Error interno del servidor',
        details: error.message 
      });
    }
  }
);

router.get('/:barberId/available-slots/:date', authenticateToken(), async (req, res) => {
  try {
    const { barberId, date } = req.params;
    const pool = getPool();

    const appointmentDate = new Date(date);
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayOfWeek = dayNames[appointmentDate.getDay()];

    const [scheduleRows] = await pool.execute(`
      SELECT start_time, end_time, is_active
      FROM barber_schedules 
      WHERE barber_id = ? AND day_of_week = ? AND is_active = TRUE
    `, [barberId, dayOfWeek]);

    if (scheduleRows.length === 0) {
      return res.json({ available_slots: [] });
    }

    const schedule = scheduleRows[0];

    const [barberRows] = await pool.execute(
      'SELECT service_duration_minutes FROM barbers WHERE id = ?',
      [barberId]
    );

    const serviceDuration = barberRows[0]?.service_duration_minutes || 30;

    const [existingAppointments] = await pool.execute(`
      SELECT queue_number, estimated_time
      FROM appointments 
      WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
      ORDER BY queue_number
    `, [barberId, date]);

    const slots = [];
    const startTime = new Date(`1970-01-01T${schedule.start_time}`);
    const endTime = new Date(`1970-01-01T${schedule.end_time}`);
    
    let currentTime = new Date(startTime);
    let queueNumber = 1;

    while (currentTime < endTime) {
      const slotEndTime = new Date(currentTime.getTime() + serviceDuration * 60000);
      
      if (slotEndTime <= endTime) {
        const isOccupied = existingAppointments.some(apt => apt.queue_number === queueNumber);
        
        slots.push({
          queue_number: queueNumber,
          start_time: currentTime.toTimeString().slice(0, 5),
          end_time: slotEndTime.toTimeString().slice(0, 5),
          is_available: !isOccupied
        });
        
        queueNumber++;
      }
      
      currentTime = slotEndTime;
    }

    res.json({
      available_slots: slots,
      service_duration_minutes: serviceDuration,
      total_slots: slots.length,
      available_count: slots.filter(slot => slot.is_available).length
    });

  } catch (error) {
    console.error('Error obteniendo slots disponibles:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Update barber details
router.put('/:id', authenticateToken(), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, service_duration_minutes, is_active, password, commission_percentage } = req.body;
    const pool = getPool();

    // Check if barber belongs to barbershop
    const [barberRows] = await pool.execute(
      'SELECT barbershop_id FROM barbers WHERE id = ?',
      [id]
    );

    if (barberRows.length === 0) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }

    // Check barbershop access
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      // Admin can edit any barber
    } else if (req.user.role === 'barbershop') {
      // Barbershop can only edit their own barbers
      if (req.user.id != barberRows[0].barbershop_id) {
        return res.status(403).json({ error: 'No tienes permisos para editar este barbero' });
      }
    } else {
      // Other roles cannot edit
      return res.status(403).json({ error: 'No tienes permisos para editar este barbero' });
    }

    // Update barber - with or without password
    if (password && password.trim() !== '') {
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      await pool.execute(`
        UPDATE barbers
        SET name = ?, email = ?, phone = ?, service_duration_minutes = ?, is_active = ?, commission_percentage = ?, password = ?
        WHERE id = ?
      `, [name, email, phone || null, service_duration_minutes, is_active || false, commission_percentage || 60.00, hashedPassword, id]);
    } else {
      // Update without changing password
      await pool.execute(`
        UPDATE barbers
        SET name = ?, email = ?, phone = ?, service_duration_minutes = ?, is_active = ?, commission_percentage = ?
        WHERE id = ?
      `, [name, email, phone || null, service_duration_minutes, is_active || false, commission_percentage || 60.00, id]);
    }

    // Get updated barber with schedules
    const [updatedBarber] = await pool.execute(`
      SELECT b.*, 
             GROUP_CONCAT(
               CONCAT(bs.day_of_week, ':', bs.start_time, '-', bs.end_time, ':', bs.is_active)
             ) as schedule_data
      FROM barbers b
      LEFT JOIN barber_schedules bs ON b.id = bs.barber_id
      WHERE b.id = ?
      GROUP BY b.id
    `, [id]);

    if (updatedBarber.length > 0) {
      const barber = updatedBarber[0];
      
      // Parse schedules
      if (barber.schedule_data) {
        barber.schedules = barber.schedule_data.split(',').map(schedule => {
          const [day_of_week, timeRange, scheduleIsActive] = schedule.split(':');
          const [start_time, end_time] = timeRange.split('-');
          return {
            day_of_week,
            start_time,
            end_time,
            is_active: scheduleIsActive === '1'
          };
        });
      } else {
        barber.schedules = [];
      }
      
      delete barber.schedule_data;
      res.json(barber);
    } else {
      res.status(404).json({ error: 'Barbero no encontrado después de actualizar' });
    }
  } catch (error) {
    console.error('Error updating barber:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get single barber with details
router.get('/:id', authenticateToken(), async (req, res) => {
  try {
    const { id } = req.params;
    const pool = getPool();

    const [barberRows] = await pool.execute(`
      SELECT b.*, 
             GROUP_CONCAT(
               CONCAT(bs.day_of_week, ':', bs.start_time, '-', bs.end_time, ':', bs.is_active)
             ) as schedule_data
      FROM barbers b
      LEFT JOIN barber_schedules bs ON b.id = bs.barber_id
      WHERE b.id = ?
      GROUP BY b.id
    `, [id]);

    if (barberRows.length === 0) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }

    const barber = barberRows[0];
    
    // Check access
    if (req.user.role !== 'admin' && req.user.barbershop_id !== barber.barbershop_id) {
      return res.status(403).json({ error: 'No tienes permisos para ver este barbero' });
    }

    // Parse schedules
    if (barber.schedule_data) {
      barber.schedules = barber.schedule_data.split(',').map(schedule => {
        const [day_of_week, timeRange, scheduleIsActive] = schedule.split(':');
        const [start_time, end_time] = timeRange.split('-');
        return {
          day_of_week,
          start_time,
          end_time,
          is_active: scheduleIsActive === '1'
        };
      });
    } else {
      barber.schedules = [];
    }
    
    delete barber.schedule_data;
    res.json(barber);
  } catch (error) {
    console.error('Error getting barber:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ========== WORK SESSIONS ENDPOINTS ==========

// Iniciar sesión de trabajo
router.post('/:barberId/start-work', authenticateToken(), checkBarberAccess, async (req, res) => {
  try {
    const { barberId } = req.params;
    const pool = getPool();
    const today = new Date().toISOString().split('T')[0];

    // Verificar que el barbero existe y obtener barbershop_id
    const [barberRows] = await pool.execute(
      'SELECT barbershop_id, name FROM barbers WHERE id = ?',
      [barberId]
    );

    if (barberRows.length === 0) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }

    const barbershopId = barberRows[0].barbershop_id;
    const barberName = barberRows[0].name;

    // Verificar si ya tiene una sesión activa hoy
    const [activeSession] = await pool.execute(
      'SELECT id FROM work_sessions WHERE barber_id = ? AND work_date = ? AND is_active = TRUE',
      [barberId, today]
    );

    if (activeSession.length > 0) {
      return res.status(400).json({ error: 'Ya tienes una sesión de trabajo activa' });
    }

    // Crear nueva sesión de trabajo
    await pool.execute(
      'INSERT INTO work_sessions (barber_id, barbershop_id, work_date, start_time) VALUES (?, ?, ?, NOW())',
      [barberId, barbershopId, today]
    );

    res.json({
      message: 'Sesión de trabajo iniciada exitosamente',
      barber_name: barberName,
      start_time: new Date()
    });

  } catch (error) {
    console.error('Error iniciando sesión de trabajo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Finalizar sesión de trabajo
router.post('/:barberId/end-work', authenticateToken(), checkBarberAccess, async (req, res) => {
  try {
    const { barberId } = req.params;
    const pool = getPool();
    const today = new Date().toISOString().split('T')[0];

    // Buscar sesión activa
    const [activeSession] = await pool.execute(
      'SELECT id, start_time FROM work_sessions WHERE barber_id = ? AND work_date = ? AND is_active = TRUE',
      [barberId, today]
    );

    if (activeSession.length === 0) {
      return res.status(400).json({ error: 'No tienes una sesión de trabajo activa' });
    }

    // Finalizar la sesión
    await pool.execute(
      'UPDATE work_sessions SET end_time = NOW(), is_active = FALSE WHERE id = ?',
      [activeSession[0].id]
    );

    res.json({
      message: 'Sesión de trabajo finalizada exitosamente',
      start_time: activeSession[0].start_time,
      end_time: new Date()
    });

  } catch (error) {
    console.error('Error finalizando sesión de trabajo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener estado de sesión actual
router.get('/:barberId/work-status', authenticateToken(), checkBarberAccess, async (req, res) => {
  try {
    const { barberId } = req.params;
    const pool = getPool();
    const today = new Date().toISOString().split('T')[0];

    const [session] = await pool.execute(
      'SELECT id, start_time, end_time, is_active FROM work_sessions WHERE barber_id = ? AND work_date = ? ORDER BY id DESC LIMIT 1',
      [barberId, today]
    );

    if (session.length === 0) {
      return res.json({
        is_working: false,
        message: 'No has iniciado labores hoy'
      });
    }

    res.json({
      is_working: session[0].is_active,
      start_time: session[0].start_time,
      end_time: session[0].end_time,
      session_id: session[0].id
    });

  } catch (error) {
    console.error('Error obteniendo estado de sesión:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener sesiones de trabajo (para barbershop)
router.get('/barbershop/:barbershopId/work-sessions', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const { date } = req.query;
    const pool = getPool();
    const targetDate = date || new Date().toISOString().split('T')[0];

    const [sessions] = await pool.execute(`
      SELECT
        ws.id,
        ws.barber_id,
        b.name as barber_name,
        ws.work_date,
        ws.start_time,
        ws.end_time,
        ws.is_active,
        TIMESTAMPDIFF(MINUTE, ws.start_time, COALESCE(ws.end_time, NOW())) as duration_minutes
      FROM work_sessions ws
      JOIN barbers b ON ws.barber_id = b.id
      WHERE ws.barbershop_id = ? AND ws.work_date = ?
      ORDER BY ws.start_time DESC
    `, [barbershopId, targetDate]);

    res.json({ sessions, date: targetDate });

  } catch (error) {
    console.error('Error obteniendo sesiones de trabajo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;