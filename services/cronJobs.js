const cron = require('node-cron');
const { getPool } = require('../database/connection');
const moment = require('moment');

class CronJobs {
  constructor() {
    this.jobs = [];
  }

  startCronJobs() {
    console.log('🕒 Iniciando tareas programadas...');
    
    this.generateMonthlyBills();
    this.checkOverdueBills();
    this.sendReminders();
    this.cleanupOldData();
    
    console.log('✅ Todas las tareas programadas iniciadas');
  }

  generateMonthlyBills() {
    const job = cron.schedule('0 9 * * *', async () => {
      console.log('🧾 Ejecutando generación de facturas mensuales...');
      await this.processMonthlyBilling();
    }, {
      scheduled: true,
      timezone: "America/Mexico_City"
    });
    
    this.jobs.push({ name: 'monthly_bills', job });
    console.log('📅 Tarea programada: Generación de facturas mensuales (diaria a las 9:00 AM)');
  }

  checkOverdueBills() {
    const job = cron.schedule('0 10 * * *', async () => {
      console.log('⚠️ Verificando facturas vencidas...');
      await this.processOverdueBills();
    }, {
      scheduled: true,
      timezone: "America/Mexico_City"
    });
    
    this.jobs.push({ name: 'overdue_bills', job });
    console.log('📅 Tarea programada: Verificación de facturas vencidas (diaria a las 10:00 AM)');
  }

  sendReminders() {
    const job = cron.schedule('0 11 * * *', async () => {
      console.log('📢 Enviando recordatorios de pago...');
      await this.processPaymentReminders();
    }, {
      scheduled: true,
      timezone: "America/Mexico_City"
    });
    
    this.jobs.push({ name: 'payment_reminders', job });
    console.log('📅 Tarea programada: Recordatorios de pago (diaria a las 11:00 AM)');
  }

  cleanupOldData() {
    const job = cron.schedule('0 2 * * 0', async () => {
      console.log('🧹 Limpiando datos antiguos...');
      await this.processDataCleanup();
    }, {
      scheduled: true,
      timezone: "America/Mexico_City"
    });
    
    this.jobs.push({ name: 'data_cleanup', job });
    console.log('📅 Tarea programada: Limpieza de datos (domingos a las 2:00 AM)');
  }

  async processMonthlyBilling() {
    try {
      const pool = getPool();
      const today = moment();
      
      const [barbershops] = await pool.execute(`
        SELECT id, name, email, whatsapp_number, billing_day, monthly_fee, is_active, is_suspended
        FROM barbershops 
        WHERE is_active = TRUE
      `);

      for (let barbershop of barbershops) {
        try {
          const billingDay = barbershop.billing_day || 1;
          
          if (today.date() !== billingDay) {
            continue;
          }

          const currentMonth = today.format('YYYY-MM');
          
          const [existingBill] = await pool.execute(
            'SELECT id FROM billing WHERE barbershop_id = ? AND billing_period = ?',
            [barbershop.id, currentMonth]
          );

          if (existingBill.length > 0) {
            console.log(`Factura ya existe para barbería ${barbershop.id} en período ${currentMonth}`);
            continue;
          }

          const dueDate = moment().add(15, 'days').format('YYYY-MM-DD');

          const [result] = await pool.execute(`
            INSERT INTO billing (barbershop_id, billing_period, amount, due_date, status)
            VALUES (?, ?, ?, ?, 'pending')
          `, [barbershop.id, currentMonth, barbershop.monthly_fee, dueDate]);

          console.log(`✅ Factura generada para ${barbershop.name} - Período: ${currentMonth} - Monto: $${barbershop.monthly_fee}`);

          if (barbershop.whatsapp_number && !barbershop.is_suspended) {
            await this.sendBillingNotification(barbershop.id, {
              id: result.insertId,
              amount: barbershop.monthly_fee,
              billing_period: currentMonth,
              due_date: dueDate
            });
          }

        } catch (error) {
          console.error(`Error generando factura para barbería ${barbershop.id}:`, error);
        }
      }

    } catch (error) {
      console.error('Error en generación de facturas mensuales:', error);
    }
  }

