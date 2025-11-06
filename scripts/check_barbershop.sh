#!/bin/bash

# Script de monitoreo para Barbershop Platform
# Verifica que el servicio esté funcionando correctamente

LOG_FILE="/var/log/barbershop_monitor.log"
SERVICE_NAME="barbershop.service"
APP_URL="http://localhost:3000"

# Función para escribir logs
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> $LOG_FILE
}

# Verificar si el servicio está activo
if ! systemctl is-active --quiet $SERVICE_NAME; then
    log_message "ERROR: Servicio $SERVICE_NAME no está activo. Intentando reiniciar..."
    systemctl restart $SERVICE_NAME
    sleep 10
    
    if systemctl is-active --quiet $SERVICE_NAME; then
        log_message "SUCCESS: Servicio $SERVICE_NAME reiniciado correctamente"
    else
        log_message "CRITICAL: No se pudo reiniciar el servicio $SERVICE_NAME"
        exit 1
    fi
fi

# Verificar si el servidor responde HTTP
if ! curl -s --max-time 10 $APP_URL > /dev/null; then
    log_message "ERROR: Servidor no responde en $APP_URL. Reiniciando servicio..."
    systemctl restart $SERVICE_NAME
    sleep 15
    
    if curl -s --max-time 10 $APP_URL > /dev/null; then
        log_message "SUCCESS: Servidor respondiendo después de reinicio"
    else
        log_message "CRITICAL: Servidor no responde después de reinicio"
        exit 1
    fi
fi

# Verificar uso de memoria (opcional)
MEMORY_USAGE=$(ps -o %mem,cmd --no-headers | grep "node server.js" | grep -v grep | awk '{print $1}' | head -1)
if [ ! -z "$MEMORY_USAGE" ] && [ "$MEMORY_USAGE" != "" ]; then
    # Comparación simple para memoria
    MEMORY_INT=$(echo $MEMORY_USAGE | cut -d'.' -f1)
    if [ "$MEMORY_INT" -gt 0 ] && [ "$MEMORY_INT" -gt 80 ]; then
        log_message "WARNING: Alto uso de memoria: ${MEMORY_USAGE}%"
    fi
fi

log_message "INFO: Monitoreo completado - Servicio funcionando correctamente"