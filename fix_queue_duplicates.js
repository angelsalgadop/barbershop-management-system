#!/usr/bin/env node
/**
 * Script para aplicar correcciones específicas al problema de cola duplicada
 */

const { getPool } = require('./database/connection');

async function fixQueueDuplicates() {
    console.log('🔧 Aplicando correcciones al problema de cola duplicada...\n');
    
    try {
        const pool = getPool();
        
        // 1. Limpiar duplicados existentes
        console.log('🧹 Limpiando duplicados existentes...');
        await cleanExistingDuplicates(pool);
        
        // 2. Verificar/agregar índice único mejorado
        console.log('📊 Verificando índices de base de datos...');
        await ensureUniqueIndex(pool);
        
        // 3. Crear tabla de bloqueos para colas si no existe
        console.log('🔒 Configurando tabla de bloqueos...');
        await createQueueLockTable(pool);
        
        // 4. Verificar integridad de todas las colas activas
        console.log('🔍 Verificando integridad de colas activas...');
        await verifyAllQueues(pool);
        
        console.log('\n✅ Correcciones aplicadas exitosamente');
        
    } catch (error) {
        console.error('❌ Error aplicando correcciones:', error);
        throw error;
    }
}

async function cleanExistingDuplicates(pool) {
    try {
        // Encontrar y eliminar duplicados, manteniendo solo el más reciente
        const [duplicates] = await pool.execute(`
            SELECT barber_id, appointment_date, queue_number, COUNT(*) as count
            FROM appointments 
            WHERE status IN ('waiting', 'in_progress')
            GROUP BY barber_id, appointment_date, queue_number
            HAVING count > 1
        `);
        
        if (duplicates.length === 0) {
            console.log('   ✅ No se encontraron duplicados');
            return;
        }
        
        console.log(`   ⚠️  Encontrados ${duplicates.length} grupos de duplicados`);
        
        for (const duplicate of duplicates) {
            // Obtener todos los turnos duplicados
            const [duplicateAppointments] = await pool.execute(`
                SELECT id, created_at, client_name, client_phone
                FROM appointments 
                WHERE barber_id = ? AND appointment_date = ? AND queue_number = ?
                AND status IN ('waiting', 'in_progress')
                ORDER BY created_at DESC
            `, [duplicate.barber_id, duplicate.appointment_date, duplicate.queue_number]);
            
            // Mantener solo el más reciente, eliminar los demás
            for (let i = 1; i < duplicateAppointments.length; i++) {
                const appointmentToDelete = duplicateAppointments[i];
                
                await pool.execute('UPDATE appointments SET status = "cancelled" WHERE id = ?', [appointmentToDelete.id]);
                
                console.log(`   🗑️  Cancelado turno duplicado: ${appointmentToDelete.client_name} (ID: ${appointmentToDelete.id})`);
            }
        }
        
        // Reordenar todas las colas después de limpiar duplicados
        await reorderAllQueues(pool);
        
    } catch (error) {
        console.error('Error limpiando duplicados:', error);
        throw error;
    }
}

async function ensureUniqueIndex(pool) {
    try {
        // Verificar si ya existe el índice único
        const [indexes] = await pool.execute(`
            SELECT INDEX_NAME
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'appointments'
            AND INDEX_NAME = 'unique_barber_queue'
        `);
        
        if (indexes.length > 0) {
            console.log('   ✅ Índice único ya existe');
            return;
        }
        
        // Crear índice único para prevenir duplicados
        await pool.execute(`
            ALTER TABLE appointments 
            ADD CONSTRAINT unique_barber_queue 
            UNIQUE KEY (barber_id, appointment_date, queue_number, status)
        `);
        
        console.log('   ✅ Índice único creado');
        
    } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
            console.log('   ✅ Índice único ya existe');
        } else {
            console.error('Error creando índice único:', error);
            // No lanzar error, el sistema puede funcionar sin el índice
        }
    }
}

