const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { getPool } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      role: user.role, 
      email: user.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

router.post('/login',
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('Contraseña requerida'),
    body('role').isIn(['admin', 'barbershop', 'barber']).withMessage('Rol inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, role } = req.body;
      const pool = getPool();
      let user = null;
      let tableName = '';
      let additionalChecks = '';

      switch (role) {
        case 'admin':
          tableName = 'admin_users';
          additionalChecks = 'AND is_active = TRUE';
          break;
        case 'barbershop':
          tableName = 'barbershops';
          additionalChecks = 'AND is_active = TRUE';
          break;
        case 'barber':
          tableName = 'barbers';
          additionalChecks = 'AND is_active = TRUE';
          break;
      }

      const [rows] = await pool.execute(
        `SELECT * FROM ${tableName} WHERE email = ? ${additionalChecks}`,
        [email]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      user = rows[0];

      if (role === 'barbershop' && user.is_suspended) {
        return res.status(403).json({ 
          error: 'Servicio suspendido por falta de pago. Contacta soporte.',
          suspended: true
        });
      }

      if (role === 'barber') {
        const [shopRows] = await pool.execute(
          'SELECT is_suspended FROM barbershops WHERE id = ?',
          [user.barbershop_id]
        );
        
        if (shopRows.length > 0 && shopRows[0].is_suspended) {
          return res.status(403).json({ 
            error: 'Servicio suspendido por falta de pago. Contacta soporte.',
            suspended: true
          });
        }
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Para admin_users, usar el rol real de la base de datos
      const actualRole = role === 'admin' && user.role ? user.role : role;
      
      const token = generateToken({ 
        id: user.id, 
        role: actualRole, 
        email: user.email 
      });

      const userResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: actualRole
      };

      // Agregar campos específicos según el tipo de usuario
      if (role === 'barbershop') {
        userResponse.business_name = user.business_name;
        userResponse.phone = user.phone;
        userResponse.address = user.address;
        userResponse.is_suspended = user.is_suspended;
        userResponse.plan_type = user.plan_type;
      }

      if (role === 'barber') {
        userResponse.barbershop_id = user.barbershop_id;
        userResponse.phone = user.phone;
      }

      res.json({
        message: 'Login exitoso',
        token,
        user: userResponse
      });

    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.post('/register-barbershop',
  [
    body('name').notEmpty().withMessage('Nombre de barbería requerido'),
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('Contraseña debe tener al menos 6 caracteres'),
    body('phone').optional().isMobilePhone('any').withMessage('Número de teléfono inválido'),
    body('whatsapp_number').optional().isMobilePhone('any').withMessage('Número de WhatsApp inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, email, password, address, phone, whatsapp_number, billing_day, monthly_fee, trial, trial_days } = req.body;
      const pool = getPool();

      const [existingUser] = await pool.execute(
        'SELECT email FROM barbershops WHERE email = ?',
        [email]
      );

      if (existingUser.length > 0) {
        return res.status(400).json({ error: 'Email ya está en uso' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Calculate trial end date if trial is requested
      let trialEndDate = null;
      if (trial && trial_days) {
        trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + trial_days);
      }

      const [result] = await pool.execute(`
        INSERT INTO barbershops (name, email, password, address, phone, whatsapp_number, billing_day, monthly_fee, trial_end_date, is_trial, max_barbers)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [name, email, hashedPassword, address || null, phone || null, whatsapp_number || null, billing_day || 1, monthly_fee || 50.00, trialEndDate || null, trial ? 1 : 0, 1]);

      const token = generateToken({ 
        id: result.insertId, 
        role: 'barbershop', 
        email 
      });

      res.status(201).json({
        message: 'Barbería registrada exitosamente',
        token,
        user: {
          id: result.insertId,
          name,
          email,
          role: 'barbershop'
        }
      });

    } catch (error) {
      console.error('Error registrando barbería:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.get('/profile', authenticateToken(), async (req, res) => {
  try {
    const pool = getPool();
    let profile = {};

    if (req.user.role === 'admin') {
      const [rows] = await pool.execute(
        'SELECT id, name, email, role FROM admin_users WHERE id = ?',
        [req.user.id]
      );
      profile = rows[0];
    } else if (req.user.role === 'barbershop') {
      const [rows] = await pool.execute(
        'SELECT id, name, email, address, phone, whatsapp_number, billing_day, monthly_fee, is_suspended FROM barbershops WHERE id = ?',
        [req.user.id]
      );
      profile = rows[0];
    } else if (req.user.role === 'barber') {
      const [rows] = await pool.execute(`
        SELECT b.id, b.name, b.email, b.phone, b.whatsapp_number, b.service_duration_minutes, 
               b.barbershop_id, bs.name as barbershop_name, bs.is_suspended
        FROM barbers b 
        JOIN barbershops bs ON b.barbershop_id = bs.id 
        WHERE b.id = ?
      `, [req.user.id]);
      profile = rows[0];
    }

    profile.role = req.user.role;
    res.json(profile);

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.put('/change-password',
  authenticateToken(),
  [
    body('currentPassword').notEmpty().withMessage('Contraseña actual requerida'),
    body('newPassword').isLength({ min: 6 }).withMessage('Nueva contraseña debe tener al menos 6 caracteres')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { currentPassword, newPassword } = req.body;
      const pool = getPool();
      
      let tableName = '';
      switch (req.user.role) {
        case 'admin':
          tableName = 'admin_users';
          break;
        case 'barbershop':
          tableName = 'barbershops';
          break;
        case 'barber':
          tableName = 'barbers';
          break;
      }

      const [rows] = await pool.execute(
        `SELECT password FROM ${tableName} WHERE id = ?`,
        [req.user.id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, rows[0].password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Contraseña actual incorrecta' });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      await pool.execute(
        `UPDATE ${tableName} SET password = ? WHERE id = ?`,
        [hashedNewPassword, req.user.id]
      );

      res.json({ message: 'Contraseña actualizada exitosamente' });

    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.put('/change-email',
  authenticateToken(),
  [
    body('newEmail').isEmail().withMessage('Email inválido'),
    body('password').notEmpty().withMessage('Contraseña requerida para verificar identidad')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { newEmail, password } = req.body;
      const pool = getPool();
      
      let tableName = '';
      switch (req.user.role) {
        case 'admin':
          tableName = 'admin_users';
          break;
        case 'barbershop':
          tableName = 'barbershops';
          break;
        case 'barber':
          tableName = 'barbers';
          break;
      }

      const [userRows] = await pool.execute(
        `SELECT password FROM ${tableName} WHERE id = ?`,
        [req.user.id]
      );

      if (userRows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const isValidPassword = await bcrypt.compare(password, userRows[0].password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Contraseña incorrecta' });
      }

      const [existingEmail] = await pool.execute(
        `SELECT id FROM ${tableName} WHERE email = ? AND id != ?`,
        [newEmail, req.user.id]
      );

      if (existingEmail.length > 0) {
        return res.status(400).json({ error: 'Email ya está en uso' });
      }

      await pool.execute(
        `UPDATE ${tableName} SET email = ? WHERE id = ?`,
        [newEmail, req.user.id]
      );

      const newToken = generateToken({ 
        id: req.user.id, 
        role: req.user.role, 
        email: newEmail 
      });

      res.json({ 
        message: 'Email actualizado exitosamente',
        token: newToken
      });

    } catch (error) {
      console.error('Error cambiando email:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.post('/admin/create-admin',
  authenticateToken(['admin', 'super_admin']),
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('password').isLength({ min: 6 }).withMessage('Contraseña debe tener al menos 6 caracteres'),
    body('name').notEmpty().withMessage('Nombre requerido'),
    body('role').isIn(['super_admin', 'admin']).withMessage('Rol inválido')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      const { email, password, name, role } = req.body;
      const pool = getPool();

      const [existingAdmin] = await pool.execute(
        'SELECT id FROM admin_users WHERE email = ?',
        [email]
      );

      if (existingAdmin.length > 0) {
        return res.status(400).json({ error: 'Email ya está en uso' });
      }

      if (role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Solo super_admin puede crear otros super_admin' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [result] = await pool.execute(
        'INSERT INTO admin_users (email, password, name, role) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, name, role]
      );

      res.status(201).json({
        message: 'Usuario admin creado exitosamente',
        admin: {
          id: result.insertId,
          email,
          name,
          role
        }
      });

    } catch (error) {
      console.error('Error creando admin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.get('/admin/list-admins',
  authenticateToken(['admin', 'super_admin']),
  async (req, res) => {
    try {
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      const pool = getPool();
      const [admins] = await pool.execute(
        'SELECT id, email, name, role, is_active, created_at FROM admin_users ORDER BY created_at DESC'
      );

      res.json({ admins });

    } catch (error) {
      console.error('Error listando admins:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.put('/admin/toggle-admin/:id',
  authenticateToken(['admin', 'super_admin']),
  async (req, res) => {
    try {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Solo super_admin puede activar/desactivar usuarios' });
      }

      const adminId = req.params.id;
      const pool = getPool();

      if (adminId == req.user.id) {
        return res.status(400).json({ error: 'No puedes desactivarte a ti mismo' });
      }

      const [admin] = await pool.execute(
        'SELECT is_active FROM admin_users WHERE id = ?',
        [adminId]
      );

      if (admin.length === 0) {
        return res.status(404).json({ error: 'Admin no encontrado' });
      }

      const newStatus = !admin[0].is_active;

      await pool.execute(
        'UPDATE admin_users SET is_active = ? WHERE id = ?',
        [newStatus, adminId]
      );

      res.json({ 
        message: `Admin ${newStatus ? 'activado' : 'desactivado'} exitosamente`,
        is_active: newStatus
      });

    } catch (error) {
      console.error('Error cambiando estado admin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.get('/admin/get-admin/:id',
  authenticateToken(['admin', 'super_admin']),
  async (req, res) => {
    try {
      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      const adminId = req.params.id;
      const pool = getPool();
      
      // Solo permitir ver otros admins si es super_admin, o si es el mismo usuario
      if (req.user.role !== 'super_admin' && adminId != req.user.id) {
        return res.status(403).json({ error: 'Solo puedes ver tu propio perfil' });
      }

      const [admin] = await pool.execute(
        'SELECT id, email, name, role, is_active, created_at FROM admin_users WHERE id = ?',
        [adminId]
      );

      if (admin.length === 0) {
        return res.status(404).json({ error: 'Admin no encontrado' });
      }

      res.json(admin[0]);

    } catch (error) {
      console.error('Error obteniendo admin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.put('/admin/update-admin/:id',
  authenticateToken(['admin', 'super_admin']),
  [
    body('email').isEmail().withMessage('Email inválido'),
    body('name').notEmpty().withMessage('Nombre requerido'),
    body('role').isIn(['super_admin', 'admin']).withMessage('Rol inválido'),
    body('password').optional().isLength({ min: 6 }).withMessage('Contraseña debe tener al menos 6 caracteres si se proporciona')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      if (req.user.role !== 'super_admin' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Acceso denegado' });
      }

      const adminId = req.params.id;
      const { email, name, role, password } = req.body;
      const pool = getPool();

      // Verificar que el admin existe
      const [existingAdmin] = await pool.execute(
        'SELECT * FROM admin_users WHERE id = ?',
        [adminId]
      );

      if (existingAdmin.length === 0) {
        return res.status(404).json({ error: 'Admin no encontrado' });
      }

      // Solo permitir actualizar otros admins si es super_admin, o si es el mismo usuario
      if (req.user.role !== 'super_admin' && adminId != req.user.id) {
        return res.status(403).json({ error: 'Solo puedes editar tu propio perfil' });
      }

      // Solo super_admin puede cambiar roles de otros usuarios
      if (req.user.role !== 'super_admin' && existingAdmin[0].role !== role) {
        return res.status(403).json({ error: 'Solo super_admin puede cambiar roles' });
      }

      // Verificar que el email no esté en uso por otro admin
      const [existingEmail] = await pool.execute(
        'SELECT id FROM admin_users WHERE email = ? AND id != ?',
        [email, adminId]
      );

      if (existingEmail.length > 0) {
        return res.status(400).json({ error: 'Email ya está en uso' });
      }

      // Solo super_admin puede crear otros super_admin
      if (role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Solo super_admin puede asignar rol de super_admin' });
      }

      // Preparar la actualización
      let updateQuery = 'UPDATE admin_users SET email = ?, name = ?, role = ? WHERE id = ?';
      let updateParams = [email, name, role, adminId];

      // Si se proporcionó una nueva contraseña, incluirla
      if (password && password.trim()) {
        const hashedPassword = await bcrypt.hash(password, 10);
        updateQuery = 'UPDATE admin_users SET email = ?, name = ?, role = ?, password = ? WHERE id = ?';
        updateParams = [email, name, role, hashedPassword, adminId];
      }

      await pool.execute(updateQuery, updateParams);

      res.json({
        message: 'Admin actualizado exitosamente',
        admin: {
          id: adminId,
          email,
          name,
          role
        }
      });

    } catch (error) {
      console.error('Error actualizando admin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

router.delete('/admin/delete-admin/:id',
  authenticateToken(['admin', 'super_admin']),
  async (req, res) => {
    try {
      if (req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Solo super_admin puede eliminar administradores' });
      }

      const adminId = req.params.id;
      const pool = getPool();

      if (adminId == req.user.id) {
        return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
      }

      // Verificar que el admin existe
      const [admin] = await pool.execute(
        'SELECT id, email, name FROM admin_users WHERE id = ?',
        [adminId]
      );

      if (admin.length === 0) {
        return res.status(404).json({ error: 'Admin no encontrado' });
      }

      // Eliminar el admin
      await pool.execute(
        'DELETE FROM admin_users WHERE id = ?',
        [adminId]
      );

      res.json({ 
        message: 'Admin eliminado exitosamente',
        deleted_admin: admin[0]
      });

    } catch (error) {
      console.error('Error eliminando admin:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// Ruta temporal para refrescar el token con el rol correcto
router.post('/admin/refresh-token',
  authenticateToken(['admin', 'super_admin']),
  async (req, res) => {
    try {
      const pool = getPool();
      const [adminRows] = await pool.execute(
        'SELECT id, email, name, role, is_active FROM admin_users WHERE id = ? AND is_active = TRUE',
        [req.user.id]
      );

      if (adminRows.length === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }

      const admin = adminRows[0];
      
      // Generar nuevo token con el rol correcto de la base de datos
      const newToken = generateToken({ 
        id: admin.id, 
        role: admin.role,  // Usar el rol de la base de datos
        email: admin.email 
      });

      const userResponse = {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role  // Usar el rol de la base de datos
      };

      res.json({
        message: 'Token actualizado exitosamente',
        token: newToken,
        user: userResponse
      });

    } catch (error) {
      console.error('Error refreshing token:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

module.exports = router;