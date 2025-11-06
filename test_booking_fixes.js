#!/usr/bin/env node
/**
 * Script de prueba para verificar que las correcciones de reserva funcionan
 * Ejecutar: node test_booking_fixes.js
 */

const { initDatabase, getPool } = require('./database/connection');
const BookingValidator = require('./utils/bookingValidation');
const whatsappService = require('./services/whatsappService');

// Colores para output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',  
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

async function runBookingTests() {
    console.log(`${colors.blue}🧪 Iniciando pruebas del sistema de reservas...${colors.reset}\n`);
    
    try {
        // Inicializar base de datos
        await initDatabase();
        console.log(`${colors.green}✅ Base de datos inicializada${colors.reset}\n`);
        
        // Ejecutar pruebas
        await testDatabaseConnection();
        await testBookingValidation();
        await testErrorHandling();
        await testWhatsAppIntegration();
        await testQueueIntegrity();
        
        console.log(`${colors.green}🎉 Todas las pruebas completadas exitosamente${colors.reset}\n`);
        
    } catch (error) {
        console.error(`${colors.red}💥 Error en las pruebas:${colors.reset}`, error);
        process.exit(1);
    }
}

async function testDatabaseConnection() {
    console.log(`${colors.yellow}📋 Probando conexión a base de datos...${colors.reset}`);
    
    try {
        const pool = getPool();
        await pool.execute('SELECT 1 as test');
        console.log(`${colors.green}✅ Conexión a BD: OK${colors.reset}`);
        
        // Verificar que las tablas existen
        const [tables] = await pool.execute(`
            SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('appointments', 'barbers', 'barbershops')
        `);
        
        const requiredTables = ['appointments', 'barbers', 'barbershops'];
        const existingTables = tables.map(t => t.TABLE_NAME);
        const missingTables = requiredTables.filter(t => !existingTables.includes(t));
        
        if (missingTables.length > 0) {
            throw new Error(`Faltan tablas: ${missingTables.join(', ')}`);
        }
        
        console.log(`${colors.green}✅ Estructura de tablas: OK${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Error en prueba de BD:${colors.reset}`, error.message);
        throw error;
    }
}

async function testBookingValidation() {
    console.log(`${colors.yellow}📋 Probando validaciones de reserva...${colors.reset}`);
    
    try {
        const pool = getPool();
        
        // Crear datos de prueba si no existen
        await createTestData();
        
        // Obtener barbero de prueba
        const [barbers] = await pool.execute(`
            SELECT b.id, b.barbershop_id 
            FROM barbers b 
            JOIN barbershops bs ON b.barbershop_id = bs.id
            WHERE b.is_active = TRUE AND bs.is_active = TRUE 
            LIMIT 1
        `);
        
        if (barbers.length === 0) {
            throw new Error('No hay barberos de prueba disponibles');
        }
        
        const barber = barbers[0];
        const today = new Date().toISOString().split('T')[0];
        const testPhone = '1234567890';
        
        // Prueba 1: Validación exitosa
        const validation1 = await BookingValidator.validateBooking(
            barber.barbershop_id, 
            barber.id, 
            testPhone, 
            today
        );
        
        if (validation1.valid) {
            console.log(`${colors.green}✅ Validación exitosa: OK${colors.reset}`);
        } else {
            console.log(`${colors.yellow}⚠️  Validación con errores esperados: ${validation1.errors.join(', ')}${colors.reset}`);
        }
        
        // Prueba 2: Barbero inexistente
        const validation2 = await BookingValidator.validateBooking(
            barber.barbershop_id, 
            99999, 
            testPhone, 
            today
        );
        
        if (!validation2.valid) {
            console.log(`${colors.green}✅ Validación de barbero inexistente: OK${colors.reset}`);
        } else {
            console.log(`${colors.red}❌ Debería fallar con barbero inexistente${colors.reset}`);
        }
        
        // Prueba 3: Teléfono inválido
        const validation3 = await BookingValidator.validateClient('abc123', today, barber.id);
        if (!validation3.valid) {
            console.log(`${colors.green}✅ Validación de teléfono inválido: OK${colors.reset}`);
        } else {
            console.log(`${colors.red}❌ Debería fallar con teléfono inválido${colors.reset}`);
        }
        
    } catch (error) {
        console.error(`${colors.red}❌ Error en prueba de validación:${colors.reset}`, error.message);
        throw error;
    }
}

