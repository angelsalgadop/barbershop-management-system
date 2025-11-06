# 📲 Configuración de Notificaciones Push

Esta guía te ayudará a configurar notificaciones push para la aplicación móvil usando Firebase Cloud Messaging (FCM).

## ¿Por qué Notificaciones Push?

Las notificaciones push son esenciales para:
- Alertar a los barberos cuando hay un nuevo turno
- Notificar a los clientes cuando es su turno
- Avisar cambios en el estado de las colas
- Recordatorios de turnos próximos

## 📋 Requisitos Previos

1. Cuenta de Google/Gmail
2. Acceso a [Firebase Console](https://console.firebase.google.com)

## 🚀 Instalación

### Paso 1: Instalar Dependencias

```bash
cd /root/TU/mobile-app
npm install @react-native-firebase/app @react-native-firebase/messaging @notifee/react-native
```

### Paso 2: Crear Proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Clic en "Agregar proyecto"
3. Nombre: "Barbershop Manager"
4. Acepta términos y crea el proyecto

### Paso 3: Agregar App Android

1. En Firebase Console, clic en el ícono de Android
2. Package name: `com.barbershopapp` (debe coincidir con el de la app)
3. Descarga `google-services.json`
4. Copia el archivo a: `/root/TU/mobile-app/android/app/google-services.json`

### Paso 4: Configurar Android

#### 1. Editar `android/build.gradle`:

```gradle
buildscript {
    dependencies {
        // Agregar esta línea:
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

#### 2. Editar `android/app/build.gradle`:

```gradle
// Al final del archivo, agregar:
apply plugin: 'com.google.gms.google-services'
```

### Paso 5: Agregar App iOS (opcional, solo macOS)

1. En Firebase Console, clic en el ícono de iOS
2. Bundle ID: `com.barbershopapp`
3. Descarga `GoogleService-Info.plist`
4. Copia el archivo a: `/root/TU/mobile-app/ios/BarbershopApp/GoogleService-Info.plist`
5. En Xcode, arrastra el archivo al proyecto

### Paso 6: Solicitar Permisos

Crea el archivo `src/utils/pushNotifications.js`:

```javascript
import messaging from '@react-native-firebase/messaging';
import notifee, {AndroidImportance} from '@notifee/react-native';

export const requestUserPermission = async () => {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    console.log('Authorization status:', authStatus);
    return true;
  }
  return false;
};

export const getFCMToken = async () => {
  try {
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error obteniendo token:', error);
    return null;
  }
};

export const createNotificationChannel = async () => {
  await notifee.createChannel({
    id: 'default',
    name: 'Default Channel',
    importance: AndroidImportance.HIGH,
  });
};

export const displayNotification = async (title, body) => {
  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId: 'default',
      importance: AndroidImportance.HIGH,
      pressAction: {
        id: 'default',
      },
    },
  });
};

export const setupNotificationListeners = () => {
  // Notificación cuando la app está en primer plano
  messaging().onMessage(async remoteMessage => {
    console.log('Notificación en primer plano:', remoteMessage);
    await displayNotification(
      remoteMessage.notification.title,
      remoteMessage.notification.body,
    );
  });

  // Notificación cuando la app está en segundo plano
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Notificación en segundo plano:', remoteMessage);
  });

  // Cuando el usuario toca la notificación
  notifee.onBackgroundEvent(async ({type, detail}) => {
    console.log('Background event:', type, detail);
  });
};
```

### Paso 7: Integrar en la App

Edita `App.js`:

```javascript
import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {AuthProvider} from './src/contexts/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import {
  requestUserPermission,
  getFCMToken,
  createNotificationChannel,
  setupNotificationListeners,
} from './src/utils/pushNotifications';

const App = () => {
  useEffect(() => {
    const initPushNotifications = async () => {
      // Solicitar permisos
      const hasPermission = await requestUserPermission();
      if (hasPermission) {
        // Crear canal de notificaciones (Android)
        await createNotificationChannel();

        // Obtener token FCM
        const token = await getFCMToken();

        // Aquí deberías enviar el token al backend
        // para que pueda enviar notificaciones a este dispositivo
        if (token) {
          // await api.post('/api/device/register-token', { token });
        }

        // Configurar listeners
        setupNotificationListeners();
      }
    };

    initPushNotifications();
  }, []);

  return (
    <AuthProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <AppNavigator />
    </AuthProvider>
  );
};

export default App;
```

## 🔧 Backend - Enviar Notificaciones

### Instalar Firebase Admin en el Backend

```bash
cd /root/TU
npm install firebase-admin
```

### Configurar Firebase Admin

1. En Firebase Console > Project Settings > Service Accounts
2. Clic en "Generate new private key"
3. Descarga el archivo JSON
4. Guárdalo como `/root/TU/firebase-admin-key.json`

### Inicializar Firebase Admin

Crea `services/pushNotifications.js` en el backend:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const sendPushNotification = async (token, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body,
      },
      data,
      token,
    };

    const response = await admin.messaging().send(message);
    console.log('Notificación enviada:', response);
    return { success: true, response };
  } catch (error) {
    console.error('Error enviando notificación:', error);
    return { success: false, error: error.message };
  }
};

const sendMultipleNotifications = async (tokens, title, body, data = {}) => {
  try {
    const message = {
      notification: {
        title,
        body,
      },
      data,
      tokens, // Array de tokens
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log(`${response.successCount} notificaciones enviadas`);
    return { success: true, response };
  } catch (error) {
    console.error('Error enviando notificaciones:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPushNotification,
  sendMultipleNotifications,
};
```

