const jwt = require('jsonwebtoken');

module.exports = (io) => {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.user = decoded;
      }
      next();
    } catch (err) {
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log(`Cliente conectado: ${socket.id}`);

    if (socket.user) {
      if (socket.user.role === 'barber') {
        socket.join(`barber_${socket.user.id}`);
        console.log(`Barbero ${socket.user.id} se unió a su sala`);
      } else if (socket.user.role === 'barbershop') {
        socket.join(`barbershop_${socket.user.id}`);
        console.log(`Barbería ${socket.user.id} se unió a su sala`);
      }
    }

    socket.on('join_barbershop_room', (barbershopId) => {
      console.log(`Solicitud para unirse a barbershop_${barbershopId}`);
      console.log(`Usuario:`, socket.user);
      if (socket.user && (socket.user.role === 'admin' || 
          (socket.user.role === 'barbershop' && socket.user.id == barbershopId))) {
        socket.join(`barbershop_${barbershopId}`);
        console.log(`Usuario se unió exitosamente a barbershop_${barbershopId}`);
      } else {
        console.log(`Usuario no autorizado para unirse a barbershop_${barbershopId}`);
      }
    });

    socket.on('join_barber_room', (barberId) => {
      if (socket.user && (socket.user.role === 'admin' || 
          (socket.user.role === 'barber' && socket.user.id == barberId) ||
          socket.user.role === 'barbershop')) {
        socket.join(`barber_${barberId}`);
        console.log(`Usuario se unió a barber_${barberId}`);
      }
    });

    socket.on('barber_status_update', (data) => {
      if (socket.user && socket.user.role === 'barber') {
        const { status, barbershop_id } = data;
        
        socket.to(`barbershop_${barbershop_id}`).emit('barber_status_changed', {
          barber_id: socket.user.id,
          status: status,
          timestamp: new Date()
        });
        
        console.log(`Barbero ${socket.user.id} cambió estado a: ${status}`);
      }
    });

    socket.on('request_queue_update', async (data) => {
      try {
        const { barber_id, date } = data;
        
        if (socket.user && (socket.user.role === 'barber' || socket.user.role === 'barbershop' || socket.user.role === 'admin')) {
          const { getPool } = require('../database/connection');
          const pool = getPool();
          
          const [appointments] = await pool.execute(`
            SELECT id, client_name, queue_number, status, estimated_time
            FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
            ORDER BY queue_number
          `, [barber_id, date]);
          
          socket.emit('queue_update_response', {
            barber_id,
            date,
            appointments,
            total_waiting: appointments.filter(apt => apt.status === 'waiting').length
          });
        }
      } catch (error) {
        console.error('Error actualizando cola:', error);
        socket.emit('error', { message: 'Error obteniendo datos de la cola' });
      }
    });

    socket.on('barbershop_open_close', (data) => {
      if (socket.user && socket.user.role === 'barbershop') {
        const { is_open } = data;
        
        socket.to(`barbershop_${socket.user.id}`).emit('barbershop_status_changed', {
          barbershop_id: socket.user.id,
          is_open,
          timestamp: new Date()
        });
        
        socket.broadcast.emit('barbershop_availability_changed', {
          barbershop_id: socket.user.id,
          is_open,
          timestamp: new Date()
        });
        
        console.log(`Barbería ${socket.user.id} ${is_open ? 'abrió' : 'cerró'}`);
      }
    });

    socket.on('client_queue_check', async (data) => {
      try {
        const { client_phone, barber_id, date } = data;
        const { getPool } = require('../database/connection');
        const pool = getPool();
        
        const [appointment] = await pool.execute(`
          SELECT a.id, a.queue_number, a.status, a.estimated_time,
                 b.service_duration_minutes
          FROM appointments a
          JOIN barbers b ON a.barber_id = b.id
          WHERE a.client_phone = ? AND a.barber_id = ? AND a.appointment_date = ? 
          AND a.status IN ('waiting', 'in_progress')
        `, [client_phone, barber_id, date]);
        
        if (appointment.length > 0) {
          const apt = appointment[0];
          
          if (apt.status === 'waiting') {
            const [queuePosition] = await pool.execute(`
              SELECT COUNT(*) as position
              FROM appointments 
              WHERE barber_id = ? AND appointment_date = ? AND status = 'waiting' 
              AND queue_number < ?
            `, [barber_id, date, apt.queue_number]);
            
            const waitTime = queuePosition[0].position * apt.service_duration_minutes;
            
            socket.emit('client_queue_status', {
              appointment_id: apt.id,
              queue_position: queuePosition[0].position + 1,
              estimated_wait_minutes: waitTime,
              status: 'waiting'
            });
          } else {
            socket.emit('client_queue_status', {
              appointment_id: apt.id,
              status: 'in_progress',
              message: 'Tu turno está siendo atendido ahora'
            });
          }
        } else {
          socket.emit('client_queue_status', {
            error: 'No tienes turnos pendientes para esta fecha'
          });
        }
      } catch (error) {
        console.error('Error consultando estado del cliente:', error);
        socket.emit('error', { message: 'Error consultando tu turno' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Cliente desconectado: ${socket.id}`);
    });
  });

  return io;
};