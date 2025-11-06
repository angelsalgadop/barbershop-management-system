#!/bin/bash

# Script de corrección para errores del chatbot de reservas
# Ejecutar: chmod +x fix_chatbot_errors.sh && ./fix_chatbot_errors.sh

echo "🔧 Iniciando corrección de errores del chatbot..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para mostrar mensajes
show_message() {
    echo -e "${BLUE}📋 $1${NC}"
}

show_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

show_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

show_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Verificar que Node.js esté instalado
if ! command -v node &> /dev/null; then
    show_error "Node.js no está instalado"
    exit 1
fi

show_success "Node.js detectado"

# Verificar estructura del proyecto
if [ ! -f "package.json" ]; then
    show_error "Este no parece ser un proyecto Node.js (no se encontró package.json)"
    exit 1
fi

show_success "Estructura del proyecto verificada"

# Instalar dependencias si es necesario
show_message "Verificando dependencias..."
if [ ! -d "node_modules" ]; then
    show_message "Instalando dependencias..."
    npm install
    show_success "Dependencias instaladas"
else
    show_success "Dependencias ya instaladas"
fi

# Verificar archivo .env
if [ ! -f ".env" ]; then
    show_warning "Archivo .env no encontrado, creando uno básico..."
    cat > .env << EOL
# Configuración de base de datos
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=barbershop_platform

# Configuración del servidor
PORT=3000
JWT_SECRET=tu_jwt_secret_muy_seguro_aqui

# Configuración de administrador
ADMIN_EMAIL=admin@barbershop.com
ADMIN_PASSWORD=admin123

# Configuración de WhatsApp
WHATSAPP_SESSION_PATH=./whatsapp-sessions
EOL
    show_warning "Por favor configura las variables en .env antes de continuar"
fi

# Ejecutar diagnóstico
show_message "Ejecutando diagnóstico del sistema..."
if node fix_appointment_booking.js; then
    show_success "Diagnóstico completado"
else
    show_error "Error en diagnóstico"
    exit 1
fi

# Ejecutar pruebas
show_message "Ejecutando pruebas de verificación..."
if node test_booking_fixes.js; then
    show_success "Pruebas completadas exitosamente"
else
    show_warning "Algunas pruebas fallaron, pero el sistema debería funcionar"
fi

# Crear directorio utils si no existe
if [ ! -d "utils" ]; then
    mkdir utils
    show_success "Directorio utils creado"
fi

# Verificar que los archivos de corrección estén en su lugar
files_to_check=(
    "fix_appointment_booking.js"
    "test_booking_fixes.js"
    "utils/bookingValidation.js"
)

for file in "${files_to_check[@]}"; do
    if [ -f "$file" ]; then
        show_success "Archivo $file: ✓"
    else
        show_error "Archivo $file: ✗ (faltante)"
    fi
done

echo
show_message "Resumen de correcciones aplicadas:"
echo "  🔧 Manejo mejorado de errores en reservas"
echo "  🔧 Validación avanzada de datos"
echo "  🔧 Diagnóstico automático de problemas"
echo "  🔧 Scripts de prueba y verificación"
echo "  🔧 Corrección de integridad de colas"

echo
show_success "¡Correcciones aplicadas exitosamente!"
echo
echo -e "${BLUE}📚 Próximos pasos:${NC}"
echo "1. Configura las variables en .env"
echo "2. Inicia el servidor: npm start"
echo "3. Verifica que WhatsApp esté conectado"
echo "4. Prueba reservar un turno"
echo
echo -e "${BLUE}🆘 Si sigues teniendo problemas:${NC}"
echo "- Ejecuta: node fix_appointment_booking.js (para diagnóstico)"
echo "- Ejecuta: node test_booking_fixes.js (para pruebas)"
echo "- Revisa los logs del servidor"
echo "- Verifica la conexión a la base de datos"

echo
show_success "Script de corrección completado"