# Plataforma de Gestión de Barberías

Una plataforma completa para la gestión de turnos multibarberos con integración de WhatsApp Bot, facturación automática y gestión en tiempo real.

## 🚀 Características Principales

### Para Administradores
- **Dashboard completo** con estadísticas y métricas
- **Gestión de barberías** (crear, editar, suspender, eliminar)
- **Sistema de facturación automática** mensual
- **Reportes financieros** y estadísticas de uso
- **Gestión de plantillas** de mensajes WhatsApp
- **Monitoreo de conexiones** WhatsApp en tiempo real

### Para Barberías
- **Panel de control** con estadísticas del negocio
- **Gestión de barberos** y sus horarios
- **Integración WhatsApp Bot** para turnos automáticos
- **Facturación y pagos** con historial completo
- **Mensajería masiva** a clientes
- **Monitoreo en tiempo real** de colas y turnos

### Para Barberos
- **Dashboard personalizado** con su cola de turnos
- **Gestión de horarios** semanales flexible
- **Sistema de llamada** de turnos con botones
- **Notificaciones automáticas** a clientes
- **Historial de servicios** completados
- **Configuración de duración** por servicio

### Para Clientes (WhatsApp Bot)
- **Reserva de turnos** vía WhatsApp automática
- **Consulta de estado** de su turno
- **Notificaciones de cola** en tiempo real
- **Información de barberos** disponibles
- **Estimación de tiempo** de espera

## 🛠️ Tecnologías Utilizadas

- **Backend:** Node.js, Express.js
- **Base de Datos:** MySQL
- **WebSockets:** Socket.IO para tiempo real
- **WhatsApp:** whatsapp-web.js
- **Frontend:** HTML5, CSS3, Bootstrap 5, JavaScript
- **Autenticación:** JWT
- **Programación:** node-cron para tareas automáticas

## 📦 Instalación

### Prerrequisitos
- Node.js 16 o superior
- MySQL 8.0 o superior
- Chrome/Chromium (para WhatsApp Web)

### Pasos de instalación

1. **Clonar el repositorio**
```bash
git clone [repository-url]
cd TU
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

4. **Configurar base de datos MySQL**
```sql
CREATE DATABASE barbershop_platform;
CREATE USER 'barbershop_user'@'localhost' IDENTIFIED BY 'password';
GRANT ALL PRIVILEGES ON barbershop_platform.* TO 'barbershop_user'@'localhost';
FLUSH PRIVILEGES;
```

5. **Iniciar la aplicación**
```bash
npm start
```

La aplicación estará disponible en `http://localhost:80`

## 🔧 Configuración

### Variables de Entorno

```env
PORT=80                                    # Puerto de la aplicación
DB_HOST=localhost                          # Host de MySQL
DB_USER=root                              # Usuario de MySQL
DB_PASSWORD=password                       # Contraseña de MySQL
DB_NAME=barbershop_platform               # Nombre de la base de datos

JWT_SECRET=tu_jwt_secret_muy_seguro       # Clave secreta JWT
JWT_EXPIRE=7d                             # Expiración del token

WHATSAPP_SESSION_PATH=./whatsapp-sessions # Directorio de sesiones WhatsApp

ADMIN_EMAIL=admin@barbershop.com          # Email del administrador
ADMIN_PASSWORD=admin123                   # Contraseña del administrador

NODE_ENV=development                      # Entorno de ejecución
```

## 📱 Acceso a los Paneles

### Panel Administrador
- **URL:** `http://localhost/admin`
- **Credenciales por defecto:** 
  - Email: admin@barbershop.com
  - Contraseña: admin123

### Panel Barbería
- **URL:** `http://localhost/barbershop`
- Las barberías pueden registrarse directamente desde la página de login

### Panel Barbero
- **URL:** `http://localhost/barber`
- Los barberos son creados por las barberías desde su panel

## 🤖 Configuración WhatsApp Bot

1. **Conectar WhatsApp desde el panel de barbería**
2. **Escanear código QR** con WhatsApp Web
3. **El bot estará disponible** automáticamente para clientes

### Comandos del Bot

