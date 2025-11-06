#!/bin/bash

echo "🔐 Configuración de SSL con Let's Encrypt para mibarberiaweb.com"
echo "=============================================================="
echo ""

# Verificar si certbot está instalado
if ! command -v certbot &> /dev/null; then
    echo "📦 Instalando Certbot..."
    if [ -f /etc/debian_version ]; then
        # Ubuntu/Debian
        sudo apt update
        sudo apt install -y certbot python3-certbot-nginx
    elif [ -f /etc/redhat-release ]; then
        # CentOS/RHEL
        sudo yum install -y certbot python3-certbot-nginx
    else
        echo "❌ Sistema operativo no soportado. Instala certbot manualmente."
        exit 1
    fi
fi

echo ""
echo "🌐 Configurando certificado SSL para mibarberiaweb.com"
echo ""

# Detener el servidor si está corriendo
echo "⏹️  Deteniendo servidor temporalmente..."
sudo pkill -f "node server.js" 2>/dev/null || true

# Generar certificado con certbot
echo "📋 Generando certificado SSL con Let's Encrypt..."
echo ""
echo "⚠️  IMPORTANTE: Asegúrate de que:"
echo "   - El dominio mibarberiaweb.com apunta a esta IP"
echo "   - Los puertos 80 y 443 estén disponibles"
echo "   - No hay otros servicios web corriendo"
echo ""

read -p "¿Continuar? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Generar certificado
    sudo certbot certonly --standalone \
        --email admin@mibarberiaweb.com \
        --agree-tos \
        --no-eff-email \
        -d mibarberiaweb.com \
        -d www.mibarberiaweb.com

    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Certificado SSL generado exitosamente!"
        echo ""
        
        # Copiar certificados a nuestro directorio
        echo "📁 Copiando certificados al proyecto..."
        sudo cp /etc/letsencrypt/live/mibarberiaweb.com/privkey.pem /root/TU/ssl/mibarberiaweb.key
        sudo cp /etc/letsencrypt/live/mibarberiaweb.com/fullchain.pem /root/TU/ssl/mibarberiaweb.crt
        
        # Cambiar permisos
        sudo chown root:root /root/TU/ssl/mibarberiaweb.*
        sudo chmod 600 /root/TU/ssl/mibarberiaweb.key
        sudo chmod 644 /root/TU/ssl/mibarberiaweb.crt
        
        echo "✅ Certificados copiados y permisos configurados"
        echo ""
        
        # Configurar renovación automática
        echo "🔄 Configurando renovación automática..."
        (sudo crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet --deploy-hook 'systemctl restart barbershop'") | sudo crontab -
        
        echo "✅ Renovación automática configurada"
        echo ""
        
        echo "🎉 Configuración completada!"
        echo ""
        echo "📋 Próximos pasos:"
        echo "1. Configura NODE_ENV=production en tu .env"
        echo "2. Reinicia el servidor: node server.js"
        echo "3. Tu sitio estará disponible en: https://mibarberiaweb.com"
        echo ""
        echo "⏰ El certificado se renovará automáticamente cada 90 días"
        
    else
        echo "❌ Error generando el certificado SSL"
        echo ""
        echo "🔍 Posibles causas:"
        echo "- El dominio no apunta a esta IP"
        echo "- Los puertos 80/443 no están disponibles"
        echo "- Problema de conectividad"
        echo ""
        echo "📞 Contacta al proveedor de dominio para verificar la configuración DNS"
    fi
else
    echo "⏹️  Operación cancelada"
fi

echo ""
echo "📖 Para más información: https://certbot.eff.org/"