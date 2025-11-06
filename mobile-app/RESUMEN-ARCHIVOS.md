# 📂 Resumen de Archivos y Ubicaciones

## 🎯 Ubicación del Proyecto

El proyecto completo de la aplicación móvil está en:
```
/root/TU/mobile-app/
```

## 📱 ¿Dónde están los archivos de instalación?

### Android (APK)

Los archivos APK **se generan después de compilar** el proyecto. No están pre-compilados.

**Ubicaciones después de compilar:**
- APK Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
- APK Release: `android/app/build/outputs/apk/release/app-release.apk`

**Para compilar, necesitas:**
1. Android Studio instalado
2. Android SDK configurado
3. Seguir la guía: `COMO-COMPILAR-APK.md`

### iOS (IPA)

Los archivos IPA se generan desde Xcode en una Mac.

**Ubicación del proyecto iOS:**
```
/root/TU/mobile-app/ios/
```

**Para compilar iOS:**
1. Necesitas una Mac con Xcode
2. Abrir `ios/BarbershopApp.xcworkspace`
3. Product > Archive > Distribute

## 📦 Estructura del Proyecto

```
/root/TU/mobile-app/
├── android/                    # Proyecto nativo Android
│   ├── app/
│   │   └── build/outputs/      # APKs compilados aparecerán aquí
│   └── gradle/
├── ios/                        # Proyecto nativo iOS
│   └── BarbershopApp.xcworkspace
├── src/                        # Código fuente JavaScript
│   ├── screens/               # Pantallas de la app
│   ├── navigation/            # Navegación
│   ├── services/              # API y Socket.IO
│   ├── contexts/              # Estado global
│   └── config/                # Configuración
├── App.js                      # Componente principal
├── index.js                    # Punto de entrada
├── package.json                # Dependencias
├── README.md                   # Documentación completa
├── INICIO-RAPIDO.md           # Guía de inicio rápido
├── CONFIGURACION.md           # Configuración detallada
├── COMO-COMPILAR-APK.md       # 👈 IMPORTANTE: Cómo compilar APK
└── NOTIFICACIONES-PUSH.md     # Guía de notificaciones push
```

## 🚀 Opciones para Obtener los Instaladores

### Opción 1: Compilar Localmente (RECOMENDADO) ⭐

1. **Descargar el proyecto a tu computadora:**
   ```bash
   # Desde tu computadora, ejecuta:
   scp -r root@TU_SERVIDOR_IP:/root/TU/mobile-app ~/Desktop/
   ```

2. **Instalar Android Studio**
   - Descargar: https://developer.android.com/studio

3. **Compilar el APK:**
   ```bash
   cd ~/Desktop/mobile-app/android
   ./gradlew assembleDebug
   ```

4. **Instalar en tu dispositivo:**
   - El APK estará en: `android/app/build/outputs/apk/debug/app-debug.apk`
   - Cópialo a tu teléfono y ábrelo para instalar

### Opción 2: Usar EAS Build (Compilación en la Nube)

```bash
npm install -g eas-cli
eas login
eas build --platform android
```

### Opción 3: Compilar en el Servidor

⚠️ **No recomendado** - Requiere instalar Android SDK (~10 GB) en el servidor.

Ver guía completa en: `COMO-COMPILAR-APK.md`

## 📖 Documentación Disponible

1. **README.md** - Documentación general del proyecto
2. **INICIO-RAPIDO.md** - Cómo empezar en 5 minutos
3. **CONFIGURACION.md** - Configuración detallada
4. **COMO-COMPILAR-APK.md** - ⭐ Cómo generar APK/IPA
5. **NOTIFICACIONES-PUSH.md** - Configurar notificaciones push
6. **RESUMEN-ARCHIVOS.md** - Este archivo

## 💡 Próximos Pasos

### Para probar la app:

1. **Descarga el proyecto a tu computadora** con Android Studio instalado:
   ```bash
   # En tu computadora:
   scp -r root@IP_SERVIDOR:/root/TU/mobile-app ~/Desktop/
   ```

2. **Instala dependencias:**
   ```bash
   cd ~/Desktop/mobile-app
   npm install
   ```

3. **Compila el APK:**
   ```bash
   cd android
   ./gradlew assembleDebug
   ```

4. **Instala en tu teléfono:**
   ```bash
   # Conecta tu teléfono por USB y ejecuta:
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

### Para ejecutar en desarrollo:

1. **Con emulador Android:**
   ```bash
   npm run android
   ```

2. **Con dispositivo físico:**
   - Conecta el dispositivo por USB
   - Habilita "Depuración USB"
   - Ejecuta: `npm run android`

## 🔧 Configuración Importante

### Conectar al servidor backend

Edita `src/config/api.js`:

```javascript
// Para emulador Android
BASE_URL: 'http://10.0.2.2:80'

// Para dispositivo físico (reemplaza con tu IP)
BASE_URL: 'http://192.168.1.100:80'

// Para producción
BASE_URL: 'https://tu-dominio.com'
```

## ❓ Preguntas Frecuentes

**P: ¿Por qué no hay APK pre-compilado?**
R: Los proyectos React Native se compilan según la plataforma y configuración. Cada desarrollador debe compilar para su caso específico.

**P: ¿Puedo usar el servidor para compilar?**
R: Técnicamente sí, pero requiere instalar ~10 GB de Android SDK. Es más práctico compilar en tu computadora local.

**P: ¿Necesito Mac para la app de iOS?**
R: Sí, iOS requiere Xcode que solo está disponible en macOS.

**P: ¿Cómo publico en Play Store?**
R: Necesitas una cuenta de Google Play Developer ($25 único) y seguir la guía oficial de React Native.

## 📞 Soporte

Para problemas:
1. Consulta `COMO-COMPILAR-APK.md`
2. Revisa `CONFIGURACION.md`
3. Verifica que el servidor backend esté corriendo
4. Revisa logs: `npx react-native log-android`

---

**Resumen:** Los archivos de instalación (APK/IPA) se generan al compilar el proyecto. Descarga el proyecto a tu computadora con Android Studio y sigue la guía `COMO-COMPILAR-APK.md`.
