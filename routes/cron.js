const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const cronJobs = require('../services/cronJobs');

const router = express.Router();

// Ejecutar generación manual de facturas
router.post('/manual/billing', authenticateToken(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log('📋 Admin solicitó generación manual de facturas');
    await cronJobs.runManualBilling();
    res.json({ 
      message: 'Facturas generadas exitosamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en generación manual de facturas:', error);
    res.status(500).json({ error: 'Error generando facturas' });
  }
});

// Ejecutar verificación manual de facturas vencidas
router.post('/manual/overdue', authenticateToken(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log('⚠️ Admin solicitó verificación manual de vencidas');
    await cronJobs.runManualOverdueCheck();
    res.json({ 
      message: 'Verificación de facturas vencidas completada',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en verificación manual de vencidas:', error);
    res.status(500).json({ error: 'Error verificando facturas vencidas' });
  }
});

// Ejecutar envío manual de recordatorios
router.post('/manual/reminders', authenticateToken(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log('📨 Admin solicitó envío manual de recordatorios');
    await cronJobs.runManualReminders();
    res.json({ 
      message: 'Recordatorios enviados exitosamente',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en envío manual de recordatorios:', error);
    res.status(500).json({ error: 'Error enviando recordatorios' });
  }
});

// Ejecutar limpieza manual de datos
router.post('/manual/cleanup', authenticateToken(['admin', 'super_admin']), async (req, res) => {
  try {
    console.log('🧹 Admin solicitó limpieza manual de datos');
    await cronJobs.runManualCleanup();
    res.json({ 
      message: 'Limpieza de datos completada',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error en limpieza manual de datos:', error);
    res.status(500).json({ error: 'Error limpiando datos' });
  }
});

// Obtener estado de las tareas programadas
router.get('/status', authenticateToken(['admin', 'super_admin']), async (req, res) => {
  try {
    const jobsStatus = cronJobs.getJobsStatus();
    res.json({
      jobs: jobsStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error obteniendo estado de tareas:', error);
    res.status(500).json({ error: 'Error obteniendo estado' });
  }
});

module.exports = router;