# 🚀 Barbershop Platform - Servicio Systemd

## ✅ **CONFIGURACIÓN COMPLETADA**

Tu aplicación Barbershop Platform ahora está configurada como un servicio systemd que:

- ✅ **Se inicia automáticamente** al reiniciar el servidor
- ✅ **Se reinicia automáticamente** si ocurre algún error  
- ✅ **Monitoreo continuo** cada 5 minutos
- ✅ **Logs organizados** y rotación automática

## 📋 **Comandos para Administrar el Servicio**

### **Estado del Servicio**
```bash
# Ver estado actual
systemctl status barbershop.service

# Ver si está habilitado para inicio automático
systemctl is-enabled barbershop.service

# Ver si está activo
systemctl is-active barbershop.service
```

### **Controlar el Servicio**
```bash
# Iniciar el servicio
sudo systemctl start barbershop.service

# Detener el servicio
sudo systemctl stop barbershop.service

# Reiniciar el servicio
sudo systemctl restart barbershop.service

# Recargar configuración (sin detener)
sudo systemctl reload barbershop.service

# Habilitar inicio automático
sudo systemctl enable barbershop.service

# Deshabilitar inicio automático
sudo systemctl disable barbershop.service
```

### **Ver Logs**
```bash
# Ver logs en tiempo real
journalctl -u barbershop.service -f

# Ver logs desde hoy
journalctl -u barbershop.service --since today

# Ver últimas 100 líneas
journalctl -u barbershop.service -n 100

# Ver logs de errores
journalctl -u barbershop.service -p err

# Ver logs del archivo específico
tail -f /var/log/barbershop.log

# Ver logs de monitoreo
tail -f /var/log/barbershop_monitor.log
```

### **Información del Servicio**
```bash
# Ver configuración del servicio
systemctl cat barbershop.service

# Ver dependencias
systemctl list-dependencies barbershop.service

# Ver procesos relacionados
systemctl status barbershop.service -l --no-pager
```

## 🔧 **Archivos de Configuración**

- **Servicio:** `/etc/systemd/system/barbershop.service`
- **Logs:** `/var/log/barbershop.log`
- **Monitor:** `/root/TU/scripts/check_barbershop.sh`
- **Cron:** `/etc/cron.d/barbershop-monitor`

## 🌐 **Acceso a la Aplicación**

- **Panel Admin:** http://localhost:3000/admin
- **Panel Barbería:** http://localhost:3000/barbershop  
- **Panel Barbero:** http://localhost:3000/barber
- **API Base:** http://localhost:3000

## 🔍 **Solución de Problemas**

### **Si el servicio no inicia:**
```bash
# Ver logs de error detallados
journalctl -u barbershop.service -n 50 --no-pager

# Verificar configuración
systemctl daemon-reload
systemctl restart barbershop.service
```

### **Si hay problemas de permisos:**
```bash
# Verificar permisos del directorio
ls -la /root/TU/
chown -R root:root /root/TU/
chmod +x /root/TU/server.js
```

### **Si MySQL no está disponible:**
```bash
systemctl status mysql.service
systemctl start mysql.service
```

## 🎯 **Monitoreo Automático**

El sistema incluye monitoreo automático que:
- Verifica cada 5 minutos que el servicio esté activo
- Reinicia automáticamente si detecta problemas
- Verifica que el servidor HTTP responda
- Registra todos los eventos en `/var/log/barbershop_monitor.log`

## ⚡ **Comandos Rápidos**

```bash
# Ver estado rápido
systemctl is-active barbershop.service

# Reinicio rápido
sudo systemctl restart barbershop.service

# Ver últimos logs
journalctl -u barbershop.service --since "10 minutes ago"

# Probar conectividad
curl -I http://localhost:3000
```

## 🆘 **En Caso de Emergencia**

Si necesitas detener completamente el servicio:
```bash
sudo systemctl stop barbershop.service
sudo systemctl disable barbershop.service
```

Para volver a habilitarlo:
```bash
sudo systemctl enable barbershop.service
sudo systemctl start barbershop.service
```

---

**🎉 ¡Tu servicio está listo y funcionando automáticamente!**