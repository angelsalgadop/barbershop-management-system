const jwt = require('jsonwebtoken');
const { getPool } = require('../database/connection');

const authenticateToken = (requiredRoles = null) => {
  return async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      console.log('=== AUTH MIDDLEWARE: No token provided ===');
      return res.status(401).json({ error: 'Token de acceso requerido' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      
      console.log('=== AUTH MIDDLEWARE DEBUG ===');
      console.log('Required roles:', requiredRoles);
      console.log('User role:', req.user.role);
      console.log('User:', { id: req.user.id, email: req.user.email, role: req.user.role });

      if (requiredRoles) {
        const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
        if (!rolesArray.includes(req.user.role)) {
          console.log('=== AUTH MIDDLEWARE: Insufficient permissions ===');
          console.log('Required:', rolesArray);
          console.log('User has:', req.user.role);
          return res.status(403).json({ error: 'Permisos insuficientes' });
        }
      }

      const pool = getPool();
      let userExists = false;

      if (req.user.role === 'admin' || req.user.role === 'super_admin') {
        const [adminRows] = await pool.execute(
          'SELECT id, is_active FROM admin_users WHERE id = ? AND is_active = TRUE',
          [req.user.id]
        );
        userExists = adminRows.length > 0;
      } else if (req.user.role === 'barbershop') {
        const [shopRows] = await pool.execute(
          'SELECT id, is_active, is_suspended FROM barbershops WHERE id = ? AND is_active = TRUE',
          [req.user.id]
        );
        userExists = shopRows.length > 0;
        
        if (userExists && shopRows[0].is_suspended) {
          return res.status(403).json({ 
            error: 'Servicio suspendido por falta de pago. Contacta soporte.',
            suspended: true
          });
        }
      } else if (req.user.role === 'barber') {
        const [barberRows] = await pool.execute(`
          SELECT b.id, b.is_active, bs.is_suspended 
          FROM barbers b 
          JOIN barbershops bs ON b.barbershop_id = bs.id 
          WHERE b.id = ? AND b.is_active = TRUE AND bs.is_active = TRUE
        `, [req.user.id]);
        
        userExists = barberRows.length > 0;
        
        if (userExists && barberRows[0].is_suspended) {
          return res.status(403).json({ 
            error: 'Servicio suspendido por falta de pago. Contacta soporte.',
            suspended: true
          });
        }
      }

      if (!userExists) {
        return res.status(401).json({ error: 'Usuario no válido o inactivo' });
      }

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expirado' });
      }
      return res.status(403).json({ error: 'Token inválido' });
    }
  };
};

const checkBarbershopAccess = async (req, res, next) => {
  try {
    const barbershopId = req.params.barbershopId || req.body.barbershopId;
    
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }
    
    if (req.user.role === 'barbershop' && req.user.id == barbershopId) {
      return next();
    }
    
    if (req.user.role === 'barber') {
      const pool = getPool();
      const [barberRows] = await pool.execute(
        'SELECT barbershop_id FROM barbers WHERE id = ?',
        [req.user.id]
      );
      
      if (barberRows.length > 0 && barberRows[0].barbershop_id == barbershopId) {
        return next();
      }
    }
    
    return res.status(403).json({ error: 'Acceso denegado a esta barbería' });
  } catch (error) {
    console.error('Error in checkBarbershopAccess:', error);
    return res.status(500).json({ error: 'Error verificando acceso' });
  }
};

const checkBarberAccess = async (req, res, next) => {
  try {
    const barberId = req.params.barberId || req.body.barberId;
    
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }
    
    if (req.user.role === 'barber' && req.user.id == barberId) {
      return next();
    }
    
    if (req.user.role === 'barbershop') {
      const pool = getPool();
      const [barberRows] = await pool.execute(
        'SELECT barbershop_id FROM barbers WHERE id = ?',
        [barberId]
      );
      
      if (barberRows.length > 0 && barberRows[0].barbershop_id == req.user.id) {
        return next();
      }
    }
    
    return res.status(403).json({ error: 'Acceso denegado a este barbero' });
  } catch (error) {
    return res.status(500).json({ error: 'Error verificando acceso' });
  }
};

module.exports = {
  authenticateToken,
  checkBarbershopAccess,
  checkBarberAccess
};