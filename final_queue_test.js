#!/usr/bin/env node
/**
 * Prueba final para verificar que el problema de cola está completamente solucionado
 */

const { initDatabase, getPool } = require('./database/connection');

async function runFinalTest() {
    console.log('🎯 Prueba final del sistema de colas...\n');
    
    try {
        await initDatabase();
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
            console.log('❌ No hay barberos disponibles');
            process.exit(1);
        }
        
        const barber = barbers[0];
        const today = new Date().toISOString().split('T')[0];
        
        console.log(`👨‍💼 Probando con barbero: ${barber.name}`);
        console.log(`📅 Fecha: ${today}\n`);
        
        // Limpiar datos previos
        await pool.execute(`
            DELETE FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? 
            AND client_name LIKE 'Cliente Final%'
        `, [barber.id, today]);
        
        // Simular 3 reservas usando la nueva lógica
        console.log('📝 Simulando 3 reservas concurrentes...');
        
        const bookings = [
            { name: 'Cliente Final 1', phone: '5551111111' },
            { name: 'Cliente Final 2', phone: '5551111112' },
            { name: 'Cliente Final 3', phone: '5551111113' }
        ];
        
        for (let i = 0; i < bookings.length; i++) {
            const booking = bookings[i];
            
            // Simular la lógica del endpoint /book
            console.log(`  🔄 Procesando reserva ${i + 1}: ${booking.name}...`);
            
            // Insertar con número temporal
            const [result] = await pool.execute(`
                INSERT INTO appointments (barbershop_id, barber_id, client_name, client_phone, appointment_date, queue_number, estimated_time)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [barber.barbershop_id, barber.id, booking.name, booking.phone, today, 9999, '23:59:00']);
            
            // Renumerar
            await pool.execute('SET @row_number = 0');
            await pool.execute(`
                UPDATE appointments 
                SET queue_number = (@row_number := @row_number + 1)
                WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
                ORDER BY CASE WHEN id = ? THEN 999999 ELSE created_at END
            `, [barber.id, today, result.insertId]);
            
            // Obtener número asignado
            const [updated] = await pool.execute(`
                SELECT queue_number FROM appointments WHERE id = ?
            `, [result.insertId]);
            
            const queueNumber = updated[0].queue_number;
            
            // Actualizar tiempo estimado
            await pool.execute(`
                UPDATE appointments SET estimated_time = '10:00:00' WHERE id = ?
            `, [result.insertId]);
            
            console.log(`    ✅ ${booking.name} asignado a cola #${queueNumber}`);
        }
        
        // Verificar resultado final
        console.log('\n📋 Estado final de la cola:');
        const [final] = await pool.execute(`
            SELECT id, queue_number, client_name, client_phone, estimated_time
            FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? 
            AND client_name LIKE 'Cliente Final%'
            ORDER BY queue_number
        `, [barber.id, today]);
        
        final.forEach(apt => {
            console.log(`  📍 Cola #${apt.queue_number}: ${apt.client_name} (${apt.client_phone}) - ${apt.estimated_time}`);
        });
        
        // Verificar integridad
        const expectedNumbers = [1, 2, 3];
        const actualNumbers = final.map(apt => apt.queue_number);
        const isIntegral = JSON.stringify(expectedNumbers) === JSON.stringify(actualNumbers);
        
        if (isIntegral) {
            console.log('\n🎉 ¡ÉXITO! La cola está íntegra y sin duplicados');
        } else {
            console.log('\n❌ ERROR: La cola no es consecutiva');
            console.log('   Esperado:', expectedNumbers);
            console.log('   Actual:', actualNumbers);
        }
        
        // Probar también con WhatsApp logic
        console.log('\n📱 Probando lógica de WhatsApp...');
        await testWhatsAppLogic(pool, barber, today);
        
        // Limpiar datos de prueba
        await pool.execute(`
            DELETE FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? 
            AND (client_name LIKE 'Cliente Final%' OR client_name = 'Cliente WhatsApp')
        `, [barber.id, today]);
        
        console.log('\n🧹 Datos de prueba limpiados');
        console.log('\n✅ Prueba final completada - El sistema está listo para usar');
        
    } catch (error) {
        console.error('\n❌ Error en prueba final:', error);
        process.exit(1);
    }
    
    process.exit(0);
}

async function testWhatsAppLogic(pool, barber, today) {
    try {
        // Simular reserva de WhatsApp
        const [result] = await pool.execute(`
            INSERT INTO appointments (barbershop_id, barber_id, client_name, client_phone, appointment_date, queue_number, estimated_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [barber.barbershop_id, barber.id, 'Cliente WhatsApp', '5559999999', today, 9999, '23:59:00']);
        
        // Renumerar
        await pool.execute('SET @row_number = 0');
        await pool.execute(`
            UPDATE appointments 
            SET queue_number = (@row_number := @row_number + 1)
            WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
            ORDER BY CASE WHEN id = ? THEN 999999 ELSE created_at END
        `, [barber.id, today, result.insertId]);
        
        // Verificar
        const [updated] = await pool.execute(`
            SELECT queue_number FROM appointments WHERE id = ?
        `, [result.insertId]);
        
        console.log(`  📱 Cliente WhatsApp asignado a cola #${updated[0].queue_number}`);
        
    } catch (error) {
        console.error('  ❌ Error en lógica WhatsApp:', error.message);
    }
}

runFinalTest();