### Guardar Token del Dispositivo

Crea una ruta en el backend para guardar tokens:

```javascript
// routes/device.js
const express = require('express');
const router = express.Router();
const db = require('../database/connection');

router.post('/register-token', async (req, res) => {
  try {
    const { token } = req.body;
    const userId = req.user.id; // Del middleware de autenticación
    const userType = req.user.type; // 'admin', 'barbershop', 'barber'

    await db.query(
      'INSERT INTO device_tokens (user_id, user_type, token) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = ?',
      [userId, userType, token, token]
    );

    res.json({ success: true, message: 'Token registrado' });
  } catch (error) {
    console.error('Error registrando token:', error);
    res.status(500).json({ success: false, message: 'Error interno' });
  }
});

module.exports = router;
```

### Crear Tabla de Tokens

```sql
CREATE TABLE device_tokens (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  user_type ENUM('admin', 'barbershop', 'barber') NOT NULL,
  token VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_token (user_id, user_type)
);
```

### Enviar Notificación Cuando Llega un Turno

```javascript
// En tu lógica de colas/turnos
const { sendPushNotification } = require('../services/pushNotifications');

// Cuando un cliente reserva turno
const notifyBarber = async (barberId, clientName) => {
  const [tokens] = await db.query(
    'SELECT token FROM device_tokens WHERE user_id = ? AND user_type = "barber"',
    [barberId]
  );

  if (tokens.length > 0) {
    await sendPushNotification(
      tokens[0].token,
      'Nuevo turno',
      `${clientName} ha reservado un turno`,
      { type: 'new_appointment', barberId: barberId.toString() }
    );
  }
};
```

## 🧪 Probar Notificaciones

### Desde Firebase Console

1. Ve a Firebase Console > Cloud Messaging
2. Clic en "Send your first message"
3. Ingresa título y texto
4. En "Target", selecciona "Token de FCM"
5. Pega el token de tu dispositivo (lo verás en los logs de la app)
6. Envía la notificación

### Programáticamente

```javascript
// En el backend
const { sendPushNotification } = require('./services/pushNotifications');

sendPushNotification(
  'TOKEN_DEL_DISPOSITIVO',
  'Prueba',
  'Esta es una notificación de prueba'
);
```

## 📱 Casos de Uso

### 1. Notificar Nuevo Turno al Barbero
```javascript
// Cuando un cliente reserva
await sendPushNotification(
  barberToken,
  'Nuevo turno',
  `${clientName} ha reservado un turno`
);
```

### 2. Notificar Próximo Turno (para futuras actualizaciones con clientes)
```javascript
// Cuando es el siguiente en la cola
await sendPushNotification(
  clientToken,
  'Tu turno se acerca',
  'Quedan 2 personas antes que tú'
);
```

### 3. Notificar Cambios de Estado
```javascript
// Socket.IO + Push
io.on('queue_updated', async (data) => {
  // Emitir por socket
  io.to(barberId).emit('queue_updated', data);

  // Y también enviar push
  await sendPushNotification(
    barberToken,
    'Cola actualizada',
    'Hay cambios en tu cola de turnos'
  );
});
```

## ⚙️ Configuración Avanzada

### Notificaciones con Acciones

```javascript
await notifee.displayNotification({
  title: 'Nuevo turno',
  body: 'Juan Pérez ha reservado un turno',
  android: {
    channelId: 'default',
    actions: [
      {
        title: 'Aceptar',
        pressAction: {id: 'accept'},
      },
      {
        title: 'Rechazar',
        pressAction: {id: 'reject'},
      },
    ],
  },
});
```

### Notificaciones Programadas

```javascript
import notifee, {TriggerType} from '@notifee/react-native';

// Recordatorio 15 minutos antes
const trigger = {
  type: TriggerType.TIMESTAMP,
  timestamp: Date.now() + 15 * 60 * 1000, // 15 minutos
};

await notifee.createTriggerNotification(
  {
    title: 'Recordatorio',
    body: 'Tu turno es en 15 minutos',
    android: {channelId: 'default'},
  },
  trigger,
);
```

## 🐛 Solución de Problemas

### No recibo notificaciones
1. Verifica permisos en configuración del dispositivo
2. Revisa que el token se haya registrado correctamente
3. Comprueba los logs del backend al enviar
4. Asegúrate de que Firebase esté configurado correctamente

### Error: "Default FirebaseApp is not initialized"
- Verifica que `google-services.json` esté en `android/app/`
- Limpia y recompila: `cd android && ./gradlew clean`

### Notificaciones no aparecen en iOS
- Configura APNs (Apple Push Notification service) en Firebase
- Agrega certificados de iOS en Firebase Console

## 📚 Recursos

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [React Native Firebase](https://rnfirebase.io)
- [Notifee Documentation](https://notifee.app)

---

**Nota**: Las notificaciones push son una funcionalidad avanzada. Comienza con la app básica y agrega esta funcionalidad gradualmente.
