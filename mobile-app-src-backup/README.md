# Barbería Manager - Aplicación Móvil

Aplicación móvil nativa para iOS y Android desarrollada con React Native para la plataforma de gestión de barberías.

## 🚀 Características

- **Autenticación por roles**: Admin, Barbería y Barbero
- **Tiempo real**: Integración con Socket.IO para actualizaciones en vivo
- **Panel de Barbero**: Gestión de cola de turnos en tiempo real
- **Panel de Barbería**: Administración completa del negocio
- **Panel de Admin**: Gestión de todas las barberías
- **Navegación intuitiva**: Drawer navigation para fácil acceso
- **Actualización automática**: Sincronización en tiempo real con el servidor

## 📋 Requisitos Previos

### Para Desarrollo

#### macOS (para iOS y Android)
- Node.js 18 o superior
- Xcode 14+ (para iOS)
- CocoaPods (`sudo gem install cocoapods`)
- Android Studio (para Android)
- JDK 11 o superior

#### Windows/Linux (solo Android)
- Node.js 18 o superior
- Android Studio
- JDK 11 o superior

### Configuración de Android Studio
1. Instalar Android Studio
2. Instalar Android SDK (API 33 o superior)
3. Configurar variables de entorno:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

## 📦 Instalación

### 1. Instalar dependencias

```bash
cd mobile-app
npm install
```

### 2. Configurar conexión al servidor

Edita el archivo `src/config/api.js` y configura la URL de tu servidor:

```javascript
export const API_CONFIG = {
  // Para desarrollo con emulador Android:
  BASE_URL: 'http://10.0.2.2:80',

  // Para desarrollo con dispositivo físico (reemplaza con tu IP):
  // BASE_URL: 'http://192.168.1.100:80',

  // Para producción:
  // BASE_URL: 'https://tu-dominio.com',

  SOCKET_URL: 'http://10.0.2.2:80', // Usar la misma URL que BASE_URL
  TIMEOUT: 30000,
};
```

#### Cómo obtener tu IP local:
```bash
# En macOS/Linux:
ifconfig | grep "inet "

# En Windows:
ipconfig

# Busca algo como: 192.168.1.100
```

### 3. Instalar pods de iOS (solo macOS)

```bash
cd ios
pod install
cd ..
```

## 🏃‍♂️ Ejecutar la Aplicación

### Android

#### Emulador
```bash
# Iniciar emulador desde Android Studio o:
emulator -avd Pixel_5_API_33

# En otra terminal:
npm run android
```

#### Dispositivo físico
1. Habilitar "Opciones de desarrollador" en tu dispositivo Android
2. Habilitar "Depuración USB"
3. Conectar el dispositivo por USB
4. Verificar conexión: `adb devices`
5. Ejecutar: `npm run android`

### iOS (solo macOS)

#### Simulador
```bash
npm run ios
```

#### Dispositivo físico
1. Abrir `mobile-app/ios/BarbershopApp.xcworkspace` en Xcode
2. Seleccionar tu dispositivo
3. Configurar equipo de desarrollo en "Signing & Capabilities"
4. Presionar "Run"

## 🔧 Configuración Adicional

### Permisos de Red

#### Android
Ya está configurado en `android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
```

