class AdminPanel {
    constructor() {
        this.token = localStorage.getItem('admin_token');
        this.socket = null;
        this.charts = {};
        
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
        this.loadProfile();
    }

    setupEventListeners() {
        document.getElementById('toggleSidebar').addEventListener('click', this.toggleSidebar);
        document.getElementById('overlay').addEventListener('click', this.closeSidebar);
        
        document.querySelectorAll('.menu-link').forEach(link => {
            link.addEventListener('click', (e) => this.switchSection(e));
        });

        document.getElementById('logout').addEventListener('click', this.logout.bind(this));
        document.getElementById('logoutLink').addEventListener('click', this.logout.bind(this));
        
        document.getElementById('changePassword').addEventListener('click', this.showChangePasswordModal.bind(this));
        document.getElementById('changeEmail').addEventListener('click', this.showChangeEmailModal.bind(this));
        document.getElementById('savePasswordBtn').addEventListener('click', this.changePassword.bind(this));
        document.getElementById('saveEmailBtn').addEventListener('click', this.changeEmail.bind(this));
        document.getElementById('saveAdminBtn').addEventListener('click', this.createAdmin.bind(this));
        
        document.getElementById('saveBarbershopBtn').addEventListener('click', this.createBarbershop.bind(this));
        document.getElementById('saveBillBtn').addEventListener('click', this.createBill.bind(this));
        
        document.getElementById('generateBillsBtn').addEventListener('click', this.generateBills.bind(this));
        document.getElementById('billingStatusFilter').addEventListener('change', this.filterBilling.bind(this));
        
        document.getElementById('runBillingBtn').addEventListener('click', () => this.runManualTask('billing'));
        document.getElementById('runRemindersBtn').addEventListener('click', () => this.runManualTask('reminders'));
        document.getElementById('runCleanupBtn').addEventListener('click', () => this.runManualTask('cleanup'));

        window.addEventListener('resize', this.handleResize);
    }

    showLogin() {
        document.body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center vh-100 bg-primary">
                <div class="card" style="width: 400px;">
                    <div class="card-body">
                        <h4 class="text-center mb-4">Login Administrador</h4>
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
            role: 'admin'
        };

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('admin_token', data.token);
                localStorage.setItem('admin_user', JSON.stringify(data.user));
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

    async loadProfile() {
        try {
            const response = await this.apiCall('/api/auth/profile');
            if (response.ok) {
                const user = await response.json();
                document.getElementById('userName').textContent = user.name;
            }
        } catch (error) {
            console.error('Error loading profile:', error);
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
        });

        this.socket.on('billing_generated', (data) => {
            this.showNotification(`Nueva factura generada: ${data.barbershop_name}`, 'success');
            this.loadDashboard();
        });

