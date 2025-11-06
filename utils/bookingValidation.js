/**
 * Utilidades de validación para reservas de turnos
 * Previene errores comunes antes de que ocurran
 */

const { getPool } = require('../database/connection');

class BookingValidator {
    
    /**
     * Valida todos los aspectos de una reserva antes de crearla
     */
    static async validateBooking(barbershopId, barberId, clientPhone, appointmentDate) {
        const errors = [];
        
        try {
            // 1. Validar barbería
            const barbershopValidation = await this.validateBarbershop(barbershopId);
            if (!barbershopValidation.valid) {
                errors.push(...barbershopValidation.errors);
            }
            
            // 2. Validar barbero
            const barberValidation = await this.validateBarber(barberId, barbershopId, appointmentDate);
            if (!barberValidation.valid) {
                errors.push(...barberValidation.errors);
            }
            
            // 3. Validar cliente
            const clientValidation = await this.validateClient(clientPhone, appointmentDate, barberId);
            if (!clientValidation.valid) {
                errors.push(...clientValidation.errors);
            }
            
            // 4. Validar fecha y horario
            const dateValidation = await this.validateDateTime(barberId, appointmentDate);
            if (!dateValidation.valid) {
                errors.push(...dateValidation.errors);
            }
            
            return {
                valid: errors.length === 0,
                errors,
                data: {
                    barbershop: barbershopValidation.data,
                    barber: barberValidation.data,
                    nextQueueNumber: barberValidation.data?.nextQueueNumber || 1
                }
            };
            
        } catch (error) {
            console.error('Error en validación de reserva:', error);
            return {
                valid: false,
                errors: ['Error interno de validación'],
                data: null
            };
        }
    }
    
    static async validateBarbershop(barbershopId) {
        const pool = getPool();
        
        try {
            const [rows] = await pool.execute(`
                SELECT id, name, is_active, is_suspended, suspension_reason
                FROM barbershops 
                WHERE id = ?
            `, [barbershopId]);
            
            if (rows.length === 0) {
                return {
                    valid: false,
                    errors: ['Barbería no encontrada'],
                    data: null
                };
            }
            
            const barbershop = rows[0];
            const errors = [];
            
            if (!barbershop.is_active) {
                errors.push('Barbería inactiva');
            }
            
            if (barbershop.is_suspended) {
                errors.push(`Servicio suspendido: ${barbershop.suspension_reason || 'Razón no especificada'}`);
            }
            
            return {
                valid: errors.length === 0,
                errors,
                data: barbershop
            };
            
        } catch (error) {
            console.error('Error validando barbería:', error);
            return {
                valid: false,
                errors: ['Error verificando barbería'],
                data: null
            };
        }
    }
    
    static async validateBarber(barberId, barbershopId, appointmentDate) {
        const pool = getPool();
        
        try {
            const [rows] = await pool.execute(`
                SELECT b.id, b.name, b.is_active, b.service_duration_minutes,
                       bs.day_of_week, bs.start_time, bs.end_time, bs.is_active as schedule_active
                FROM barbers b
                LEFT JOIN barber_schedules bs ON b.id = bs.barber_id
                WHERE b.id = ? AND b.barbershop_id = ?
            `, [barberId, barbershopId]);
            
            if (rows.length === 0) {
                return {
                    valid: false,
                    errors: ['Barbero no encontrado'],
                    data: null
                };
            }
            
            const barber = rows[0];
            const errors = [];
            
            if (!barber.is_active) {
                errors.push('Barbero no disponible');
            }
            
            // Verificar horario para la fecha específica
            const dayOfWeek = this.getDayOfWeek(appointmentDate);
            const hasScheduleForDay = rows.some(row => 
                row.day_of_week === dayOfWeek && row.schedule_active
            );
            
            if (!hasScheduleForDay) {
                const dayName = this.getDayName(dayOfWeek);
                errors.push(`El barbero no atiende los ${dayName}s`);
            }
            
            // Obtener siguiente número en cola
            let nextQueueNumber = 1;
            try {
                const [queueRows] = await pool.execute(`
                    SELECT COALESCE(MAX(queue_number), 0) as last_queue_number
                    FROM appointments 
                    WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
                `, [barberId, appointmentDate]);
                
                nextQueueNumber = queueRows[0].last_queue_number + 1;
            } catch (queueError) {
                console.error('Error calculando número de cola:', queueError);
            }
            
            return {
                valid: errors.length === 0,
                errors,
                data: {
                    ...barber,
                    nextQueueNumber,
                    scheduleForDay: rows.find(row => row.day_of_week === dayOfWeek)
                }
            };
            
        } catch (error) {
            console.error('Error validando barbero:', error);
            return {
                valid: false,
                errors: ['Error verificando barbero'],
                data: null
            };
        }
    }
    
