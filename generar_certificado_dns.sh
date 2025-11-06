#!/bin/bash

echo "=========================================="
echo "  Generación de Certificado SSL con DNS"
echo "=========================================="
echo ""
echo "IMPORTANTE: Este script requiere que tengas acceso a configurar"
echo "registros DNS en tu proveedor de dominio."
echo ""

# Detener servicios
echo "🔴 Deteniendo servicios..."
sudo pkill -f "node server.js" 2>/dev/null || true
sudo systemctl stop apache2 2>/dev/null || true

echo ""
echo "📋 Iniciando validación DNS..."
echo ""
echo "Certbot te mostrará 2 registros TXT que debes agregar en tu DNS:"
echo "  - Tipo: TXT"
echo "  - Nombre: _acme-challenge"
echo "  - Valor: (el que te muestre Certbot)"
echo ""
echo "Presiona ENTER para continuar..."
read

# Ejecutar certbot en modo manual DNS
sudo certbot certonly \
    --manual \
    --preferred-challenges dns \
    -d mibarberiaweb.com \
    -d www.mibarberiaweb.com \
    --email admin@mibarberiaweb.com \
    --agree-tos

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Certificado generado exitosamente!"
    echo ""
    echo "📁 Copiando certificados al proyecto..."

    # Crear directorio SSL si no existe
    mkdir -p /root/TU/ssl

    # Copiar certificados
    sudo cp /etc/letsencrypt/live/mibarberiaweb.com/privkey.pem /root/TU/ssl/mibarberiaweb.key
    sudo cp /etc/letsencrypt/live/mibarberiaweb.com/fullchain.pem /root/TU/ssl/mibarberiaweb.crt

    # Permisos
    sudo chmod 600 /root/TU/ssl/mibarberiaweb.key
    sudo chmod 644 /root/TU/ssl/mibarberiaweb.crt

    echo "✅ Certificados copiados"
    echo ""
    echo "🔄 Reiniciando aplicación..."

    cd /root/TU
    NODE_ENV=production /usr/bin/node server.js > /dev/null 2>&1 &

    echo ""
    echo "🎉 ¡Proceso completado!"
    echo ""
    echo "Tu sitio ahora tiene un certificado SSL válido de Let's Encrypt"
    echo "Accede a: https://mibarberiaweb.com"
    echo ""
else
    echo ""
    echo "❌ Error generando el certificado"
    echo ""
    echo "Reiniciando servicios..."
    cd /root/TU
    NODE_ENV=production /usr/bin/node server.js > /dev/null 2>&1 &
fi
