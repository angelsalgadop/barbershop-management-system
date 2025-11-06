# 🚀 Guía de Despliegue en Producción - mibarberiaweb.com

## 📋 Resumen

Esta guía te ayudará a desplegar tu plataforma MiBarberiaWeb en el dominio `https://mibarberiaweb.com/` con certificados SSL válidos y configuración de producción completa.

## 🎯 Objetivos del Despliegue

- ✅ Servidor HTTPS funcionando en puerto 443 (estándar)
- ✅ Redirección HTTP → HTTPS en puerto 80
- ✅ Certificado SSL válido sin advertencias de navegador
- ✅ Configuración optimizada para producción
- ✅ Servicio systemd para inicio automático
- ✅ Monitoreo y logs centralizados

## 🔧 Prerrequisitos

### 1. Servidor
- Ubuntu 18.04+ o CentOS 7+ 
- Acceso root o sudo
- Puertos 80 y 443 disponibles
- Node.js 16+ instalado

### 2. Dominio
- Dominio `mibarberiaweb.com` debe apuntar a la IP del servidor
- Subdominio `www.mibarberiaweb.com` configurado (opcional)
- Acceso a configuración DNS

### 3. Verificar DNS
```bash
# Verificar que el dominio apunta correctamente
nslookup mibarberiaweb.com
dig mibarberiaweb.com
```

## 🚀 Pasos de Despliegue

### Paso 1: Ejecutar Despliegue Automático
```bash
# Desde el directorio del proyecto
./deploy_production.sh
```

Este script automáticamente:
- Instala dependencias
- Configura variables de entorno
- Crea servicio systemd
- Configura firewall
- Inicia la aplicación

### Paso 2: Configurar Certificado SSL (Opción A - Let's Encrypt - RECOMENDADO)
```bash
# Generar certificado gratuito y válido
./setup_letsencrypt.sh
```

**Ventajas de Let's Encrypt:**
- ✅ Certificado completamente válido
- ✅ Sin advertencias en navegadores
- ✅ Renovación automática cada 90 días
- ✅ Completamente gratuito

### Paso 2 Alternativo: Certificado Comercial (Opción B)
Si tienes un certificado comercial:

```bash
# Copiar certificados
sudo cp tu_certificado.crt /root/TU/ssl/mibarberiaweb.crt
sudo cp tu_clave_privada.key /root/TU/ssl/mibarberiaweb.key

# Configurar permisos
sudo chmod 644 /root/TU/ssl/mibarberiaweb.crt
sudo chmod 600 /root/TU/ssl/mibarberiaweb.key
```

### Paso 3: Verificar Despliegue
```bash
# Verificar estado del servicio
sudo systemctl status mibarberiaweb

# Ver logs en tiempo real
sudo journalctl -u mibarberiaweb -f

# Probar conectividad
curl -I https://mibarberiaweb.com
```

## 🌐 URLs de Producción

Una vez desplegado, tu plataforma estará disponible en:

| Panel | URL |
|-------|-----|
| **Página Principal** | https://mibarberiaweb.com |
| **Panel Admin** | https://mibarberiaweb.com/admin |
| **Panel Barbería** | https://mibarberiaweb.com/barbershop |
| **Panel Barbero** | https://mibarberiaweb.com/barber |
| **API** | https://mibarberiaweb.com/api/* |

## ⚙️ Configuración de Producción

### Variables de Entorno (.env)
```bash
NODE_ENV=production
PORT=80
HTTPS_PORT=443
DB_HOST=localhost
DB_USER=barbershop_user
DB_PASSWORD=barbershop_password_2024
DB_NAME=barbershop_platform
```

### Certificados SSL
- **Desarrollo**: `ssl/cert.pem` y `ssl/key.pem` (autofirmados)
- **Producción**: `ssl/mibarberiaweb.crt` y `ssl/mibarberiaweb.key` (válidos)

### Servicio Systemd
- **Nombre**: `mibarberiaweb.service`
- **Inicio automático**: ✅ Habilitado
- **Reinicio automático**: ✅ En caso de fallas
- **Usuario**: root
- **Directorio de trabajo**: `/root/TU`

## 🔍 Monitoreo y Mantenimiento