**Comandos principales:**
- `menu`, `hola` o `inicio` - Mostrar menú principal
- `1` o `turnos` - Ver barberos disponibles y reservar
- `2` o `consultar` - Consultar estado del turno
- `3` o `barberos` - Ver información de barberos
- `4` o `estado` - Ver estado actual de las colas
- `5` o `cancelar` - Cancelar mi turno

**Comandos de reserva rápida:**
- `A`, `B`, `C`... - Reservar con barbero específico (según orden mostrado)

**Comandos adicionales:**
- `ayuda`, `help` o `?` - Mostrar ayuda completa
- `contacto` o `info` - Información de contacto de la barbería

**Comandos de confirmación:**
- `si` o `confirmar_cancelar` - Confirmar cancelación de turno
- `no` o `no_cancelar` - Mantener turno activo

## 💰 Sistema de Facturación

### Facturación Automática
- **Generación automática** el día configurado de cada mes
- **Recordatorios automáticos** 7, 3 y 1 días antes del vencimiento
- **Suspensión automática** después de 15 días de vencimiento
- **Notificaciones WhatsApp** para todos los estados

### Estados de Facturas
- **Pendiente:** Factura generada, esperando pago
- **Pagada:** Pago registrado y confirmado
- **Vencida:** Factura no pagada después del vencimiento
- **Cancelada:** Factura cancelada por el administrador

## 🔄 Tareas Automáticas

### Programadas diariamente:
- **9:00 AM:** Generación de facturas mensuales
- **10:00 AM:** Verificación de facturas vencidas
- **11:00 AM:** Envío de recordatorios de pago

### Programadas semanalmente:
- **Domingos 2:00 AM:** Limpieza de datos antiguos

## 📊 Base de Datos

### Tablas principales:
- `barbershops` - Información de barberías
- `barbers` - Información de barberos
- `barber_schedules` - Horarios de barberos
- `appointments` - Turnos y citas
- `billing` - Facturación y pagos
- `whatsapp_messages` - Historial de mensajes
- `notification_templates` - Plantillas de mensajes
- `admin_users` - Usuarios administradores

## 🚀 Despliegue en Producción

### Configuraciones recomendadas:

1. **Usar HTTPS** con certificado SSL
2. **Configurar proxy reverso** (Nginx)
3. **Usar PM2** para gestión de procesos
4. **Configurar backups** automáticos de base de datos
5. **Monitoreo** de logs y rendimiento

### Ejemplo configuración PM2:
```bash
npm install -g pm2
pm2 start server.js --name "barbershop-platform"
pm2 startup
pm2 save
```

### Ejemplo configuración Nginx:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🛡️ Seguridad

- **Autenticación JWT** con tokens seguros
- **Validación de entrada** en todas las APIs
- **Sanitización de datos** para prevenir inyecciones
- **Roles y permisos** granulares por usuario
- **Sesiones seguras** para WhatsApp

## 🔧 Solución de Problemas

### WhatsApp no conecta
1. Verificar que Chrome/Chromium esté instalado
2. Limpiar sesiones: `rm -rf whatsapp-sessions/*`
3. Reiniciar aplicación

### Errores de base de datos
1. Verificar que MySQL esté corriendo
2. Comprobar credenciales en `.env`
3. Revisar permisos de usuario MySQL

### Problemas de permisos puerto 80
```bash
# En Linux, usar sudo para puerto 80
sudo npm start

# O cambiar a puerto superior a 1024
PORT=3000 npm start
```

## 📞 Soporte

Para reportar problemas o solicitar características:
- Crear issue en el repositorio
- Contactar al equipo de desarrollo

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT. Ver archivo `LICENSE` para más detalles.

---

## 🎯 Próximas Características

- [ ] Integración con sistemas de pago en línea
- [ ] App móvil nativa
- [ ] Reportes avanzados con gráficos
- [ ] Sistema de calificaciones y reseñas
- [ ] Integración con calendarios externos
- [ ] API pública para integraciones
- [ ] Sistema de promociones y descuentos
- [ ] Gestión de inventario básica

---

**Desarrollado con ❤️ para modernizar las barberías**