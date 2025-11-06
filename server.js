const express = require('express');
const cors = require('cors');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const barberShopRoutes = require('./routes/barbershops');
const barberRoutes = require('./routes/barbers');
const appointmentRoutes = require('./routes/appointments');
const billingRoutes = require('./routes/billing');
const commissionsRoutes = require('./routes/commissions');
const whatsappRoutes = require('./routes/whatsapp');
const cronRoutes = require('./routes/cron');

const socketHandler = require('./socket/socketHandler');
const cronJobs = require('./services/cronJobs');
const { initDatabase } = require('./database/connection');

const app = express();

// SSL certificate paths - Choose based on environment
const isDevelopment = process.env.NODE_ENV === 'development';
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'ssl', isDevelopment ? 'key.pem' : 'mibarberiaweb.key')),
  cert: fs.readFileSync(path.join(__dirname, 'ssl', isDevelopment ? 'cert.pem' : 'mibarberiaweb.crt'))
};

// Create both HTTP and HTTPS servers
const httpServer = http.createServer(app);
const httpsServer = https.createServer(sslOptions, app);

// Socket.io with both servers
const io = socketIo(httpsServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Also create socket for HTTP server for backward compatibility
const ioHttp = socketIo(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// HTTP to HTTPS redirect middleware (must be first)
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https' && req.secure !== true) {
    return res.redirect(301, `https://${req.header('host')}${req.url}`);
  }
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/barbershops', barberShopRoutes);
app.use('/api/barbers', barberRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/commissions', commissionsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/cron', cronRoutes);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/public/admin.html');
});

app.get('/barbershop', (req, res) => {
  res.sendFile(__dirname + '/public/barbershop.html');
});

app.get('/barber', (req, res) => {
  res.sendFile(__dirname + '/public/barber.html');
});

app.get('/auth/register-barbershop', (req, res) => {
  res.sendFile(__dirname + '/public/register-trial.html');
});

app.get('/manual', (req, res) => {
  res.sendFile(__dirname + '/public/manual-chatbot-clientes.html');
});

app.get('/manual/download', (req, res) => {
  res.download(__dirname + '/Manual-Chatbot-MiBarberiaWeb.md', 'Manual-Chatbot-MiBarberiaWeb.md');
});

app.set('socketio', io);
global.io = io;
socketHandler(io);
socketHandler(ioHttp);
cronJobs.startCronJobs();

const HTTP_PORT = process.env.PORT || 80;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;

async function startServer() {
  try {
    await initDatabase();
    console.log('✅ Base de datos inicializada correctamente');
    
    // Start HTTP server
    httpServer.listen(HTTP_PORT, () => {
      console.log(`🔓 Servidor HTTP corriendo en puerto ${HTTP_PORT} (redirige a HTTPS)`);
    });

    // Start HTTPS server
    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`🔒 Servidor HTTPS corriendo en puerto ${HTTPS_PORT}`);
      console.log(`🌐 Panel Admin: https://localhost:${HTTPS_PORT}/admin`);
      console.log(`🏪 Panel Barbería: https://localhost:${HTTPS_PORT}/barbershop`);
      console.log(`✂️ Panel Barbero: https://localhost:${HTTPS_PORT}/barber`);
      console.log(`📱 WhatsApp: Reconexión automática programada en 60 segundos...`);
    });
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown handling
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;

  isShuttingDown = true;
  console.log(`\n🛑 ${signal} recibido. Cerrando servidor correctamente...`);

  // Cerrar servidores HTTP/HTTPS
  const closePromises = [];

  if (httpServer) {
    closePromises.push(new Promise((resolve) => {
      httpServer.close(() => {
        console.log('✅ Servidor HTTP cerrado');
        resolve();
      });
    }));
  }

  if (httpsServer) {
    closePromises.push(new Promise((resolve) => {
      httpsServer.close(() => {
        console.log('✅ Servidor HTTPS cerrado');
        resolve();
      });
    }));
  }

  // Esperar a que se cierren los servidores con timeout
  await Promise.race([
    Promise.all(closePromises),
    new Promise(resolve => setTimeout(resolve, 5000)) // Timeout de 5 segundos
  ]);

  console.log('👋 Servidor cerrado correctamente');
  process.exit(0);
}

// Manejar señales de terminación
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Error no capturado:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rechazada no manejada:', reason);
  gracefulShutdown('unhandledRejection');
});