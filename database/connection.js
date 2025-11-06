const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'barbershop_platform',
  charset: 'utf8mb4'
};

let pool;

async function createConnection() {
  try {
    pool = mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
    
    console.log('✅ Pool de conexiones MySQL creado');
    return pool;
  } catch (error) {
    console.error('❌ Error creando pool de conexiones:', error);
    throw error;
  }
}

async function initDatabase() {
  try {
    const tempConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await tempConnection.execute(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await tempConnection.end();

    await createConnection();
    await createTables();
    
    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('❌ Error inicializando base de datos:', error);
    throw error;
  }
}

async function createTables() {
  const connection = await pool.getConnection();
  
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS barbershops (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255) NOT NULL,
        whatsapp_number VARCHAR(50),
        billing_day INT DEFAULT 1,
        monthly_fee DECIMAL(10,2) DEFAULT 50.00,
        is_active BOOLEAN DEFAULT TRUE,
        is_suspended BOOLEAN DEFAULT FALSE,
        suspension_reason TEXT,
        is_trial BOOLEAN DEFAULT FALSE,
        trial_end_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Add trial columns if they don't exist (for existing databases)
    try {
      await connection.execute(`ALTER TABLE barbershops ADD COLUMN is_trial BOOLEAN DEFAULT FALSE`);
      await connection.execute(`ALTER TABLE barbershops ADD COLUMN trial_end_date DATE NULL`);
    } catch (error) {
      // Columns probably already exist, ignore error
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS barbers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        barbershop_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        phone VARCHAR(50),
        whatsapp_number VARCHAR(50),
        service_duration_minutes INT DEFAULT 30,
        commission_percentage DECIMAL(5,2) DEFAULT 60.00,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE
      )
    `);

    // Add commission_percentage column if it doesn't exist (for existing databases)
    try {
      await connection.execute(`ALTER TABLE barbers ADD COLUMN commission_percentage DECIMAL(5,2) DEFAULT 60.00`);
    } catch (error) {
      // Column probably already exists, ignore error
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS barber_schedules (
        id INT PRIMARY KEY AUTO_INCREMENT,
        barber_id INT NOT NULL,
        day_of_week ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday') NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_barber_day (barber_id, day_of_week)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        barbershop_id INT NOT NULL,
        barber_id INT NOT NULL,
        client_name VARCHAR(255) NOT NULL,
        client_phone VARCHAR(50) NOT NULL,
        appointment_date DATE NOT NULL,
        queue_number INT NOT NULL,
        status ENUM('waiting', 'in_progress', 'completed', 'cancelled') DEFAULT 'waiting',
        estimated_time TIME,
        actual_start_time TIMESTAMP NULL,
        actual_end_time TIMESTAMP NULL,
        service_amount DECIMAL(10,2) NULL,
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
        FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
        UNIQUE KEY unique_barber_queue (barber_id, appointment_date, queue_number)
      )
    `);

    // Add service_amount and notes columns if they don't exist (for existing databases)
    try {
      await connection.execute(`ALTER TABLE appointments ADD COLUMN service_amount DECIMAL(10,2) NULL`);
      await connection.execute(`ALTER TABLE appointments ADD COLUMN notes TEXT NULL`);
    } catch (error) {
      // Columns probably already exist, ignore error
    }

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS billing (
        id INT PRIMARY KEY AUTO_INCREMENT,
        barbershop_id INT NOT NULL,
        billing_period VARCHAR(7) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        due_date DATE NOT NULL,
        paid_date TIMESTAMP NULL,
        status ENUM('pending', 'paid', 'overdue', 'cancelled') DEFAULT 'pending',
        payment_method VARCHAR(100),
        transaction_id VARCHAR(255),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
        UNIQUE KEY unique_barbershop_period (barbershop_id, billing_period)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS barbershop_revenue (
        id INT PRIMARY KEY AUTO_INCREMENT,
        barbershop_id INT NOT NULL,
        appointment_id INT NULL,
        amount DECIMAL(10,2) NOT NULL,
        revenue_date DATE NOT NULL,
        description VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS revenue_distribution (
        id INT PRIMARY KEY AUTO_INCREMENT,
        barbershop_revenue_id INT NOT NULL,
        barber_id INT NOT NULL,
        barbershop_id INT NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        barber_amount DECIMAL(10,2) NOT NULL,
        barbershop_amount DECIMAL(10,2) NOT NULL,
        barber_percentage DECIMAL(5,2) NOT NULL,
        barbershop_percentage DECIMAL(5,2) NOT NULL,
        distribution_date DATE NOT NULL,
        status ENUM('pending', 'paid_to_barber', 'completed') DEFAULT 'pending',
        notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (barbershop_revenue_id) REFERENCES barbershop_revenue(id) ON DELETE CASCADE,
        FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
        FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
        UNIQUE KEY unique_revenue_distribution (barbershop_revenue_id)
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        barbershop_id INT,
        phone_number VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        message_type ENUM('billing', 'reminder', 'suspension', 'payment_thanks', 'appointment') NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status ENUM('sent', 'failed', 'pending') DEFAULT 'pending',
        FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE SET NULL
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notification_templates (
        id INT PRIMARY KEY AUTO_INCREMENT,
        template_type ENUM('billing', 'reminder', 'suspension', 'payment_thanks') NOT NULL UNIQUE,
        message_template TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS whatsapp_pending_notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        barbershop_id INT NOT NULL,
        barber_id INT NOT NULL,
        appointment_date DATE NOT NULL,
        notification_type VARCHAR(50) NOT NULL,
        client_phone VARCHAR(20),
        message TEXT,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('super_admin', 'admin') DEFAULT 'admin',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await connection.execute(`
      CREATE TABLE IF NOT EXISTS work_sessions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        barber_id INT NOT NULL,
        barbershop_id INT NOT NULL,
        work_date DATE NOT NULL,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
        FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
        INDEX idx_barber_date (barber_id, work_date),
        INDEX idx_active_sessions (barber_id, is_active)
      )
    `);

    await insertDefaultData(connection);
    
    console.log('✅ Tablas creadas correctamente');
  } finally {
    connection.release();
  }
}

async function insertDefaultData(connection) {
  const bcrypt = require('bcryptjs');
  
  const adminExists = await connection.execute('SELECT id FROM admin_users WHERE email = ?', [process.env.ADMIN_EMAIL || 'admin@barbershop.com']);
  
  if (adminExists[0].length === 0) {
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
    await connection.execute(
      'INSERT INTO admin_users (email, password, name, role) VALUES (?, ?, ?, ?)',
      [process.env.ADMIN_EMAIL || 'admin@barbershop.com', hashedPassword, 'Super Admin', 'super_admin']
    );
    console.log('✅ Usuario administrador creado');
  }

  const templates = [
    {
      type: 'billing',
      message: 'Hola! Tienes una factura pendiente por ${{amount}} correspondiente al período {{period}}. Vence el {{due_date}}. Por favor realiza el pago para mantener activo tu servicio.'
    },
    {
      type: 'reminder',
      message: 'Recordatorio: Tu factura por ${{amount}} vence en {{days_left}} días. Si no realizas el pago, tu servicio será suspendido.'
    },
    {
      type: 'suspension',
      message: 'Tu servicio ha sido suspendido por falta de pago. Para reactivarlo, contacta con soporte y realiza el pago pendiente.'
    },
    {
      type: 'payment_thanks',
      message: '¡Muchas gracias por tu pago de ${{amount}}! Tu servicio está activo y funcionando correctamente.'
    }
  ];

  for (const template of templates) {
    await connection.execute(
      'INSERT IGNORE INTO notification_templates (template_type, message_template) VALUES (?, ?)',
      [template.type, template.message]
    );
  }
}

function getPool() {
  if (!pool) {
    throw new Error('Pool de conexiones no inicializado');
  }
  return pool;
}

module.exports = {
  initDatabase,
  getPool,
  createConnection
};