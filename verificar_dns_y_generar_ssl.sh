#!/bin/bash

echo "🔍 Verificando DNS y generando certificado SSL"
echo "=============================================="
echo ""

# Verificar que no haya registro AAAA
echo "📡 Esperando a que el DNS se actualice..."
echo ""

MAX_ATTEMPTS=60
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    AAAA_RECORD=$(dig +short mibarberiaweb.com AAAA)

    if [ -z "$AAAA_RECORD" ]; then
        echo "✅ DNS actualizado correctamente (sin IPv6)"
        break
    else
        ATTEMPT=$((ATTEMPT + 1))
        echo "⏳ Intento $ATTEMPT/$MAX_ATTEMPTS - Aún hay registro AAAA: $AAAA_RECORD"
        echo "   Esperando 10 segundos..."
        sleep 10
    fi
done

if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo "❌ Tiempo de espera agotado. El DNS aún tiene registro AAAA."
    echo "   Por favor, verifica que eliminaste el registro en tu proveedor."
    exit 1
fi

echo ""
echo "🔐 Generando certificado SSL..."
echo ""

# Detener servicios
sudo pkill -f "node server.js" 2>/dev/null || true
sleep 2

# Generar certificado
sudo certbot certonly \
    --webroot \
    -w /var/www/html \
    -d mibarberiaweb.com \
    -d www.mibarberiaweb.com \
    --non-interactive \
    --agree-tos \
    --email admin@mibarberiaweb.com

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Certificado generado exitosamente!"
    echo ""

    # Copiar certificados
    echo "📁 Copiando certificados al proyecto..."
    sudo cp /etc/letsencrypt/live/mibarberiaweb.com/privkey.pem /root/TU/ssl/mibarberiaweb.key
    sudo cp /etc/letsencrypt/live/mibarberiaweb.com/fullchain.pem /root/TU/ssl/mibarberiaweb.crt
    sudo chmod 600 /root/TU/ssl/mibarberiaweb.key
    sudo chmod 644 /root/TU/ssl/mibarberiaweb.crt

    echo "✅ Certificados copiados"
    echo ""

    # Actualizar server.js para production
    cd /root/TU
    if ! grep -q "NODE_ENV=production" .env; then
        echo "NODE_ENV=production" >> .env
    fi

    # Reiniciar aplicación
    echo "🔄 Reiniciando aplicación con certificados válidos..."
    NODE_ENV=production /usr/bin/node server.js > /dev/null 2>&1 &

    sleep 3

    echo ""
    echo "🎉 ¡PROCESO COMPLETADO!"
    echo ""
    echo "✅ Tu sitio ahora tiene un certificado SSL válido"
    echo "🌐 Accede a: https://mibarberiaweb.com"
    echo ""
    echo "🔒 El candado de seguridad ahora aparecerá verde"
    echo ""

    # Configurar renovación automática
    echo "⏰ Configurando renovación automática..."
    CRON_CMD="0 3 * * * /usr/bin/certbot renew --quiet --post-hook 'systemctl restart apache2 && pkill -f \"node server.js\" && cd /root/TU && NODE_ENV=production /usr/bin/node server.js &'"
    (sudo crontab -l 2>/dev/null | grep -v "certbot renew"; echo "$CRON_CMD") | sudo crontab -
    echo "✅ Renovación automática configurada (diariamente a las 3 AM)"

else
    echo ""
    echo "❌ Error generando el certificado"
    echo ""
    echo "📋 Verifica los logs: sudo cat /var/log/letsencrypt/letsencrypt.log"
    echo ""

    # Reiniciar aplicación
    cd /root/TU
    NODE_ENV=production /usr/bin/node server.js > /dev/null 2>&1 &
fi
