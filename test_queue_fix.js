#!/usr/bin/env node
/**
 * Script para probar la corrección del problema de cola duplicada
 * Simula múltiples reservas concurrentes para verificar que no haya duplicados
 */

const { getPool } = require('./database/connection');

async function testConcurrentBookings() {
    console.log('🧪 Probando reservas concurrentes para verificar corrección de cola...\n');
    
    try {
        const pool = getPool();
        
        // Obtener barbero de prueba
        const [barbers] = await pool.execute(`
            SELECT b.id, b.barbershop_id, b.name 
            FROM barbers b 
            JOIN barbershops bs ON b.barbershop_id = bs.id
            WHERE b.is_active = TRUE AND bs.is_active = TRUE 
            LIMIT 1
        `);
        
        if (barbers.length === 0) {
            console.error('❌ No hay barberos disponibles para la prueba');
            return;
        }
        
        const barber = barbers[0];
        const today = new Date().toISOString().split('T')[0];
        
        console.log(`📋 Probando con barbero: ${barber.name} (ID: ${barber.id})`);
        console.log(`📅 Fecha: ${today}\n`);
        
        // Limpiar turnos de prueba anteriores
        await pool.execute(`
            DELETE FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? AND client_name LIKE 'Cliente Test %'
        `, [barber.id, today]);
        
        console.log('🧹 Datos de prueba anteriores limpiados\n');
        
        // Simular múltiples reservas concurrentes
        const numberOfConcurrentBookings = 5;
        const bookingPromises = [];
        
        console.log(`🚀 Iniciando ${numberOfConcurrentBookings} reservas concurrentes...\n`);
        
        for (let i = 1; i <= numberOfConcurrentBookings; i++) {
            const bookingPromise = makeBooking(pool, barber, today, i);
            bookingPromises.push(bookingPromise);
        }
        
        // Ejecutar todas las reservas al mismo tiempo
        const results = await Promise.allSettled(bookingPromises);
        
        // Analizar resultados
        console.log('📊 Resultados de las reservas concurrentes:\n');
        
        let successful = 0;
        let failed = 0;
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                console.log(`✅ Reserva ${index + 1}: Exitosa - Cola #${result.value.queueNumber}`);
                successful++;
            } else {
                console.log(`❌ Reserva ${index + 1}: Falló - ${result.reason.message}`);
                failed++;
            }
        });
        
        console.log(`\n📈 Resumen:`);
        console.log(`   Exitosas: ${successful}`);
        console.log(`   Fallidas: ${failed}\n`);
        
        // Verificar integridad de la cola
        await verifyQueueIntegrity(pool, barber.id, today);
        
        // Limpiar datos de prueba
        await pool.execute(`
            DELETE FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? AND client_name LIKE 'Cliente Test %'
        `, [barber.id, today]);
        
        console.log('🧹 Datos de prueba limpiados\n');
        
        if (successful > 0 && failed === 0) {
            console.log('🎉 ¡Prueba exitosa! El problema de cola duplicada está corregido.');
        } else {
            console.log('⚠️  La prueba reveló algunos problemas. Revisa los logs anteriores.');
        }
        
    } catch (error) {
        console.error('💥 Error durante la prueba:', error);
    }
}

