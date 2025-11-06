# 🚀 Inicio Rápido - 5 Minutos

## Paso 1: Instalar Dependencias (1 min)

```bash
cd /root/TU/mobile-app
npm install
```

## Paso 2: Configurar URL del Servidor (1 min)

### Para Emulador Android:
Ya está configurado por defecto en `src/config/api.js`:
```javascript
BASE_URL: 'http://10.0.2.2:80'
```

### Para Dispositivo Físico:
1. Obtén tu IP local:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Windows
   ipconfig
   ```

2. Edita `src/config/api.js`:
   ```javascript
   BASE_URL: 'http://TU_IP:80'  // Ejemplo: http://192.168.1.100:80
   ```

## Paso 3: Asegurar que el Servidor Backend está Corriendo (1 min)

```bash
# En otra terminal, desde /root/TU (NO desde mobile-app)
cd /root/TU
npm start
```

Deberías ver algo como:
```
Servidor corriendo en puerto 80
```

## Paso 4: Ejecutar la App (2 min)

### Opción A: Emulador Android

```bash
# En /root/TU/mobile-app
npm run android
```

### Opción B: Dispositivo Android Físico

1. Habilita "Depuración USB" en tu dispositivo Android:
   - Ajustes > Acerca del teléfono
   - Toca "Número de compilación" 7 veces
   - Vuelve a Ajustes > Opciones de desarrollador
   - Activa "Depuración USB"

2. Conecta el dispositivo por USB

3. Verifica la conexión:
   ```bash
   adb devices
   ```

4. Ejecuta:
   ```bash
   npm run android
   ```

### Opción C: iOS (solo macOS)

```bash
# Primero instala los pods
cd ios
pod install
cd ..

# Ejecuta la app
npm run ios
```

## ✅ Verificar que Funciona

1. La app se abrirá mostrando la pantalla de login
2. Selecciona el tipo de usuario (Admin/Barbería/Barbero)
3. Ingresa credenciales de prueba:
   - **Admin**: admin@barbershop.com / admin123
   - **Barbería**: Tu cuenta registrada
   - **Barbero**: Credenciales proporcionadas por la barbería

4. Si inicia sesión correctamente, ¡todo está funcionando!

## 🐛 Problemas Comunes

### Error: "Unable to connect to development server"
```bash
# Solución: Reinicia Metro Bundler
npm start -- --reset-cache
```

### Error: "Network request failed"
1. Verifica que el servidor backend esté corriendo
2. Verifica la IP en `src/config/api.js`
3. Para emulador Android, usa `10.0.2.2` en lugar de `localhost`
4. Para dispositivo físico, asegúrate de estar en la misma red WiFi

### Error: No se puede instalar en el dispositivo
```bash
# Limpia el proyecto
cd android
./gradlew clean
cd ..
npm run android
```

### La app se cierra inmediatamente
```bash
# Ver logs para identificar el error
npx react-native log-android
```

## 📱 Próximos Pasos

1. **Explorar la app**: Navega por las diferentes pantallas
2. **Probar funcionalidades**:
   - Como Barbero: Ver cola de turnos en tiempo real
   - Como Barbería: Administrar tu negocio
   - Como Admin: Gestionar barberías
3. **Personalizar**: Modifica colores, textos y funcionalidades según tus necesidades

## 📚 Documentación Completa

- `README.md` - Documentación completa del proyecto
- `CONFIGURACION.md` - Guía detallada de configuración
- Código fuente comentado en `/src`

## 🆘 ¿Necesitas Ayuda?

1. Revisa los logs: `npx react-native log-android` o `npx react-native log-ios`
2. Verifica que el servidor backend esté corriendo
3. Consulta `CONFIGURACION.md` para configuración avanzada

---

**¡Listo para empezar!** 🎉