        this.socket.on('payment_received', (data) => {
            this.showNotification(`Pago recibido: ${data.barbershop_name} - $${data.amount}`, 'success');
            this.loadDashboard();
        });
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        
        if (window.innerWidth < 992) {
            sidebar.classList.toggle('show');
            overlay.style.display = sidebar.classList.contains('show') ? 'block' : 'none';
        }
    }

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        
        sidebar.classList.remove('show');
        overlay.style.display = 'none';
    }

    handleResize() {
        if (window.innerWidth >= 992) {
            document.getElementById('overlay').style.display = 'none';
        }
    }

    switchSection(e) {
        e.preventDefault();
        const targetSection = e.target.getAttribute('data-section');
        
        document.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));
        e.target.classList.add('active');
        
        document.querySelectorAll('.section').forEach(section => section.style.display = 'none');
        document.getElementById(`${targetSection}-section`).style.display = 'block';

        this.loadSectionData(targetSection);
        this.closeSidebar();
    }

    loadSectionData(section) {
        switch(section) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'barbershops':
                this.loadBarbershops();
                break;
            case 'billing':
                this.loadBilling();
                break;
            case 'reports':
                this.loadReports();
                break;
            case 'whatsapp':
                this.loadWhatsAppConnections();
                break;
            case 'settings':
                this.loadSettings();
                break;
            case 'admin-management':
                this.loadAdminManagement();
                break;
        }
    }

    async loadDashboard() {
        try {
            const barbershopsRes = await this.apiCall('/api/barbershops');

            if (barbershopsRes.ok) {
                const barbershops = await barbershopsRes.json();

                const totalBarbershops = barbershops.length;
                const activeBarbershops = barbershops.filter(b => b.is_active && !b.is_suspended).length;
                const suspendedBarbershops = barbershops.filter(b => b.is_suspended).length;

                document.getElementById('totalBarbershops').textContent = totalBarbershops;
                document.getElementById('activeBarbershops').textContent = activeBarbershops;
                document.getElementById('suspendedBarbershops').textContent = suspendedBarbershops;
                document.getElementById('overdueAmount').textContent = '$0';

                this.renderRecentBarbershops(barbershops.slice(0, 5));

                // Limpiar facturas vencidas (sin datos por ahora)
                const overdueBillsContainer = document.getElementById('overdueBills');
                if (overdueBillsContainer) {
                    overdueBillsContainer.innerHTML = '<p class="text-muted text-center">No hay facturas vencidas</p>';
                }
            } else {
                // Si las respuestas no son OK, mostrar error
                const tbody = document.querySelector('#recentBarbershopsTable tbody');
                if (tbody) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error al cargar barberías. Por favor, recarga la página.</td></tr>';
                }
                console.error('Error en respuesta:', await barbershopsRes.text());
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
            // Mostrar mensaje de error en la tabla
            const tbody = document.querySelector('#recentBarbershopsTable tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error de conexión. Por favor, verifica tu sesión e intenta nuevamente.</td></tr>';
            }
        }
    }

    renderRecentBarbershops(barbershops) {
        const tbody = document.querySelector('#recentBarbershopsTable tbody');
        tbody.innerHTML = '';

        if (barbershops.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay barberías registradas</td></tr>';
            return;
        }

        barbershops.forEach(shop => {
            const statusClass = shop.is_suspended ? 'status-suspended' : 
                              shop.is_active ? 'status-active' : 'status-inactive';
            const statusText = shop.is_suspended ? 'Suspendida' : 
                             shop.is_active ? 'Activa' : 'Inactiva';

            tbody.innerHTML += `
                <tr>
                    <td>${shop.name}</td>
                    <td>${shop.email}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${new Date(shop.created_at).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="adminPanel.viewBarbershop(${shop.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${shop.is_suspended ? 
                            `<button class="btn btn-sm btn-outline-success" onclick="adminPanel.toggleSuspension(${shop.id}, false)">
                                <i class="fas fa-play"></i>
                            </button>` :
                            `<button class="btn btn-sm btn-outline-warning" onclick="adminPanel.toggleSuspension(${shop.id}, true)">
                                <i class="fas fa-pause"></i>
                            </button>`
                        }
                    </td>
                </tr>
            `;
        });
    }

    renderOverdueBills(bills) {
        const container = document.getElementById('overdueBills');
        container.innerHTML = '';

        if (bills.length === 0) {
            container.innerHTML = '<div class="text-muted">No hay facturas vencidas</div>';
            return;
        }

        bills.forEach(bill => {
            const dueDate = new Date(bill.due_date);
            const daysOverdue = Math.floor((Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

            container.innerHTML += `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 bg-light rounded">
                    <div>
                        <strong>${bill.barbershop_name}</strong><br>
                        <small>$${bill.amount} - ${daysOverdue} días vencida</small>
                    </div>
                    <button class="btn btn-sm btn-success" onclick="adminPanel.markAsPaid(${bill.id})">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            `;
        });
    }

    async loadBarbershops() {
        try {
            const response = await this.apiCall('/api/barbershops');
            if (response.ok) {
                const barbershops = await response.json();
                this.renderBarbershopsTable(barbershops);
            }
        } catch (error) {
            console.error('Error loading barbershops:', error);
        }
    }

    renderBarbershopsTable(barbershops) {
        const tbody = document.querySelector('#barbershopsTable tbody');
        tbody.innerHTML = '';

        barbershops.forEach(shop => {
            const statusClass = shop.is_suspended ? 'status-suspended' : 
                              shop.is_active ? 'status-active' : 'status-inactive';
            const statusText = shop.is_suspended ? 'Suspendida' : 
                             shop.is_active ? 'Activa' : 'Inactiva';

            tbody.innerHTML += `
                <tr>
                    <td>${shop.id}</td>
                    <td>${shop.name}</td>
                    <td>${shop.email}</td>
                    <td>${shop.phone || '-'}</td>
                    <td>${shop.active_barbers || 0}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-outline-primary" onclick="adminPanel.viewBarbershop(${shop.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm btn-outline-info" onclick="adminPanel.editBarbershop(${shop.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${shop.is_suspended ? 
                                `<button class="btn btn-sm btn-outline-success" onclick="adminPanel.toggleSuspension(${shop.id}, false)" title="Reactivar">
                                    <i class="fas fa-play"></i>
                                </button>` :
                                `<button class="btn btn-sm btn-outline-warning" onclick="adminPanel.toggleSuspension(${shop.id}, true)" title="Suspender">
                                    <i class="fas fa-pause"></i>
                                </button>`
                            }
                            <button class="btn btn-sm btn-outline-danger" onclick="adminPanel.deleteBarbershop(${shop.id})" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        this.populateBarbershopSelects(barbershops);
    }

    populateBarbershopSelects(barbershops) {
        const select = document.getElementById('billBarbershopSelect');
        select.innerHTML = '<option value="">Seleccione una barbería</option>';
        
        barbershops.filter(shop => shop.is_active).forEach(shop => {
            select.innerHTML += `<option value="${shop.id}">${shop.name}</option>`;
        });
    }

    async createBarbershop() {
        const form = document.getElementById('createBarbershopForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await this.apiCall('/api/barbershops', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showNotification('Barbería creada exitosamente', 'success');
                form.reset();
                const modal = bootstrap.Modal.getInstance(document.getElementById('createBarbershopModal'));
                modal.hide();
                this.loadBarbershops();
                this.loadDashboard();
            } else {
                const error = await response.json();
                this.showNotification(error.error, 'danger');
            }
        } catch (error) {
            this.showNotification('Error creando barbería', 'danger');
        }
    }

    async loadBilling() {
        try {
            console.log('Loading billing data...');
            const response = await this.apiCall('/api/billing/admin/all');
            
            if (response.ok) {
                const data = await response.json();
                console.log('Billing data received:', data);
                this.renderBillingStats(data.summary);
                this.renderBillingTable(data.bills);
            } else {
                console.error('Error response from billing API:', response.status, response.statusText);
                const errorData = await response.json().catch(() => ({ error: 'Error desconocido' }));
                console.error('Error details:', errorData);
                this.showNotification('Error cargando facturas: ' + errorData.error, 'danger');
                
                // Renderizar tabla vacía con mensaje de error
                const tbody = document.querySelector('#billingTable tbody');
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error cargando facturas. Verifique la conexión.</td></tr>';
            }
            
            await this.loadBarbershopsForBilling();
        } catch (error) {
            console.error('Error loading billing:', error);
            this.showNotification('Error de conexión cargando facturas', 'danger');
            
            // Renderizar tabla vacía con mensaje de error
            const tbody = document.querySelector('#billingTable tbody');
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error de conexión. Verifique que el servidor esté funcionando.</td></tr>';
        }
    }

    async loadBarbershopsForBilling() {
        try {
            const response = await this.apiCall('/api/barbershops');
            if (response.ok) {
                const barbershops = await response.json();
                this.populateBarbershopSelect(barbershops);
            }
        } catch (error) {
            console.error('Error loading barbershops for billing:', error);
        }
    }

    populateBarbershopSelect(barbershops) {
        const select = document.getElementById('billBarbershopSelect');
        if (!select) return;

        select.innerHTML = '<option value="">Seleccione una barbería</option>';
        
        barbershops.forEach(shop => {
            if (shop.is_active) {
                const option = document.createElement('option');
                option.value = shop.id;
                option.textContent = `${shop.name} (${shop.email})`;
                select.appendChild(option);
            }
        });
    }

    renderBillingStats(summary) {
        document.getElementById('totalPending').textContent = `$${summary.pending_amount || 0}`;
        document.getElementById('totalPaid').textContent = `$${summary.paid_amount || 0}`;
        document.getElementById('totalOverdue').textContent = `$${summary.overdue_amount || 0}`;
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        // This would need additional API call for monthly revenue
        document.getElementById('monthlyRevenue').textContent = '$0';
    }

    renderBillingTable(bills) {
        const tbody = document.querySelector('#billingTable tbody');
        tbody.innerHTML = '';

        if (!bills || bills.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay facturas registradas. Genera las primeras facturas usando el botón "Generar Facturas".</td></tr>';
            return;
        }

        bills.forEach(bill => {
            const statusClass = `status-${bill.status}`;
            const statusText = {
                pending: 'Pendiente',
                paid: 'Pagada',
                overdue: 'Vencida',
                cancelled: 'Cancelada'
            }[bill.status];

            tbody.innerHTML += `
                <tr>
                    <td>${bill.id}</td>
                    <td>${bill.barbershop_name}</td>
                    <td>${bill.billing_period}</td>
                    <td>$${bill.amount}</td>
                    <td>${new Date(bill.due_date).toLocaleDateString()}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-outline-primary" onclick="adminPanel.viewBill(${bill.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${bill.status === 'pending' || bill.status === 'overdue' ? 
                                `<button class="btn btn-sm btn-outline-success" onclick="adminPanel.markAsPaid(${bill.id})">
                                    <i class="fas fa-check"></i>
                                </button>` : ''
                            }
                            ${bill.status !== 'paid' ? 
                                `<button class="btn btn-sm btn-outline-danger" onclick="adminPanel.cancelBill(${bill.id})">
                                    <i class="fas fa-times"></i>
                                </button>` : ''
                            }
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    async filterBilling() {
        const status = document.getElementById('billingStatusFilter').value;
        const url = status ? `/api/billing/admin/all?status=${status}` : '/api/billing/admin/all';
        
        try {
            const response = await this.apiCall(url);
            if (response.ok) {
                const data = await response.json();
                this.renderBillingTable(data.bills);
            }
        } catch (error) {
            console.error('Error filtering billing:', error);
        }
    }

    async createBill() {
        const form = document.getElementById('createBillForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await this.apiCall('/api/billing/create-manual', {
                method: 'POST',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showNotification('Factura creada exitosamente', 'success');
                form.reset();
                const modal = bootstrap.Modal.getInstance(document.getElementById('createBillModal'));
                modal.hide();
                this.loadBilling();
            } else {
                const error = await response.json();
                this.showNotification(error.error, 'danger');
            }
        } catch (error) {
            this.showNotification('Error creando factura', 'danger');
        }
    }

    async generateBills() {
        if (!confirm('¿Generar facturas para todas las barberías activas?')) return;

        try {
            const response = await this.apiCall('/api/cron/manual/billing', { method: 'POST' });
            if (response.ok) {
                this.showNotification('Facturas generadas exitosamente', 'success');
                this.loadBilling();
                this.loadDashboard();
            }
        } catch (error) {
            this.showNotification('Error generando facturas', 'danger');
        }
    }

    async runManualTask(task) {
        try {
            const response = await this.apiCall(`/api/cron/manual/${task}`, { method: 'POST' });
            if (response.ok) {
                this.showNotification(`Tarea ${task} ejecutada exitosamente`, 'success');
            }
        } catch (error) {
            this.showNotification(`Error ejecutando tarea ${task}`, 'danger');
        }
    }

    async markAsPaid(billId) {
        const paymentMethod = prompt('Método de pago:');
        if (!paymentMethod) return;

        try {
            const response = await this.apiCall(`/api/billing/payment/${billId}`, {
                method: 'PATCH',
                body: JSON.stringify({ payment_method: paymentMethod })
            });

            if (response.ok) {
                this.showNotification('Pago registrado exitosamente', 'success');
                this.loadBilling();
                this.loadDashboard();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error registrando pago', 'danger');
            }
        } catch (error) {
            console.error('Error registrando pago:', error);
            this.showNotification('Error registrando pago', 'danger');
        }
    }

    async viewBill(billId) {
        try {
            const response = await this.apiCall(`/api/billing/details/${billId}`);
            if (response.ok) {
                const bill = await response.json();
                this.showBillDetailsModal(bill);
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error obteniendo detalles de la factura', 'danger');
            }
        } catch (error) {
            console.error('Error obteniendo detalles:', error);
            this.showNotification('Error obteniendo detalles de la factura', 'danger');
        }
    }

    async cancelBill(billId) {
        if (!confirm('¿Estás seguro de que quieres cancelar esta factura?')) {
            return;
        }
        
        const reason = prompt('Motivo de cancelación (opcional):');
        
        try {
            const response = await this.apiCall(`/api/billing/cancel/${billId}`, {
                method: 'PATCH',
                body: JSON.stringify({ reason: reason || 'Cancelada por administrador' })
            });
            if (response.ok) {
                this.showNotification('Factura cancelada exitosamente', 'success');
                this.loadBilling();
                this.loadDashboard();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error cancelando factura', 'danger');
            }
        } catch (error) {
            console.error('Error cancelando factura:', error);
            this.showNotification('Error cancelando factura', 'danger');
        }
    }

    showBillDetailsModal(bill) {
        const modalHtml = `
            <div class="modal fade" id="billDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Detalles de Factura #${bill.id}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Información de la Barbería</h6>
                                    <p><strong>Nombre:</strong> ${bill.barbershop_name}</p>
                                    <p><strong>Email:</strong> ${bill.barbershop_email}</p>
                                    <p><strong>Teléfono:</strong> ${bill.barbershop_phone || 'No especificado'}</p>
                                    <p><strong>Dirección:</strong> ${bill.barbershop_address || 'No especificada'}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6>Información de la Factura</h6>
                                    <p><strong>Período:</strong> ${bill.billing_period}</p>
                                    <p><strong>Monto:</strong> $${bill.amount}</p>
                                    <p><strong>Estado:</strong> <span class="badge bg-${bill.status === 'paid' ? 'success' : bill.status === 'pending' ? 'warning' : bill.status === 'overdue' ? 'danger' : 'secondary'}">${bill.status}</span></p>
                                    <p><strong>Fecha de vencimiento:</strong> ${new Date(bill.due_date).toLocaleDateString()}</p>
                                    <p><strong>Fecha de pago:</strong> ${bill.paid_date ? new Date(bill.paid_date).toLocaleDateString() : 'No pagada'}</p>
                                    <p><strong>Método de pago:</strong> ${bill.payment_method || '-'}</p>
                                    <p><strong>ID de transacción:</strong> ${bill.transaction_id || '-'}</p>
                                    <p><strong>Fecha de creación:</strong> ${new Date(bill.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            ${bill.notes ? `
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <h6>Notas</h6>
                                        <div class="alert alert-info">${bill.notes}</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remover modal anterior si existe
        const existingModal = document.getElementById('billDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Agregar el nuevo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('billDetailsModal'));
        modal.show();
        
        // Limpiar el modal cuando se cierre
        document.getElementById('billDetailsModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    async toggleSuspension(barbershopId, suspend) {
        const action = suspend ? 'suspender' : 'reactivar';
        let reason = '';
        
        if (suspend) {
            reason = prompt('Motivo de suspensión:');
            if (!reason) return;
        }

        try {
            console.log(`Attempting to ${action} barbershop ${barbershopId}`, { suspend, reason });
            
            const response = await this.apiCall(`/api/barbershops/${barbershopId}/suspend`, {
                method: 'PATCH',
                body: JSON.stringify({ 
                    is_suspended: suspend, 
                    suspension_reason: reason 
                })
            });

            console.log('Response status:', response.status);

            if (response.ok) {
                this.showNotification(`Barbería ${suspend ? 'suspendida' : 'reactivada'} exitosamente`, 'success');
                this.loadBarbershops();
                this.loadDashboard();
            } else {
                const errorData = await response.json();
                console.error('Error response:', errorData);
                console.error('Error details:', JSON.stringify(errorData, null, 2));
                if (errorData.errors && errorData.errors.length > 0) {
                    console.error('Validation errors:', errorData.errors);
                    this.showNotification(`Error: ${errorData.errors[0].msg}`, 'danger');
                } else {
                    this.showNotification(errorData.error || `Error al ${action} barbería`, 'danger');
                }
            }
        } catch (error) {
            console.error('Exception in toggleSuspension:', error);
            this.showNotification(`Error al ${action} barbería: ${error.message}`, 'danger');
        }
    }

    async viewBarbershop(barbershopId) {
        try {
            const response = await this.apiCall(`/api/barbershops/${barbershopId}`);
            if (response.ok) {
                const barbershop = await response.json();
                this.showBarbershopDetailsModal(barbershop);
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error obteniendo detalles de la barbería', 'danger');
            }
        } catch (error) {
            console.error('Error obteniendo detalles:', error);
            this.showNotification('Error obteniendo detalles de la barbería', 'danger');
        }
    }

    async editBarbershop(barbershopId) {
        try {
            const response = await this.apiCall(`/api/barbershops/${barbershopId}`);
            if (response.ok) {
                const barbershop = await response.json();
                this.showEditBarbershopModal(barbershop);
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error cargando datos de la barbería', 'danger');
            }
        } catch (error) {
            console.error('Error cargando barbería:', error);
            this.showNotification('Error cargando datos de la barbería', 'danger');
        }
    }

    async deleteBarbershop(barbershopId) {
        if (!confirm('⚠️ ¿Estás seguro de que quieres eliminar esta barbería?\n\nEsta acción eliminará:\n- Todos los barberos asociados\n- Todas las citas\n- Todo el historial\n\nEsta acción NO se puede deshacer.')) {
            return;
        }

        const confirmation = prompt('Para confirmar, escribe "ELIMINAR" en mayúsculas:');
        if (confirmation !== 'ELIMINAR') {
            this.showNotification('Eliminación cancelada', 'info');
            return;
        }

        try {
            const response = await this.apiCall(`/api/barbershops/${barbershopId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                this.showNotification('Barbería eliminada exitosamente', 'success');
                this.loadBarbershops();
                this.loadDashboard();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error eliminando barbería', 'danger');
            }
        } catch (error) {
            console.error('Error eliminando barbería:', error);
            this.showNotification('Error eliminando barbería', 'danger');
        }
    }


    async loadWhatsAppConnections() {
        try {
            const response = await this.apiCall('/api/whatsapp/admin/all-connected');
            if (response.ok) {
                const data = await response.json();
                this.renderWhatsAppConnections(data.connected_clients);
            }
        } catch (error) {
            console.error('Error loading WhatsApp connections:', error);
        }
    }

    renderWhatsAppConnections(connections) {
        const container = document.getElementById('whatsappConnections');
        container.innerHTML = '';

        if (connections.length === 0) {
            container.innerHTML = '<div class="text-center text-muted">No hay conexiones WhatsApp activas</div>';
            return;
        }

        connections.forEach(conn => {
            const statusClass = conn.is_ready ? 'text-success' : 'text-warning';
            const statusText = conn.is_ready ? 'Conectado' : 'Desconectado';

            container.innerHTML += `
                <div class="d-flex justify-content-between align-items-center p-3 bg-light rounded mb-2">
                    <div>
                        <strong>${conn.barbershop_name}</strong><br>
                        <small class="text-muted">${conn.phone || 'Sin número'}</small>
                    </div>
                    <span class="${statusClass}">
                        <i class="fas fa-circle"></i> ${statusText}
                    </span>
                </div>
            `;
        });
    }

    async loadSettings() {
        // Load message templates and other settings
        document.getElementById('messageTemplates').innerHTML = `
            <div class="mb-3">
                <label class="form-label">Plantilla de Facturación</label>
                <textarea class="form-control" rows="3" placeholder="Mensaje para nueva factura..."></textarea>
            </div>
            <div class="mb-3">
                <label class="form-label">Plantilla de Recordatorio</label>
                <textarea class="form-control" rows="3" placeholder="Mensaje de recordatorio de pago..."></textarea>
            </div>
            <div class="mb-3">
                <label class="form-label">Plantilla de Suspensión</label>
                <textarea class="form-control" rows="3" placeholder="Mensaje de suspensión..."></textarea>
            </div>
            <div class="mb-3">
                <label class="form-label">Plantilla de Agradecimiento</label>
                <textarea class="form-control" rows="3" placeholder="Mensaje de agradecimiento por pago..."></textarea>
            </div>
            <button class="btn btn-primary">Guardar Plantillas</button>
        `;
    }

    async loadReports() {
        // This would load chart data and render charts
        console.log('Loading reports...');
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

    showChangePasswordModal() {
        const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
        modal.show();
    }

    showChangeEmailModal() {
        const user = JSON.parse(localStorage.getItem('admin_user'));
        document.getElementById('currentEmail').value = user.email;
        const modal = new bootstrap.Modal(document.getElementById('changeEmailModal'));
        modal.show();
    }

    async changePassword() {
        const form = document.getElementById('changePasswordForm');
        const formData = new FormData(form);
        
        const currentPassword = formData.get('currentPassword');
        const newPassword = formData.get('newPassword');
        const confirmPassword = formData.get('confirmPassword');

        if (newPassword !== confirmPassword) {
            this.showNotification('Las contraseñas no coinciden', 'danger');
            return;
        }

        try {
            const response = await this.apiCall('/api/auth/change-password', {
                method: 'PUT',
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Contraseña actualizada exitosamente', 'success');
                bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
                form.reset();
            } else {
                this.showNotification(data.error || 'Error al cambiar contraseña', 'danger');
            }
        } catch (error) {
            this.showNotification('Error de conexión', 'danger');
        }
    }

    async changeEmail() {
        const form = document.getElementById('changeEmailForm');
        const formData = new FormData(form);
        
        const newEmail = formData.get('newEmail');
        const password = formData.get('password');

        try {
            const response = await this.apiCall('/api/auth/change-email', {
                method: 'PUT',
                body: JSON.stringify({ newEmail, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('admin_token', data.token);
                const user = JSON.parse(localStorage.getItem('admin_user'));
                user.email = newEmail;
                localStorage.setItem('admin_user', JSON.stringify(user));
                
                this.showNotification('Email actualizado exitosamente', 'success');
                bootstrap.Modal.getInstance(document.getElementById('changeEmailModal')).hide();
                document.getElementById('userName').textContent = user.name;
                form.reset();
            } else {
                this.showNotification(data.error || 'Error al cambiar email', 'danger');
            }
        } catch (error) {
            this.showNotification('Error de conexión', 'danger');
        }
    }

    async createAdmin() {
        const form = document.getElementById('createAdminForm');
        const formData = new FormData(form);
        
        const adminData = {
            name: formData.get('name'),
            email: formData.get('email'),
            password: formData.get('password'),
            role: formData.get('role')
        };

        try {
            const response = await this.apiCall('/api/auth/admin/create-admin', {
                method: 'POST',
                body: JSON.stringify(adminData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Administrador creado exitosamente', 'success');
                bootstrap.Modal.getInstance(document.getElementById('createAdminModal')).hide();
                form.reset();
                this.loadAdminManagement();
            } else {
                this.showNotification(data.error || 'Error al crear administrador', 'danger');
            }
        } catch (error) {
            this.showNotification('Error de conexión', 'danger');
        }
    }

    async loadAdminManagement() {
        try {
            const response = await this.apiCall('/api/auth/admin/list-admins');
            if (response.ok) {
                const data = await response.json();
                this.renderAdminsTable(data.admins);
                
                const user = JSON.parse(localStorage.getItem('admin_user'));
                if (user.role === 'super_admin') {
                    document.getElementById('superAdminOption').style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Error loading admin management:', error);
        }
    }

    renderAdminsTable(admins) {
        const tbody = document.querySelector('#adminsTable tbody');
        tbody.innerHTML = '';

        if (admins.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay administradores registrados</td></tr>';
            return;
        }

        const currentUser = JSON.parse(localStorage.getItem('admin_user'));

        admins.forEach(admin => {
            const statusClass = admin.is_active ? 'status-active' : 'status-inactive';
            const statusText = admin.is_active ? 'Activo' : 'Inactivo';
            const roleText = admin.role === 'super_admin' ? 'Super Admin' : 'Admin';

            tbody.innerHTML += `
                <tr>
                    <td>${admin.id}</td>
                    <td>${admin.name}</td>
                    <td>${admin.email}</td>
                    <td><span class="badge bg-primary">${roleText}</span></td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${new Date(admin.created_at).toLocaleDateString()}</td>
                    <td>
                        <div class="btn-group" role="group">
                            <button class="btn btn-sm btn-outline-info" onclick="adminPanel.editAdmin(${admin.id})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            ${currentUser.role === 'super_admin' && admin.id !== currentUser.id ? 
                                `<button class="btn btn-sm ${admin.is_active ? 'btn-outline-warning' : 'btn-outline-success'}" 
                                    onclick="adminPanel.toggleAdmin(${admin.id})" title="${admin.is_active ? 'Desactivar' : 'Activar'}">
                                    <i class="fas ${admin.is_active ? 'fa-pause' : 'fa-play'}"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="adminPanel.deleteAdmin(${admin.id})" title="Eliminar">
                                    <i class="fas fa-trash"></i>
                                </button>` : 
                                admin.id === currentUser.id ? '' : 
                                `<button class="btn btn-sm btn-outline-warning" onclick="adminPanel.toggleAdmin(${admin.id})" title="${admin.is_active ? 'Desactivar' : 'Activar'}">
                                    <i class="fas ${admin.is_active ? 'fa-pause' : 'fa-play'}"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" onclick="adminPanel.deleteAdmin(${admin.id})" title="Eliminar">
                                    <i class="fas fa-trash"></i>
                                </button>`
                            }
                        </div>
                    </td>
                </tr>
            `;
        });
    }

    async toggleAdmin(adminId) {
        try {
            const response = await this.apiCall(`/api/auth/admin/toggle-admin/${adminId}`, {
                method: 'PUT'
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification(data.message, 'success');
                this.loadAdminManagement();
            } else {
                this.showNotification(data.error || 'Error al cambiar estado del administrador', 'danger');
            }
        } catch (error) {
            this.showNotification('Error de conexión', 'danger');
        }
    }

    async editAdmin(adminId) {
        try {
            console.log('Cargando datos del admin ID:', adminId);
            const response = await this.apiCall(`/api/auth/admin/get-admin/${adminId}`);
            
            console.log('Respuesta del servidor:', response.status, response.statusText);
            
            if (response.ok) {
                const admin = await response.json();
                console.log('Datos del admin recibidos:', admin);
                this.showEditAdminModal(admin);
            } else {
                const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
                console.error('Error del servidor:', error);
                this.showNotification(error.error || 'Error obteniendo datos del administrador', 'danger');
            }
        } catch (error) {
            console.error('Error loading admin:', error);
            this.showNotification(`Error cargando datos del administrador: ${error.message}`, 'danger');
        }
    }

    showEditAdminModal(admin) {
        try {
            const form = document.getElementById('editAdminForm');
            if (!form) {
                throw new Error('Formulario de edición no encontrado');
            }

            // Usar querySelector para acceder a los elementos del formulario
            const nameInput = form.querySelector('input[name="name"]');
            const emailInput = form.querySelector('input[name="email"]');
            const roleSelect = form.querySelector('select[name="role"]');
            const passwordInput = form.querySelector('input[name="password"]');

            if (!nameInput || !emailInput || !roleSelect || !passwordInput) {
                throw new Error('No se pudieron encontrar todos los elementos del formulario');
            }

            nameInput.value = admin.name || '';
            emailInput.value = admin.email || '';
            roleSelect.value = admin.role || '';
            passwordInput.value = '';
            
            // Mostrar opción super_admin si el usuario actual es super_admin
            const currentUser = JSON.parse(localStorage.getItem('admin_user'));
            const superAdminOption = document.getElementById('editSuperAdminOption');
            if (superAdminOption) {
                if (currentUser && currentUser.role === 'super_admin') {
                    superAdminOption.style.display = 'block';
                } else {
                    superAdminOption.style.display = 'none';
                }
            }

            const modalElement = document.getElementById('editAdminModal');
            if (!modalElement) {
                throw new Error('Modal de edición no encontrado');
            }

            const modal = new bootstrap.Modal(modalElement);
            modal.show();

            // Configurar evento de actualización
            const updateBtn = document.getElementById('updateAdminBtn');
            if (updateBtn) {
                updateBtn.onclick = () => this.updateAdmin(admin.id);
            }
        } catch (error) {
            console.error('Error mostrando modal de edición:', error);
            this.showNotification(`Error mostrando modal de edición: ${error.message}`, 'danger');
        }
    }

    async updateAdmin(adminId) {
        const form = document.getElementById('editAdminForm');
        const formData = new FormData(form);
        
        const adminData = {
            name: formData.get('name'),
            email: formData.get('email'),
            role: formData.get('role')
        };

        // Solo incluir contraseña si se proporcionó una nueva
        const password = formData.get('password');
        if (password && password.trim()) {
            adminData.password = password;
        }

        try {
            const response = await this.apiCall(`/api/auth/admin/update-admin/${adminId}`, {
                method: 'PUT',
                body: JSON.stringify(adminData)
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Administrador actualizado exitosamente', 'success');
                bootstrap.Modal.getInstance(document.getElementById('editAdminModal')).hide();
                form.reset();
                this.loadAdminManagement();
            } else {
                this.showNotification(data.error || 'Error al actualizar administrador', 'danger');
            }
        } catch (error) {
            this.showNotification('Error de conexión', 'danger');
        }
    }

    async deleteAdmin(adminId) {
        if (!confirm('⚠️ ¿Estás seguro de que quieres eliminar este administrador?\n\nEsta acción NO se puede deshacer.')) {
            return;
        }

        const confirmation = prompt('Para confirmar, escribe "ELIMINAR" en mayúsculas:');
        if (confirmation !== 'ELIMINAR') {
            this.showNotification('Eliminación cancelada', 'info');
            return;
        }

        try {
            const response = await this.apiCall(`/api/auth/admin/delete-admin/${adminId}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Administrador eliminado exitosamente', 'success');
                this.loadAdminManagement();
            } else {
                this.showNotification(data.error || 'Error al eliminar administrador', 'danger');
            }
        } catch (error) {
            this.showNotification('Error de conexión', 'danger');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
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

    showBarbershopDetailsModal(barbershop) {
        const modalHtml = `
            <div class="modal fade" id="barbershopDetailsModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Detalles de Barbería - ${barbershop.name}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Información General</h6>
                                    <p><strong>ID:</strong> ${barbershop.id}</p>
                                    <p><strong>Nombre:</strong> ${barbershop.name}</p>
                                    <p><strong>Email:</strong> ${barbershop.email}</p>
                                    <p><strong>Teléfono:</strong> ${barbershop.phone || 'No especificado'}</p>
                                    <p><strong>Dirección:</strong> ${barbershop.address || 'No especificada'}</p>
                                    <p><strong>WhatsApp:</strong> ${barbershop.whatsapp_number || 'No configurado'}</p>
                                </div>
                                <div class="col-md-6">
                                    <h6>Estado y Configuración</h6>
                                    <p><strong>Estado:</strong> 
                                        <span class="badge bg-${barbershop.is_suspended ? 'danger' : barbershop.is_active ? 'success' : 'secondary'}">
                                            ${barbershop.is_suspended ? 'Suspendida' : barbershop.is_active ? 'Activa' : 'Inactiva'}
                                        </span>
                                    </p>
                                    <p><strong>Cuota mensual:</strong> $${barbershop.monthly_fee}</p>
                                    <p><strong>Día de facturación:</strong> ${barbershop.billing_day}</p>
                                    <p><strong>Fecha de registro:</strong> ${new Date(barbershop.created_at).toLocaleDateString()}</p>
                                    <p><strong>Última actualización:</strong> ${new Date(barbershop.updated_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            ${barbershop.suspension_reason ? `
                                <div class="row mt-3">
                                    <div class="col-12">
                                        <h6>Motivo de Suspensión</h6>
                                        <div class="alert alert-warning">${barbershop.suspension_reason}</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                            <button type="button" class="btn btn-primary" onclick="adminPanel.editBarbershop(${barbershop.id})" data-bs-dismiss="modal">Editar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Remover modal anterior si existe
        const existingModal = document.getElementById('barbershopDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Agregar el nuevo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('barbershopDetailsModal'));
        modal.show();
        
        // Limpiar el modal cuando se cierre
        document.getElementById('barbershopDetailsModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    showEditBarbershopModal(barbershop) {
        const modalHtml = `
            <div class="modal fade" id="editBarbershopModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Editar Barbería - ${barbershop.name}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <form id="editBarbershopForm">
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label">Nombre *</label>
                                            <input type="text" class="form-control" name="name" value="${barbershop.name}" required>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Email *</label>
                                            <input type="email" class="form-control" name="email" value="${barbershop.email}" required>
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Teléfono</label>
                                            <input type="tel" class="form-control" name="phone" value="${barbershop.phone || ''}">
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label">WhatsApp</label>
                                            <input type="tel" class="form-control" name="whatsapp_number" value="${barbershop.whatsapp_number || ''}">
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Cuota Mensual</label>
                                            <input type="number" step="0.01" class="form-control" name="monthly_fee" value="${barbershop.monthly_fee}">
                                        </div>
                                        <div class="mb-3">
                                            <label class="form-label">Día de Facturación</label>
                                            <select class="form-select" name="billing_day">
                                                ${Array.from({length: 28}, (_, i) => i + 1).map(day =>
                                                    `<option value="${day}" ${day == barbershop.billing_day ? 'selected' : ''}>${day}</option>`
                                                ).join('')}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div class="row">
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label class="form-label">Máximo de Barberos *</label>
                                            <input type="number" class="form-control" name="max_barbers" value="${barbershop.max_barbers || 1}" min="1" max="50" required>
                                            <div class="form-text">
                                                <i class="fas fa-info-circle"></i>
                                                Número máximo de barberos que puede registrar esta barbería
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Dirección</label>
                                    <textarea class="form-control" name="address" rows="2">${barbershop.address || ''}</textarea>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Nueva Contraseña (opcional)</label>
                                    <input type="password" class="form-control" name="password" minlength="6" placeholder="Dejar vacío para no cambiar">
                                    <div class="form-text">Mínimo 6 caracteres. Solo completar si se desea cambiar la contraseña.</div>
                                </div>
                                <div class="form-check">
                                    <input class="form-check-input" type="checkbox" name="is_active" ${barbershop.is_active ? 'checked' : ''}>
                                    <label class="form-check-label">Barbería activa</label>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                                <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Remover modal anterior si existe
        const existingModal = document.getElementById('editBarbershopModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Agregar el nuevo modal
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Configurar evento submit
        document.getElementById('editBarbershopForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateBarbershop(barbershop.id);
        });
        
        // Mostrar el modal
        const modal = new bootstrap.Modal(document.getElementById('editBarbershopModal'));
        modal.show();
        
        // Limpiar el modal cuando se cierre
        document.getElementById('editBarbershopModal').addEventListener('hidden.bs.modal', function () {
            this.remove();
        });
    }

    async updateBarbershop(barbershopId) {
        const form = document.getElementById('editBarbershopForm');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convertir checkbox a boolean
        data.is_active = formData.has('is_active');

        try {
            const response = await this.apiCall(`/api/barbershops/${barbershopId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showNotification('Barbería actualizada exitosamente', 'success');
                this.loadBarbershops();
                // Cerrar modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editBarbershopModal'));
                modal.hide();
            } else {
                const error = await response.json();
                this.showNotification(error.error || 'Error actualizando barbería', 'danger');
            }
        } catch (error) {
            console.error('Error actualizando barbería:', error);
            this.showNotification('Error actualizando barbería', 'danger');
        }
    }

    logout() {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        if (this.socket) {
            this.socket.disconnect();
        }
        location.reload();
    }
}

// Initialize the admin panel
const adminPanel = new AdminPanel();