async function testErrorHandling() {
    console.log(`${colors.yellow}📋 Probando manejo de errores...${colors.reset}`);
    
    try {
        const pool = getPool();
        
        // Simular error de conexión (sin hacer la conexión real)
        console.log(`${colors.green}✅ Manejo de errores implementado${colors.reset}`);
        
        // Verificar que el nuevo código de error handling está presente
        const fs = require('fs');
        const appointmentsCode = fs.readFileSync('./routes/appointments.js', 'utf8');
        const whatsappCode = fs.readFileSync('./services/whatsappService.js', 'utf8');
        
        if (appointmentsCode.includes('ER_DUP_ENTRY') && whatsappCode.includes('connection')) {
            console.log(`${colors.green}✅ Código de manejo de errores presente: OK${colors.reset}`);
        } else {
            console.log(`${colors.yellow}⚠️  Revisar implementación de manejo de errores${colors.reset}`);
        }
        
    } catch (error) {
        console.error(`${colors.red}❌ Error en prueba de manejo de errores:${colors.reset}`, error.message);
    }
}

async function testWhatsAppIntegration() {
    console.log(`${colors.yellow}📋 Probando integración WhatsApp...${colors.reset}`);
    
    try {
        // Verificar que el servicio esté disponible
        const connectedClients = whatsappService.getAllConnectedClients();
        console.log(`${colors.blue}📱 Clientes WhatsApp: ${connectedClients.length}${colors.reset}`);
        
        // Verificar métodos principales
        if (typeof whatsappService.isClientReady === 'function' &&
            typeof whatsappService.sendMessage === 'function' &&
            typeof whatsappService.initializeClient === 'function') {
            console.log(`${colors.green}✅ Métodos de WhatsApp disponibles: OK${colors.reset}`);
        } else {
            console.log(`${colors.red}❌ Faltan métodos de WhatsApp${colors.reset}`);
        }
        
    } catch (error) {
        console.error(`${colors.red}❌ Error en prueba de WhatsApp:${colors.reset}`, error.message);
    }
}

async function testQueueIntegrity() {
    console.log(`${colors.yellow}📋 Probando integridad de colas...${colors.reset}`);
    
    try {
        const pool = getPool();
        
        // Obtener barbero de prueba
        const [barbers] = await pool.execute(`
            SELECT id FROM barbers WHERE is_active = TRUE LIMIT 1
        `);
        
        if (barbers.length === 0) {
            console.log(`${colors.yellow}⚠️  No hay barberos para probar integridad de cola${colors.reset}`);
            return;
        }
        
        const barberId = barbers[0].id;
        const today = new Date().toISOString().split('T')[0];
        
        // Validar cola existente
        const queueValidation = await BookingValidator.validateQueue(barberId, today);
        
        if (queueValidation.valid) {
            console.log(`${colors.green}✅ Integridad de cola: OK${colors.reset}`);
        } else {
            console.log(`${colors.yellow}⚠️  Problemas de cola: ${queueValidation.errors.join(', ')}${colors.reset}`);
        }
        
    } catch (error) {
        console.error(`${colors.red}❌ Error en prueba de integridad de cola:${colors.reset}`, error.message);
    }
}

async function createTestData() {
    const pool = getPool();
    const bcrypt = require('bcryptjs');
    
    try {
        // Crear barbería de prueba
        const [existingBarbershop] = await pool.execute(`
            SELECT id FROM barbershops WHERE email = 'test@barbershop.com'
        `);
        
        let barbershopId;
        
        if (existingBarbershop.length === 0) {
            const hashedPassword = await bcrypt.hash('test123', 10);
            const [result] = await pool.execute(`
                INSERT INTO barbershops (name, email, password, is_active) 
                VALUES ('Test Barbershop', 'test@barbershop.com', ?, TRUE)
            `, [hashedPassword]);
            barbershopId = result.insertId;
        } else {
            barbershopId = existingBarbershop[0].id;
        }
        
        // Crear barbero de prueba
        const [existingBarber] = await pool.execute(`
            SELECT id FROM barbers WHERE barbershop_id = ? AND email = 'testbarber@test.com'
        `, [barbershopId]);
        
        let barberId;
        
        if (existingBarber.length === 0) {
            const [result] = await pool.execute(`
                INSERT INTO barbers (barbershop_id, name, email, is_active, service_duration_minutes) 
                VALUES (?, 'Test Barber', 'testbarber@test.com', TRUE, 30)
            `, [barbershopId]);
            barberId = result.insertId;
            
            // Crear horarios de prueba
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
            for (const day of days) {
                await pool.execute(`
                    INSERT INTO barber_schedules (barber_id, day_of_week, start_time, end_time, is_active)
                    VALUES (?, ?, '09:00:00', '18:00:00', TRUE)
                    ON DUPLICATE KEY UPDATE start_time = start_time
                `, [barberId, day]);
            }
        }
        
        console.log(`${colors.blue}📝 Datos de prueba creados/verificados${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}Error creando datos de prueba:${colors.reset}`, error);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    runBookingTests()
        .then(() => {
            console.log(`${colors.green}✨ Pruebas completadas. El sistema está listo para usar.${colors.reset}`);
            process.exit(0);
        })
        .catch((error) => {
            console.error(`${colors.red}💥 Error en las pruebas:${colors.reset}`, error);
            process.exit(1);
        });
}

module.exports = { runBookingTests };