#### iOS
Ya está configurado en `ios/BarbershopApp/Info.plist` para desarrollo:
```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

⚠️ **Importante para producción**: Debes configurar HTTPS y eliminar `NSAllowsArbitraryLoads`.

## 👥 Usuarios de Prueba

Puedes usar las mismas credenciales que en la web:

### Admin
- Email: admin@barbershop.com
- Contraseña: admin123

### Barbería
- Usa las credenciales de registro de tu barbería

### Barbero
- Los barberos son creados por la barbería desde su panel

## 🏗️ Estructura del Proyecto

```
mobile-app/
├── src/
│   ├── components/         # Componentes reutilizables
│   ├── screens/           # Pantallas de la app
│   │   ├── auth/         # Login y registro
│   │   ├── admin/        # Pantallas de admin
│   │   ├── barbershop/   # Pantallas de barbería
│   │   └── barber/       # Pantallas de barbero
│   ├── navigation/        # Navegación de la app
│   ├── contexts/          # Context API (Auth, etc.)
│   ├── services/          # Servicios (API, Socket)
│   ├── config/           # Configuraciones
│   └── utils/            # Utilidades
├── android/              # Proyecto Android nativo
├── ios/                  # Proyecto iOS nativo
└── App.js               # Punto de entrada
```

## 🔌 Conexión con el Backend

La aplicación móvil se conecta al **mismo servidor backend** que la aplicación web. No hay servidor separado.

### Endpoints utilizados:
- `/api/admin/*` - Endpoints de administrador
- `/api/barbershop/*` - Endpoints de barbería
- `/api/barber/*` - Endpoints de barbero

### WebSocket
La app se conecta automáticamente al servidor Socket.IO cuando el usuario inicia sesión.

Eventos escuchados:
- `queue_updated` - Actualización de cola de turnos
- `appointment_updated` - Cambios en turnos
- `whatsapp_status` - Estado de WhatsApp Bot

## 📱 Funcionalidades por Rol

### Barbero
- ✅ Ver cola de turnos en tiempo real
- ✅ Llamar próximo cliente
- ✅ Completar servicios
- ✅ Ver estadísticas del día
- 🔄 Gestionar horarios (en desarrollo)

### Barbería
- ✅ Dashboard con métricas
- 🔄 Gestión de barberos (en desarrollo)
- 🔄 Configuración de horarios (en desarrollo)
- 🔄 WhatsApp Bot (en desarrollo)

### Admin
- ✅ Panel de administración
- 🔄 Gestión de barberías (en desarrollo)
- 🔄 Facturación (en desarrollo)

## 🐛 Solución de Problemas

### Error: "Unable to connect to development server"
- Verifica que el servidor backend esté corriendo
- Verifica la IP en `src/config/api.js`
- En Android, usa `10.0.2.2` para emulador
- Para dispositivo físico, usa la IP de tu computadora

### Error: "Network request failed"
- Verifica que el firewall no bloquee el puerto
- Verifica que el dispositivo esté en la misma red
- Revisa la URL en `src/config/api.js`

### Socket no se conecta
- Verifica que el token JWT sea válido
- Revisa que el servidor Socket.IO esté corriendo
- Comprueba la consola del servidor para errores

### Android: "Execution failed for task ':app:installDebug'"
```bash
cd android
./gradlew clean
cd ..
npm run android
```

### iOS: Error de certificados
- Abre el proyecto en Xcode
- Ve a "Signing & Capabilities"
- Selecciona tu equipo de desarrollo

## 🚀 Compilación para Producción

### Android APK

```bash
cd android
./gradlew assembleRelease
# APK en: android/app/build/outputs/apk/release/app-release.apk
```

### Android App Bundle (Play Store)

```bash
cd android
./gradlew bundleRelease
# Bundle en: android/app/build/outputs/bundle/release/app-release.aab
```

### iOS (App Store)

1. Abrir proyecto en Xcode
2. Product > Archive
3. Distribute App
4. App Store Connect

## 📝 Próximas Mejoras

- [ ] Notificaciones push
- [ ] Modo offline con cache
- [ ] Gestión completa de barberos
- [ ] Gestión completa de horarios
- [ ] Chat en tiempo real
- [ ] Modo oscuro
- [ ] Internacionalización (i18n)
- [ ] Tests unitarios

## 🆘 Soporte

Para problemas o preguntas:
1. Revisa la documentación
2. Consulta los logs: `npx react-native log-android` o `npx react-native log-ios`
3. Verifica la consola del servidor backend

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT.

---

**Desarrollado con ❤️ para modernizar las barberías**
