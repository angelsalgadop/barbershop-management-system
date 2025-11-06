class BarberPanel {
    constructor() {
        this.token = localStorage.getItem('barber_token');
        this.user = JSON.parse(localStorage.getItem('barber_user') || '{}');
        this.socket = null;
        this.currentDate = new Date().toISOString().split('T')[0];
        this.refreshInterval = null;
        
        if (!this.token) {
            this.showLogin();
            return;
        }

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.connectSocket();
        this.loadDashboard();
        this.updateCurrentDate();
        this.loadWorkStatus();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('dashboardTab').addEventListener('click', (e) => this.switchTab(e, 'dashboard'));
        document.getElementById('scheduleTab').addEventListener('click', (e) => this.switchTab(e, 'schedule'));
        document.getElementById('historyTab').addEventListener('click', (e) => this.switchTab(e, 'history'));

        // Dashboard actions
        document.getElementById('callNextBtn').addEventListener('click', this.callNext.bind(this));
        document.getElementById('completeCurrentBtn').addEventListener('click', this.completeCurrent.bind(this));
        document.getElementById('notifyClientsBtn').addEventListener('click', this.notifyClients.bind(this));
        document.getElementById('refreshQueueBtn').addEventListener('click', this.loadQueue.bind(this));

        // Schedule actions
        document.getElementById('saveScheduleBtn').addEventListener('click', this.saveSchedule.bind(this));
        document.getElementById('updateServiceDurationBtn').addEventListener('click', this.updateServiceDuration.bind(this));

        // History actions
        document.getElementById('filterHistoryBtn').addEventListener('click', this.loadHistory.bind(this));

        // Profile actions
        document.getElementById('logoutLink').addEventListener('click', this.logout.bind(this));
        document.getElementById('changePasswordLink').addEventListener('click', this.showChangePasswordModal.bind(this));
        document.getElementById('savePasswordBtn').addEventListener('click', this.changePassword.bind(this));

        // Real-time updates
        this.startAutoRefresh();
    }

    showLogin() {
        document.body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center vh-100" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
                <div class="card" style="width: 400px;">
                    <div class="card-body">
                        <h4 class="text-center mb-4">Login Barbero</h4>
                        <form id="loginForm">
                            <div class="mb-3">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-control" name="email" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Contraseña</label>
                                <input type="password" class="form-control" name="password" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-100">Iniciar Sesión</button>
                        </form>
                        <div id="loginError" class="alert alert-danger d-none mt-3"></div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', this.handleLogin.bind(this));
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password'),
            role: 'barber'
        };

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('barber_token', data.token);
                localStorage.setItem('barber_user', JSON.stringify(data.user));
                location.reload();
            } else {
                document.getElementById('loginError').textContent = data.error;
                document.getElementById('loginError').classList.remove('d-none');
            }
        } catch (error) {
            document.getElementById('loginError').textContent = 'Error de conexión';
            document.getElementById('loginError').classList.remove('d-none');
        }
    }

    connectSocket() {
        const protocol = location.protocol === 'https:' ? 'https:' : 'http:';
        const socketUrl = protocol + '//' + location.host;
        this.socket = io(socketUrl, {
            auth: { token: this.token },
            secure: protocol === 'https:'
        });

        this.socket.on('connect', () => {
            console.log('Socket connected');
            this.socket.emit('join_barber_room', this.user.id);
        });

        this.socket.on('new_appointment', (appointment) => {
            this.showNotification(`Nuevo turno: ${appointment.client_name}`, 'info');
            this.loadQueue();
            this.updateStats();
        });

        this.socket.on('appointment_called', (appointment) => {
            this.showNotification(`Turno llamado: ${appointment.client_name}`, 'success');
            this.loadQueue();
        });

        this.socket.on('appointment_completed', (appointment) => {
            this.showNotification(`Turno completado: ${appointment.client_name}`, 'success');
            this.loadQueue();
            this.updateStats();
        });

        this.socket.on('appointment_cancelled', (data) => {
            this.showNotification(`Turno cancelado: ${data.client_name}`, 'warning');
            this.loadQueue();
        });

        this.socket.on('queue_update', (data) => {
            this.loadQueue();
        });
    }

    switchTab(e, tab) {
        e.preventDefault();
        
        // Update nav
        document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update content
        document.querySelectorAll('[id$="-section"]').forEach(section => section.style.display = 'none');
        document.getElementById(`${tab}-section`).style.display = 'block';

        // Load specific data
        this.loadTabData(tab);
    }

    loadTabData(tab) {
        switch(tab) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'schedule':
                this.loadSchedule();
                break;
            case 'history':
                this.loadHistory();
                break;
        }
    }

    async loadDashboard() {
        await Promise.all([
            this.updateStats(),
            this.loadQueue(),
            this.loadWorkStatus()
        ]);

        document.getElementById('barberName').textContent = this.user.name || 'Barbero';
    }

    async loadWorkStatus() {
        try {
            const response = await this.apiCall(`/api/barbers/${this.user.id}/work-status`);
            if (response.ok) {
                const status = await response.json();
                this.updateWorkButton(status.is_working, status.start_time);
            } else {
                this.updateWorkButton(false);
            }
        } catch (error) {
            console.error('Error loading work status:', error);
            this.updateWorkButton(false);
        }
    }

    updateWorkButton(isWorking, startTime = null) {
        const btn = document.getElementById('toggleWorkBtn');
        const statusText = document.getElementById('workStatusText');

        if (isWorking) {
            btn.className = 'btn btn-lg btn-danger';
            btn.innerHTML = '<i class="fas fa-stop-circle"></i> Finalizar Turno';
            btn.disabled = false;
            statusText.textContent = 'Actualmente trabajando - Disponible para recibir turnos por WhatsApp';
        } else {
            btn.className = 'btn btn-lg btn-success';
            btn.innerHTML = '<i class="fas fa-play-circle"></i> Iniciar Turno';
            btn.disabled = false;
            statusText.textContent = 'No estás trabajando - No recibirás turnos por WhatsApp';
        }
    }

    async toggleWork() {
        const btn = document.getElementById('toggleWorkBtn');
        const isCurrentlyWorking = btn.classList.contains('btn-danger');

        // Deshabilitar botón mientras procesa
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

        try {
            if (isCurrentlyWorking) {
                await this.endWork();
            } else {
                await this.startWork();
            }
        } catch (error) {
            console.error('Error toggling work:', error);
            // Recargar estado en caso de error
            await this.loadWorkStatus();
        }
    }

    async startWork() {
        try {
            const response = await this.apiCall(`/api/barbers/${this.user.id}/start-work`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showNotification('Turno iniciado exitosamente. Ahora estás disponible en WhatsApp.', 'success');
                await this.loadWorkStatus();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error iniciando turno', 'danger');
                await this.loadWorkStatus();
            }
        } catch (error) {
            console.error('Error starting work:', error);
            this.showNotification('Error iniciando turno', 'danger');
            await this.loadWorkStatus();
        }
    }

    async endWork() {
        if (!confirm('¿Estás seguro de finalizar tu turno? Ya no recibirás nuevos turnos por WhatsApp.')) {
            await this.loadWorkStatus();
            return;
        }

        try {
            const response = await this.apiCall(`/api/barbers/${this.user.id}/end-work`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showNotification('Turno finalizado exitosamente', 'success');
                await this.loadWorkStatus();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error finalizando turno', 'danger');
                await this.loadWorkStatus();
            }
        } catch (error) {
            console.error('Error ending work:', error);
            this.showNotification('Error finalizando turno', 'danger');
            await this.loadWorkStatus();
        }
    }

    async updateStats() {
        try {
            const response = await this.apiCall(`/api/appointments/barber/${this.user.id}/${this.currentDate}`);
            if (response.ok) {
                const data = await response.json();
                
                document.getElementById('todayAppointments').textContent = data.total_appointments;
                document.getElementById('completedToday').textContent = data.completed_count;
                document.getElementById('waitingClients').textContent = data.waiting_count;
                
                // Get service duration
                const profileResponse = await this.apiCall('/api/auth/profile');
                if (profileResponse.ok) {
                    const profile = await profileResponse.json();
                    document.getElementById('avgServiceTime').textContent = profile.service_duration_minutes || 30;
                    document.getElementById('serviceDurationInput').value = profile.service_duration_minutes || 30;
                }
            }
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    async loadQueue() {
        try {
            const response = await this.apiCall(`/api/appointments/barber/${this.user.id}/${this.currentDate}`);
            if (response.ok) {
                const data = await response.json();
                this.renderQueue(data.appointments);
                this.updateCurrentStatus(data.appointments);
            }
        } catch (error) {
            console.error('Error loading queue:', error);
            this.renderQueueError();
        }
    }

    renderQueue(appointments) {
        const container = document.getElementById('queueContainer');
        container.innerHTML = '';

        if (!appointments || appointments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-check"></i>
                    <h5>No hay turnos para hoy</h5>
                    <p class="text-muted">Los clientes pueden reservar turnos a través de WhatsApp</p>
                </div>
            `;
            return;
        }

        appointments.forEach((appointment, index) => {
            const statusClass = appointment.status === 'in_progress' ? 'active' : 
                              appointment.status === 'waiting' ? 'waiting' : 'completed';
            const statusIcon = appointment.status === 'completed' ? 'fa-check' :
                             appointment.status === 'in_progress' ? 'fa-play' : 'fa-clock';
            const statusText = appointment.status === 'completed' ? 'Completado' :
                             appointment.status === 'in_progress' ? 'En Progreso' : 'Esperando';

            const estimatedTime = appointment.estimated_time || 'No definida';
            const waitTime = appointment.wait_time_minutes || 0;

            container.innerHTML += `
                <div class="queue-item p-3 d-flex align-items-center">
                    <div class="queue-number ${statusClass} me-3">
                        ${appointment.queue_number}
                    </div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between">
                            <div>
                                <h6 class="mb-1">${appointment.client_name}</h6>
                                <small class="text-muted">${appointment.client_phone}</small>
                            </div>
                            <div class="text-end">
                                <span class="badge bg-${appointment.status === 'completed' ? 'success' : 
                                                      appointment.status === 'in_progress' ? 'primary' : 'warning'}">
                                    <i class="fas ${statusIcon}"></i> ${statusText}
                                </span>
                                <br>
                                <small class="text-muted">
                                    <i class="fas fa-clock"></i> ${estimatedTime}
                                    ${appointment.status === 'waiting' ? ` (${waitTime} min)` : ''}
                                </small>
                            </div>
                        </div>
                    </div>
                    <div class="ms-3">
                        <div class="btn-group-vertical" role="group">
                            ${appointment.status === 'waiting' ? 
                                `<button class="btn btn-sm btn-success mb-1" onclick="barberPanel.callAppointment(${appointment.id})">
                                    <i class="fas fa-phone"></i> Llamar
                                </button>` : ''
                            }
                            ${appointment.status === 'in_progress' ? 
                                `<button class="btn btn-sm btn-info mb-1" onclick="barberPanel.completeAppointment(${appointment.id})">
                                    <i class="fas fa-check"></i> Completar
                                </button>` : ''
                            }
                            ${appointment.status !== 'completed' ? 
                                `<button class="btn btn-sm btn-outline-danger" onclick="barberPanel.cancelAppointment(${appointment.id})">
                                    <i class="fas fa-times"></i> Cancelar
                                </button>` : ''
                            }
                        </div>
                    </div>
                </div>
            `;
        });

        this.updateActionButtons(appointments);
    }

    updateCurrentStatus(appointments) {
        const inProgress = appointments.find(apt => apt.status === 'in_progress');
        const nextWaiting = appointments.find(apt => apt.status === 'waiting');

        if (inProgress) {
            document.getElementById('currentClientNumber').textContent = inProgress.queue_number;
            document.getElementById('currentClientName').textContent = inProgress.client_name;
            document.getElementById('currentClientTime').textContent = 
                `Iniciado: ${new Date(inProgress.actual_start_time).toLocaleTimeString()}`;
        } else {
            document.getElementById('currentClientNumber').textContent = '-';
            document.getElementById('currentClientName').textContent = 'Sin cliente actual';
            document.getElementById('currentClientTime').textContent = '-';
        }

        if (nextWaiting) {
            document.getElementById('nextClientNumber').textContent = nextWaiting.queue_number;
            document.getElementById('estimatedWaitTime').textContent = `${nextWaiting.wait_time_minutes || 0} min`;
        } else {
            document.getElementById('nextClientNumber').textContent = '-';
            document.getElementById('estimatedWaitTime').textContent = '0 min';
        }
    }

    updateActionButtons(appointments) {
        const hasWaiting = appointments.some(apt => apt.status === 'waiting');
        const hasInProgress = appointments.some(apt => apt.status === 'in_progress');

        document.getElementById('callNextBtn').disabled = !hasWaiting || hasInProgress;
        document.getElementById('completeCurrentBtn').disabled = !hasInProgress;
    }

    renderQueueError() {
        document.getElementById('queueContainer').innerHTML = `
            <div class="empty-state text-danger">
                <i class="fas fa-exclamation-triangle"></i>
                <h5>Error cargando turnos</h5>
                <button class="btn btn-outline-primary" onclick="barberPanel.loadQueue()">Reintentar</button>
            </div>
        `;
    }

    async callNext() {
        try {
            const response = await this.apiCall(`/api/appointments/barber/${this.user.id}/${this.currentDate}`);
            if (response.ok) {
                const data = await response.json();
                const nextAppointment = data.appointments.find(apt => apt.status === 'waiting');
                
                if (nextAppointment) {
                    await this.callAppointment(nextAppointment.id);
                }
            }
        } catch (error) {
            this.showNotification('Error llamando siguiente turno', 'danger');
        }
    }

    async completeCurrent() {
        try {
            const response = await this.apiCall(`/api/appointments/barber/${this.user.id}/${this.currentDate}`);
            if (response.ok) {
                const data = await response.json();
                const currentAppointment = data.appointments.find(apt => apt.status === 'in_progress');
                
                if (currentAppointment) {
                    await this.completeAppointment(currentAppointment.id);
                }
            }
        } catch (error) {
            this.showNotification('Error completando turno actual', 'danger');
        }
    }

    async callAppointment(appointmentId) {
        try {
            const response = await this.apiCall(`/api/appointments/${appointmentId}/call-next`, {
                method: 'PATCH'
            });

            if (response.ok) {
                const data = await response.json();
                this.showNotification(data.message, 'success');
                this.loadQueue();
                this.updateStats();
            } else {
                const error = await response.json();
                this.showNotification(error.error, 'danger');
            }
        } catch (error) {
            this.showNotification('Error llamando turno', 'danger');
        }
    }

    completeAppointment(appointmentId) {
        // Show modal to enter service amount
        this.showCompleteAppointmentModal(appointmentId);
    }

    showCompleteAppointmentModal(appointmentId) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title">
                            <i class="fas fa-check me-2"></i>Completar Turno
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="completeAppointmentFormBarber">
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Valor del Servicio *</label>
                                <div class="input-group">
                                    <span class="input-group-text">$</span>
                                    <input type="number" class="form-control" name="service_amount"
                                           min="0" step="0.01" required placeholder="0.00" autofocus>
                                </div>
                                <div class="form-text">Ingresa el valor cobrado por el servicio</div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Notas (opcional)</label>
                                <textarea class="form-control" name="notes" rows="2"
                                          placeholder="Detalles adicionales del servicio..."></textarea>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="submit" class="btn btn-success">
                                <i class="fas fa-check me-2"></i>Completar Turno
                            </button>
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();

        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });

        document.getElementById('completeAppointmentFormBarber').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const serviceAmount = formData.get('service_amount');
            const notes = formData.get('notes');

            await this.finishCompleteAppointment(appointmentId, serviceAmount, notes, modalInstance);
        });
    }

    async finishCompleteAppointment(appointmentId, serviceAmount, notes, modalInstance) {
        try {
            const response = await this.apiCall(`/api/appointments/${appointmentId}/complete`, {
                method: 'PATCH',
                body: JSON.stringify({
                    service_amount: parseFloat(serviceAmount),
                    notes: notes
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.showNotification('Turno completado exitosamente', 'success');
                modalInstance.hide();
                this.loadQueue();
                this.updateStats();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error completando turno', 'danger');
            }
        } catch (error) {
            console.error('Error completing appointment:', error);
            this.showNotification('Error completando turno', 'danger');
        }
    }

    async cancelAppointment(appointmentId) {
        if (!confirm('¿Estás seguro de cancelar este turno?')) return;

        try {
            const response = await this.apiCall(`/api/appointments/${appointmentId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                const data = await response.json();
                this.showNotification(data.message, 'success');
                this.loadQueue();
                this.updateStats();
            } else {
                const error = await response.json();
                this.showNotification(error.error, 'danger');
            }
        } catch (error) {
            this.showNotification('Error cancelando turno', 'danger');
        }
    }

    async notifyClients() {
        try {
            const response = await this.apiCall(`/api/whatsapp/notify-queue-update/${this.user.barbershop_id}`, {
                method: 'POST',
                body: JSON.stringify({
                    barber_id: this.user.id,
                    appointment_date: this.currentDate
                })
            });

            if (response.ok) {
                const data = await response.json();
                this.showNotification(data.message, 'success');
            } else {
                const error = await response.json();
                this.showNotification(error.error, 'danger');
            }
        } catch (error) {
            this.showNotification('Error notificando clientes', 'danger');
        }
    }

    async loadSchedule() {
        try {
            const response = await this.apiCall(`/api/barbers/${this.user.id}/schedule`);
            if (response.ok) {
                const schedule = await response.json();
                console.log('Schedule cargado:', schedule);
                this.renderSchedule(schedule);
            } else {
                console.error('Error response al cargar schedule:', await response.text());
            }
        } catch (error) {
            console.error('Error loading schedule:', error);
        }
    }

    renderSchedule(schedule) {
        const container = document.getElementById('scheduleContainer');
        if (!container) {
            console.error('scheduleContainer no encontrado en el DOM');
            return;
        }
        
        container.innerHTML = '';

        const dayNames = {
            monday: 'Lunes',
            tuesday: 'Martes',
            wednesday: 'Miércoles',
            thursday: 'Jueves',
            friday: 'Viernes',
            saturday: 'Sábado',
            sunday: 'Domingo'
        };

        Object.keys(dayNames).forEach(day => {
            const daySchedule = schedule[day] || { is_active: false, start_time: '09:00', end_time: '18:00' };
            
            // Convertir formato de hora de HH:MM:SS a HH:MM si es necesario
            const startTime = daySchedule.start_time ? daySchedule.start_time.substring(0, 5) : '09:00';
            const endTime = daySchedule.end_time ? daySchedule.end_time.substring(0, 5) : '18:00';
            
            container.innerHTML += `
                <div class="schedule-day">
                    <div class="day-name">${dayNames[day]}</div>
                    <div class="flex-grow-1 mx-3">
                        <div class="row align-items-center">
                            <div class="col-md-4">
                                <input type="time" class="form-control form-control-sm" 
                                       id="${day}-start" value="${startTime}"
                                       ${!daySchedule.is_active ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-1 text-center">
                                <span>-</span>
                            </div>
                            <div class="col-md-4">
                                <input type="time" class="form-control form-control-sm" 
                                       id="${day}-end" value="${endTime}"
                                       ${!daySchedule.is_active ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-3">
                                <div class="day-status">
                                    <label class="switch">
                                        <input type="checkbox" id="${day}-active" 
                                               ${daySchedule.is_active ? 'checked' : ''}
                                               onchange="barberPanel.toggleDaySchedule('${day}')">
                                        <span class="slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    toggleDaySchedule(day) {
        const isActive = document.getElementById(`${day}-active`).checked;
        const startInput = document.getElementById(`${day}-start`);
        const endInput = document.getElementById(`${day}-end`);
        
        startInput.disabled = !isActive;
        endInput.disabled = !isActive;
        
        if (!isActive) {
            // Para días inactivos, limpiar los valores en lugar de asignar defaults
            startInput.value = '';
            endInput.value = '';
        } else if (!startInput.value || !endInput.value) {
            // Solo asignar valores default si están vacíos y el día se está activando
            startInput.value = '09:00';
            endInput.value = '18:00';
        }
    }

    async saveSchedule() {
        const scheduleData = {};
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const dayNamesSpanish = {
            monday: 'Lunes',
            tuesday: 'Martes', 
            wednesday: 'Miércoles',
            thursday: 'Jueves',
            friday: 'Viernes',
            saturday: 'Sábado',
            sunday: 'Domingo'
        };
        
        dayNames.forEach(day => {
            const activeElement = document.getElementById(`${day}-active`);
            const startElement = document.getElementById(`${day}-start`);
            const endElement = document.getElementById(`${day}-end`);
            
            if (!activeElement || !startElement || !endElement) {
                console.error(`Elementos del día ${day} no encontrados`);
                return;
            }
            
            const isActive = activeElement.checked;
            let startTime = startElement.value.trim();
            let endTime = endElement.value.trim();
            
            // Convertir formato de HH:MM:SS a HH:MM si es necesario
            if (startTime && startTime.length > 5) {
                startTime = startTime.substring(0, 5);
            }
            if (endTime && endTime.length > 5) {
                endTime = endTime.substring(0, 5);
            }
            
            // Para días inactivos, asegurarse de que los tiempos son null
            if (!isActive) {
                scheduleData[day] = {
                    is_active: false,
                    start_time: null,
                    end_time: null
                };
            } else {
                // Para días activos, validar que tengan horarios
                if (!startTime || !endTime) {
                    this.showNotification(`${dayNamesSpanish[day] || day}: Debe especificar horarios de inicio y fin para días activos`, 'danger');
                    return;
                }
                scheduleData[day] = {
                    is_active: true,
                    start_time: startTime,
                    end_time: endTime
                };
            }
        });

        console.log('Datos de horario a enviar:', scheduleData);
        console.log('User ID:', this.user.id);
        console.log('Token:', this.token ? 'presente' : 'ausente');
        
        try {
            const response = await this.apiCall(`/api/barbers/${this.user.id}/schedule`, {
                method: 'PUT',
                body: JSON.stringify(scheduleData)
            });

            console.log('Response status:', response.status);
            
            if (response.ok) {
                this.showNotification('Horarios actualizados exitosamente', 'success');
            } else {
                const errorText = await response.text();
                console.error('Error response text:', errorText);
                
                try {
                    const error = JSON.parse(errorText);
                    this.showNotification(error.error || 'Error actualizando horarios', 'danger');
                } catch (parseError) {
                    console.error('Error parsing response:', parseError);
                    this.showNotification(`Error actualizando horarios: ${errorText}`, 'danger');
                }
            }
        } catch (error) {
            console.error('Error guardando horarios:', error);
            this.showNotification('Error guardando horarios', 'danger');
        }
    }

    async updateServiceDuration() {
        const duration = document.getElementById('serviceDurationInput').value;
        
        try {
            const response = await this.apiCall(`/api/barbers/${this.user.id}`, {
                method: 'PUT',
                body: JSON.stringify({ service_duration_minutes: parseInt(duration) })
            });

            if (response.ok) {
                this.showNotification('Duración de servicio actualizada', 'success');
                this.updateStats();
            } else {
                const error = await response.json();
                this.showNotification(error.error, 'danger');
            }
        } catch (error) {
            this.showNotification('Error actualizando duración', 'danger');
        }
    }

    setQuickSchedule(type) {
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        dayNames.forEach(day => {
            const checkbox = document.getElementById(`${day}-active`);
            const startInput = document.getElementById(`${day}-start`);
            const endInput = document.getElementById(`${day}-end`);
            
            let isActive = false;
            
            switch(type) {
                case 'weekdays':
                    isActive = !['saturday', 'sunday'].includes(day);
                    break;
                case 'weekend':
                    isActive = ['saturday', 'sunday'].includes(day);
                    break;
                case 'fulltime':
                    isActive = true;
                    break;
            }
            
            checkbox.checked = isActive;
            startInput.disabled = !isActive;
            endInput.disabled = !isActive;
            
            if (isActive) {
                startInput.value = '09:00';
                endInput.value = '18:00';
            }
        });
    }

    clearAllSchedule() {
        const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        dayNames.forEach(day => {
            document.getElementById(`${day}-active`).checked = false;
            this.toggleDaySchedule(day);
        });
    }

    async loadHistory() {
        const date = document.getElementById('historyDateFilter').value || this.currentDate;
        
        try {
            const response = await this.apiCall(`/api/appointments/barber/${this.user.id}/${date}`);
            const data = await response.json();
            
            if (response.ok) {
                this.renderHistory(data.appointments || []);
                
                // Update stats
                const totalCompleted = data.appointments.filter(apt => apt.status === 'completed').length;
                const totalCancelled = data.appointments.filter(apt => apt.status === 'cancelled').length;
                
                const completedCountElement = document.getElementById('todayCompletedCount');
                if (completedCountElement) {
                    completedCountElement.textContent = totalCompleted;
                }
                
                // Calculate earnings if available
                const avgPrice = 15000; // Default price - could be configurable
                const estimatedEarnings = totalCompleted * avgPrice;
                const earningsElement = document.getElementById('todayEarnings');
                if (earningsElement) {
                    earningsElement.textContent = `$${estimatedEarnings.toLocaleString()}`;
                }
                
            } else {
                throw new Error(data.error || 'Error cargando historial');
            }
        } catch (error) {
            console.error('Error loading history:', error);
            this.showNotification('Error cargando historial: ' + error.message, 'danger');
            const tbody = document.getElementById('historyTableBody');
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Error cargando datos</td></tr>';
        }
    }

    renderHistory(appointments) {
        const tbody = document.getElementById('historyTableBody');
        
        if (appointments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay turnos en esta fecha</td></tr>';
            return;
        }

        tbody.innerHTML = appointments.map(appointment => {
            const statusBadge = this.getStatusBadge(appointment.status);
            const duration = appointment.actual_end_time && appointment.actual_start_time 
                ? this.calculateDuration(appointment.actual_start_time, appointment.actual_end_time)
                : '-';
            
            return `
                <tr>
                    <td>${appointment.queue_number}</td>
                    <td>${appointment.client_name || 'Cliente WhatsApp'}</td>
                    <td>${appointment.client_phone || '-'}</td>
                    <td>${appointment.estimated_time}</td>
                    <td>${appointment.actual_start_time ? new Date(appointment.actual_start_time).toLocaleTimeString('es-ES', {hour: '2-digit', minute: '2-digit'}) : '-'}</td>
                    <td>${duration}</td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        }).join('');
    }

    calculateDuration(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        const diffMins = Math.round(diffMs / 60000);
        return `${diffMins} min`;
    }

    getStatusBadge(status) {
        const statusMap = {
            'waiting': { class: 'bg-warning', text: 'Esperando', icon: 'fa-clock' },
            'in_progress': { class: 'bg-info', text: 'En progreso', icon: 'fa-scissors' },
            'completed': { class: 'bg-success', text: 'Completado', icon: 'fa-check' },
            'cancelled': { class: 'bg-danger', text: 'Cancelado', icon: 'fa-times' },
            'no_show': { class: 'bg-secondary', text: 'No se presentó', icon: 'fa-user-times' }
        };
        
        const statusInfo = statusMap[status] || { class: 'bg-secondary', text: 'Desconocido', icon: 'fa-question' };
        return `<span class="badge ${statusInfo.class}"><i class="fas ${statusInfo.icon}"></i> ${statusInfo.text}</span>`;
    }

    updateCurrentDate() {
        const today = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('currentDate').textContent = 
            today.toLocaleDateString('es-ES', options);
    }

    startAutoRefresh() {
        // Refresh queue every 30 seconds
        this.refreshInterval = setInterval(() => {
            if (document.getElementById('dashboard-section').style.display !== 'none') {
                this.loadQueue();
            }
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    showChangePasswordModal(e) {
        e.preventDefault();
        
        // Limpiar el formulario
        document.getElementById('changePasswordForm').reset();
        
        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
        modal.show();
    }

    async changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validaciones básicas
        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showNotification('Todos los campos son requeridos', 'danger');
            return;
        }

        if (newPassword.length < 6) {
            this.showNotification('La nueva contraseña debe tener al menos 6 caracteres', 'danger');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showNotification('Las contraseñas no coinciden', 'danger');
            return;
        }

        try {
            const response = await this.apiCall('/api/auth/change-password', {
                method: 'PUT',
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            if (response.ok) {
                this.showNotification('Contraseña cambiada exitosamente', 'success');
                
                // Cerrar el modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
                modal.hide();
                
                // Limpiar el formulario
                document.getElementById('changePasswordForm').reset();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error cambiando contraseña', 'danger');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            this.showNotification('Error cambiando contraseña', 'danger');
        }
    }

    async apiCall(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        };

        return fetch(url, { ...defaultOptions, ...options });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification alert alert-${type} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    logout() {
        if (confirm('¿Estás seguro de cerrar sesión?')) {
            localStorage.removeItem('barber_token');
            localStorage.removeItem('barber_user');
            this.stopAutoRefresh();
            if (this.socket) {
                this.socket.disconnect();
            }
            location.reload();
        }
    }
}

// Initialize the barber panel
const barberPanel = new BarberPanel();

// Handle visibility change to pause/resume auto-refresh
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        barberPanel.stopAutoRefresh();
    } else {
        barberPanel.startAutoRefresh();
    }
});

// Handle window focus to refresh data
window.addEventListener('focus', () => {
    if (barberPanel.token) {
        barberPanel.loadQueue();
    }
});