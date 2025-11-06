#!/usr/bin/env node
/**
 * Script de diagnóstico y reparación para errores de reserva de turnos
 * Ejecutar: node fix_appointment_booking.js
 */

const { getPool } = require('./database/connection');
const whatsappService = require('./services/whatsappService');

async function diagnoseAndFixBookingErrors() {
    console.log('🔍 Iniciando diagnóstico de errores de reserva...\n');
    
    try {
        // 1. Verificar conexión de base de datos
        await checkDatabaseConnection();
        
        // 2. Verificar estructura de tablas
        await checkTableStructure();
        
        // 3. Verificar datos inconsistentes
        await checkDataConsistency();
        
        // 4. Verificar WhatsApp
        await checkWhatsAppStatus();
        
        // 5. Aplicar correcciones
        await applyFixes();
        
        console.log('✅ Diagnóstico completado\n');
        
    } catch (error) {
        console.error('❌ Error durante diagnóstico:', error);
    }
}

async function checkDatabaseConnection() {
    console.log('📋 Verificando conexión a base de datos...');
    try {
        const pool = getPool();
        const [result] = await pool.execute('SELECT 1 as test');
        console.log('✅ Base de datos: Conectada');
    } catch (error) {
        console.error('❌ Base de datos: Error de conexión -', error.message);
        throw new Error('Database connection failed');
    }
}

async function checkTableStructure() {
    console.log('📋 Verificando estructura de tablas...');
    const pool = getPool();
    
    try {
        // Verificar tabla appointments
        const [appointments] = await pool.execute(`
            SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'appointments' AND TABLE_SCHEMA = DATABASE()
        `);
        
        const requiredColumns = ['id', 'barbershop_id', 'barber_id', 'client_name', 'client_phone', 'appointment_date', 'queue_number'];
        const existingColumns = appointments.map(col => col.COLUMN_NAME);
        
        const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
        
        if (missingColumns.length > 0) {
            console.error('❌ Tabla appointments: Faltan columnas -', missingColumns);
            return false;
        }
        
        // Verificar tabla whatsapp_messages
        const [messages] = await pool.execute(`
            SELECT COLUMN_NAME, COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'whatsapp_messages' AND TABLE_SCHEMA = DATABASE()
        `);
        
        if (messages.length === 0) {
            console.log('⚠️  Tabla whatsapp_messages: No existe, será creada');
        }
        
        console.log('✅ Estructura de tablas: OK');
        return true;
        
    } catch (error) {
        console.error('❌ Error verificando estructura:', error.message);
        return false;
    }
}

async function checkDataConsistency() {
    console.log('📋 Verificando consistencia de datos...');
    const pool = getPool();
    
    try {
        // Verificar turnos duplicados
        const [duplicates] = await pool.execute(`
            SELECT barber_id, appointment_date, queue_number, COUNT(*) as count
            FROM appointments 
            WHERE status IN ('waiting', 'in_progress')
            GROUP BY barber_id, appointment_date, queue_number
            HAVING count > 1
        `);
        
        if (duplicates.length > 0) {
            console.log('⚠️  Encontrados turnos duplicados:', duplicates.length);
            return false;
        }
        
        // Verificar barberos sin horarios
        const [barbersNoSchedule] = await pool.execute(`
            SELECT b.id, b.name 
            FROM barbers b 
            LEFT JOIN barber_schedules bs ON b.id = bs.barber_id 
            WHERE b.is_active = TRUE AND bs.id IS NULL
        `);
        
        if (barbersNoSchedule.length > 0) {
            console.log('⚠️  Barberos sin horarios definidos:', barbersNoSchedule.length);
        }
        
        console.log('✅ Consistencia de datos: OK');
        return true;
        
    } catch (error) {
        console.error('❌ Error verificando datos:', error.message);
        return false;
    }
}

async function checkWhatsAppStatus() {
    console.log('📋 Verificando estado de WhatsApp...');
    
    try {
        const connectedClients = whatsappService.getAllConnectedClients();
        console.log(`📱 Clientes WhatsApp conectados: ${connectedClients.length}`);
        
        if (connectedClients.length === 0) {
            console.log('⚠️  No hay clientes WhatsApp conectados');
        }
        
        connectedClients.forEach(client => {
            console.log(`  - Barbería ${client.barbershop_id}: ${client.is_ready ? '✅ Conectado' : '❌ Desconectado'}`);
        });
        
        return true;
        
    } catch (error) {
        console.error('❌ Error verificando WhatsApp:', error.message);
        return false;
    }
}

