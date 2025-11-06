const express = require('express');
const { getPool } = require('../database/connection');
const { authenticateToken, checkBarbershopAccess } = require('../middleware/auth');

const router = express.Router();

// Obtener informe de facturación
router.get('/report/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const { periodType, startDate, endDate, barberId } = req.query;

    const pool = getPool();

    // Calcular fechas según el tipo de período
    let dateCondition = '';
    let dateParams = [];

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (periodType) {
      case 'daily':
        const targetDate = startDate || todayStr;
        dateCondition = 'DATE(a.appointment_date) = ?';
        dateParams = [targetDate];
        break;

      case 'weekly':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        dateCondition = 'DATE(a.appointment_date) BETWEEN ? AND ?';
        dateParams = [weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]];
        break;

      case 'biweekly':
        const biweeklyStart = new Date(today);
        biweeklyStart.setDate(today.getDate() - 13);
        dateCondition = 'DATE(a.appointment_date) BETWEEN ? AND ?';
        dateParams = [biweeklyStart.toISOString().split('T')[0], todayStr];
        break;

      case 'monthly':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        dateCondition = 'DATE(a.appointment_date) BETWEEN ? AND ?';
        dateParams = [monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]];
        break;

      case 'custom':
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'Fechas de inicio y fin requeridas para período personalizado' });
        }
        dateCondition = 'DATE(a.appointment_date) BETWEEN ? AND ?';
        dateParams = [startDate, endDate];
        break;

      default:
        return res.status(400).json({ error: 'Tipo de período inválido' });
    }

    // Construir consulta base
    let baseQuery = `
      SELECT
        b.id as barber_id,
        b.name as barber_name,
        b.commission_percentage,
        COUNT(a.id) as completed_appointments,
        COALESCE(SUM(a.service_amount), 0) as total_revenue,
        COALESCE(SUM(a.service_amount * b.commission_percentage / 100), 0) as barber_commission,
        COALESCE(SUM(a.service_amount * (100 - b.commission_percentage) / 100), 0) as barbershop_earnings
      FROM barbers b
      LEFT JOIN appointments a ON b.id = a.barber_id
        AND a.barbershop_id = ?
        AND a.status = 'completed'
        AND ${dateCondition}
      WHERE b.barbershop_id = ?
    `;

    let queryParams = [parseInt(barbershopId), ...dateParams, parseInt(barbershopId)];

    // Filtrar por barbero específico si se proporciona
    if (barberId && barberId !== '') {
      baseQuery += ' AND b.id = ?';
      queryParams.push(parseInt(barberId));
    }

    baseQuery += ' GROUP BY b.id, b.name, b.commission_percentage ORDER BY total_revenue DESC';

    const [barberReports] = await pool.execute(baseQuery, queryParams);

    // Calcular totales generales
    const totals = barberReports.reduce((acc, report) => {
      acc.totalRevenue += parseFloat(report.total_revenue);
      acc.totalCommissions += parseFloat(report.barber_commission);
      acc.barbershopEarnings += parseFloat(report.barbershop_earnings);
      acc.totalAppointments += parseInt(report.completed_appointments);
      return acc;
    }, {
      totalRevenue: 0,
      totalCommissions: 0,
      barbershopEarnings: 0,
      totalAppointments: 0
    });

    // Obtener detalle de citas para la tabla diaria
    let detailQuery = `
      SELECT
        a.appointment_date,
        a.estimated_time as appointment_time,
        a.client_name,
        a.client_phone,
        b.name as barber_name,
        'Servicio' as service_type,
        a.service_amount as price,
        ROUND(a.service_amount * b.commission_percentage / 100, 2) as commission,
        a.status
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.barbershop_id = ?
        AND a.status = 'completed'
        AND ${dateCondition}
    `;

    let detailParams = [parseInt(barbershopId), ...dateParams];

    if (barberId && barberId !== '') {
      detailQuery += ' AND a.barber_id = ?';
      detailParams.push(parseInt(barberId));
    }

    detailQuery += ' ORDER BY a.appointment_date DESC, a.appointment_time DESC';

    const [appointmentDetails] = await pool.execute(detailQuery, detailParams);

    res.json({
      success: true,
      period: {
        type: periodType,
        startDate: dateParams[0] || null,
        endDate: dateParams[1] || null
      },
      totals,
      barberReports,
      appointmentDetails
    });

  } catch (error) {
    console.error('Error generando informe de facturación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Obtener resumen rápido para el dashboard
router.get('/summary/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const pool = getPool();

    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    // Resumen del día actual
    const [todayData] = await pool.execute(`
      SELECT
        COUNT(a.id) as today_appointments,
        COALESCE(SUM(a.service_amount), 0) as today_revenue,
        COALESCE(SUM(a.service_amount * b.commission_percentage / 100), 0) as today_commissions
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.barbershop_id = ?
        AND DATE(a.appointment_date) = ?
        AND a.status = 'completed'
    `, [parseInt(barbershopId), today]);

    // Resumen del mes actual
    const [monthData] = await pool.execute(`
      SELECT
        COUNT(a.id) as month_appointments,
        COALESCE(SUM(a.service_amount), 0) as month_revenue,
        COALESCE(SUM(a.service_amount * b.commission_percentage / 100), 0) as month_commissions
      FROM appointments a
      JOIN barbers b ON a.barber_id = b.id
      WHERE a.barbershop_id = ?
        AND DATE(a.appointment_date) >= ?
        AND a.status = 'completed'
    `, [parseInt(barbershopId), monthStartStr]);

    const summary = {
      today: {
        appointments: todayData[0].today_appointments,
        revenue: parseFloat(todayData[0].today_revenue),
        commissions: parseFloat(todayData[0].today_commissions),
        barbershopEarnings: parseFloat(todayData[0].today_revenue) - parseFloat(todayData[0].today_commissions)
      },
      month: {
        appointments: monthData[0].month_appointments,
        revenue: parseFloat(monthData[0].month_revenue),
        commissions: parseFloat(monthData[0].month_commissions),
        barbershopEarnings: parseFloat(monthData[0].month_revenue) - parseFloat(monthData[0].month_commissions)
      }
    };

    res.json({ success: true, summary });

  } catch (error) {
    console.error('Error obteniendo resumen de facturación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Exportar informe a CSV
router.post('/export/:barbershopId', authenticateToken(), checkBarbershopAccess, async (req, res) => {
  try {
    const { barbershopId } = req.params;
    const { periodType, startDate, endDate, barberId, reportData } = req.body;

    // Crear contenido CSV
    let csvContent = 'Barbero,Citas Completadas,Ingresos Brutos,% Comision,Pago al Barbero,Ganancia Barberia\n';

    if (reportData && reportData.barberReports) {
      reportData.barberReports.forEach(report => {
        csvContent += `"${report.barber_name}",${report.completed_appointments},"$${report.total_revenue}","${report.commission_percentage}%","$${report.barber_commission}","$${report.barbershop_earnings}"\n`;
      });

      // Agregar totales
      csvContent += '\nTOTALES:';
      csvContent += `${reportData.totals.totalAppointments},"$${reportData.totals.totalRevenue}",,"$${reportData.totals.totalCommissions}","$${reportData.totals.barbershopEarnings}"\n`;
    }

    // Configurar headers para descarga
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="informe_facturacion_${periodType}_${new Date().toISOString().split('T')[0]}.csv"`);

    res.send(csvContent);

  } catch (error) {
    console.error('Error exportando informe:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;