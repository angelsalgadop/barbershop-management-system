#!/bin/bash

# Script de monitoreo de recursos de WhatsApp
# Muestra en tiempo real el uso de recursos por las instancias de WhatsApp

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     MONITOR DE RECURSOS - WHATSAPP                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Función para obtener métricas
get_metrics() {
    # Memoria total del sistema
    MEM_TOTAL=$(free -h | grep "Mem:" | awk '{print $2}')
    MEM_USED=$(free -h | grep "Mem:" | awk '{print $3}')
    MEM_FREE=$(free -h | grep "Mem:" | awk '{print $4}')
    MEM_AVAILABLE=$(free -h | grep "Mem:" | awk '{print $7}')

    # CPU
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)

    # Procesos de Chromium
    CHROMIUM_PROCESSES=$(ps aux | grep chromium | grep -v grep | wc -l)

    # Memoria de Chromium
    CHROMIUM_MEM_MB=$(ps aux | grep chromium | grep -v grep | awk '{sum+=$6} END {print sum/1024}')

    # Sesiones activas
    ACTIVE_SESSIONS=$(ps aux | grep chromium | grep -v grep | grep -o "session-barbershop_[0-9]*" | sort -u | wc -l)

    # Sesiones en disco
    SESSIONS_ON_DISK=$(ls -1 /root/TU/whatsapp-sessions/ 2>/dev/null | wc -l)

    # Node.js
    NODE_MEM_MB=$(ps aux | grep "node server.js" | grep -v grep | awk '{print $6/1024}' | head -1)

    # PM2 status
    PM2_STATUS=$(pm2 jlist 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    PM2_RESTARTS=$(pm2 jlist 2>/dev/null | grep -o '"restart_time":[0-9]*' | head -1 | cut -d':' -f2)

    echo "═══════════════════════════════════════════════════════════"
    echo "FECHA: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    echo "📊 SISTEMA"
    echo "  CPU: ${CPU_USAGE}%"
    echo "  RAM: ${MEM_USED} / ${MEM_TOTAL} (Disponible: ${MEM_AVAILABLE})"
    echo ""

    echo "💬 WHATSAPP"
    echo "  Sesiones Activas: ${ACTIVE_SESSIONS}"
    echo "  Sesiones en Disco: ${SESSIONS_ON_DISK}"
    echo "  Procesos Chromium: ${CHROMIUM_PROCESSES}"
    echo "  Memoria Chromium: ${CHROMIUM_MEM_MB} MB"

    if [ ${ACTIVE_SESSIONS} -gt 0 ]; then
        AVG_MEM=$(echo "scale=2; ${CHROMIUM_MEM_MB} / ${ACTIVE_SESSIONS}" | bc)
        echo "  Promedio por Sesión: ${AVG_MEM} MB"
    fi
    echo ""

    echo "🚀 NODE.JS"
    echo "  Memoria: ${NODE_MEM_MB} MB"
    echo "  PM2 Status: ${PM2_STATUS}"
    echo "  PM2 Restarts: ${PM2_RESTARTS}"
    echo ""

    # Capacidad estimada
    if [ ${ACTIVE_SESSIONS} -gt 0 ]; then
        MEM_AVAILABLE_MB=$(echo ${MEM_AVAILABLE} | sed 's/Gi//' | awk '{print $1*1024}')
        AVG_MEM=$(echo "scale=2; ${CHROMIUM_MEM_MB} / ${ACTIVE_SESSIONS}" | bc)
        MAX_ADDITIONAL=$(echo "scale=0; ${MEM_AVAILABLE_MB} / ${AVG_MEM}" | bc)
        MAX_TOTAL=$(echo "${MAX_ADDITIONAL} + ${ACTIVE_SESSIONS}" | bc)

        echo "📈 CAPACIDAD ESTIMADA"
        echo "  Barberías adicionales posibles: ~${MAX_ADDITIONAL}"
        echo "  Capacidad máxima total: ~${MAX_TOTAL}"
        echo ""
    fi

    # Alertas
    MEM_PERCENT=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
    MEM_PERCENT_INT=$(echo ${MEM_PERCENT} | cut -d'.' -f1)

    echo "⚠️  ALERTAS"
    if [ ${MEM_PERCENT_INT} -gt 85 ]; then
        echo "  [CRÍTICO] Uso de memoria alto: ${MEM_PERCENT_INT}%"
    elif [ ${MEM_PERCENT_INT} -gt 70 ]; then
        echo "  [ADVERTENCIA] Uso de memoria elevado: ${MEM_PERCENT_INT}%"
    else
        echo "  [OK] Uso de memoria normal: ${MEM_PERCENT_INT}%"
    fi

    if [ ${PM2_RESTARTS} -gt 5 ]; then
        echo "  [ADVERTENCIA] Muchos reinicios de PM2: ${PM2_RESTARTS}"
    fi

    if [ ${SESSIONS_ON_DISK} -gt ${ACTIVE_SESSIONS} ]; then
        ORPHAN_SESSIONS=$(echo "${SESSIONS_ON_DISK} - ${ACTIVE_SESSIONS}" | bc)
        echo "  [INFO] Sesiones huérfanas detectadas: ${ORPHAN_SESSIONS}"
    fi

    echo ""
    echo "═══════════════════════════════════════════════════════════"
}

# Si se pasa argumento "watch", monitorear continuamente
if [ "$1" == "watch" ]; then
    INTERVAL=${2:-5}
    echo "Modo monitoreo continuo (intervalo: ${INTERVAL}s)"
    echo "Presiona Ctrl+C para detener"
    echo ""

    while true; do
        clear
        get_metrics
        sleep ${INTERVAL}
    done
else
    # Una sola ejecución
    get_metrics
fi