### Comandos Esenciales
```bash
# Ver estado del servicio
sudo systemctl status mibarberiaweb

# Ver logs en tiempo real
sudo journalctl -u mibarberiaweb -f

# Reiniciar servicio
sudo systemctl restart mibarberiaweb

# Detener servicio
sudo systemctl stop mibarberiaweb

# Iniciar servicio
sudo systemctl start mibarberiaweb

# Ver logs de errores únicamente
sudo journalctl -u mibarberiaweb -p err

# Ver últimas 100 líneas de log
sudo journalctl -u mibarberiaweb -n 100
```

### Verificación de Salud
```bash
# Verificar conectividad HTTPS
curl -I https://mibarberiaweb.com

# Probar API
curl -k -X POST https://mibarberiaweb.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@barbershop.com","password":"admin123","role":"admin"}'

# Verificar certificado SSL
openssl s_client -connect mibarberiaweb.com:443 -servername mibarberiaweb.com
```

## 🔐 Seguridad de Producción

### Firewall (UFW)
```bash
# Habilitar firewall
sudo ufw enable

# Permitir SSH (CRÍTICO - no te bloquees)
sudo ufw allow ssh

# Permitir HTTP y HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Ver reglas activas
sudo ufw status
```

### Actualizaciones de Seguridad
```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Actualizar dependencias Node.js
npm audit && npm audit fix

# Verificar certificado SSL (renovación cada 90 días con Let's Encrypt)
sudo certbot certificates
```

## 🚨 Solución de Problemas

### Problema: Servicio no inicia
```bash
# Ver logs detallados
sudo journalctl -u mibarberiaweb -n 50

# Verificar permisos de certificados
ls -la /root/TU/ssl/

# Verificar puertos en uso
sudo lsof -i :80
sudo lsof -i :443
```

### Problema: Certificado SSL no válido
```bash
# Regenerar certificado Let's Encrypt
sudo certbot renew --force-renewal

# Verificar configuración DNS
nslookup mibarberiaweb.com

# Probar desde otro servidor
curl -I https://mibarberiaweb.com
```

### Problema: Base de datos no conecta
```bash
# Verificar MySQL
sudo systemctl status mysql

# Probar conexión
mysql -u barbershop_user -p barbershop_platform

# Ver logs de la aplicación
sudo journalctl -u mibarberiaweb | grep -i mysql
```

## 📈 Optimizaciones de Producción

### 1. PM2 para Gestión de Procesos (Opcional)
```bash
# Instalar PM2
npm install -g pm2

# Crear configuración PM2
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'mibarberiaweb',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 80,
      HTTPS_PORT: 443
    }
  }]
}
EOF

# Iniciar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 2. Nginx como Proxy Reverso (Opcional)
```bash
# Instalar Nginx
sudo apt install nginx

# Configurar proxy reverso
sudo tee /etc/nginx/sites-available/mibarberiaweb << EOF
server {
    listen 80;
    server_name mibarberiaweb.com www.mibarberiaweb.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mibarberiaweb.com www.mibarberiaweb.com;
    
    ssl_certificate /root/TU/ssl/mibarberiaweb.crt;
    ssl_certificate_key /root/TU/ssl/mibarberiaweb.key;
    
    location / {
        proxy_pass https://localhost:3443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Habilitar configuración
sudo ln -s /etc/nginx/sites-available/mibarberiaweb /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## ✅ Checklist de Despliegue

- [ ] Dominio apunta a la IP del servidor
- [ ] Puertos 80 y 443 disponibles
- [ ] Certificado SSL configurado
- [ ] Variables de entorno configuradas para producción
- [ ] Servicio systemd creado y funcionando
- [ ] Firewall configurado
- [ ] Base de datos funcional
- [ ] URLs principales accesibles
- [ ] Socket.io funcionando
- [ ] WhatsApp Bot conectado
- [ ] Logs monitoreables

## 🎉 ¡Despliegue Completado!

Una vez completados todos los pasos, tu plataforma MiBarberiaWeb estará:

- 🌐 **Accesible**: https://mibarberiaweb.com
- 🔒 **Segura**: Certificado SSL válido, sin advertencias
- 🚀 **Optimizada**: Configuración de producción
- 📊 **Monitoreada**: Logs y métricas disponibles
- 🔄 **Resiliente**: Reinicio automático en caso de fallas

**¡Tu barbería ya está en línea con tecnología de clase mundial!** 💈✨