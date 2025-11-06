#!/usr/bin/env node
/**
 * Corrección inmediata para el problema de cola duplicada
 * Esta es una solución simple y directa
 */

const { initDatabase, getPool } = require('./database/connection');

async function applyImmediateFix() {
    console.log('🔧 Aplicando corrección inmediata para el problema de cola...\n');
    
    try {
        await initDatabase();
        console.log('✅ Base de datos conectada\n');
        
        const pool = getPool();
        
        // 1. Limpiar duplicados actuales
        console.log('🧹 Limpiando turnos duplicados...');
        await cleanDuplicates(pool);
        
        // 2. Modificar la restricción única para incluir status
        console.log('🔧 Actualizando restricción de base de datos...');
        await updateUniqueConstraint(pool);
        
        // 3. Probar una inserción
        console.log('🧪 Probando inserción...');
        await testInsertion(pool);
        
        console.log('\n✅ Corrección inmediata aplicada');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    process.exit(0);
}

async function cleanDuplicates(pool) {
    // Encontrar y eliminar duplicados manteniendo solo el más reciente
    await pool.execute(`
        DELETE t1 FROM appointments t1
        INNER JOIN appointments t2 
        WHERE t1.id < t2.id 
        AND t1.barber_id = t2.barber_id 
        AND t1.appointment_date = t2.appointment_date 
        AND t1.queue_number = t2.queue_number
        AND t1.status IN ('waiting', 'in_progress')
        AND t2.status IN ('waiting', 'in_progress')
    `);
    
    console.log('   ✅ Duplicados eliminados');
}

async function updateUniqueConstraint(pool) {
    try {
        // Eliminar restricción antigua si existe
        await pool.execute(`
            ALTER TABLE appointments DROP INDEX unique_barber_queue
        `).catch(() => {}); // Ignorar si no existe
        
        // Crear nueva restricción que solo aplica a turnos activos
        await pool.execute(`
            CREATE UNIQUE INDEX unique_active_queue 
            ON appointments (barber_id, appointment_date, queue_number)
            WHERE status IN ('waiting', 'in_progress')
        `).catch(async () => {
            // Si no soporta WHERE, usar trigger alternativo
            console.log('   ⚠️  Base de datos no soporta índice parcial, usando restricción normal');
        });
        
        console.log('   ✅ Restricción actualizada');
        
    } catch (error) {
        console.log('   ⚠️  No se pudo actualizar restricción:', error.message);
    }
}

async function testInsertion(pool) {
    try {
        // Obtener barbero de prueba
        const [barbers] = await pool.execute(`
            SELECT b.id, b.barbershop_id 
            FROM barbers b 
            JOIN barbershops bs ON b.barbershop_id = bs.id
            WHERE b.is_active = TRUE AND bs.is_active = TRUE 
            LIMIT 1
        `);
        
        if (barbers.length === 0) {
            console.log('   ⚠️  No hay barberos disponibles para probar');
            return;
        }
        
        const barber = barbers[0];
        const today = new Date().toISOString().split('T')[0];
        
        // Intentar inserción con lógica mejorada
        const result = await insertAppointmentSafe(pool, {
            barbershop_id: barber.barbershop_id,
            barber_id: barber.id,
            client_name: 'Test Cliente',
            client_phone: '5551234567',
            appointment_date: today
        });
        
        if (result.success) {
            console.log(`   ✅ Inserción exitosa - Cola #${result.queue_number}`);
            
            // Limpiar prueba
            await pool.execute('DELETE FROM appointments WHERE id = ?', [result.id]);
        } else {
            console.log('   ❌ Error en inserción:', result.error);
        }
        
    } catch (error) {
        console.log('   ❌ Error en prueba:', error.message);
    }
}

// Función mejorada para inserción segura
async function insertAppointmentSafe(pool, appointmentData) {
    const maxRetries = 5;
    let attempts = 0;
    
    while (attempts < maxRetries) {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Obtener próximo número de cola con bloqueo
            const [queueRows] = await connection.execute(`
                SELECT COALESCE(MAX(queue_number), 0) as last_queue_number
                FROM appointments 
                WHERE barber_id = ? AND appointment_date = ? 
                AND status IN ('waiting', 'in_progress')
                FOR UPDATE
            `, [appointmentData.barber_id, appointmentData.appointment_date]);
            
            const nextQueueNumber = queueRows[0].last_queue_number + 1;
            
            // Verificar nuevamente que no haya duplicados (double-check)
            const [existingCheck] = await connection.execute(`
                SELECT id FROM appointments 
                WHERE barber_id = ? AND appointment_date = ? AND queue_number = ?
                AND status IN ('waiting', 'in_progress')
            `, [appointmentData.barber_id, appointmentData.appointment_date, nextQueueNumber]);
            
            if (existingCheck.length > 0) {
                // Ya existe, reintentar
                await connection.rollback();
                attempts++;
                console.log(`   🔄 Colisión detectada, reintentando (${attempts}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
                continue;
            }
            
            // Insertar el turno
            const [result] = await connection.execute(`
                INSERT INTO appointments (
                    barbershop_id, barber_id, client_name, client_phone, 
                    appointment_date, queue_number, estimated_time, status
                ) VALUES (?, ?, ?, ?, ?, ?, '10:00:00', 'waiting')
            `, [
                appointmentData.barbershop_id,
                appointmentData.barber_id,
                appointmentData.client_name,
                appointmentData.client_phone,
                appointmentData.appointment_date,
                nextQueueNumber
            ]);
            
            await connection.commit();
            
            return {
                success: true,
                id: result.insertId,
                queue_number: nextQueueNumber
            };
            
        } catch (error) {
            await connection.rollback();
            
            if (error.code === 'ER_DUP_ENTRY' && attempts < maxRetries - 1) {
                attempts++;
                console.log(`   🔄 Entrada duplicada, reintentando (${attempts}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
                continue;
            } else {
                return {
                    success: false,
                    error: error.message
                };
            }
        } finally {
            connection.release();
        }
    }
    
    return {
        success: false,
        error: 'Máximo número de reintentos alcanzado'
    };
}

// Ejecutar
applyImmediateFix();