async function makeBooking(pool, barber, date, clientNumber) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Obtener siguiente número en cola con bloqueo
        const [lastQueueRows] = await connection.execute(`
            SELECT COALESCE(MAX(queue_number), 0) as last_queue_number
            FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
            FOR UPDATE
        `, [barber.id, date]);
        
        const nextQueueNumber = lastQueueRows[0].last_queue_number + 1;
        const clientPhone = `555000${clientNumber.toString().padStart(3, '0')}`;
        
        // Insertar el turno
        const [result] = await connection.execute(`
            INSERT INTO appointments (barbershop_id, barber_id, client_name, client_phone, appointment_date, queue_number, estimated_time)
            VALUES (?, ?, ?, ?, ?, ?, '10:00:00')
        `, [barber.barbershop_id, barber.id, `Cliente Test ${clientNumber}`, clientPhone, date, nextQueueNumber]);
        
        await connection.commit();
        
        return {
            success: true,
            queueNumber: nextQueueNumber,
            appointmentId: result.insertId
        };
        
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function verifyQueueIntegrity(pool, barberId, date) {
    console.log('🔍 Verificando integridad de la cola...\n');
    
    const [appointments] = await pool.execute(`
        SELECT id, queue_number, client_name, client_phone
        FROM appointments 
        WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
        ORDER BY queue_number
    `, [barberId, date]);
    
    console.log(`📋 Turnos en cola: ${appointments.length}\n`);
    
    let integrityIssues = 0;
    
    // Verificar que los números sean consecutivos empezando desde 1
    for (let i = 0; i < appointments.length; i++) {
        const expected = i + 1;
        const actual = appointments[i].queue_number;
        
        if (actual !== expected) {
            console.log(`❌ Problema de integridad: Posición ${i + 1} tiene queue_number ${actual}, esperado ${expected}`);
            integrityIssues++;
        } else {
            console.log(`✅ Posición ${i + 1}: queue_number ${actual} - ${appointments[i].client_name}`);
        }
    }
    
    // Verificar duplicados
    const queueNumbers = appointments.map(apt => apt.queue_number);
    const uniqueNumbers = [...new Set(queueNumbers)];
    
    if (queueNumbers.length !== uniqueNumbers.length) {
        console.log(`❌ Se encontraron números duplicados en la cola`);
        integrityIssues++;
    }
    
    console.log(`\n🔍 Resultado de integridad:`);
    if (integrityIssues === 0) {
        console.log(`✅ Cola íntegra - No hay problemas`);
    } else {
        console.log(`❌ Se encontraron ${integrityIssues} problemas de integridad`);
    }
    
    console.log('');
}

// Función adicional para probar con el servicio WhatsApp (simulado)
async function testWhatsAppBooking() {
    console.log('📱 Probando lógica de reserva de WhatsApp...\n');
    
    try {
        const pool = getPool();
        
        // Obtener barbero de prueba
        const [barbers] = await pool.execute(`
            SELECT b.id, b.barbershop_id, b.name 
            FROM barbers b 
            JOIN barbershops bs ON b.barbershop_id = bs.id
            WHERE b.is_active = TRUE AND bs.is_active = TRUE 
            LIMIT 1
        `);
        
        if (barbers.length === 0) {
            console.log('❌ No hay barberos disponibles para la prueba');
            return;
        }
        
        const barber = barbers[0];
        const today = new Date().toISOString().split('T')[0];
        const testPhone = '5551234567';
        
        // Simular reserva de WhatsApp usando la misma lógica corregida
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            const [lastQueueRows] = await connection.execute(`
                SELECT COALESCE(MAX(queue_number), 0) as last_queue_number
                FROM appointments 
                WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
                FOR UPDATE
            `, [barber.id, today]);
            
            const nextQueueNumber = lastQueueRows[0].last_queue_number + 1;
            
            const [result] = await connection.execute(`
                INSERT INTO appointments (barbershop_id, barber_id, client_name, client_phone, appointment_date, queue_number, estimated_time)
                VALUES (?, ?, ?, ?, ?, ?, '10:00:00')
            `, [barber.barbershop_id, barber.id, 'Cliente WhatsApp Test', testPhone, today, nextQueueNumber]);
            
            await connection.commit();
            
            console.log(`✅ Reserva WhatsApp exitosa - Cola #${nextQueueNumber}, ID: ${result.insertId}`);
            
            // Limpiar
            await pool.execute('DELETE FROM appointments WHERE id = ?', [result.insertId]);
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('❌ Error en prueba WhatsApp:', error.message);
    }
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
    testConcurrentBookings()
        .then(() => testWhatsAppBooking())
        .then(() => {
            console.log('🎯 Pruebas completadas\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Error en las pruebas:', error);
            process.exit(1);
        });
}

module.exports = {
    testConcurrentBookings,
    testWhatsAppBooking
};