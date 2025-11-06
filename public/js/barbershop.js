class BarbershopPanel {
    constructor() {
        this.token = localStorage.getItem('barbershop_token');
        this.user = JSON.parse(localStorage.getItem('barbershop_user') || '{}');
        this.socket = null;
        this.currentDate = new Date().toISOString().split('T')[0];
        this.refreshInterval = null;
        this.whatsappNotificationShown = false;
        this.qrFallbackTimeout = null;
        this.whatsappStatusInterval = null;
        
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
        this.startAutoRefresh();
        this.startWhatsAppStatusCheck();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('dashboardTab').addEventListener('click', (e) => this.switchTab(e, 'dashboard'));
        document.getElementById('barbersTab').addEventListener('click', (e) => this.switchTab(e, 'barbers'));
        document.getElementById('appointmentsTab').addEventListener('click', (e) => this.switchTab(e, 'appointments'));
        document.getElementById('whatsappTab').addEventListener('click', (e) => this.switchTab(e, 'whatsapp'));
        document.getElementById('billingTab').addEventListener('click', (e) => this.switchTab(e, 'billing'));

        // Dashboard actions
        document.getElementById('refreshDashboardBtn').addEventListener('click', this.loadDashboard.bind(this));

        // Barbers actions
        document.getElementById('saveBarberBtn').addEventListener('click', this.createBarber.bind(this));

        // Appointments actions
        document.getElementById('refreshAppointmentsBtn').addEventListener('click', this.loadAppointments.bind(this));
        document.getElementById('dateFilter').addEventListener('change', this.loadAppointments.bind(this));
        document.getElementById('barberFilter').addEventListener('change', this.loadAppointments.bind(this));

        // WhatsApp actions
        document.getElementById('connectWhatsAppBtn').addEventListener('click', this.connectWhatsApp.bind(this));
        document.getElementById('disconnectWhatsAppBtn').addEventListener('click', this.disconnectWhatsApp.bind(this));
        document.getElementById('bulkMessageForm').addEventListener('submit', this.sendBulkMessage.bind(this));

        // Billing actions
        document.getElementById('billingFiltersForm').addEventListener('submit', this.generateBillingReport.bind(this));
        document.getElementById('periodType').addEventListener('change', this.handlePeriodTypeChange.bind(this));
        document.getElementById('exportReportBtn').addEventListener('click', this.exportBillingReport.bind(this));

        // Profile actions
        document.getElementById('changePasswordLink').addEventListener('click', this.showChangePasswordModal.bind(this));
        document.getElementById('logoutLink').addEventListener('click', this.logout.bind(this));
    }

    showLogin() {
        document.body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center vh-100" style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);">
                <div class="card" style="width: 400px;">
                    <div class="card-body">
                        <h4 class="text-center mb-4">Login Barbería</h4>
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
                        <div class="text-center mt-3">
                            <small class="text-muted">¿No tienes cuenta? <a href="#" onclick="showRegisterForm()">Registra tu barbería</a></small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', this.handleLogin.bind(this));
        
        // Add register functionality
        window.showRegisterForm = this.showRegisterForm.bind(this);
    }

    showRegisterForm() {
        document.body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center vh-100" style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);">
                <div class="card" style="width: 500px;">
                    <div class="card-body">
                        <h4 class="text-center mb-4">Registrar Barbería</h4>
                        <form id="registerForm">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Nombre de la Barbería *</label>
                                        <input type="text" class="form-control" name="name" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Email *</label>
                                        <input type="email" class="form-control" name="email" required>
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Dirección</label>
                                <textarea class="form-control" name="address" rows="2"></textarea>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">Teléfono</label>
                                        <input type="text" class="form-control" name="phone">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label class="form-label">WhatsApp</label>
                                        <input type="text" class="form-control" name="whatsapp_number">
                                    </div>
                                </div>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Contraseña *</label>
                                <input type="password" class="form-control" name="password" required minlength="6">
                            </div>
                            <button type="submit" class="btn btn-success w-100">Registrar Barbería</button>
                        </form>
                        <div id="registerError" class="alert alert-danger d-none mt-3"></div>
                        <div class="text-center mt-3">
                            <small class="text-muted">¿Ya tienes cuenta? <a href="#" onclick="location.reload()">Iniciar Sesión</a></small>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('registerForm').addEventListener('submit', this.handleRegister.bind(this));
    }

    async handleLogin(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const loginData = {
            email: formData.get('email'),
            password: formData.get('password'),
            role: 'barbershop'
        };

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });

            const data = await response.json();

            if (response.ok) {
                if (data.suspended) {
                    document.getElementById('loginError').textContent = data.error;
                    document.getElementById('loginError').classList.remove('d-none');
                    return;
                }
                
                localStorage.setItem('barbershop_token', data.token);
                localStorage.setItem('barbershop_user', JSON.stringify(data.user));
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

    async handleRegister(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const registerData = Object.fromEntries(formData.entries());

        try {
            const response = await fetch('/api/auth/register-barbershop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerData)
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('barbershop_token', data.token);
                localStorage.setItem('barbershop_user', JSON.stringify(data.user));
                location.reload();
            } else {
                const errorMsg = data.errors ? data.errors.map(e => e.msg).join(', ') : data.error;
                document.getElementById('registerError').textContent = errorMsg;
                document.getElementById('registerError').classList.remove('d-none');
            }
        } catch (error) {
            document.getElementById('registerError').textContent = 'Error de conexión';
            document.getElementById('registerError').classList.remove('d-none');
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
            console.log('Intentando unirse a la sala barbershop_' + this.user.id);
            this.socket.emit('join_barbershop_room', this.user.id);
        });

        this.socket.on('new_appointment', (appointment) => {
            this.showNotification(`Nuevo turno: ${appointment.client_name}`, 'success');
            this.loadDashboard();
        });

        this.socket.on('appointment_called', (appointment) => {
            this.showNotification(`Turno llamado: ${appointment.client_name} (${appointment.barber_name})`, 'info');
            this.loadDashboard();
        });

        this.socket.on('appointment_completed', (appointment) => {
            this.showNotification(`Turno completado: ${appointment.client_name} (${appointment.barber_name})`, 'success');
            this.loadDashboard();
        });

        this.socket.on('appointment_cancelled', (data) => {
            this.showNotification(`Turno cancelado: ${data.client_name}`, 'warning');
            this.loadDashboard();
        });

        this.socket.on('queue_refresh', () => {
            // Refresh appointments if we're on the appointments tab
            if (document.getElementById('appointments-section').style.display !== 'none') {
                this.loadAppointments();
            }
            this.loadDashboard(); // Also refresh dashboard stats
        });

        this.socket.on('queue_position_updated', (data) => {
            this.showNotification(`Posición actualizada para turno ${data.appointment_id}: Nuevo turno #${data.new_queue_number}`, 'info');
            // Refresh appointments if we're on the appointments tab
            if (document.getElementById('appointments-section').style.display !== 'none') {
                this.loadAppointments();
            }
        });

        this.socket.on('whatsapp_qr', (data) => {
            console.log('QR recibido via socket:', data);

            // Verificar si ya está conectado antes de mostrar QR
            const currentStatus = this.getCurrentDisplayedStatus();
            if (currentStatus === 'connected') {
                console.log('WhatsApp ya conectado, ignorando QR');
                return;
            }

            // Limpiar timeout de fallback si existe
            if (this.qrFallbackTimeout) {
                clearTimeout(this.qrFallbackTimeout);
                this.qrFallbackTimeout = null;
            }

            this.showWhatsAppQR(data.qr);
            this.showNotification('Código QR generado. Escanea con tu teléfono.', 'success');
        });

        this.socket.on('whatsapp_ready', (data) => {
            console.log('Evento whatsapp_ready recibido:', data);
            console.log('Usuario ID:', this.user.id);

            // Limpiar timeout de fallback si existe
            if (this.qrFallbackTimeout) {
                clearTimeout(this.qrFallbackTimeout);
                this.qrFallbackTimeout = null;
            }

            // Verificar que no esté ya conectado para evitar notificaciones duplicadas
            const currentStatus = this.getCurrentDisplayedStatus();
            if (currentStatus !== 'connected') {
                this.showWhatsAppConnected(data);
            }
        });

        this.socket.on('whatsapp_disconnected', () => {
            console.log('Evento whatsapp_disconnected recibido');
            this.showWhatsAppDisconnected();
        });

        this.socket.on('whatsapp_initializing', (data) => {
            console.log('Evento whatsapp_initializing recibido:', data);
            this.showWhatsAppInitializing();
        });

        this.socket.on('whatsapp_error', (data) => {
            console.log('Evento whatsapp_error recibido:', data);
            this.showWhatsAppError(data);
        });

        this.socket.on('whatsapp_qr_clear', (data) => {
            console.log('Evento whatsapp_qr_clear recibido:', data);
            // Limpiar QR cuando se conecta exitosamente
            const qrDiv = document.getElementById('whatsappQR');
            if (qrDiv) {
                qrDiv.style.display = 'none';
            }
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
            case 'barbers':
                this.loadBarbers();
                break;
            case 'appointments':
                this.loadAppointments();
                break;
            case 'whatsapp':
                this.loadWhatsApp();
                break;
            case 'billing':
                this.loadBilling();
                break;
        }
    }

    async loadDashboard() {
        try {
            const [statsResponse, barbersResponse] = await Promise.all([
                this.apiCall(`/api/barbershops/${this.user.id}/stats`),
                this.apiCall(`/api/barbers/barbershop/${this.user.id}`)
            ]);

            if (statsResponse.ok && barbersResponse.ok) {
                const stats = await statsResponse.json();
                const barbers = await barbersResponse.json();

                document.getElementById('todayAppointments').textContent = stats.today_appointments || 0;
                document.getElementById('activeBarbers').textContent = stats.active_barbers || 0;
                document.getElementById('waitingClients').textContent = stats.waiting_clients || 0;
                document.getElementById('monthlyAppointments').textContent = stats.monthly_appointments || 0;

                // Cargar estado de trabajo para cada barbero
                await this.loadBarbersWorkStatus(barbers);
                this.renderBarbersStatus(barbers);

                // Cargar gráfico de resumen del día
                this.renderDailySummaryChart(stats);

                // Cargar alertas
                this.renderAlerts(stats, barbers);

                document.getElementById('barbershopName').textContent = this.user.name || 'Barbería';
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
    }

    renderDailySummaryChart(stats) {
        const ctx = document.getElementById('dailySummaryChart');
        if (!ctx) return;

        // Destruir gráfico anterior si existe
        if (this.dailySummaryChartInstance) {
            this.dailySummaryChartInstance.destroy();
        }

        // Crear nuevo gráfico
        this.dailySummaryChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Completados', 'En Espera', 'En Progreso', 'Cancelados'],
                datasets: [{
                    data: [
                        stats.completed_today || 0,
                        stats.waiting_clients || 0,
                        stats.in_progress_today || 0,
                        stats.cancelled_today || 0
                    ],
                    backgroundColor: [
                        '#28a745',  // Verde para completados
                        '#ffc107',  // Amarillo para en espera
                        '#17a2b8',  // Azul para en progreso
                        '#dc3545'   // Rojo para cancelados
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'Turnos de Hoy'
                    }
                }
            }
        });
    }

    renderAlerts(stats, barbers) {
        const alertsContainer = document.getElementById('alertsContainer');
        if (!alertsContainer) return;

        const alerts = [];

        // Alerta si hay barberos inactivos
        const inactiveBarbers = barbers.filter(b => !b.is_active);
        if (inactiveBarbers.length > 0) {
            alerts.push({
                type: 'warning',
                icon: 'fa-user-slash',
                message: `${inactiveBarbers.length} barbero(s) inactivo(s)`
            });
        }

        // Alerta si hay barberos que no han iniciado turno
        const notWorkingBarbers = barbers.filter(b => b.is_active && (!b.work_status || !b.work_status.is_working));
        if (notWorkingBarbers.length > 0) {
            alerts.push({
                type: 'info',
                icon: 'fa-clock',
                message: `${notWorkingBarbers.length} barbero(s) no han iniciado turno hoy`
            });
        }

        // Alerta si hay muchos clientes esperando
        if (stats.waiting_clients > 5) {
            alerts.push({
                type: 'warning',
                icon: 'fa-users',
                message: `${stats.waiting_clients} clientes esperando. Cola larga detectada.`
            });
        }

        // Alerta si no hay turnos hoy
        if (stats.today_appointments === 0) {
            alerts.push({
                type: 'info',
                icon: 'fa-calendar-times',
                message: 'No hay turnos registrados para hoy'
            });
        }

        // Renderizar alertas
        if (alerts.length === 0) {
            alertsContainer.innerHTML = '<div class="text-muted text-center">Sin alertas</div>';
        } else {
            alertsContainer.innerHTML = alerts.map(alert => `
                <div class="alert alert-${alert.type} alert-dismissible fade show mb-2" role="alert">
                    <i class="fas ${alert.icon} me-2"></i>${alert.message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `).join('');
        }
    }

    async loadBarbersWorkStatus(barbers) {
        // Cargar estado de trabajo para cada barbero
        const workStatusPromises = barbers.map(barber =>
            this.apiCall(`/api/barbers/${barber.id}/work-status`)
                .then(res => res.ok ? res.json() : { is_working: false })
                .then(status => {
                    barber.work_status = status;
                    return barber;
                })
                .catch(() => {
                    barber.work_status = { is_working: false };
                    return barber;
                })
        );
        await Promise.all(workStatusPromises);
    }

    renderBarbersStatus(barbers) {
        const container = document.getElementById('barbersStatusContainer');
        container.innerHTML = '';

        if (!barbers || barbers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h5>No hay barberos registrados</h5>
                    <p class="text-muted">Agrega barberos para comenzar a recibir turnos</p>
                    <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#createBarberModal">
                        <i class="fas fa-plus"></i> Agregar Primer Barbero
                    </button>
                </div>
            `;
            return;
        }

        barbers.forEach(barber => {
            const statusClass = barber.is_active ? 'active' : 'inactive';
            const queueIndicator = barber.waiting_clients_today > 0 ?
                `<span class="queue-indicator">${barber.waiting_clients_today} esperando</span>` :
                '<span class="text-muted">Sin cola</span>';

            // Botón de trabajo
            const isWorking = barber.work_status && barber.work_status.is_working;
            const workButtonClass = isWorking ? 'danger' : 'success';
            const workButtonIcon = isWorking ? 'fa-stop-circle' : 'fa-play-circle';
            const workButtonText = isWorking ? 'Finalizar Turno' : 'Iniciar Turno';
            const workButtonAction = isWorking ?
                `barbershopPanel.endWork(${barber.id})` :
                `barbershopPanel.startWork(${barber.id})`;

            container.innerHTML += `
                <div class="barber-card card mb-3">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-1">
                                    <span class="barber-status ${statusClass}"></span>
                                    ${barber.name}
                                    ${isWorking ? '<span class="badge bg-success ms-2">Trabajando</span>' : '<span class="badge bg-secondary ms-2">Sin trabajar</span>'}
                                </h6>
                                <small class="text-muted">
                                    <i class="fas fa-clock"></i> ${barber.service_duration_minutes || 30} min/cliente
                                </small>
                            </div>
                            <div class="text-end">
                                ${queueIndicator}
                                <br>
                                <button class="btn btn-sm btn-${workButtonClass} mt-2 me-2" onclick="${workButtonAction}">
                                    <i class="fas ${workButtonIcon}"></i> ${workButtonText}
                                </button>
                                <div class="btn-group mt-2">
                                    <button class="btn btn-sm btn-outline-primary" onclick="barbershopPanel.viewBarber(${barber.id})">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-info" onclick="barbershopPanel.editBarber(${barber.id})">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn btn-sm btn-outline-${barber.is_active ? 'warning' : 'success'}"
                                            onclick="barbershopPanel.toggleBarberStatus(${barber.id}, ${!barber.is_active})">
                                        <i class="fas fa-${barber.is_active ? 'pause' : 'play'}"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    async loadBarbers() {
        try {
            const response = await this.apiCall(`/api/barbers/barbershop/${this.user.id}`);
            if (response.ok) {
                const barbers = await response.json();
                await this.loadBarbersWorkStatus(barbers);
                this.renderBarbersGrid(barbers);
            }
        } catch (error) {
            console.error('Error loading barbers:', error);
        }
    }

    renderBarbersGrid(barbers) {
        const container = document.getElementById('barbersGrid');
        container.innerHTML = '';

        if (!barbers || barbers.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <h5>No hay barberos registrados</h5>
                        <p class="text-muted">Agrega tu primer barbero para comenzar</p>
                        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#createBarberModal">
                            <i class="fas fa-plus"></i> Agregar Barbero
                        </button>
                    </div>
                </div>
            `;
            return;
        }

        barbers.forEach(barber => {
            const statusClass = barber.is_active ? 'text-success' : 'text-muted';
            const statusIcon = barber.is_active ? 'fa-check-circle' : 'fa-pause-circle';
            const statusText = barber.is_active ? 'Activo' : 'Inactivo';

            // Estado de trabajo
            const isWorking = barber.work_status && barber.work_status.is_working;
            const workButtonClass = isWorking ? 'danger' : 'success';
            const workButtonIcon = isWorking ? 'fa-stop-circle' : 'fa-play-circle';
            const workButtonText = isWorking ? 'Finalizar Turno' : 'Iniciar Turno';
            const workButtonAction = isWorking ?
                `barbershopPanel.endWork(${barber.id})` :
                `barbershopPanel.startWork(${barber.id})`;

            container.innerHTML += `
                <div class="col-lg-4 col-md-6">
                    <div class="card barber-card">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <h5 class="card-title mb-0">
                                    ${barber.name}
                                    ${isWorking ? '<br><span class="badge bg-success mt-1">Trabajando</span>' : '<br><span class="badge bg-secondary mt-1">Sin trabajar</span>'}
                                </h5>
                                <span class="${statusClass}">
                                    <i class="fas ${statusIcon}"></i> ${statusText}
                                </span>
                            </div>

                            <div class="mb-2">
                                <small class="text-muted">
                                    <i class="fas fa-envelope"></i> ${barber.email || 'Sin email'}
                                </small>
                            </div>

                            <div class="mb-2">
                                <small class="text-muted">
                                    <i class="fas fa-phone"></i> ${barber.phone || 'Sin teléfono'}
                                </small>
                            </div>

                            <div class="mb-3">
                                <small class="text-muted">
                                    <i class="fas fa-clock"></i> ${barber.service_duration_minutes || 30} min por cliente
                                </small>
                            </div>

                            <div class="row text-center mb-3">
                                <div class="col-6">
                                    <strong>${barber.waiting_clients_today || 0}</strong>
                                    <br><small>En espera</small>
                                </div>
                                <div class="col-6">
                                    <strong>${isWorking ? '<i class="fas fa-check-circle text-success"></i>' : '<i class="fas fa-times-circle text-muted"></i>'}</strong>
                                    <br><small>Estado turno</small>
                                </div>
                            </div>

                            <div class="d-grid gap-2">
                                <button class="btn btn-${workButtonClass} btn-sm" onclick="${workButtonAction}">
                                    <i class="fas ${workButtonIcon}"></i> ${workButtonText}
                                </button>
                                <button class="btn btn-primary btn-sm" onclick="barbershopPanel.viewBarber(${barber.id})">
                                    <i class="fas fa-eye"></i> Ver Detalles
                                </button>
                                <div class="btn-group">
                                    <button class="btn btn-outline-info btn-sm" onclick="barbershopPanel.editBarber(${barber.id})">
                                        <i class="fas fa-edit"></i> Editar
                                    </button>
                                    <button class="btn btn-outline-${barber.is_active ? 'warning' : 'success'} btn-sm"
                                            onclick="barbershopPanel.toggleBarberStatus(${barber.id}, ${!barber.is_active})">
                                        <i class="fas fa-${barber.is_active ? 'pause' : 'play'}"></i>
                                        ${barber.is_active ? 'Pausar' : 'Activar'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    async createBarber() {
        const form = document.getElementById('createBarberForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await this.apiCall(`/api/barbers/barbershop/${this.user.id}`, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showNotification('Barbero agregado exitosamente', 'success');
                form.reset();
                const modal = bootstrap.Modal.getInstance(document.getElementById('createBarberModal'));
                modal.hide();
                this.loadBarbers();
                this.loadDashboard();
            } else {
                const error = await response.json();

                // Manejo especial para límite de barberos alcanzado
                if (response.status === 403 && error.message) {
                    // Mostrar modal con información detallada
                    this.showPlanLimitModal(error);
                } else {
                    this.showNotification(error.error || 'Error agregando barbero', 'danger');
                }
            }
        } catch (error) {
            this.showNotification('Error agregando barbero', 'danger');
        }
    }

    async toggleBarberStatus(barberId, isActive) {
        try {
            const response = await this.apiCall(`/api/barbers/${barberId}/toggle-status`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: isActive })
            });

            if (response.ok) {
                this.showNotification(`Barbero ${isActive ? 'activado' : 'desactivado'} exitosamente`, 'success');
                this.loadBarbers();
                this.loadDashboard();
            } else {
                const error = await response.json();
                this.showNotification(error.error, 'danger');
            }
        } catch (error) {
            this.showNotification('Error cambiando estado del barbero', 'danger');
        }
    }

    async startWork(barberId) {
        try {
            const response = await this.apiCall(`/api/barbers/${barberId}/start-work`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showNotification('Turno iniciado exitosamente', 'success');
                this.loadBarbers();
                this.loadDashboard();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error iniciando turno', 'danger');
            }
        } catch (error) {
            console.error('Error starting work:', error);
            this.showNotification('Error iniciando turno', 'danger');
        }
    }

    async endWork(barberId) {
        if (!confirm('¿Estás seguro de finalizar el turno? Esto afectará la disponibilidad en WhatsApp.')) {
            return;
        }

        try {
            const response = await this.apiCall(`/api/barbers/${barberId}/end-work`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showNotification('Turno finalizado exitosamente', 'success');
                this.loadBarbers();
                this.loadDashboard();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error finalizando turno', 'danger');
            }
        } catch (error) {
            console.error('Error ending work:', error);
            this.showNotification('Error finalizando turno', 'danger');
        }
    }

    async viewBarber(barberId) {
        try {
            const response = await this.apiCall(`/api/barbers/${barberId}`);
            const data = await response.json();
            
            if (response.ok) {
                this.showBarberDetailsModal(data);
            } else {
                throw new Error(data.error || 'Error cargando barbero');
            }
        } catch (error) {
            console.error('Error viewing barber:', error);
            this.showNotification('Error cargando detalles del barbero: ' + error.message, 'danger');
        }
    }

    async editBarber(barberId) {
        try {
            const response = await this.apiCall(`/api/barbers/${barberId}`);
            const data = await response.json();
            
            if (response.ok) {
                this.showEditBarberModal(data);
            } else {
                throw new Error(data.error || 'Error cargando barbero');
            }
        } catch (error) {
            console.error('Error loading barber for edit:', error);
            this.showNotification('Error cargando barbero: ' + error.message, 'danger');
        }
    }

    showBarberDetailsModal(barber) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-user-circle me-2"></i>
                            Detalles del Barbero - ${barber.name}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6><i class="fas fa-info-circle me-2"></i>Información Personal</h6>
                                <p><strong>Nombre:</strong> ${barber.name}</p>
                                <p><strong>Email:</strong> ${barber.email}</p>
                                <p><strong>Teléfono:</strong> ${barber.phone || 'No especificado'}</p>
                                <p><strong>Duración por servicio:</strong> ${barber.service_duration_minutes} minutos</p>
                                <p><strong>Estado:</strong> 
                                    <span class="badge bg-${barber.is_active ? 'success' : 'danger'}">
                                        ${barber.is_active ? 'Activo' : 'Inactivo'}
                                    </span>
                                </p>
                            </div>
                            <div class="col-md-6" style="display: none;">
                                <h6><i class="fas fa-calendar me-2"></i>Horarios</h6>
                                <div id="barberSchedule">
                                    ${this.renderBarberSchedule(barber.schedules || [])}
                                </div>
                            </div>
                        </div>
                        <hr>
                        <h6><i class="fas fa-chart-bar me-2"></i>Estadísticas de Hoy</h6>
                        <div id="barberStats">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Cargando...</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="barbershopPanel.editBarber(${barber.id})" data-bs-dismiss="modal">
                            <i class="fas fa-edit me-2"></i>Editar
                        </button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        const modalInstance = new bootstrap.Modal(modal);
        modalInstance.show();
        
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
        
        // Load today's stats
        this.loadBarberStats(barber.id);
    }

    showEditBarberModal(barber) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-edit me-2"></i>
                            Editar Barbero - ${barber.name}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="editBarberForm">
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Nombre</label>
                                <input type="text" class="form-control" name="name" value="${barber.name}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Email</label>
                                <input type="email" class="form-control" name="email" value="${barber.email}" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Nueva Contraseña</label>
                                <input type="password" class="form-control" name="password" minlength="6" placeholder="Dejar vacío para mantener la actual">
                                <small class="form-text text-muted">Solo ingresa una nueva contraseña si deseas cambiarla</small>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Teléfono</label>
                                <input type="tel" class="form-control" name="phone" value="${barber.phone || ''}" placeholder="Opcional">
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Duración por servicio (minutos)</label>
                                <input type="number" class="form-control" name="service_duration_minutes"
                                       value="${barber.service_duration_minutes}" min="5" max="180" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">
                                    Porcentaje de Comisión (%)
                                    <i class="fas fa-info-circle text-info ms-1" data-bs-toggle="tooltip"
                                       title="Porcentaje que recibe el barbero por cada servicio completado"></i>
                                </label>
                                <div class="input-group">
                                    <input type="number" class="form-control" name="commission_percentage"
                                           value="${barber.commission_percentage || 60.00}" min="0" max="100" step="0.01" required>
                                    <span class="input-group-text">%</span>
                                </div>
                                <small class="text-muted">El resto va para la barbería. Ejemplo: 60% barbero, 40% barbería</small>
                            </div>

                            <!-- Horarios de atención - OCULTO (ahora se usa inicio/fin de labores) -->
                            <div class="mb-4" style="display: none;">
                                <h6 class="form-label mb-3">
                                    <i class="fas fa-calendar-alt me-2"></i>Horarios de Atención
                                </h6>
                                <div class="row g-2">
                                    ${this.generateScheduleFields(barber.schedules || [])}
                                </div>
                            </div>

                            <div class="mb-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" name="is_active"
                                           ${barber.is_active ? 'checked' : ''} id="editBarberActive">
                                    <label class="form-check-label" for="editBarberActive">
                                        Barbero activo
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="submit" class="btn btn-primary">
                                <i class="fas fa-save me-2"></i>Guardar Cambios
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
        
        document.getElementById('editBarberForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveBarberChanges(barber.id, new FormData(e.target), modalInstance);
        });

        // Agregar eventos para habilitar/deshabilitar campos de horario
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        days.forEach(day => {
            const checkbox = document.getElementById(`schedule_${day}`);
            const startTimeInput = document.querySelector(`input[name="schedule[${day}][start_time]"]`);
            const endTimeInput = document.querySelector(`input[name="schedule[${day}][end_time]"]`);

            if (checkbox && startTimeInput && endTimeInput) {
                checkbox.addEventListener('change', (e) => {
                    startTimeInput.disabled = !e.target.checked;
                    endTimeInput.disabled = !e.target.checked;
                });
            }
        });
    }

    generateScheduleFields(schedules) {
        const dayNames = {
            monday: 'Lunes',
            tuesday: 'Martes',
            wednesday: 'Miércoles',
            thursday: 'Jueves',
            friday: 'Viernes',
            saturday: 'Sábado',
            sunday: 'Domingo'
        };

        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

        return days.map(day => {
            const schedule = schedules.find(s => s.day_of_week === day) || {
                day_of_week: day,
                start_time: '09:00',
                end_time: '18:00',
                is_active: false
            };

            return `
                <div class="col-12 mb-2">
                    <div class="border rounded p-2">
                        <div class="row align-items-center">
                            <div class="col-md-3">
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox"
                                           id="schedule_${day}"
                                           name="schedule[${day}][is_active]"
                                           ${schedule.is_active ? 'checked' : ''}>
                                    <label class="form-check-label" for="schedule_${day}">
                                        ${dayNames[day]}
                                    </label>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label small">Inicio</label>
                                <input type="time" class="form-control form-control-sm"
                                       name="schedule[${day}][start_time]"
                                       value="${schedule.start_time || '09:00'}"
                                       ${!schedule.is_active ? 'disabled' : ''}>
                            </div>
                            <div class="col-md-4">
                                <label class="form-label small">Fin</label>
                                <input type="time" class="form-control form-control-sm"
                                       name="schedule[${day}][end_time]"
                                       value="${schedule.end_time || '18:00'}"
                                       ${!schedule.is_active ? 'disabled' : ''}>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderBarberSchedule(schedules) {
        if (!schedules || schedules.length === 0) {
            return '<p class="text-muted">No hay horarios configurados</p>';
        }

        const dayNames = {
            monday: 'Lunes',
            tuesday: 'Martes', 
            wednesday: 'Miércoles',
            thursday: 'Jueves',
            friday: 'Viernes',
            saturday: 'Sábado',
            sunday: 'Domingo'
        };

        return schedules
            .filter(schedule => schedule.is_active)
            .map(schedule => `
                <div class="d-flex justify-content-between">
                    <span>${dayNames[schedule.day_of_week]}</span>
                    <span class="text-muted">${schedule.start_time.slice(0,5)} - ${schedule.end_time.slice(0,5)}</span>
                </div>
            `).join('');
    }

    async loadBarberStats(barberId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await this.apiCall(`/api/appointments/barber/${barberId}/${today}`);
            const data = await response.json();
            
            if (response.ok) {
                const statsHtml = `
                    <div class="row">
                        <div class="col-4 text-center">
                            <h5 class="text-primary">${data.total_appointments}</h5>
                            <small>Total Turnos</small>
                        </div>
                        <div class="col-4 text-center">
                            <h5 class="text-success">${data.completed_count}</h5>
                            <small>Completados</small>
                        </div>
                        <div class="col-4 text-center">
                            <h5 class="text-warning">${data.waiting_count}</h5>
                            <small>En Espera</small>
                        </div>
                    </div>
                `;
                document.getElementById('barberStats').innerHTML = statsHtml;
            }
        } catch (error) {
            document.getElementById('barberStats').innerHTML = '<p class="text-muted">Error cargando estadísticas</p>';
        }
    }

    async saveBarberChanges(barberId, formData, modalInstance) {
        try {
            const data = Object.fromEntries(formData);
            data.is_active = formData.has('is_active');

            // Extraer datos de horarios
            const scheduleData = {};
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

            days.forEach(day => {
                const isActive = formData.has(`schedule[${day}][is_active]`);
                const startTime = formData.get(`schedule[${day}][start_time]`);
                const endTime = formData.get(`schedule[${day}][end_time]`);

                scheduleData[day] = {
                    is_active: isActive,
                    start_time: isActive && startTime ? startTime : null,
                    end_time: isActive && endTime ? endTime : null
                };
            });

            // Filtrar datos del barbero (remover campos de horarios)
            const barberData = {};
            for (const [key, value] of Object.entries(data)) {
                if (!key.startsWith('schedule[')) {
                    // Solo incluir password si no está vacío
                    if (key === 'password' && !value) {
                        continue; // Skip empty password
                    }
                    barberData[key] = value;
                }
            }

            // Actualizar datos básicos del barbero
            const barberResponse = await this.apiCall(`/api/barbers/${barberId}`, {
                method: 'PUT',
                body: JSON.stringify(barberData)
            });

            if (!barberResponse.ok) {
                const error = await barberResponse.json();
                throw new Error(error.error || 'Error actualizando datos del barbero');
            }

            // Actualizar horarios del barbero
            const scheduleResponse = await this.apiCall(`/api/barbers/${barberId}/schedule`, {
                method: 'PUT',
                body: JSON.stringify(scheduleData)
            });

            if (!scheduleResponse.ok) {
                const error = await scheduleResponse.json();
                throw new Error(error.error || 'Error actualizando horarios del barbero');
            }

            this.showNotification('Barbero y horarios actualizados exitosamente', 'success');
            modalInstance.hide();
            this.loadBarbers(); // Refresh the list

        } catch (error) {
            console.error('Error saving barber:', error);
            this.showNotification('Error guardando cambios: ' + error.message, 'danger');
        }
    }

    // ========================= APPOINTMENTS MANAGEMENT =========================

    async loadAppointments() {
        try {
            const dateFilter = document.getElementById('dateFilter').value || new Date().toISOString().split('T')[0];
            const barberFilter = document.getElementById('barberFilter').value;

            // Set default date to today if not set
            if (!document.getElementById('dateFilter').value) {
                document.getElementById('dateFilter').value = dateFilter;
            }

            // Load barbers for filter if not loaded
            await this.loadBarberFilter();

            let url = `/api/appointments/barbershop/${this.user.id}?date=${dateFilter}`;
            if (barberFilter) {
                url += `&barber_id=${barberFilter}`;
            }

            const response = await this.apiCall(url);
            if (response.ok) {
                const data = await response.json();
                this.renderAppointments(data.appointments || []);
                this.updateAppointmentStats(data.stats || {});
            } else {
                throw new Error('Error cargando turnos');
            }
        } catch (error) {
            console.error('Error loading appointments:', error);
            this.showNotification('Error cargando turnos: ' + error.message, 'danger');
        }
    }

    async loadBarberFilter() {
        try {
            const response = await this.apiCall(`/api/barbers/barbershop/${this.user.id}`);
            if (response.ok) {
                const barbers = await response.json();
                const filterSelect = document.getElementById('barberFilter');

                // Clear existing options except "Todos los barberos"
                while (filterSelect.children.length > 1) {
                    filterSelect.removeChild(filterSelect.lastChild);
                }

                barbers.forEach(barber => {
                    const option = document.createElement('option');
                    option.value = barber.id;
                    option.textContent = barber.name;
                    filterSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading barbers for filter:', error);
        }
    }

    renderAppointments(appointments) {
        const container = document.getElementById('appointmentsContainer');

        if (appointments.length === 0) {
            container.innerHTML = `
                <div class="p-4 text-center text-muted">
                    <i class="fas fa-calendar-times fa-3x mb-3"></i>
                    <p>No hay turnos para la fecha seleccionada</p>
                </div>
            `;
            return;
        }

        // Group appointments by barber
        const appointmentsByBarber = appointments.reduce((acc, appointment) => {
            const barberName = appointment.barber_name || 'Sin asignar';
            if (!acc[barberName]) {
                acc[barberName] = [];
            }
            acc[barberName].push(appointment);
            return acc;
        }, {});

        let html = '';
        for (const [barberName, barberAppointments] of Object.entries(appointmentsByBarber)) {
            html += `
                <div class="border-bottom p-3">
                    <h6 class="text-primary mb-3">
                        <i class="fas fa-user"></i> ${barberName}
                        <span class="badge bg-secondary ms-2">${barberAppointments.length} turnos</span>
                    </h6>
                    <div class="row g-2">
            `;

            barberAppointments.forEach(appointment => {
                const statusClass = this.getAppointmentStatusClass(appointment.status);
                const statusText = this.getAppointmentStatusText(appointment.status);

                html += `
                    <div class="col-md-6 col-lg-4">
                        <div class="card border-start border-3 border-${statusClass}">
                            <div class="card-body p-2">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <h6 class="card-title mb-1">${appointment.client_name}</h6>
                                        <small class="text-muted">${appointment.client_phone || 'Sin teléfono'}</small>
                                    </div>
                                    <span class="badge bg-${statusClass}">#${appointment.queue_number}</span>
                                </div>

                                <div class="mb-2">
                                    <small class="text-muted">
                                        <i class="fas fa-clock"></i> ${appointment.estimated_time || 'Sin hora'}
                                    </small>
                                    ${appointment.service_amount ? `
                                        <br><small class="text-success">
                                            <i class="fas fa-dollar-sign"></i> $${appointment.service_amount}
                                        </small>
                                    ` : ''}
                                </div>

                                <div class="d-flex gap-1">
                                    ${this.getAppointmentActions(appointment)}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;
    }

    getAppointmentStatusClass(status) {
        switch (status) {
            case 'waiting': return 'warning';
            case 'in_progress': return 'info';
            case 'completed': return 'success';
            case 'cancelled': return 'danger';
            default: return 'secondary';
        }
    }

    getAppointmentStatusText(status) {
        switch (status) {
            case 'waiting': return 'Esperando';
            case 'in_progress': return 'En Progreso';
            case 'completed': return 'Completado';
            case 'cancelled': return 'Cancelado';
            default: return 'Desconocido';
        }
    }

    getAppointmentActions(appointment) {
        let actions = '';

        switch (appointment.status) {
            case 'waiting':
                actions = `
                    <button class="btn btn-sm btn-info" onclick="barbershopPanel.startAppointment(${appointment.id})" title="Llamar turno">
                        <i class="fas fa-bullhorn"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="barbershopPanel.cancelAppointment(${appointment.id})" title="Cancelar turno">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                break;
            case 'in_progress':
                actions = `
                    <button class="btn btn-sm btn-success" onclick="barbershopPanel.completeAppointment(${appointment.id})">
                        <i class="fas fa-check"></i>
                    </button>
                `;
                break;
            case 'completed':
                actions = `
                    <button class="btn btn-sm btn-outline-secondary" disabled>
                        <i class="fas fa-check"></i> Completado
                    </button>
                `;
                break;
        }

        return actions;
    }

    updateAppointmentStats(stats) {
        document.getElementById('totalAppointmentsToday').textContent = stats.total || 0;
        document.getElementById('completedAppointmentsToday').textContent = stats.completed || 0;
        document.getElementById('pendingAppointmentsToday').textContent = stats.pending || 0;
        document.getElementById('dailyRevenue').textContent = `$${stats.revenue || 0}`;
    }

    async startAppointment(appointmentId) {
        try {
            const response = await this.apiCall(`/api/appointments/${appointmentId}/call-next`, {
                method: 'PATCH'
            });

            if (response.ok) {
                this.showNotification('Turno llamado exitosamente', 'success');
                this.loadAppointments();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error llamando turno');
            }
        } catch (error) {
            console.error('Error calling appointment:', error);
            this.showNotification('Error llamando turno: ' + error.message, 'danger');
        }
    }

    async cancelAppointment(appointmentId) {
        if (!confirm('¿Estás seguro de que quieres cancelar este turno?')) {
            return;
        }

        try {
            const response = await this.apiCall(`/api/appointments/${appointmentId}/cancel`, {
                method: 'PATCH'
            });

            if (response.ok) {
                this.showNotification('Turno cancelado exitosamente', 'success');
                this.loadAppointments();
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error cancelando turno');
            }
        } catch (error) {
            console.error('Error cancelling appointment:', error);
            this.showNotification('Error cancelando turno: ' + error.message, 'danger');
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
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-check me-2"></i>Completar Turno
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <form id="completeAppointmentForm">
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label">Valor del Servicio *</label>
                                <div class="input-group">
                                    <span class="input-group-text">$</span>
                                    <input type="number" class="form-control" name="service_amount"
                                           min="0" step="0.01" required placeholder="0.00">
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

        document.getElementById('completeAppointmentForm').addEventListener('submit', async (e) => {
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
                this.showNotification('Turno completado exitosamente', 'success');
                modalInstance.hide();
                this.loadAppointments();
                this.loadDashboard(); // Refresh dashboard stats
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error completando turno');
            }
        } catch (error) {
            console.error('Error completing appointment:', error);
            this.showNotification('Error completando turno: ' + error.message, 'danger');
        }
    }

    async loadWhatsApp() {
        try {
            console.log('Cargando estado de WhatsApp...');
            const [statusResponse, messagesResponse] = await Promise.all([
                this.apiCall(`/api/whatsapp/status/${this.user.id}`),
                this.apiCall(`/api/whatsapp/messages/${this.user.id}?limit=10`)
            ]);

            if (statusResponse.ok) {
                const status = await statusResponse.json();
                console.log('Estado de WhatsApp cargado:', status);
                this.updateWhatsAppStatus(status);
                
                // Si está conectado, mostrar notificación de éxito si no se había mostrado antes
                if (status.status === 'connected' && !this.whatsappNotificationShown) {
                    this.showNotification('WhatsApp ya está conectado', 'success');
                    this.whatsappNotificationShown = true;
                }
            }

            if (messagesResponse.ok) {
                const messages = await messagesResponse.json();
                this.renderMessages(messages.messages);
            }
        } catch (error) {
            console.error('Error loading WhatsApp:', error);
        }
    }

    updateWhatsAppStatus(status) {
        const statusCard = document.getElementById('whatsappStatus');
        const qrDiv = document.getElementById('whatsappQR');
        const connectBtn = document.getElementById('connectWhatsAppBtn');
        const disconnectBtn = document.getElementById('disconnectWhatsAppBtn');
        const sendBtn = document.getElementById('sendBulkMessageBtn');

        if (status.status === 'connected') {
            statusCard.innerHTML = `
                <i class="fab fa-whatsapp fa-3x mb-3 text-success"></i>
                <h5 class="text-success">WhatsApp Conectado</h5>
                <p class="mb-0">Número: ${status.phone}</p>
                <p class="mb-0">Los clientes pueden reservar turnos automáticamente</p>
            `;
            qrDiv.style.display = 'none';
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'inline-block';
            sendBtn.disabled = false;
        } else if (status.status === 'waiting_qr') {
            this.showWhatsAppQR(status.qr_code);
        } else if (status.status === 'initializing') {
            statusCard.innerHTML = `
                <i class="fab fa-whatsapp fa-3x mb-3 text-warning"></i>
                <h5 class="text-warning">Iniciando WhatsApp</h5>
                <p class="mb-0">Conectando... El código QR aparecerá en breve</p>
                <div class="spinner-border spinner-border-sm mt-2" role="status">
                    <span class="sr-only">Cargando...</span>
                </div>
            `;
            qrDiv.style.display = 'none';
            connectBtn.style.display = 'none';
            disconnectBtn.style.display = 'none';
            sendBtn.disabled = true;
        } else if (status.status === 'error') {
            statusCard.innerHTML = `
                <i class="fab fa-whatsapp fa-3x mb-3 text-danger"></i>
                <h5 class="text-danger">Error en WhatsApp</h5>
                <p class="mb-0">Hubo un problema inicializando WhatsApp. Intenta de nuevo.</p>
            `;
            qrDiv.style.display = 'none';
            connectBtn.style.display = 'inline-block';
            connectBtn.disabled = false;
            connectBtn.textContent = 'Reintentar Conexión';
            disconnectBtn.style.display = 'none';
            sendBtn.disabled = true;
        } else {
            statusCard.innerHTML = `
                <i class="fab fa-whatsapp fa-3x mb-3"></i>
                <h5>WhatsApp Desconectado</h5>
                <p class="mb-0">Conecta tu número para recibir turnos automáticamente</p>
            `;
            qrDiv.style.display = 'none';
            connectBtn.style.display = 'inline-block';
            disconnectBtn.style.display = 'none';
            sendBtn.disabled = true;
        }
    }

    showWhatsAppQR(qrCode) {
        console.log('Mostrando QR code:', qrCode ? 'QR disponible' : 'QR no disponible');
        console.log('QR Code data URL length:', qrCode ? qrCode.length : 0);
        
        const statusCard = document.getElementById('whatsappStatus');
        const qrDiv = document.getElementById('whatsappQR');
        const qrImage = document.getElementById('qrImage');
        const connectBtn = document.getElementById('connectWhatsAppBtn');
        const disconnectBtn = document.getElementById('disconnectWhatsAppBtn');
        
        console.log('Elementos DOM:', {
            statusCard: !!statusCard,
            qrDiv: !!qrDiv,
            qrImage: !!qrImage,
            connectBtn: !!connectBtn,
            disconnectBtn: !!disconnectBtn
        });
        
        if (!statusCard || !qrDiv || !qrImage) {
            console.error('Elementos DOM no encontrados para mostrar QR');
            return;
        }
        
        statusCard.innerHTML = `
            <i class="fab fa-whatsapp fa-3x mb-3 text-warning"></i>
            <h5 class="text-warning">Escanea el código QR</h5>
            <p class="mb-0">Usa WhatsApp en tu teléfono para escanear este código</p>
        `;
        
        qrImage.src = qrCode;
        qrDiv.style.display = 'block';
        
        // Ocultar botón conectar y mostrar estado correcto
        if (connectBtn) {
            connectBtn.style.display = 'none';
            connectBtn.disabled = false;
            connectBtn.textContent = 'Conectar WhatsApp';
        }
        
        if (disconnectBtn) {
            disconnectBtn.style.display = 'none';
        }
        
        console.log('QR mostrado exitosamente, div visible:', qrDiv.style.display);
    }

    showWhatsAppConnected(data) {
        console.log('Actualizando estado a conectado:', data);

        // Limpiar QR antes de actualizar estado
        const qrDiv = document.getElementById('whatsappQR');
        if (qrDiv) {
            qrDiv.style.display = 'none';
        }

        this.updateWhatsAppStatus({ status: 'connected', phone: data.number });
        this.showNotification('WhatsApp conectado exitosamente', 'success');
    }

    showWhatsAppDisconnected() {
        this.updateWhatsAppStatus({ status: 'disconnected' });
        this.showNotification('WhatsApp desconectado', 'warning');
    }

    showWhatsAppInitializing() {
        console.log('Mostrando estado de inicialización de WhatsApp');
        this.updateWhatsAppStatus({ status: 'initializing' });
    }

    showWhatsAppError(data) {
        console.log('Mostrando error de WhatsApp:', data);
        this.updateWhatsAppStatus({ status: 'error' });
        this.showNotification(`Error WhatsApp: ${data.message}`, 'danger');
        
        // Limpiar timeout de fallback si existe
        if (this.qrFallbackTimeout) {
            clearTimeout(this.qrFallbackTimeout);
            this.qrFallbackTimeout = null;
        }
    }

    async checkForQRFallback() {
        console.log('Verificando QR como fallback...');
        
        // Verificar si el QR ya está visible
        const qrDiv = document.getElementById('whatsappQR');
        if (qrDiv && qrDiv.style.display === 'block') {
            console.log('QR ya está visible, fallback no es necesario');
            return;
        }
        
        try {
            const response = await this.apiCall(`/api/whatsapp/status/${this.user.id}`);
            if (response.ok) {
                const status = await response.json();
                console.log('Estado fallback obtenido:', status);
                
                if (status.status === 'waiting_qr' && status.qr_code) {
                    console.log('QR encontrado en fallback, mostrando...');
                    this.showWhatsAppQR(status.qr_code);
                } else if (status.status === 'connected') {
                    console.log('Conexión detectada en fallback');
                    this.showWhatsAppConnected({ number: status.phone });
                } else if (status.status === 'disconnected') {
                    console.log('WhatsApp desconectado según fallback - manteniendo estado actual');
                    // No hacer nada si está desconectado, el QR podría estar en proceso
                }
            }
        } catch (error) {
            console.error('Error en verificación fallback de QR:', error);
        }
    }

    async connectWhatsApp() {
        const connectBtn = document.getElementById('connectWhatsAppBtn');

        try {
            // Verificar estado actual antes de intentar conectar
            const statusResponse = await this.apiCall(`/api/whatsapp/status/${this.user.id}`);
            if (statusResponse.ok) {
                const currentStatus = await statusResponse.json();
                if (currentStatus.status === 'connected') {
                    this.showNotification('WhatsApp ya está conectado', 'info');
                    this.updateWhatsAppStatus(currentStatus);
                    return;
                }
            }

            // Deshabilitar botón para evitar múltiples clics
            connectBtn.disabled = true;
            connectBtn.textContent = 'Conectando...';

            console.log('Iniciando conexión WhatsApp para usuario:', this.user.id);
            const response = await this.apiCall(`/api/whatsapp/init/${this.user.id}`, {
                method: 'POST'
            });

            console.log('Respuesta de conexión WhatsApp:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('Datos de respuesta:', data);
                if (data.status === 'already_connected') {
                    this.showNotification('WhatsApp ya está conectado', 'success');
                    this.updateWhatsAppStatus({ status: 'connected', phone: data.phone });
                } else if (data.status === 'qr_available') {
                    this.showNotification('Código QR disponible para escanear', 'info');
                    this.showWhatsAppQR(data.qr_code);
                } else if (data.status === 'initializing') {
                    this.showNotification('Iniciando conexión WhatsApp... El código QR aparecerá en breve.', 'info');

                    // Solo mostrar initializing si no hay un QR ya mostrado
                    const qrDiv = document.getElementById('whatsappQR');
                    if (!qrDiv || qrDiv.style.display !== 'block') {
                        this.showWhatsAppInitializing();
                    } else {
                        console.log('QR ya está visible, no se sobrescribe el estado');
                    }
                    
                    // Fallback: verificar QR después de 8 segundos si no se recibe el evento
                    this.qrFallbackTimeout = setTimeout(() => {
                        this.checkForQRFallback();
                    }, 8000);
                } else {
                    this.showNotification('Iniciando conexión WhatsApp...', 'info');
                }
            } else {
                console.error('Error en respuesta:', response.status, response.statusText);
                this.showNotification('Error en la conexión WhatsApp', 'danger');
                // Restaurar botón en caso de error
                connectBtn.disabled = false;
                connectBtn.textContent = 'Conectar WhatsApp';
            }
        } catch (error) {
            console.error('Error conectando WhatsApp:', error);
            this.showNotification('Error conectando WhatsApp', 'danger');
            // Restaurar botón en caso de error
            connectBtn.disabled = false;
            connectBtn.textContent = 'Conectar WhatsApp';
        }
    }

    async disconnectWhatsApp() {
        if (!confirm('¿Estás seguro de desconectar WhatsApp? Los clientes no podrán reservar turnos.')) return;

        try {
            const response = await this.apiCall(`/api/whatsapp/disconnect/${this.user.id}`, {
                method: 'POST'
            });

            if (response.ok) {
                this.showNotification('WhatsApp desconectado', 'success');
                this.loadWhatsApp();
            }
        } catch (error) {
            this.showNotification('Error desconectando WhatsApp', 'danger');
        }
    }

    async sendBulkMessage(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const phones = formData.get('phones').split('\n').filter(p => p.trim());
        const message = formData.get('message');

        if (!phones.length || !message) {
            this.showNotification('Por favor completa todos los campos', 'warning');
            return;
        }

        try {
            const response = await this.apiCall(`/api/whatsapp/send-bulk-message/${this.user.id}`, {
                method: 'POST',
                body: JSON.stringify({ phones, message })
            });

            if (response.ok) {
                const data = await response.json();
                this.showNotification(data.message, 'success');
                e.target.reset();
                this.loadWhatsApp();
            } else {
                const error = await response.json();
                this.showNotification(error.error, 'danger');
            }
        } catch (error) {
            this.showNotification('Error enviando mensajes', 'danger');
        }
    }

    renderMessages(messages) {
        const tbody = document.getElementById('messagesTableBody');
        tbody.innerHTML = '';

        if (!messages || messages.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No hay mensajes enviados</td></tr>';
            return;
        }

        messages.forEach(message => {
            const typeLabels = {
                reminder: 'Recordatorio',
                suspension: 'Suspensión',
                payment_thanks: 'Agradecimiento',
                appointment: 'Turno',
                manual: 'Manual',
                bulk: 'Masivo'
            };

            const statusClass = message.status === 'sent' ? 'text-success' : 'text-danger';
            const statusText = message.status === 'sent' ? 'Enviado' : 'Error';

            tbody.innerHTML += `
                <tr>
                    <td>${new Date(message.sent_at).toLocaleString()}</td>
                    <td>${message.phone_number}</td>
                    <td><span class="badge bg-secondary">${typeLabels[message.message_type] || message.message_type}</span></td>
                    <td><span class="${statusClass}"><i class="fas fa-circle"></i> ${statusText}</span></td>
                    <td>
                        <small>${message.message.substring(0, 50)}${message.message.length > 50 ? '...' : ''}</small>
                    </td>
                </tr>
            `;
        });
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
        this.refreshInterval = setInterval(() => {
            if (document.getElementById('dashboard-section').style.display !== 'none') {
                this.loadDashboard();
            }
        }, 60000); // Refresh every minute
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
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

    showPlanLimitModal(errorData) {
        // Crear modal dinámicamente
        const modalHTML = `
            <div class="modal fade" id="planLimitModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-warning text-dark">
                            <h5 class="modal-title">
                                <i class="fas fa-exclamation-triangle me-2"></i>
                                Límite de Plan Alcanzado
                            </h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-warning mb-3">
                                <i class="fas fa-info-circle me-2"></i>
                                <strong>${errorData.message}</strong>
                            </div>
                            <div class="mb-3">
                                <p><strong>Estado actual:</strong></p>
                                <ul>
                                    <li>Barberos registrados: <strong>${errorData.current_barbers}</strong></li>
                                    <li>Límite de tu plan: <strong>${errorData.max_barbers}</strong></li>
                                </ul>
                            </div>
                            <div class="alert alert-info mb-0">
                                <i class="fas fa-phone me-2"></i>
                                <strong>¿Necesitas más barberos?</strong><br>
                                Contacta a nuestro equipo de soporte para actualizar tu plan y agregar más barberos a tu barbería.
                                <div class="mt-2">
                                    <small>
                                        <i class="fas fa-envelope me-1"></i> soporte@mibarberiaweb.com<br>
                                        <i class="fas fa-whatsapp me-1"></i> WhatsApp: +57 300 123 4567
                                    </small>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Entendido</button>
                            <a href="mailto:soporte@mibarberiaweb.com" class="btn btn-primary">
                                <i class="fas fa-envelope me-2"></i>Contactar Soporte
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Eliminar modal anterior si existe
        const existingModal = document.getElementById('planLimitModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Agregar modal al DOM
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('planLimitModal'));
        modal.show();

        // Limpiar modal cuando se cierre
        document.getElementById('planLimitModal').addEventListener('hidden.bs.modal', function() {
            this.remove();
        });
    }

    showLoading() {
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showChangePasswordModal() {
        const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
        modal.show();
        
        // Add event listener for save button
        document.getElementById('savePasswordBtn').addEventListener('click', this.changePassword.bind(this));
    }

    async changePassword() {
        const form = document.getElementById('changePasswordForm');
        const formData = new FormData(form);
        const currentPassword = formData.get('currentPassword');
        const newPassword = formData.get('newPassword');
        const confirmPassword = formData.get('confirmPassword');
        const errorDiv = document.getElementById('passwordError');
        
        // Clear previous errors
        errorDiv.classList.add('d-none');
        errorDiv.textContent = '';
        
        // Validate passwords match
        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'Las contraseñas no coinciden';
            errorDiv.classList.remove('d-none');
            return;
        }
        
        // Validate password length
        if (newPassword.length < 6) {
            errorDiv.textContent = 'La nueva contraseña debe tener al menos 6 caracteres';
            errorDiv.classList.remove('d-none');
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
            
            const data = await response.json();
            
            if (response.ok) {
                this.showNotification('Contraseña cambiada exitosamente', 'success');
                const modal = bootstrap.Modal.getInstance(document.getElementById('changePasswordModal'));
                modal.hide();
                form.reset();
            } else {
                errorDiv.textContent = data.error || 'Error cambiando contraseña';
                errorDiv.classList.remove('d-none');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            errorDiv.textContent = 'Error de conexión. Inténtalo de nuevo.';
            errorDiv.classList.remove('d-none');
        }
    }

    startWhatsAppStatusCheck() {
        // Verificar estado de WhatsApp cada 30 segundos
        this.whatsappStatusInterval = setInterval(() => {
            // Solo verificar si estamos en la pestaña de WhatsApp
            const whatsappSection = document.getElementById('whatsapp-section');
            if (whatsappSection && whatsappSection.style.display !== 'none') {
                this.checkWhatsAppStatus();
            }
        }, 30000);
    }

    stopWhatsAppStatusCheck() {
        if (this.whatsappStatusInterval) {
            clearInterval(this.whatsappStatusInterval);
            this.whatsappStatusInterval = null;
        }
    }

    async checkWhatsAppStatus() {
        try {
            const response = await this.apiCall(`/api/whatsapp/status/${this.user.id}`);
            if (response.ok) {
                const status = await response.json();

                // Solo actualizar si hay cambio en el estado
                const currentStatus = this.getCurrentDisplayedStatus();
                if (currentStatus !== status.status) {
                    console.log('Estado WhatsApp cambió de', currentStatus, 'a', status.status);
                    this.updateWhatsAppStatus(status);

                    if (status.status === 'connected' && currentStatus !== 'connected') {
                        this.showNotification('WhatsApp conectado exitosamente', 'success');
                    } else if (status.status === 'disconnected' && currentStatus === 'connected') {
                        this.showNotification('WhatsApp desconectado', 'warning');
                    }
                }
            }
        } catch (error) {
            console.error('Error verificando estado WhatsApp:', error);
        }
    }

    getCurrentDisplayedStatus() {
        const statusCard = document.getElementById('whatsappStatus');
        if (statusCard.innerHTML.includes('text-success')) return 'connected';
        if (statusCard.innerHTML.includes('text-warning')) return 'initializing';
        if (statusCard.innerHTML.includes('text-danger')) return 'error';
        return 'disconnected';
    }

    logout() {
        if (confirm('¿Estás seguro de cerrar sesión?')) {
            localStorage.removeItem('barbershop_token');
            localStorage.removeItem('barbershop_user');
            this.stopAutoRefresh();
            this.stopWhatsAppStatusCheck();
            if (this.socket) {
                this.socket.disconnect();
            }
            location.reload();
        }
    }

    // ========== BILLING FUNCTIONS ==========

    async loadBilling() {
        try {
            // Cargar barberos para el filtro
            await this.loadBarbersForBilling();

            // Cargar resumen rápido
            await this.loadBillingSummary();

            // Configurar fecha por defecto
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('specificDate').value = today;

            // Cargar informe diario por defecto
            this.generateDefaultBillingReport();

        } catch (error) {
            console.error('Error loading billing:', error);
            this.showNotification('Error cargando datos de facturación', 'danger');
        }
    }

    async loadBarbersForBilling() {
        try {
            const response = await this.apiCall(`/api/barbers/barbershop/${this.user.id}`);
            if (response.ok) {
                const barbers = await response.json();
                const barberSelect = document.getElementById('billingBarberFilter');

                // Limpiar opciones existentes (excepto "Todos")
                barberSelect.innerHTML = '<option value="">Todos los barberos</option>';

                barbers.forEach(barber => {
                    const option = document.createElement('option');
                    option.value = barber.id;
                    option.textContent = barber.name;
                    barberSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading barbers for billing:', error);
        }
    }

    async loadBillingSummary() {
        try {
            const response = await this.apiCall(`/api/billing/summary/${this.user.id}`);
            if (response.ok) {
                const data = await response.json();
                const { summary } = data;

                // Actualizar totales del resumen rápido
                document.getElementById('totalRevenue').textContent = `$${summary.today.revenue.toFixed(2)}`;
                document.getElementById('totalCommissions').textContent = `$${summary.today.commissions.toFixed(2)}`;
                document.getElementById('barbershopEarnings').textContent = `$${summary.today.barbershopEarnings.toFixed(2)}`;
                document.getElementById('totalAppointments').textContent = summary.today.appointments;
            }
        } catch (error) {
            console.error('Error loading billing summary:', error);
        }
    }

    handlePeriodTypeChange(e) {
        const periodType = e.target.value;
        const dateRangeGroup = document.getElementById('dateRangeGroup');
        const customRangeGroup = document.getElementById('customRangeGroup');
        const specificDateLabel = dateRangeGroup.querySelector('label');
        const specificDateInput = document.getElementById('specificDate');

        if (periodType === 'custom') {
            dateRangeGroup.classList.add('d-none');
            customRangeGroup.classList.remove('d-none');
        } else {
            dateRangeGroup.classList.remove('d-none');
            customRangeGroup.classList.add('d-none');

            // Actualizar etiqueta según el tipo de período
            switch (periodType) {
                case 'daily':
                    specificDateLabel.textContent = 'Fecha Específica';
                    specificDateInput.value = new Date().toISOString().split('T')[0];
                    break;
                case 'weekly':
                    specificDateLabel.textContent = 'Semana (opcional)';
                    specificDateInput.value = '';
                    break;
                case 'biweekly':
                    specificDateLabel.textContent = 'Fecha de referencia (opcional)';
                    specificDateInput.value = '';
                    break;
                case 'monthly':
                    specificDateLabel.textContent = 'Mes (opcional)';
                    specificDateInput.value = '';
                    break;
            }
        }
    }

    async generateBillingReport(e) {
        e.preventDefault();

        try {
            const formData = new FormData(e.target);
            const periodType = formData.get('periodType');
            const barberId = formData.get('barberFilter');

            let queryParams = new URLSearchParams({
                periodType: periodType
            });

            if (barberId) {
                queryParams.append('barberId', barberId);
            }

            if (periodType === 'custom') {
                const startDate = formData.get('startDate');
                const endDate = formData.get('endDate');

                if (!startDate || !endDate) {
                    this.showNotification('Selecciona fechas de inicio y fin para período personalizado', 'warning');
                    return;
                }

                queryParams.append('startDate', startDate);
                queryParams.append('endDate', endDate);
            } else if (periodType === 'daily') {
                const specificDate = formData.get('specificDate');
                if (specificDate) {
                    queryParams.append('startDate', specificDate);
                }
            }

            const response = await this.apiCall(`/api/billing/report/${this.user.id}?${queryParams}`);

            if (response.ok) {
                const reportData = await response.json();
                this.currentReportData = reportData;
                this.renderBillingReport(reportData);
                this.showNotification('Informe generado exitosamente', 'success');
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Error generando informe');
            }

        } catch (error) {
            console.error('Error generating billing report:', error);
            this.showNotification('Error generando informe: ' + error.message, 'danger');
        }
    }

    renderBillingReport(data) {
        const { totals, barberReports, appointmentDetails, period } = data;

        // Actualizar totales del resumen
        document.getElementById('totalRevenue').textContent = `$${totals.totalRevenue.toFixed(2)}`;
        document.getElementById('totalCommissions').textContent = `$${totals.totalCommissions.toFixed(2)}`;
        document.getElementById('barbershopEarnings').textContent = `$${totals.barbershopEarnings.toFixed(2)}`;
        document.getElementById('totalAppointments').textContent = totals.totalAppointments;

        // Renderizar tabla de barberos
        this.renderBarberReportsTable(barberReports);

        // Renderizar detalle diario
        this.renderDailyDetailTable(appointmentDetails);

        // Renderizar gráfico
        this.renderRevenueChart(barberReports);
    }

    renderBarberReportsTable(barberReports) {
        const tbody = document.getElementById('billingReportTableBody');

        if (barberReports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay datos para el período seleccionado</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        barberReports.forEach(report => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${report.barber_name}</td>
                <td>${report.completed_appointments}</td>
                <td>$${parseFloat(report.total_revenue).toFixed(2)}</td>
                <td>${report.commission_percentage}%</td>
                <td class="text-success">$${parseFloat(report.barber_commission).toFixed(2)}</td>
                <td class="text-primary">$${parseFloat(report.barbershop_earnings).toFixed(2)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    renderDailyDetailTable(appointmentDetails) {
        const tbody = document.getElementById('dailyDetailTableBody');

        if (appointmentDetails.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay citas para mostrar</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        appointmentDetails.forEach(appointment => {
            const row = document.createElement('tr');
            const date = new Date(appointment.appointment_date).toLocaleDateString();
            const time = appointment.appointment_time;

            row.innerHTML = `
                <td>${date}</td>
                <td>${time}</td>
                <td>${appointment.client_name}</td>
                <td>${appointment.barber_name}</td>
                <td>${appointment.service_type || 'Corte general'}</td>
                <td>$${parseFloat(appointment.price).toFixed(2)}</td>
                <td class="text-success">$${parseFloat(appointment.commission).toFixed(2)}</td>
                <td><span class="badge bg-success">${appointment.status}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    renderRevenueChart(barberReports) {
        const ctx = document.getElementById('revenueChart').getContext('2d');

        // Destruir gráfico anterior si existe
        if (this.revenueChart) {
            this.revenueChart.destroy();
        }

        const labels = barberReports.map(report => report.barber_name);
        const commissionData = barberReports.map(report => parseFloat(report.barber_commission));
        const barbershopData = barberReports.map(report => parseFloat(report.barbershop_earnings));

        this.revenueChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [...labels.map(name => `${name} (Barbero)`), ...labels.map(name => `${name} (Barbería)`)],
                datasets: [{
                    data: [...commissionData, ...barbershopData],
                    backgroundColor: [
                        '#28a745', '#17a2b8', '#ffc107', '#dc3545', '#6f42c1',
                        '#20c997', '#fd7e14', '#e83e8c', '#6610f2', '#007bff'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 10
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                return `${context.label}: $${value.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    }

    async exportBillingReport() {
        try {
            if (!this.currentReportData) {
                this.showNotification('Genera un informe primero antes de exportar', 'warning');
                return;
            }

            const response = await this.apiCall(`/api/billing/export/${this.user.id}`, {
                method: 'POST',
                body: JSON.stringify({
                    reportData: this.currentReportData,
                    periodType: this.currentReportData.period.type
                })
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `informe_facturacion_${this.currentReportData.period.type}_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);

                this.showNotification('Informe exportado exitosamente', 'success');
            } else {
                throw new Error('Error exportando informe');
            }

        } catch (error) {
            console.error('Error exporting report:', error);
            this.showNotification('Error exportando informe: ' + error.message, 'danger');
        }
    }

    async generateDefaultBillingReport() {
        try {
            const today = new Date().toISOString().split('T')[0];

            const queryParams = new URLSearchParams({
                periodType: 'daily',
                startDate: today
            });

            const response = await this.apiCall(`/api/billing/report/${this.user.id}?${queryParams}`);

            if (response.ok) {
                const reportData = await response.json();
                this.currentReportData = reportData;
                this.renderBillingReport(reportData);
            } else {
                console.error('Error generando informe por defecto');
            }
        } catch (error) {
            console.error('Error generating default billing report:', error);
        }
    }
}

// Initialize the barbershop panel
const barbershopPanel = new BarbershopPanel();