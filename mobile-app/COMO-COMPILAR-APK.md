# 📦 Cómo Compilar el APK/AAB de Android

## 📍 Ubicación de los Archivos del Proyecto

Tu proyecto React Native está en:
```
/root/TU/mobile-app/
```

## 🎯 Opciones para Compilar

### Opción 1: Compilar en tu Computadora Local (RECOMENDADO) ⭐

Esta es la opción más fácil y rápida.

#### Paso 1: Descargar el proyecto a tu computadora

```bash
# Desde tu computadora local, descarga el proyecto del servidor:
scp -r root@TU_IP:/root/TU/mobile-app ~/Desktop/mobile-app

# O si tienes acceso FTP/SFTP, usa FileZilla o similar
```

#### Paso 2: Instalar Android Studio

1. Descarga Android Studio: https://developer.android.com/studio
2. Instala Android Studio
3. Abre Android Studio > More Actions > SDK Manager
4. Instala:
   - Android SDK Platform 33
   - Android SDK Build-Tools 33.0.0
   - Android SDK Command-line Tools

#### Paso 3: Configurar Variables de Entorno

**Windows:**
```cmd
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools
```

**macOS/Linux:**
```bash
export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
# o
export ANDROID_HOME=$HOME/Android/Sdk  # Linux

export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

#### Paso 4: Instalar Dependencias

```bash
cd ~/Desktop/mobile-app
npm install
```

#### Paso 5: Compilar el APK

**APK de Debug (para pruebas):**
```bash
cd android
./gradlew assembleDebug

# El APK estará en:
# android/app/build/outputs/apk/debug/app-debug.apk
```

**APK de Release (para distribución):**

Primero, genera un keystore:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Luego, crea `android/gradle.properties`:
```properties
MYAPP_RELEASE_STORE_FILE=my-release-key.keystore
MYAPP_RELEASE_KEY_ALIAS=my-key-alias
MYAPP_RELEASE_STORE_PASSWORD=tu_password
MYAPP_RELEASE_KEY_PASSWORD=tu_password
```

Edita `android/app/build.gradle`:
```gradle
android {
    ...
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            ...
            signingConfig signingConfigs.release
        }
    }
}
```

Compila:
```bash
cd android
./gradlew assembleRelease

# El APK estará en:
# android/app/build/outputs/apk/release/app-release.apk
```

### Opción 2: Usar Expo Application Services (EAS Build)

EAS Build compila tu app en la nube sin necesidad de configurar Android Studio.

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Configurar
eas build:configure

# Compilar
eas build --platform android
```

Más info: https://docs.expo.dev/build/setup/

### Opción 3: Instalar Android SDK en el Servidor

**⚠️ No recomendado** - Requiere mucho espacio (~10 GB) y recursos.

```bash
# Instalar dependencias
sudo apt install -y wget unzip

# Descargar Android command-line tools
wget https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip

# Extraer
mkdir -p ~/Android/Sdk/cmdline-tools
unzip commandlinetools-linux-9477386_latest.zip -d ~/Android/Sdk/cmdline-tools
mv ~/Android/Sdk/cmdline-tools/cmdline-tools ~/Android/Sdk/cmdline-tools/latest

# Configurar variables
export ANDROID_HOME=~/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Instalar Android SDK
sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.0"

# Aceptar licencias
yes | sdkmanager --licenses

# Compilar
cd /root/TU/mobile-app/android
./gradlew assembleDebug
```

## 📱 Instalar el APK en tu Dispositivo

### Desde computadora a dispositivo Android:

```bash
# Conectar dispositivo por USB
# Habilitar "Depuración USB" en el dispositivo

# Instalar APK
adb install app-debug.apk
```

### Directamente en el dispositivo:

1. Copia el APK a tu dispositivo
2. Abre el archivo APK desde el explorador de archivos
3. Habilita "Instalar apps desconocidas" si te lo pide
4. Instala la app

## 🎯 Ubicaciones de los APK Compilados

Después de compilar, los APK estarán en:

- **Debug**: `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release**: `android/app/build/outputs/apk/release/app-release.apk`

## 🍎 Para iOS

Compilar para iOS requiere una Mac con Xcode.

```bash
# En Mac con Xcode instalado:
cd ios
pod install
cd ..

# Abrir en Xcode
open ios/BarbershopApp.xcworkspace

# En Xcode:
# 1. Seleccionar tu dispositivo o simulador
# 2. Product > Archive
# 3. Distribute App
```

## 🔥 Solución de Problemas

### Error: "SDK location not found"
- Instala Android Studio y Android SDK
- Configura ANDROID_HOME correctamente

### Error: "JAVA_HOME not set"
- Instala JDK 17
- Configura JAVA_HOME: `export JAVA_HOME=/path/to/jdk`

### Error de firma (release)
- Verifica que el keystore esté en la ruta correcta
- Verifica las contraseñas en gradle.properties

## 📚 Recursos

- [React Native Docs - Publishing to Play Store](https://reactnative.dev/docs/signed-apk-android)
- [Android Studio Download](https://developer.android.com/studio)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

---

## ⚡ Recomendación Final

**Para desarrollo y pruebas:**
- Descarga el proyecto a tu computadora
- Instala Android Studio
- Compila y prueba localmente

**Para distribución:**
- Genera APK de release firmado
- Sube a Google Play Store, o
- Distribuye el APK directamente

---

**Ubicación actual del proyecto:** `/root/TU/mobile-app/`

**Siguiente paso:** Descarga el proyecto a tu computadora con Android Studio instalado y sigue los pasos de la Opción 1.