    static async validateClient(clientPhone, appointmentDate, barberId) {
        const pool = getPool();
        
        try {
            // Verificar si ya tiene turno para hoy
            const [existingAppointments] = await pool.execute(`
                SELECT id, status, barber_id
                FROM appointments 
                WHERE client_phone = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
            `, [clientPhone, appointmentDate]);
            
            if (existingAppointments.length > 0) {
                const existing = existingAppointments[0];
                const sameBarber = existing.barber_id === barberId;
                const status = existing.status === 'in_progress' ? 'siendo atendido' : 'en espera';
                
                return {
                    valid: false,
                    errors: [`Ya tienes un turno ${status} para hoy${!sameBarber ? ' con otro barbero' : ''}`],
                    data: existing
                };
            }
            
            // Validar formato de teléfono
            const phoneRegex = /^[0-9]{8,15}$/;
            if (!phoneRegex.test(clientPhone.replace(/[^0-9]/g, ''))) {
                return {
                    valid: false,
                    errors: ['Número de teléfono inválido'],
                    data: null
                };
            }
            
            return {
                valid: true,
                errors: [],
                data: { clientPhone }
            };
            
        } catch (error) {
            console.error('Error validando cliente:', error);
            return {
                valid: false,
                errors: ['Error verificando cliente'],
                data: null
            };
        }
    }
    
    static async validateDateTime(barberId, appointmentDate) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const appointmentDateObj = new Date(appointmentDate);
            const now = new Date();
            
            const errors = [];
            
            // No permitir fechas pasadas
            if (appointmentDate < today) {
                errors.push('No se pueden reservar turnos para fechas pasadas');
            }
            
            // No permitir fechas muy futuras (más de 30 días)
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 30);
            if (appointmentDateObj > maxDate) {
                errors.push('No se pueden reservar turnos con más de 30 días de anticipación');
            }
            
            // Si es hoy, verificar que esté dentro del horario
            if (appointmentDate === today) {
                const pool = getPool();
                const dayOfWeek = this.getDayOfWeek(appointmentDate);
                
                const [scheduleRows] = await pool.execute(`
                    SELECT start_time, end_time 
                    FROM barber_schedules 
                    WHERE barber_id = ? AND day_of_week = ? AND is_active = TRUE
                `, [barberId, dayOfWeek]);
                
                if (scheduleRows.length > 0) {
                    const schedule = scheduleRows[0];
                    const currentTime = now.getHours() * 60 + now.getMinutes();
                    const endTime = parseInt(schedule.end_time.split(':')[0]) * 60 + parseInt(schedule.end_time.split(':')[1]);
                    
                    if (currentTime >= endTime) {
                        errors.push('Horario de atención cerrado para hoy');
                    }
                }
            }
            
            return {
                valid: errors.length === 0,
                errors,
                data: { appointmentDate }
            };
            
        } catch (error) {
            console.error('Error validando fecha/hora:', error);
            return {
                valid: false,
                errors: ['Error verificando fecha y horario'],
                data: null
            };
        }
    }
    
    static getDayOfWeek(dateString) {
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return dayNames[new Date(dateString).getDay()];
    }
    
    static getDayName(dayOfWeek) {
        const dayNamesEs = {
            'sunday': 'Domingo',
            'monday': 'Lunes', 
            'tuesday': 'Martes',
            'wednesday': 'Miércoles',
            'thursday': 'Jueves',
            'friday': 'Viernes',
            'saturday': 'Sábado'
        };
        return dayNamesEs[dayOfWeek] || 'día';
    }
    
    /**
     * Valida la integridad de la cola de un barbero
     */
    static async validateQueue(barberId, appointmentDate) {
        const pool = getPool();
        
        try {
            const [appointments] = await pool.execute(`
                SELECT id, queue_number, status
                FROM appointments 
                WHERE barber_id = ? AND appointment_date = ? AND status IN ('waiting', 'in_progress')
                ORDER BY queue_number
            `, [barberId, appointmentDate]);
            
            const errors = [];
            const expectedNumbers = [];
            
            // Verificar que los números de cola sean consecutivos empezando desde 1
            for (let i = 0; i < appointments.length; i++) {
                expectedNumbers.push(i + 1);
                if (appointments[i].queue_number !== i + 1) {
                    errors.push(`Número de cola inconsistente: esperado ${i + 1}, encontrado ${appointments[i].queue_number}`);
                }
            }
            
            return {
                valid: errors.length === 0,
                errors,
                data: {
                    totalAppointments: appointments.length,
                    expectedNumbers,
                    actualNumbers: appointments.map(apt => apt.queue_number)
                }
            };
            
        } catch (error) {
            console.error('Error validando cola:', error);
            return {
                valid: false,
                errors: ['Error verificando integridad de la cola'],
                data: null
            };
        }
    }
}

module.exports = BookingValidator;