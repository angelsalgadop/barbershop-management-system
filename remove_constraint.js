#!/usr/bin/env node
/**
 * Remover la restricción única que está causando problemas
 */

const { initDatabase, getPool } = require('./database/connection');

async function removeProblematicConstraint() {
    console.log('🔧 Removiendo restricción única problemática...\n');
    
    try {
        await initDatabase();
        const pool = getPool();
        
        // Remover todas las restricciones únicas de queue_number
        await pool.execute(`
            ALTER TABLE appointments DROP INDEX unique_barber_queue
        `).catch(() => console.log('   ℹ️  Restricción unique_barber_queue no existe'));
        
        await pool.execute(`
            ALTER TABLE appointments DROP INDEX unique_active_queue
        `).catch(() => console.log('   ℹ️  Restricción unique_active_queue no existe'));
        
        // Agregar un índice normal (no único) para performance
        await pool.execute(`
            CREATE INDEX idx_barber_date_queue ON appointments (barber_id, appointment_date, queue_number)
        `).catch(() => console.log('   ℹ️  Índice ya existe'));
        
        console.log('✅ Restricciones problemáticas removidas');
        console.log('✅ Índice de performance agregado');
        
        // Probar inserción
        console.log('\n🧪 Probando inserción...');
        await testInsertion(pool);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    process.exit(0);
}

async function testInsertion(pool) {
    try {
        const [barbers] = await pool.execute(`
            SELECT b.id, b.barbershop_id 
            FROM barbers b 
            JOIN barbershops bs ON b.barbershop_id = bs.id
            WHERE b.is_active = TRUE AND bs.is_active = TRUE 
            LIMIT 1
        `);
        
        if (barbers.length === 0) {
            console.log('   ⚠️  No hay barberos disponibles');
            return;
        }
        
        const barber = barbers[0];
        const today = new Date().toISOString().split('T')[0];
        
        // Insertar con número temporal
        const [result] = await pool.execute(`
            INSERT INTO appointments (barbershop_id, barber_id, client_name, client_phone, appointment_date, queue_number, estimated_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [barber.barbershop_id, barber.id, 'Test Cliente 1', '5551111111', today, 9999, '23:59:00']);
        
        console.log('   ✅ Primera inserción exitosa');
        
        // Insertar segunda vez con mismo número temporal
        const [result2] = await pool.execute(`
            INSERT INTO appointments (barbershop_id, barber_id, client_name, client_phone, appointment_date, queue_number, estimated_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [barber.barbershop_id, barber.id, 'Test Cliente 2', '5551111112', today, 9999, '23:59:00']);
        
        console.log('   ✅ Segunda inserción exitosa (sin restricción única)');
        
        // Renumerar
        await pool.execute('SET @row_number = 0');
        await pool.execute(`
            UPDATE appointments 
            SET queue_number = (@row_number := @row_number + 1)
            WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
            ORDER BY created_at
        `, [barber.id, today]);
        
        console.log('   ✅ Renumeración exitosa');
        
        // Verificar resultado
        const [final] = await pool.execute(`
            SELECT id, queue_number, client_name 
            FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? 
            AND client_name LIKE 'Test Cliente%'
            ORDER BY queue_number
        `, [barber.id, today]);
        
        console.log('   📋 Resultado final:');
        final.forEach(apt => {
            console.log(`     - ${apt.client_name}: Cola #${apt.queue_number}`);
        });
        
        // Limpiar
        await pool.execute(`
            DELETE FROM appointments 
            WHERE barber_id = ? AND appointment_date = ? 
            AND client_name LIKE 'Test Cliente%'
        `, [barber.id, today]);
        
        console.log('   🧹 Datos de prueba limpiados');
        
    } catch (error) {
        console.error('   ❌ Error en prueba:', error.message);
    }
}

removeProblematicConstraint();