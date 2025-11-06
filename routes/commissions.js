const express = require('express');
const { body, validationResult } = require('express-validator');
const { getPool } = require('../database/connection');
const { authenticateToken, checkBarbershopAccess, checkBarberAccess } = require('../middleware/auth');

const router = express.Router();

// Get commission distribution for a barbershop
router.get('/barbershop/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const { startDate, endDate, status, barberId, limit = 50, offset = 0 } = req.query;
    const pool = getPool();

    let whereClause = 'WHERE rd.barbershop_id = ?';
    let params = [barbershopId];

    if (startDate && endDate) {
      whereClause += ' AND rd.distribution_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      whereClause += ' AND rd.distribution_date >= ?';
      params.push(startDate);
    } else if (endDate) {
      whereClause += ' AND rd.distribution_date <= ?';
      params.push(endDate);
    }

    if (status && ['pending', 'paid_to_barber', 'completed'].includes(status)) {
      whereClause += ' AND rd.status = ?';
      params.push(status);
    }

    if (barberId) {
      whereClause += ' AND rd.barber_id = ?';
      params.push(barberId);
    }

    const validLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 500);
    const validOffset = Math.max(parseInt(offset) || 0, 0);

    // Get commission distributions
    const [distributions] = await pool.execute(`
      SELECT
        rd.*,
        b.name as barber_name,
        b.email as barber_email,
        a.client_name,
        a.appointment_date,
        br.description as service_description
      FROM revenue_distribution rd
      JOIN barbers b ON rd.barber_id = b.id
      JOIN barbershop_revenue br ON rd.barbershop_revenue_id = br.id
      LEFT JOIN appointments a ON br.appointment_id = a.id
      ${whereClause}
      ORDER BY rd.created_at DESC
      LIMIT ${validLimit} OFFSET ${validOffset}
    `, params);

    // Get total count
    const [totalCount] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM revenue_distribution rd
      ${whereClause}
    `, params);

    // Get summary statistics
    const [summary] = await pool.execute(`
      SELECT
        COUNT(*) as total_distributions,
        SUM(rd.total_amount) as total_revenue,
        SUM(rd.barber_amount) as total_barber_amount,
        SUM(rd.barbershop_amount) as total_barbershop_amount,
        AVG(rd.barber_percentage) as avg_barber_percentage,
        COUNT(CASE WHEN rd.status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN rd.status = 'paid_to_barber' THEN 1 END) as paid_count,
        COUNT(CASE WHEN rd.status = 'completed' THEN 1 END) as completed_count,
        SUM(CASE WHEN rd.status = 'pending' THEN rd.barber_amount ELSE 0 END) as pending_barber_amount,
        SUM(CASE WHEN rd.status = 'pending' THEN rd.barbershop_amount ELSE 0 END) as pending_barbershop_amount
      FROM revenue_distribution rd
      ${whereClause}
    `, params);

    // Get commission summary by barber
    const [barberSummary] = await pool.execute(`
      SELECT
        b.id as barber_id,
        b.name as barber_name,
        b.commission_percentage,
        COUNT(rd.id) as total_services,
        SUM(rd.total_amount) as total_revenue,
        SUM(rd.barber_amount) as total_barber_earnings,
        SUM(rd.barbershop_amount) as total_barbershop_earnings,
        SUM(CASE WHEN rd.status = 'pending' THEN rd.barber_amount ELSE 0 END) as pending_earnings,
        AVG(rd.total_amount) as avg_service_amount
      FROM barbers b
      LEFT JOIN revenue_distribution rd ON b.id = rd.barber_id AND rd.barbershop_id = ?
      WHERE b.barbershop_id = ? AND b.is_active = TRUE
      GROUP BY b.id, b.name, b.commission_percentage
      ORDER BY total_revenue DESC
    `, [barbershopId, barbershopId]);

    res.json({
      distributions,
      total: totalCount[0].total,
      limit: validLimit,
      offset: validOffset,
      summary: summary[0],
      barber_summary: barberSummary,
      filters: {
        start_date: startDate || null,
        end_date: endDate || null,
        status: status || null,
        barber_id: barberId || null
      }
    });

  } catch (error) {
    console.error('Error obteniendo distribuciones de comisión:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Get commission details for a specific barber
router.get('/barber/:barberId', authenticateToken(), checkBarberAccess, async (req, res) => {
  try {
    const { barberId } = req.params;
    const { startDate, endDate, status, limit = 50, offset = 0 } = req.query;
    const pool = getPool();

    let whereClause = 'WHERE rd.barber_id = ?';
    let params = [barberId];

    if (startDate && endDate) {
      whereClause += ' AND rd.distribution_date BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      whereClause += ' AND rd.distribution_date >= ?';
      params.push(startDate);
    } else if (endDate) {
      whereClause += ' AND rd.distribution_date <= ?';
      params.push(endDate);
    }

    if (status && ['pending', 'paid_to_barber', 'completed'].includes(status)) {
      whereClause += ' AND rd.status = ?';
      params.push(status);
    }

    const validLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 500);
    const validOffset = Math.max(parseInt(offset) || 0, 0);

    // Get barber information
    const [barberInfo] = await pool.execute(
      'SELECT id, name, email, commission_percentage, barbershop_id FROM barbers WHERE id = ?',
      [barberId]
    );

    if (barberInfo.length === 0) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }

    // Get commission distributions for the barber
    const [distributions] = await pool.execute(`
      SELECT
        rd.*,
        a.client_name,
        a.appointment_date,
        br.description as service_description
      FROM revenue_distribution rd
      JOIN barbershop_revenue br ON rd.barbershop_revenue_id = br.id
      LEFT JOIN appointments a ON br.appointment_id = a.id
      ${whereClause}
      ORDER BY rd.created_at DESC
      LIMIT ${validLimit} OFFSET ${validOffset}
    `, params);

    // Get summary for the barber
    const [summary] = await pool.execute(`
      SELECT
        COUNT(*) as total_services,
        SUM(rd.total_amount) as total_revenue,
        SUM(rd.barber_amount) as total_earnings,
        SUM(CASE WHEN rd.status = 'pending' THEN rd.barber_amount ELSE 0 END) as pending_earnings,
        SUM(CASE WHEN rd.status = 'paid_to_barber' THEN rd.barber_amount ELSE 0 END) as paid_earnings,
        AVG(rd.total_amount) as avg_service_amount,
        MAX(rd.distribution_date) as last_service_date
      FROM revenue_distribution rd
      ${whereClause}
    `, params);

    res.json({
      barber: barberInfo[0],
      distributions,
      summary: summary[0],
      filters: {
        start_date: startDate || null,
        end_date: endDate || null,
        status: status || null
      }
    });

  } catch (error) {
    console.error('Error obteniendo comisiones del barbero:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Update barber commission percentage
router.patch('/barber/:barberId/commission',
  authenticateToken(),
  checkBarberAccess,
  [
    body('commission_percentage').isFloat({ min: 0, max: 100 }).withMessage('Porcentaje debe estar entre 0 y 100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { barberId } = req.params;
      const { commission_percentage } = req.body;
      const pool = getPool();

      await pool.execute(
        'UPDATE barbers SET commission_percentage = ? WHERE id = ?',
        [commission_percentage, barberId]
      );

      const [updatedBarber] = await pool.execute(
        'SELECT id, name, email, commission_percentage FROM barbers WHERE id = ?',
        [barberId]
      );

      res.json({
        message: 'Porcentaje de comisión actualizado exitosamente',
        barber: updatedBarber[0],
        old_percentage: commission_percentage,
        new_percentage: commission_percentage
      });

    } catch (error) {
      console.error('Error actualizando porcentaje de comisión:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// Mark commission as paid to barber
router.patch('/distribution/:distributionId/pay',
  authenticateToken(),
  [
    body('notes').optional().isString().withMessage('Las notas deben ser texto')
  ],
  async (req, res) => {
    try {
      const { distributionId } = req.params;
      const { notes } = req.body;
      const pool = getPool();

      // Get distribution details
      const [distribution] = await pool.execute(
        'SELECT * FROM revenue_distribution WHERE id = ?',
        [distributionId]
      );

      if (distribution.length === 0) {
        return res.status(404).json({ error: 'Distribución no encontrada' });
      }

      // Check access permissions
      if (req.user.role !== 'admin' && req.user.barbershop_id !== distribution[0].barbershop_id) {
        return res.status(403).json({ error: 'No tienes permisos para modificar esta distribución' });
      }

      // Update status to paid
      const updateNotes = notes ? `${distribution[0].notes || ''}\n${notes}` : distribution[0].notes;

      await pool.execute(
        'UPDATE revenue_distribution SET status = "paid_to_barber", notes = ?, updated_at = NOW() WHERE id = ?',
        [updateNotes, distributionId]
      );

      const [updatedDistribution] = await pool.execute(`
        SELECT rd.*, b.name as barber_name
        FROM revenue_distribution rd
        JOIN barbers b ON rd.barber_id = b.id
        WHERE rd.id = ?
      `, [distributionId]);

      res.json({
        message: 'Comisión marcada como pagada exitosamente',
        distribution: updatedDistribution[0]
      });

    } catch (error) {
      console.error('Error marcando comisión como pagada:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
);

// Get commission statistics and charts data
router.get('/barbershop/:barbershopId/stats', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const { year = new Date().getFullYear(), month } = req.query;
    const pool = getPool();

    let dateFilter = 'WHERE rd.barbershop_id = ? AND YEAR(rd.distribution_date) = ?';
    let params = [barbershopId, year];

    if (month) {
      dateFilter += ' AND MONTH(rd.distribution_date) = ?';
      params.push(month);
    }

    // Monthly distribution statistics
    const [monthlyStats] = await pool.execute(`
      SELECT
        MONTH(rd.distribution_date) as month,
        YEAR(rd.distribution_date) as year,
        SUM(rd.total_amount) as total_revenue,
        SUM(rd.barber_amount) as total_barber_amount,
        SUM(rd.barbershop_amount) as total_barbershop_amount,
        COUNT(*) as total_services,
        COUNT(DISTINCT rd.barber_id) as active_barbers
      FROM revenue_distribution rd
      ${dateFilter}
      GROUP BY YEAR(rd.distribution_date), MONTH(rd.distribution_date)
      ORDER BY year, month
    `, params);

    // Top performing barbers
    const [topBarbers] = await pool.execute(`
      SELECT
        b.id,
        b.name,
        b.commission_percentage,
        SUM(rd.total_amount) as total_revenue,
        SUM(rd.barber_amount) as total_earnings,
        COUNT(rd.id) as total_services,
        AVG(rd.total_amount) as avg_service_amount
      FROM barbers b
      JOIN revenue_distribution rd ON b.id = rd.barber_id
      ${dateFilter}
      GROUP BY b.id, b.name, b.commission_percentage
      ORDER BY total_revenue DESC
      LIMIT 10
    `, params);

    // Commission distribution by status
    const [statusStats] = await pool.execute(`
      SELECT
        rd.status,
        COUNT(*) as count,
        SUM(rd.total_amount) as total_amount,
        SUM(rd.barber_amount) as barber_amount,
        SUM(rd.barbershop_amount) as barbershop_amount
      FROM revenue_distribution rd
      ${dateFilter}
      GROUP BY rd.status
    `, params);

    res.json({
      period: { year: parseInt(year), month: month ? parseInt(month) : null },
      monthly_stats: monthlyStats,
      top_barbers: topBarbers,
      status_distribution: statusStats
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas de comisiones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;