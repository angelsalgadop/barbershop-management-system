const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { getPool } = require('../database/connection');
const { authenticateToken, checkBarbershopAccess } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken(['admin', 'super_admin']), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(`
      SELECT id, name, address, phone, email, whatsapp_number, billing_day, 
             monthly_fee, is_active, is_suspended, suspension_reason, created_at
      FROM barbershops 
      ORDER BY created_at DESC
    `);

    for (let shop of rows) {
      const [barberCount] = await pool.execute(
        'SELECT COUNT(*) as count FROM barbers WHERE barbershop_id = ? AND is_active = TRUE',
        [shop.id]
      );
      shop.active_barbers = barberCount[0].count;

      const [pendingBills] = await pool.execute(
        'SELECT COUNT(*) as count FROM billing WHERE barbershop_id = ? AND status = "pending"',
        [shop.id]
      );
      shop.pending_bills = pendingBills[0].count;
    }

    res.json(rows);
  } catch (error) {
    console.error('Error obteniendo barberías:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const pool = getPool();
    
    const [rows] = await pool.execute(`
      SELECT id, name, address, phone, email, whatsapp_number, billing_day, 
             monthly_fee, is_active, is_suspended, suspension_reason, created_at
      FROM barbershops 
      WHERE id = ?
    `, [barbershopId]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Barbería no encontrada' });
    }

    const barbershop = rows[0];

    const [barbers] = await pool.execute(
      'SELECT id, name, email, phone, whatsapp_number, service_duration_minutes, is_active FROM barbers WHERE barbershop_id = ?',
      [barbershopId]
    );
    barbershop.barbers = barbers;

    const [billing] = await pool.execute(
      'SELECT * FROM billing WHERE barbershop_id = ? ORDER BY created_at DESC LIMIT 5',
      [barbershopId]
    );
    barbershop.recent_billing = billing;

    res.json(barbershop);
  } catch (error) {
    console.error('Error obteniendo barbería:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/', 
  authenticateToken(['admin', 'super_admin']),
  [
    body('name').notEmpty().withMessage('Nombre de barbería requerido'),
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('Contraseña debe tener al menos 6 caracteres'),
    body('billing_day').optional().isInt({ min: 1, max: 31 }).withMessage('Día de facturación debe ser entre 1 y 31'),
    body('monthly_fee').optional().isFloat({ min: 0 }).withMessage('Tarifa mensual debe ser positiva')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password, address, phone, whatsapp_number, billing_day, monthly_fee, max_barbers } = req.body;
      const pool = getPool();

      const [existingShop] = await pool.execute(
        'SELECT email FROM barbershops WHERE email = ?',
        [email]
      );

      if (existingShop.length > 0) {
        return res.status(400).json({ error: 'Email ya está en uso' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await pool.execute(`
        INSERT INTO barbershops (name, email, password, address, phone, whatsapp_number, billing_day, monthly_fee, max_barbers)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [name, email, hashedPassword, address, phone, whatsapp_number, billing_day || 1, monthly_fee || 50.00, max_barbers || 1]);

      const [newShop] = await pool.execute(
        'SELECT id, name, email, address, phone, whatsapp_number, billing_day, monthly_fee, created_at FROM barbershops WHERE id = ?',
        [result.insertId]
      );

      res.status(201).json({
        message: 'Barbería creada exitosamente',
        barbershop: newShop[0]
      });

    } catch (error) {
      console.error('Error creando barbería:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.put('/:barbershopId', 
  authenticateToken(), 
  checkBarbershopAccess,
  [
    body('name').optional().notEmpty().withMessage('Nombre no puede estar vacío'),
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('billing_day').optional().isInt({ min: 1, max: 31 }).withMessage('Día de facturación debe ser entre 1 y 31'),
    body('monthly_fee').optional().isFloat({ min: 0 }).withMessage('Tarifa mensual debe ser positiva'),
    body('password').optional().isLength({ min: 6 }).withMessage('Contraseña debe tener al menos 6 caracteres')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { barbershopId } = req.params;
      const { name, email, address, phone, whatsapp_number, billing_day, monthly_fee, password, is_active, max_barbers } = req.body;
      const pool = getPool();

      if (email) {
        const [existingShop] = await pool.execute(
          'SELECT id FROM barbershops WHERE email = ? AND id != ?',
          [email, barbershopId]
        );

        if (existingShop.length > 0) {
          return res.status(400).json({ error: 'Email ya está en uso por otra barbería' });
        }
      }

      const updateFields = [];
      const updateValues = [];

      if (name) { updateFields.push('name = ?'); updateValues.push(name); }
      if (email) { updateFields.push('email = ?'); updateValues.push(email); }
      if (address !== undefined) { updateFields.push('address = ?'); updateValues.push(address); }
      if (phone) { updateFields.push('phone = ?'); updateValues.push(phone); }
      if (whatsapp_number) { updateFields.push('whatsapp_number = ?'); updateValues.push(whatsapp_number); }
      if (billing_day) { updateFields.push('billing_day = ?'); updateValues.push(billing_day); }
      if (monthly_fee !== undefined) { updateFields.push('monthly_fee = ?'); updateValues.push(monthly_fee); }
      if (is_active !== undefined) { updateFields.push('is_active = ?'); updateValues.push(is_active); }
      if (max_barbers !== undefined) { updateFields.push('max_barbers = ?'); updateValues.push(max_barbers); }

      // Solo permitir cambio de contraseña para admins
      if (password && password.trim() && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateFields.push('password = ?');
        updateValues.push(hashedPassword);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No hay campos para actualizar' });
      }

      updateValues.push(barbershopId);

      await pool.execute(
        `UPDATE barbershops SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      const [updatedShop] = await pool.execute(
        'SELECT id, name, email, address, phone, whatsapp_number, billing_day, monthly_fee FROM barbershops WHERE id = ?',
        [barbershopId]
      );

      res.json({
        message: 'Barbería actualizada exitosamente',
        barbershop: updatedShop[0]
      });

    } catch (error) {
      console.error('Error actualizando barbería:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.patch('/:barbershopId/toggle-status', 
  authenticateToken(['admin', 'super_admin']), 
  async (req, res) => {
    try {
      const { barbershopId } = req.params;
      const { is_active } = req.body;
      const pool = getPool();

      await pool.execute(
        'UPDATE barbershops SET is_active = ? WHERE id = ?',
        [is_active, barbershopId]
      );

      res.json({ 
        message: `Barbería ${is_active ? 'activada' : 'desactivada'} exitosamente` 
      });

    } catch (error) {
      console.error('Error cambiando estado de barbería:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.patch('/:barbershopId/suspend', 
  authenticateToken(['admin', 'super_admin']), 
  async (req, res) => {
    try {
      console.log('=== SUSPEND ENDPOINT DEBUG ===');
      console.log('User:', req.user);
      console.log('Params:', req.params);
      console.log('Body:', req.body);
      console.log('Body types:', {
        is_suspended_type: typeof req.body.is_suspended,
        is_suspended_value: req.body.is_suspended,
        suspension_reason_type: typeof req.body.suspension_reason,
        suspension_reason_value: req.body.suspension_reason
      });

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
      }

      const { barbershopId } = req.params;
      const { is_suspended, suspension_reason } = req.body;
      const pool = getPool();

      console.log(`Updating barbershop ${barbershopId}: is_suspended=${is_suspended}, reason=${suspension_reason}`);

      await pool.execute(
        'UPDATE barbershops SET is_suspended = ?, suspension_reason = ? WHERE id = ?',
        [is_suspended, suspension_reason, barbershopId]
      );

      if (is_suspended) {
        const [barbershop] = await pool.execute(
          'SELECT whatsapp_number FROM barbershops WHERE id = ?',
          [barbershopId]
        );

        if (barbershop.length > 0 && barbershop[0].whatsapp_number) {
          await pool.execute(`
            INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type)
            VALUES (?, ?, ?, ?)
          `, [
            barbershopId,
            barbershop[0].whatsapp_number,
            suspension_reason || 'Tu servicio ha sido suspendido por falta de pago. Contacta soporte.',
            'suspension'
          ]);
        }
      }

      console.log('Suspension update successful');
      res.json({ 
        message: `Barbería ${is_suspended ? 'suspendida' : 'reactivada'} exitosamente` 
      });

    } catch (error) {
      console.error('Error suspendiendo barbería:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.delete('/:barbershopId', authenticateToken(['admin', 'super_admin']), async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const pool = getPool();

    const [barbershop] = await pool.execute(
      'SELECT name FROM barbershops WHERE id = ?',
      [barbershopId]
    );

    if (barbershop.length === 0) {
      return res.status(404).json({ error: 'Barbería no encontrada' });
    }

    await pool.execute('DELETE FROM barbershops WHERE id = ?', [barbershopId]);

    res.json({ 
      message: `Barbería "${barbershop[0].name}" eliminada exitosamente` 
    });

  } catch (error) {
    console.error('Error eliminando barbería:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/:barbershopId/stats', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const pool = getPool();

    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    const [todayAppointments] = await pool.execute(
      'SELECT COUNT(*) as count FROM appointments WHERE barbershop_id = ? AND appointment_date = ?',
      [barbershopId, today]
    );

    const [monthlyAppointments] = await pool.execute(
      'SELECT COUNT(*) as count FROM appointments WHERE barbershop_id = ? AND appointment_date LIKE ?',
      [barbershopId, `${thisMonth}%`]
    );

    const [activeBarbers] = await pool.execute(
      'SELECT COUNT(*) as count FROM barbers WHERE barbershop_id = ? AND is_active = TRUE',
      [barbershopId]
    );

    const [waitingClients] = await pool.execute(
      'SELECT COUNT(*) as count FROM appointments WHERE barbershop_id = ? AND status = "waiting" AND appointment_date = ?',
      [barbershopId, today]
    );

    // Ingresos del día (simplificado - ajustar según tu tabla)
    // const [todayRevenue] = await pool.execute(
    //   'SELECT COALESCE(SUM(total_price), 0) as revenue FROM appointments WHERE barbershop_id = ? AND appointment_date = ? AND status = "completed"',
    //   [barbershopId, today]
    // );
    const todayRevenue = [{revenue: 0}]; // Temporalmente en 0 hasta configurar precios

    // Total de clientes únicos
    const [totalClients] = await pool.execute(
      'SELECT COUNT(DISTINCT client_phone) as count FROM appointments WHERE barbershop_id = ?',
      [barbershopId]
    );

    res.json({
      appointmentsToday: todayAppointments[0].count,
      today_appointments: todayAppointments[0].count,
      monthly_appointments: monthlyAppointments[0].count,
      activeBarbers: activeBarbers[0].count,
      active_barbers: activeBarbers[0].count,
      waiting_clients: waitingClients[0].count,
      todayRevenue: Math.round(todayRevenue[0].revenue || 0),
      totalClients: totalClients[0].count
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;