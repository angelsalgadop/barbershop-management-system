# Guía de Configuración Detallada

## 🔧 Configuración del Servidor Backend

La aplicación móvil se conecta al servidor backend existente. Asegúrate de que el servidor esté configurado correctamente para aceptar conexiones desde la app móvil.

### 1. Verificar CORS en el servidor

El archivo `server.js` del backend debe tener CORS habilitado:

```javascript
const cors = require('cors');
app.use(cors({
  origin: '*', // En producción, especifica el origen
  credentials: true
}));
```

### 2. Verificar que el servidor esté corriendo

```bash
# En el directorio raíz del proyecto (no en mobile-app)
cd /root/TU
npm start
```

El servidor debe estar escuchando en el puerto configurado (por defecto 80).

### 3. Verificar conectividad

#### Desde emulador Android:
```bash
# El emulador usa 10.0.2.2 para referirse a localhost del host
curl http://10.0.2.2:80/api/health
```

#### Desde dispositivo físico:
```bash
# Reemplaza con tu IP local
curl http://192.168.1.100:80/api/health
```

## 📱 Configuración de la App Móvil

### Paso 1: Configurar URL del servidor

Edita `mobile-app/src/config/api.js`:

```javascript
export const API_CONFIG = {
  // DESARROLLO - Emulador Android
  BASE_URL: 'http://10.0.2.2:80',
  SOCKET_URL: 'http://10.0.2.2:80',

  // DESARROLLO - Dispositivo físico (cambia por tu IP)
  // BASE_URL: 'http://192.168.1.100:80',
  // SOCKET_URL: 'http://192.168.1.100:80',

  // PRODUCCIÓN
  // BASE_URL: 'https://tu-dominio.com',
  // SOCKET_URL: 'https://tu-dominio.com',

  TIMEOUT: 30000,
};
```

### Paso 2: Obtener tu IP local

#### macOS/Linux:
```bash
ifconfig | grep "inet " | grep -v 127.0.0.1
```

#### Windows:
```bash
ipconfig
```

Busca una dirección como `192.168.1.100` o `192.168.0.100`.

### Paso 3: Configurar firewall

Asegúrate de que el firewall permita conexiones en el puerto del servidor:

#### macOS:
```bash
# Permitir conexiones entrantes en el puerto 80
sudo pfctl -d
```

#### Linux:
```bash
sudo ufw allow 80
```

#### Windows:
- Panel de Control > Firewall de Windows > Configuración avanzada
- Regla de entrada > Puerto TCP 80

## 🔐 Configuración de Autenticación

### JWT Token
La app guarda el token JWT en AsyncStorage después del login. El token se incluye automáticamente en todas las peticiones HTTP mediante un interceptor de Axios.

### Configuración del token en el backend
Verifica que el backend acepte el header `Authorization: Bearer <token>`:

```javascript
// Ejemplo en server.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'No autorizado' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};
```

## 🔌 Configuración de Socket.IO

### En el backend

El servidor debe estar configurado para aceptar conexiones Socket.IO con autenticación:

```javascript
const io = require('socket.io')(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('No autorizado'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Token inválido'));
  }
});
```

### En la app móvil

Ya está configurado en `src/services/socket.js`. El token se envía automáticamente en la conexión.

## 📲 Instalación de Dependencias Nativas

### React Native Vector Icons

#### Android
Ya configurado en el proyecto. Si tienes problemas:

```bash
cd android
./gradlew clean
cd ..
```

#### iOS
```bash
cd ios
pod install
cd ..
```

### AsyncStorage

#### Android
Ya configurado automáticamente.

#### iOS
```bash
cd ios
pod install
cd ..
```

## 🔨 Compilación de Producción

### Android

#### 1. Generar keystore

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 -keystore barbershop-release.keystore -alias barbershop -keyalg RSA -keysize 2048 -validity 10000
```

#### 2. Configurar keystore

Crea `android/gradle.properties`:

```properties
BARBERSHOP_RELEASE_STORE_FILE=barbershop-release.keystore
BARBERSHOP_RELEASE_KEY_ALIAS=barbershop
BARBERSHOP_RELEASE_STORE_PASSWORD=tu_password
BARBERSHOP_RELEASE_KEY_PASSWORD=tu_password
```

#### 3. Editar build.gradle

En `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            storeFile file(BARBERSHOP_RELEASE_STORE_FILE)
            storePassword BARBERSHOP_RELEASE_STORE_PASSWORD
            keyAlias BARBERSHOP_RELEASE_KEY_ALIAS
            keyPassword BARBERSHOP_RELEASE_KEY_PASSWORD
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

#### 4. Compilar

```bash
cd android
./gradlew bundleRelease
```

### iOS

#### 1. Configurar código de firma

1. Abrir `ios/BarbershopApp.xcworkspace` en Xcode
2. Seleccionar el proyecto
3. En "Signing & Capabilities":
   - Seleccionar tu equipo
   - Habilitar "Automatically manage signing"

#### 2. Crear archivo

1. Product > Archive
2. Window > Organizer
3. Distribute App
4. Seguir el asistente

## 🌐 Configuración de Red para Producción

### HTTPS

Para producción, **DEBES** usar HTTPS:

1. Configura certificado SSL en tu servidor
2. Actualiza `src/config/api.js`:
   ```javascript
   BASE_URL: 'https://tu-dominio.com',
   SOCKET_URL: 'https://tu-dominio.com',
   ```

### iOS App Transport Security

Para producción, edita `ios/BarbershopApp/Info.plist` y **elimina** esto:

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <true/>
</dict>
```

Solo úsalo en desarrollo. Para producción con HTTPS no es necesario.

## 🐛 Debug

### Ver logs en tiempo real

#### Android:
```bash
npx react-native log-android
```

#### iOS:
```bash
npx react-native log-ios
```

### Debug remoto

1. Sacudir el dispositivo
2. Seleccionar "Debug"
3. Abrir Chrome en `http://localhost:8081/debugger-ui`

### React DevTools

```bash
npm install -g react-devtools
react-devtools
```

## 📊 Monitoreo

### Crashlytics (opcional)

Para producción, considera agregar Firebase Crashlytics:

```bash
npm install @react-native-firebase/app @react-native-firebase/crashlytics
```

## 🔄 Actualizaciones OTA (opcional)

Para actualizaciones sin pasar por las tiendas, considera:

- CodePush (Microsoft)
- Expo Updates

## ✅ Checklist Pre-Producción

- [ ] Servidor backend con HTTPS
- [ ] Variables de entorno configuradas correctamente
- [ ] CORS configurado para el dominio de producción
- [ ] Keystore/certificados configurados
- [ ] App Transport Security configurado (iOS)
- [ ] Iconos y splash screens configurados
- [ ] Permisos verificados
- [ ] Pruebas en dispositivos físicos
- [ ] Manejo de errores implementado
- [ ] Analytics configurado (opcional)
- [ ] Crashlytics configurado (opcional)

---

Si tienes problemas, revisa los logs del servidor y de la app móvil para identificar el error específico.
