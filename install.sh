#!/bin/bash

# Script de instalación para Plataforma de Gestión de Barberías
# Autor: Claude AI
# Fecha: 2025

set -e

echo "🚀 Instalando Plataforma de Gestión de Barberías..."
echo "=================================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # Sin color

# Función para imprimir mensajes coloreados
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Verificar sistema operativo
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    print_error "Sistema operativo no soportado: $OSTYPE"
    exit 1
fi

print_info "Sistema detectado: $OS"

# Verificar Node.js
check_nodejs() {
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_status "Node.js encontrado: $NODE_VERSION"
        
        # Verificar versión mínima (v16)
        NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$NODE_MAJOR" -lt 16 ]; then
            print_error "Node.js versión 16 o superior requerida. Versión actual: $NODE_VERSION"
            exit 1
        fi
    else
        print_error "Node.js no encontrado. Por favor instala Node.js 16 o superior."
        print_info "Visita: https://nodejs.org/"
        exit 1
    fi
}

# Verificar npm
check_npm() {
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_status "npm encontrado: $NPM_VERSION"
    else
        print_error "npm no encontrado. Instala npm junto con Node.js."
        exit 1
    fi
}

# Verificar MySQL
check_mysql() {
    if command -v mysql &> /dev/null; then
        MYSQL_VERSION=$(mysql --version)
        print_status "MySQL encontrado: $MYSQL_VERSION"
    else
        print_warning "MySQL no encontrado en PATH"
        print_info "Asegúrate de tener MySQL 8.0+ instalado y configurado"
        
        read -p "¿Continuar sin verificar MySQL? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Verificar Chrome/Chromium para WhatsApp
check_chrome() {
    if command -v google-chrome &> /dev/null || command -v chromium-browser &> /dev/null || command -v chromium &> /dev/null; then
        print_status "Navegador Chrome/Chromium encontrado"
    else
        print_warning "Chrome/Chromium no encontrado"
        print_info "Chrome/Chromium es necesario para la funcionalidad de WhatsApp"
        
        if [ "$OS" == "linux" ]; then
            print_info "Instalar con: sudo apt update && sudo apt install -y chromium-browser"
        elif [ "$OS" == "macos" ]; then
            print_info "Instalar Chrome desde: https://www.google.com/chrome/"
        fi
        
        read -p "¿Continuar sin Chrome/Chromium? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Instalar dependencias npm
install_dependencies() {
    print_info "Instalando dependencias de Node.js..."
    if npm install; then
        print_status "Dependencias instaladas correctamente"
    else
        print_error "Error instalando dependencias"
        exit 1
    fi
}

# Configurar variables de entorno
setup_env() {
    print_info "Configurando variables de entorno..."
    
    if [ ! -f .env ]; then
        cp .env.example .env
        print_status "Archivo .env creado desde .env.example"
        
        print_warning "IMPORTANTE: Edita el archivo .env con tus configuraciones:"
        print_info "- Configuración de base de datos MySQL"
        print_info "- Cambiar JWT_SECRET por una clave segura"
        print_info "- Configurar credenciales de administrador"
        
        read -p "¿Abrir .env para editar ahora? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if command -v nano &> /dev/null; then
                nano .env
            elif command -v vim &> /dev/null; then
                vim .env
            elif command -v code &> /dev/null; then
                code .env
            else
                print_info "Edita manualmente el archivo .env"
            fi
        fi
    else
        print_status "Archivo .env ya existe"
    fi
}

# Crear directorios necesarios
create_directories() {
    print_info "Creando directorios necesarios..."
    
    mkdir -p whatsapp-sessions
    mkdir -p logs
    
    print_status "Directorios creados"
}

# Configurar base de datos
setup_database() {
    print_info "Configuración de base de datos MySQL..."
    print_warning "Asegúrate de que MySQL esté ejecutándose"
    
    # Leer configuración del archivo .env
    if [ -f .env ]; then
        DB_NAME=$(grep "^DB_NAME=" .env | cut -d'=' -f2)
        DB_USER=$(grep "^DB_USER=" .env | cut -d'=' -f2)
        DB_PASSWORD=$(grep "^DB_PASSWORD=" .env | cut -d'=' -f2)
        
        print_info "Base de datos configurada: $DB_NAME"
        print_info "Usuario: $DB_USER"
        
        print_warning "Asegúrate de crear la base de datos y usuario MySQL manualmente:"
        echo
        echo "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
        echo "CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';"
        echo "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
        echo "FLUSH PRIVILEGES;"
        echo
    fi
}

# Verificar permisos para puerto 80
check_port_permissions() {
    print_info "Verificando permisos para puerto 80..."
    
    if [ "$EUID" -eq 0 ]; then
        print_status "Ejecutándose como root - puerto 80 disponible"
    else
        print_warning "No ejecutándose como root"
        print_info "Para usar puerto 80, puedes:"
        print_info "1. Ejecutar con sudo: sudo npm start"
        print_info "2. Cambiar puerto en .env: PORT=3000"
        print_info "3. Usar authbind (Linux): authbind --deep npm start"
    fi
}

# Función principal de instalación
main() {
    echo
    print_info "Iniciando verificaciones del sistema..."
    
    check_nodejs
    check_npm
    check_mysql
    check_chrome
    
    echo
    print_info "Configurando proyecto..."
    
    install_dependencies
    setup_env
    create_directories
    setup_database
    check_port_permissions
    
    echo
    print_status "¡Instalación completada!"
    echo
    print_info "Pasos siguientes:"
    print_info "1. Editar archivo .env con tus configuraciones"
    print_info "2. Configurar base de datos MySQL"
    print_info "3. Ejecutar: npm start"
    print_info "4. Acceder a http://localhost/admin (o el puerto configurado)"
    echo
    print_info "Credenciales por defecto del administrador:"
    print_info "Email: admin@barbershop.com"
    print_info "Contraseña: admin123"
    echo
    print_warning "¡IMPORTANTE: Cambia las credenciales por defecto en producción!"
    echo
    print_info "Para obtener ayuda, consulta el archivo README.md"
    echo
    print_status "¡Disfruta de tu nueva plataforma de gestión de barberías! ✂️"
}

# Ejecutar instalación
main