const express = require('express');
const { getPool } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Dashboard estadísticas globales para admin
router.get('/dashboard', authenticateToken(['admin', 'super_admin']), async (req, res) => {
  try {
    const pool = getPool();
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().slice(0, 7);

    // Total de barberías
    const [totalBarbershops] = await pool.execute(
      'SELECT COUNT(*) as count FROM barbershops WHERE is_active = TRUE'
    );

    // Total de barberos
    const [totalBarbers] = await pool.execute(
      'SELECT COUNT(*) as count FROM barbers WHERE is_active = TRUE'
    );

    // Citas de hoy (todas las barberías)
    const [todayAppointments] = await pool.execute(
      'SELECT COUNT(*) as count FROM appointments WHERE appointment_date = ?',
      [today]
    );

    // Ingresos del mes (simplificado - ajustar según tu tabla)
    // const [monthRevenue] = await pool.execute(
    //   'SELECT COALESCE(SUM(total_price), 0) as revenue FROM appointments WHERE appointment_date LIKE ? AND status = "completed"',
    //   [`${thisMonth}%`]
    // );
    const monthRevenue = [{revenue: 0}]; // Temporalmente en 0 hasta configurar precios

    // Barberías suspendidas
    const [suspendedBarbershops] = await pool.execute(
      'SELECT COUNT(*) as count FROM barbershops WHERE is_suspended = TRUE'
    );

    // Pagos pendientes (simplificado - ajustar según tu lógica de billing)
    const [pendingPayments] = await pool.execute(
      'SELECT COUNT(*) as count FROM barbershops WHERE is_suspended = TRUE'
    );

    res.json({
      totalBarbershops: totalBarbershops[0].count,
      totalBarbers: totalBarbers[0].count,
      todayAppointments: todayAppointments[0].count,
      monthRevenue: Math.round(monthRevenue[0].revenue || 0),
      suspendedBarbershops: suspendedBarbershops[0].count,
      pendingPayments: pendingPayments[0].count,
      recentActivity: [] // Puedes agregar actividad reciente si lo deseas
    });

  } catch (error) {
    console.error('Error obteniendo dashboard admin:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