  async processOverdueBills() {
    try {
      const pool = getPool();
      const today = moment().format('YYYY-MM-DD');
      
      const [result] = await pool.execute(`
        UPDATE billing 
        SET status = 'overdue' 
        WHERE status = 'pending' AND due_date < ? 
      `, [today]);

      if (result.affectedRows > 0) {
        console.log(`📊 Marcadas ${result.affectedRows} facturas como vencidas`);
      }

      const [overdueBills] = await pool.execute(`
        SELECT b.id, b.barbershop_id, b.amount, b.due_date,
               bs.name as barbershop_name, bs.whatsapp_number,
               DATEDIFF(?, b.due_date) as days_overdue
        FROM billing b
        JOIN barbershops bs ON b.barbershop_id = bs.id
        WHERE b.status = 'overdue' AND bs.is_active = TRUE AND bs.is_suspended = FALSE
        AND DATEDIFF(?, b.due_date) IN (3, 7, 15)
      `, [today, today]);

      for (let bill of overdueBills) {
        if (bill.days_overdue >= 15) {
          await this.suspendBarbershop(bill.barbershop_id, 
            `Servicio suspendido por falta de pago. Factura vencida hace ${bill.days_overdue} días.`);
        } else {
          if (bill.whatsapp_number) {
            await this.sendOverdueReminder(bill.barbershop_id, {
              amount: bill.amount,
              days_overdue: bill.days_overdue,
              due_date: bill.due_date
            });
          }
        }
      }

    } catch (error) {
      console.error('Error procesando facturas vencidas:', error);
    }
  }

  async processPaymentReminders() {
    try {
      const pool = getPool();
      const today = moment();
      const reminderDays = [7, 3, 1];
      
      for (let days of reminderDays) {
        const reminderDate = today.clone().add(days, 'days').format('YYYY-MM-DD');
        
        const [bills] = await pool.execute(`
          SELECT b.id, b.barbershop_id, b.amount, b.due_date, b.billing_period,
                 bs.name as barbershop_name, bs.whatsapp_number
          FROM billing b
          JOIN barbershops bs ON b.barbershop_id = bs.id
          WHERE b.status = 'pending' AND b.due_date = ? 
          AND bs.is_active = TRUE AND bs.is_suspended = FALSE
        `, [reminderDate]);

        for (let bill of bills) {
          if (bill.whatsapp_number) {
            await this.sendPaymentReminder(bill.barbershop_id, {
              amount: bill.amount,
              due_date: bill.due_date,
              days_left: days,
              billing_period: bill.billing_period
            });
            
            console.log(`📨 Recordatorio enviado a ${bill.barbershop_name} - ${days} días restantes`);
          }
        }
      }

    } catch (error) {
      console.error('Error enviando recordatorios de pago:', error);
    }
  }

  async processDataCleanup() {
    try {
      const pool = getPool();
      
      const oneYearAgo = moment().subtract(1, 'year').format('YYYY-MM-DD');
      const sixMonthsAgo = moment().subtract(6, 'months').format('YYYY-MM-DD');
      const threeMonthsAgo = moment().subtract(3, 'months').format('YYYY-MM-DD');

      const [oldAppointments] = await pool.execute(`
        DELETE FROM appointments 
        WHERE appointment_date < ? AND status IN ('completed', 'cancelled')
      `, [oneYearAgo]);

      const [oldMessages] = await pool.execute(`
        DELETE FROM whatsapp_messages 
        WHERE sent_at < ?
      `, [sixMonthsAgo]);

      const [oldBillingCancelled] = await pool.execute(`
        DELETE FROM billing 
        WHERE created_at < ? AND status = 'cancelled'
      `, [threeMonthsAgo]);

      console.log(`🧹 Datos limpiados: ${oldAppointments.affectedRows} turnos antiguos, ${oldMessages.affectedRows} mensajes antiguos, ${oldBillingCancelled.affectedRows} facturas canceladas`);

    } catch (error) {
      console.error('Error limpiando datos antiguos:', error);
    }
  }

  async suspendBarbershop(barbershopId, reason) {
    try {
      const pool = getPool();
      
      await pool.execute(`
        UPDATE barbershops 
        SET is_suspended = TRUE, suspension_reason = ? 
        WHERE id = ?
      `, [reason, barbershopId]);

      const [barbershop] = await pool.execute(
        'SELECT name, whatsapp_number FROM barbershops WHERE id = ?',
        [barbershopId]
      );

      if (barbershop.length > 0) {
        console.log(`🚫 Barbería ${barbershop[0].name} suspendida: ${reason}`);
        
        if (barbershop[0].whatsapp_number) {
          await this.sendSuspensionNotification(barbershopId, reason);
        }
      }

    } catch (error) {
      console.error(`Error suspendiendo barbería ${barbershopId}:`, error);
    }
  }

