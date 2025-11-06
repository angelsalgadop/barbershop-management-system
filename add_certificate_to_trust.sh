#!/bin/bash

echo "🔐 Script para agregar certificado SSL como confiable"
echo "=================================================="
echo ""

# Para sistemas Ubuntu/Debian
if command -v update-ca-certificates &> /dev/null; then
    echo "📋 Instrucciones para Ubuntu/Debian:"
    echo "1. Copia el certificado al directorio de certificados del sistema:"
    echo "   sudo cp /root/TU/ssl/cert.pem /usr/local/share/ca-certificates/barbershop.crt"
    echo ""
    echo "2. Actualiza los certificados del sistema:"
    echo "   sudo update-ca-certificates"
    echo ""
fi

# Para sistemas CentOS/RHEL
if command -v update-ca-trust &> /dev/null; then
    echo "📋 Instrucciones para CentOS/RHEL:"
    echo "1. Copia el certificado al directorio de certificados del sistema:"
    echo "   sudo cp /root/TU/ssl/cert.pem /etc/pki/ca-trust/source/anchors/barbershop.crt"
    echo ""
    echo "2. Actualiza los certificados del sistema:"
    echo "   sudo update-ca-trust"
    echo ""
fi

echo "🌐 Para navegadores (alternativa manual):"
echo "1. Abre Chrome y ve a chrome://settings/certificates"
echo "2. Pestaña 'Autoridades' -> 'Importar'"
echo "3. Selecciona /root/TU/ssl/cert.pem"
echo "4. Marca 'Confiar en este certificado para identificar sitios web'"
echo ""

echo "⚠️  IMPORTANTE: Esto es solo para desarrollo local."
echo "   En producción, usa certificados de una CA reconocida."
echo ""

echo "🎯 Una vez aplicado, ya no verás advertencias de seguridad."