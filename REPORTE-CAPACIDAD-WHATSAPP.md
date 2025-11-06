# Reporte de Capacidad de WhatsApp
**Fecha:** 2 de Noviembre, 2025
**Servidor:** Ubuntu Linux 6.8.0-86-generic

---

## 📊 Resumen Ejecutivo

**Capacidad Máxima Recomendada: 9-11 barberías simultáneas con WhatsApp activo**

### Factores Limitantes:
1. **Memoria RAM** (Principal limitante)
2. CPU (Secundario)
3. Procesos del sistema

---

## 🖥️ Especificaciones del Servidor

### Hardware:
- **CPU:** 2 cores
- **RAM:** 4.7 GB total
- **Disco:** 97 GB (68 GB libres)

### Software:
- **OS:** Ubuntu Linux
- **Node.js:** Versión activa con PM2
- **WhatsApp:** whatsapp-web.js con Puppeteer
- **Base de datos:** MySQL

---

## 📈 Análisis de Recursos Actuales

### Estado Actual (3 barberías activas con WhatsApp):

| Recurso | Valor |
|---------|-------|
| Memoria Total | 4.7 GB |
| Memoria Usada | 2.0 GB (42%) |
| Memoria Disponible | 2.8 GB |
| Procesos Chromium | 17 (3 instancias principales) |
| Memoria Chromium Total | 1.65 GB |
| CPU Promedio | ~8% |

### Consumo por Barbería:

| Componente | Consumo |
|------------|---------|
| Chromium/Puppeteer | ~235 MB por instancia |
| Procesos asociados | ~5-6 procesos por instancia |
| Node.js (total) | ~105 MB (compartido) |

**Total estimado por barbería:** ~240 MB

---

## 🧪 Resultados de Pruebas de Carga

### Prueba 1: Carga Moderada
**Configuración:**
- 5 barberías simultáneas
- 10 clientes por barbería
- 5 mensajes por cliente
- **Total:** 250 mensajes procesados

**Resultados:**
- ✅ Tiempo total: 21.15 segundos
- ✅ Promedio por mensaje: 78.20 ms
- ✅ CPU promedio: 7.98%
- ✅ Memoria: Sin incremento significativo
- **Estado:** EXITOSO

### Prueba 2: Carga Alta
**Configuración:**
- 10 barberías simultáneas
- 15 clientes por barbería
- 10 mensajes por cliente
- **Total:** 1,500 mensajes procesados

**Resultados:**
- ✅ Tiempo total: 39.11 segundos
- ✅ Promedio por mensaje: 78.90 ms
- ✅ CPU promedio: 7.98%
- ✅ CPU por barbería: 0.80%
- ✅ Memoria: +0.03 GB
- **Estado:** EXITOSO

**Conclusión:** El procesamiento de mensajes del chatbot es muy eficiente y NO es el cuello de botella.

---

## 📊 Cálculos de Capacidad Máxima

### Escenario Conservador (Recomendado):

```
Memoria disponible: 2.8 GB
Memoria por barbería: 0.24 GB
Margen de seguridad: 20%

Capacidad = (2.8 GB * 0.8) / 0.24 GB = 9.3 barberías
```

**Recomendación: 9 barberías simultáneas máximo**

### Escenario Optimista:

```
Memoria disponible: 2.8 GB
Memoria por barbería: 0.24 GB
Sin margen de seguridad

Capacidad = 2.8 GB / 0.24 GB = 11.6 barberías
```

**Límite técnico: 11 barberías simultáneas**

### Consideraciones de CPU:

Con 2 cores disponibles:
- CPU por barbería con carga: ~0.8%
- 11 barberías: ~8.8% CPU total
- Margen amplio disponible

**Conclusión:** CPU NO es limitante, puede soportar fácilmente 11+ barberías.

---

## ⚠️ Factores de Riesgo

### 1. Memoria RAM (CRÍTICO)
- Es el principal limitante
- Con 11 barberías se usaría ~4.6 GB de ~4.7 GB disponibles
- Riesgo de swap y degradación de rendimiento
- **Recomendación:** No exceder 9 barberías sin aumentar RAM

### 2. Sesiones Huérfanas
- Actualmente hay 7 carpetas de sesión pero solo 3 activas
- Las sesiones antiguas ocupan espacio en disco (no crítico)
- **Recomendación:** Implementar limpieza automática de sesiones antiguas