  async sendBillingNotification(barbershopId, billData) {
    try {
      const pool = getPool();
      
      const [templateRows] = await pool.execute(
        'SELECT message_template FROM notification_templates WHERE template_type = "billing" AND is_active = TRUE'
      );

      if (templateRows.length === 0) return;

      let message = templateRows[0].message_template;
      message = message.replace('{{amount}}', billData.amount);
      message = message.replace('{{period}}', billData.billing_period);
      message = message.replace('{{due_date}}', moment(billData.due_date).format('DD/MM/YYYY'));

      const [barbershopRows] = await pool.execute(
        'SELECT whatsapp_number FROM barbershops WHERE id = ?',
        [barbershopId]
      );

      if (barbershopRows.length > 0 && barbershopRows[0].whatsapp_number) {
        await pool.execute(`
          INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type)
          VALUES (?, ?, ?, 'billing')
        `, [barbershopId, barbershopRows[0].whatsapp_number, message]);
      }

    } catch (error) {
      console.error('Error enviando notificación de facturación:', error);
    }
  }

  async sendPaymentReminder(barbershopId, reminderData) {
    try {
      const pool = getPool();
      
      const [templateRows] = await pool.execute(
        'SELECT message_template FROM notification_templates WHERE template_type = "reminder" AND is_active = TRUE'
      );

      if (templateRows.length === 0) return;

      let message = templateRows[0].message_template;
      message = message.replace('{{amount}}', reminderData.amount);
      message = message.replace('{{days_left}}', reminderData.days_left);
      message = message.replace('{{due_date}}', moment(reminderData.due_date).format('DD/MM/YYYY'));

      const [barbershopRows] = await pool.execute(
        'SELECT whatsapp_number FROM barbershops WHERE id = ?',
        [barbershopId]
      );

      if (barbershopRows.length > 0 && barbershopRows[0].whatsapp_number) {
        await pool.execute(`
          INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type)
          VALUES (?, ?, ?, 'reminder')
        `, [barbershopId, barbershopRows[0].whatsapp_number, message]);
      }

    } catch (error) {
      console.error('Error enviando recordatorio:', error);
    }
  }

  async sendOverdueReminder(barbershopId, overdueData) {
    try {
      const pool = getPool();
      
      const [templateRows] = await pool.execute(
        'SELECT message_template FROM notification_templates WHERE template_type = "reminder" AND is_active = TRUE'
      );

      if (templateRows.length === 0) return;

      let message = `⚠️ *FACTURA VENCIDA*\n\nTu factura por $${overdueData.amount} está vencida desde hace ${overdueData.days_overdue} días.\n\nRealiza el pago inmediatamente para evitar la suspensión del servicio.`;

      const [barbershopRows] = await pool.execute(
        'SELECT whatsapp_number FROM barbershops WHERE id = ?',
        [barbershopId]
      );

      if (barbershopRows.length > 0 && barbershopRows[0].whatsapp_number) {
        await pool.execute(`
          INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type)
          VALUES (?, ?, ?, 'reminder')
        `, [barbershopId, barbershopRows[0].whatsapp_number, message]);
      }

    } catch (error) {
      console.error('Error enviando recordatorio de vencido:', error);
    }
  }

  async sendSuspensionNotification(barbershopId, reason) {
    try {
      const pool = getPool();
      
      const [templateRows] = await pool.execute(
        'SELECT message_template FROM notification_templates WHERE template_type = "suspension" AND is_active = TRUE'
      );

      let message = reason;
      if (templateRows.length > 0) {
        message = templateRows[0].message_template;
      }

      const [barbershopRows] = await pool.execute(
        'SELECT whatsapp_number FROM barbershops WHERE id = ?',
        [barbershopId]
      );

      if (barbershopRows.length > 0 && barbershopRows[0].whatsapp_number) {
        await pool.execute(`
          INSERT INTO whatsapp_messages (barbershop_id, phone_number, message, message_type)
          VALUES (?, ?, ?, 'suspension')
        `, [barbershopId, barbershopRows[0].whatsapp_number, message]);
      }

    } catch (error) {
      console.error('Error enviando notificación de suspensión:', error);
    }
  }

  stopAllJobs() {
    this.jobs.forEach(jobInfo => {
      jobInfo.job.stop();
      console.log(`⏹️ Tarea detenida: ${jobInfo.name}`);
    });
    this.jobs = [];
  }

  getJobsStatus() {
    return this.jobs.map(jobInfo => ({
      name: jobInfo.name,
      running: jobInfo.job.running
    }));
  }

  async runManualBilling() {
    console.log('🔧 Ejecutando generación manual de facturas...');
    await this.processMonthlyBilling();
  }

  async runManualOverdueCheck() {
    console.log('🔧 Ejecutando verificación manual de vencidos...');
    await this.processOverdueBills();
  }

  async runManualReminders() {
    console.log('🔧 Ejecutando envío manual de recordatorios...');
    await this.processPaymentReminders();
  }

  async runManualCleanup() {
    console.log('🔧 Ejecutando limpieza manual de datos...');
    await this.processDataCleanup();
  }
}

module.exports = new CronJobs();