async function createQueueLockTable(pool) {
    try {
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS queue_locks (
                id INT PRIMARY KEY AUTO_INCREMENT,
                barber_id INT NOT NULL,
                appointment_date DATE NOT NULL,
                lock_holder VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL,
                UNIQUE KEY unique_barber_date (barber_id, appointment_date),
                FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
                INDEX idx_expires (expires_at)
            )
        `);
        
        console.log('   ✅ Tabla de bloqueos configurada');
        
        // Limpiar bloqueos expirados
        await pool.execute(`
            DELETE FROM queue_locks WHERE expires_at < NOW()
        `);
        
    } catch (error) {
        console.error('Error creando tabla de bloqueos:', error);
    }
}

async function reorderAllQueues(pool) {
    console.log('🔄 Reordenando todas las colas...');
    
    try {
        // Obtener todas las combinaciones barber_id + appointment_date activas
        const [activeQueues] = await pool.execute(`
            SELECT DISTINCT barber_id, appointment_date
            FROM appointments 
            WHERE status IN ('waiting', 'in_progress')
        `);
        
        for (const queue of activeQueues) {
            await reorderQueue(pool, queue.barber_id, queue.appointment_date);
        }
        
        console.log(`   ✅ ${activeQueues.length} colas reordenadas`);
        
    } catch (error) {
        console.error('Error reordenando colas:', error);
        throw error;
    }
}

async function reorderQueue(pool, barberId, appointmentDate) {
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Obtener todos los turnos activos ordenados por created_at
        const [appointments] = await connection.execute(`
            SELECT id, queue_number
            FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
            ORDER BY queue_number, created_at
        `, [barberId, appointmentDate]);
        
        // Reasignar números de cola consecutivos
        for (let i = 0; i < appointments.length; i++) {
            const newQueueNumber = i + 1;
            const appointment = appointments[i];
            
            if (appointment.queue_number !== newQueueNumber) {
                await connection.execute(`
                    UPDATE appointments 
                    SET queue_number = ? 
                    WHERE id = ?
                `, [newQueueNumber, appointment.id]);
            }
        }
        
        await connection.commit();
        
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function verifyAllQueues(pool) {
    try {
        const [activeQueues] = await pool.execute(`
            SELECT barber_id, appointment_date, COUNT(*) as count
            FROM appointments 
            WHERE status IN ('waiting', 'in_progress')
            GROUP BY barber_id, appointment_date
        `);
        
        let totalIssues = 0;
        
        for (const queue of activeQueues) {
            const [appointments] = await pool.execute(`
                SELECT queue_number
                FROM appointments 
                WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
                ORDER BY queue_number
            `, [queue.barber_id, queue.appointment_date]);
            
            // Verificar que sean consecutivos empezando desde 1
            const issues = [];
            for (let i = 0; i < appointments.length; i++) {
                const expected = i + 1;
                const actual = appointments[i].queue_number;
                if (actual !== expected) {
                    issues.push(`Esperado ${expected}, encontrado ${actual}`);
                }
            }
            
            if (issues.length > 0) {
                console.log(`   ❌ Barbero ${queue.barber_id}, fecha ${queue.appointment_date}: ${issues.join(', ')}`);
                totalIssues += issues.length;
            }
        }
        
        if (totalIssues === 0) {
            console.log(`   ✅ Todas las ${activeQueues.length} colas están íntegras`);
        } else {
            console.log(`   ⚠️  Se encontraron ${totalIssues} problemas en ${activeQueues.length} colas`);
        }
        
    } catch (error) {
        console.error('Error verificando colas:', error);
    }
}

// Función para crear una reserva con el nuevo sistema mejorado
async function makeSecureBooking(barbershopId, barberId, clientName, clientPhone, appointmentDate) {
    const pool = getPool();
    const connection = await pool.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // 1. Verificar si el cliente ya tiene un turno
        const [existing] = await connection.execute(`
            SELECT id FROM appointments 
            WHERE client_phone = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
        `, [clientPhone, appointmentDate]);
        
        if (existing.length > 0) {
            throw new Error('El cliente ya tiene un turno activo para esta fecha');
        }
        
        // 2. Obtener próximo número con bloqueo
        const [lastQueue] = await connection.execute(`
            SELECT COALESCE(MAX(queue_number), 0) as last_queue_number
            FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
            FOR UPDATE
        `, [barberId, appointmentDate]);
        
        const nextQueueNumber = lastQueue[0].last_queue_number + 1;
        
        // 3. Insertar con reintentos en caso de conflicto
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
            try {
                const [result] = await connection.execute(`
                    INSERT INTO appointments (barbershop_id, barber_id, client_name, client_phone, appointment_date, queue_number, estimated_time)
                    VALUES (?, ?, ?, ?, ?, ?, '10:00:00')
                `, [barbershopId, barberId, clientName, clientPhone, appointmentDate, nextQueueNumber]);
                
                await connection.commit();
                
                return {
                    success: true,
                    appointmentId: result.insertId,
                    queueNumber: nextQueueNumber
                };
                
            } catch (insertError) {
                if (insertError.code === 'ER_DUP_ENTRY' && attempts < maxAttempts - 1) {
                    attempts++;
                    console.log(`Reintentando reserva (intento ${attempts + 1}/${maxAttempts})...`);
                    
                    // Esperar un poco antes de reintentar
                    await new Promise(resolve => setTimeout(resolve, 100));
                    continue;
                } else {
                    throw insertError;
                }
            }
        }
        
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    fixQueueDuplicates()
        .then(() => {
            console.log('\n🎉 Correcciones del problema de cola completadas exitosamente');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Error aplicando correcciones:', error);
            process.exit(1);
        });
}

module.exports = {
    fixQueueDuplicates,
    makeSecureBooking,
    reorderQueue
};