### 3. Procesos de Chromium
- Cada instancia crea 5-6 procesos hijo
- 11 barberías = ~60-70 procesos de Chromium
- Límite de procesos del sistema puede ser alcanzado
- **Recomendación:** Verificar límites con `ulimit -u`

### 4. Reconexiones Simultáneas
- Si múltiples barberías pierden conexión y reconectan simultáneamente
- Puede causar pico temporal de uso de recursos
- **Recomendación:** Implementar cola de reconexión escalonada

---

## 🎯 Recomendaciones

### Inmediatas:

1. **Límite Operacional:** Configurar máximo de 9 barberías con WhatsApp simultáneas
2. **Monitoreo:** Implementar alertas cuando memoria > 85%
3. **Limpieza:** Eliminar sesiones huérfanas de `/root/TU/whatsapp-sessions/`

### A Corto Plazo:

1. **Upgrade de RAM:** Aumentar a 8 GB para soportar 20+ barberías
2. **Optimización:**
   - Implementar limpieza automática de sesiones
   - Añadir reinicio programado de instancias Chromium (reducir memory leaks)
   - Implementar cola de reconexión escalonada

3. **Monitoreo Avanzado:**
   - Dashboard de uso de recursos por barbería
   - Alertas automáticas de alto consumo
   - Logs de rendimiento

### A Largo Plazo:

1. **Escalabilidad Horizontal:**
   - Distribuir barberías en múltiples servidores
   - Load balancer para distribución de carga
   - Servidor dedicado para WhatsApp

2. **Optimización de Puppeteer:**
   - Considerar alternativas más ligeras (baileys, venom-bot)
   - Implementar pool de instancias compartidas
   - Configurar límites de memoria por instancia

---

## 📝 Comandos de Monitoreo

### Verificar memoria actual:
```bash
free -h
```

### Ver procesos de Chromium:
```bash
ps aux | grep chromium | grep -v grep | wc -l
```

### Memoria usada por Chromium:
```bash
ps aux | grep chromium | grep -v grep | awk '{sum+=$6} END {print sum/1024 " MB"}'
```

### Sesiones activas:
```bash
ls -1 /root/TU/whatsapp-sessions/
```

### Estado de PM2:
```bash
pm2 status
pm2 monit
```

### Ejecutar prueba de capacidad:
```bash
# Sintaxis: node test-whatsapp-capacity.js [barberías] [clientes] [mensajes]
node test-whatsapp-capacity.js 10 15 10
```

---

## 📞 Plan de Acción por Crecimiento

| Barberías | RAM Necesaria | Acción Requerida |
|-----------|---------------|------------------|
| 1-5 | 2 GB | ✅ OK con recursos actuales |
| 6-9 | 2.5 GB | ✅ OK - Monitoreo recomendado |
| 10-11 | 3 GB | ⚠️ Límite - Requiere monitoreo constante |
| 12-15 | 4 GB | ❌ Upgrade RAM a 8GB requerido |
| 16-20 | 5 GB | ❌ Upgrade RAM a 8GB requerido |
| 21+ | 6+ GB | ❌ Considerar servidor dedicado o distribución |

---

## ✅ Conclusiones

1. **El servidor puede soportar cómodamente 9 barberías simultáneas con WhatsApp activo**
2. **El límite absoluto es 11 barberías**, pero con riesgo de degradación
3. **La memoria RAM es el único cuello de botella real**
4. **El procesamiento de mensajes del chatbot es muy eficiente** (78ms promedio)
5. **CPU tiene amplio margen** - puede soportar 3-4x la carga actual
6. **Upgrade a 8GB RAM permitiría 20+ barberías sin problemas**

### Respuesta a la Pregunta Original:

> **¿Cuántas barberías simultáneas puedo tener con WhatsApp conectado y clientes interactuando con el chatbot?**

**Respuesta:** Con la configuración actual del servidor, puedes tener **9 barberías de forma segura y estable**, o hasta **11 barberías en el límite máximo**. Para más barberías, se requiere un upgrade de RAM a 8GB, lo cual permitiría soportar 20+ barberías cómodamente.

---

**Última actualización:** 2025-11-02
**Script de prueba:** `/root/TU/test-whatsapp-capacity.js`
