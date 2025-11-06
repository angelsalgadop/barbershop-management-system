#!/bin/bash

echo "🚀 Desplegando MiBarberiaWeb en Producción"
echo "=========================================="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "server.js" ]; then
    echo "❌ Error: server.js no encontrado. Ejecuta este script desde el directorio raíz del proyecto."
    exit 1
fi

echo "🔍 Verificando configuración..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Instalando..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "✅ Node.js versión: $(node --version)"

# Verificar dependencias
echo "📦 Instalando dependencias..."
npm install --production

# Verificar certificados SSL
if [ ! -f "ssl/mibarberiaweb.crt" ] || [ ! -f "ssl/mibarberiaweb.key" ]; then
    echo "⚠️  Certificados SSL no encontrados."
    echo "💡 Opciones:"
    echo "   1. Ejecutar ./setup_letsencrypt.sh para certificados gratuitos"
    echo "   2. Copiar manualmente tus certificados SSL a ssl/mibarberiaweb.crt y ssl/mibarberiaweb.key"
    echo ""
    read -p "¿Usar certificados temporales para prueba? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📋 Usando certificados temporales (solo para pruebas)..."
        cp ssl/cert.pem ssl/mibarberiaweb.crt 2>/dev/null || true
        cp ssl/key.pem ssl/mibarberiaweb.key 2>/dev/null || true
    else
        echo "❌ Configura los certificados SSL antes de continuar."
        exit 1
    fi
fi

# Configurar variables de entorno para producción
echo "⚙️  Configurando variables de entorno para producción..."

# Backup del .env actual
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Asegurar configuración de producción
sed -i 's/NODE_ENV=development/NODE_ENV=production/g' .env
sed -i 's/PORT=.*/PORT=80/g' .env
sed -i 's/HTTPS_PORT=.*/HTTPS_PORT=443/g' .env

echo "✅ Variables de entorno configuradas"

# Verificar puertos disponibles
echo "🔍 Verificando puertos 80 y 443..."
if sudo lsof -Pi :80 -sTCP:LISTEN -t >/dev/null; then
    echo "⚠️  Puerto 80 está en uso. Deteniendo servicios..."
    sudo systemctl stop apache2 2>/dev/null || true
    sudo systemctl stop nginx 2>/dev/null || true
fi

if sudo lsof -Pi :443 -sTCP:LISTEN -t >/dev/null; then
    echo "⚠️  Puerto 443 está en uso. Deteniendo servicios..."
    sudo systemctl stop apache2 2>/dev/null || true
    sudo systemctl stop nginx 2>/dev/null || true
fi

# Crear servicio systemd
echo "🔧 Creando servicio systemd..."
sudo tee /etc/systemd/system/mibarberiaweb.service > /dev/null <<EOF
[Unit]
Description=MiBarberiaWeb - Plataforma de Gestión de Barberías
After=network.target
StartLimitIntervalSec=0

[Service]
Type=simple
Restart=always
RestartSec=1
User=root
WorkingDirectory=/root/TU
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Servicio systemd creado"

# Habilitar y configurar servicio
sudo systemctl daemon-reload
sudo systemctl enable mibarberiaweb

echo "🔥 Configurando firewall..."
# Configurar firewall (si está activo)
if sudo ufw status | grep -q "Status: active"; then
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    echo "✅ Firewall configurado (puertos 80 y 443 abiertos)"
fi

# Iniciar servicio
echo "🚀 Iniciando MiBarberiaWeb..."
sudo systemctl start mibarberiaweb

# Verificar estado
sleep 3
if sudo systemctl is-active --quiet mibarberiaweb; then
    echo "✅ MiBarberiaWeb iniciado correctamente"
    echo ""
    echo "🌐 URLs disponibles:"
    echo "   https://mibarberiaweb.com"
    echo "   https://mibarberiaweb.com/admin"
    echo "   https://mibarberiaweb.com/barbershop"
    echo "   https://mibarberiaweb.com/barber"
    echo ""
    echo "📊 Para monitorear el servicio:"
    echo "   sudo systemctl status mibarberiaweb"
    echo "   sudo journalctl -u mibarberiaweb -f"
    echo ""
    echo "🔄 Para reiniciar el servicio:"
    echo "   sudo systemctl restart mibarberiaweb"
    echo ""
    echo "🎉 ¡Despliegue completado exitosamente!"
else
    echo "❌ Error iniciando el servicio"
    echo "🔍 Revisar logs: sudo journalctl -u mibarberiaweb"
fi

echo ""
echo "📋 Comandos útiles:"
echo "   Estado del servicio: sudo systemctl status mibarberiaweb"
echo "   Ver logs en tiempo real: sudo journalctl -u mibarberiaweb -f"
echo "   Reiniciar servicio: sudo systemctl restart mibarberiaweb"
echo "   Detener servicio: sudo systemctl stop mibarberiaweb"