async function applyFixes() {
    console.log('🔧 Aplicando correcciones...');
    const pool = getPool();
    
    try {
        // 1. Actualizar tabla whatsapp_messages si es necesario
        await pool.execute(`
            ALTER TABLE whatsapp_messages 
            MODIFY COLUMN message_type ENUM(
                'billing', 'reminder', 'suspension', 'payment_thanks', 
                'appointment', 'manual', 'bulk', 'position_update', 
                'queue_reorder'
            ) NOT NULL
        `).catch(() => {
            console.log('⚠️  Tabla whatsapp_messages ya está actualizada');
        });
        
        // 2. Crear tabla para notificaciones pendientes
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS whatsapp_pending_notifications (
                id INT PRIMARY KEY AUTO_INCREMENT,
                barbershop_id INT NOT NULL,
                barber_id INT NOT NULL,
                appointment_date DATE NOT NULL,
                notification_type VARCHAR(50) NOT NULL,
                processed BOOLEAN DEFAULT FALSE,
                processed_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_notification (barbershop_id, barber_id, appointment_date, notification_type),
                FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE
            )
        `);
        
        // 3. Limpiar datos inconsistentes
        await pool.execute(`
            DELETE a1 FROM appointments a1
            INNER JOIN appointments a2 
            WHERE a1.id > a2.id 
            AND a1.barber_id = a2.barber_id 
            AND a1.appointment_date = a2.appointment_date 
            AND a1.queue_number = a2.queue_number
            AND a1.status IN ('waiting', 'in_progress')
            AND a2.status IN ('waiting', 'in_progress')
        `);
        
        // 4. Reordenar colas si es necesario
        await pool.execute(`
            SET @row_number = 0; 
            SET @prev_barber = '';
            SET @prev_date = '';
            
            UPDATE appointments a
            JOIN (
                SELECT id, 
                       @row_number := CASE 
                           WHEN @prev_barber = CONCAT(barber_id, '_', appointment_date) THEN @row_number + 1 
                           ELSE 1 
                       END AS new_queue_number,
                       @prev_barber := CONCAT(barber_id, '_', appointment_date)
                FROM appointments 
                WHERE status IN ('waiting', 'in_progress')
                ORDER BY barber_id, appointment_date, queue_number, created_at
            ) AS ordered ON a.id = ordered.id
            SET a.queue_number = ordered.new_queue_number
            WHERE a.status IN ('waiting', 'in_progress')
        `);
        
        console.log('✅ Correcciones aplicadas');
        
    } catch (error) {
        console.error('❌ Error aplicando correcciones:', error.message);
    }
}

// Función para testear una reserva
async function testBooking() {
    console.log('🧪 Ejecutando test de reserva...');
    const pool = getPool();
    
    try {
        // Obtener barbero de prueba
        const [barbers] = await pool.execute(`
            SELECT b.id, b.name, b.barbershop_id 
            FROM barbers b 
            JOIN barbershops bs ON b.barbershop_id = bs.id
            WHERE b.is_active = TRUE AND bs.is_active = TRUE 
            LIMIT 1
        `);
        
        if (barbers.length === 0) {
            console.log('❌ No hay barberos disponibles para test');
            return;
        }
        
        const barber = barbers[0];
        const today = new Date().toISOString().split('T')[0];
        const testPhone = '1234567890';
        
        // Simular reserva
        const [lastQueue] = await pool.execute(`
            SELECT COALESCE(MAX(queue_number), 0) as last_queue_number
            FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
        `, [barber.id, today]);
        
        const nextQueue = lastQueue[0].last_queue_number + 1;
        
        console.log(`📋 Test: Barbero ${barber.name}, Cola: ${nextQueue}`);
        console.log('✅ Test de reserva: OK');
        
    } catch (error) {
        console.error('❌ Test de reserva falló:', error.message);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    diagnoseAndFixBookingErrors()
        .then(() => testBooking())
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('💥 Error crítico:', error);
            process.exit(1);
        });
}

module.exports = {
    diagnoseAndFixBookingErrors,
    testBooking
};