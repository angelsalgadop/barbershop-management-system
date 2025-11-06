# 🌐 Compilar APK Online (Sin instalar Android SDK)

## ✅ **OPCIÓN 1: GitHub Actions (GRATIS y AUTOMÁTICO)** ⭐

GitHub compila el APK por ti en la nube automáticamente. Ya está configurado en este proyecto.

### Pasos:

#### 1. Crear repositorio en GitHub

1. Ve a https://github.com/new
2. Nombre: `barbershop-mobile-app`
3. Crea el repositorio (puede ser privado)

#### 2. Subir el proyecto a GitHub

```bash
cd /root/TU/mobile-app

# Agregar todos los archivos
git add .
git commit -m "Initial commit - Barbershop Mobile App"

# Conectar con GitHub (reemplaza con tu usuario y repo)
git remote add origin https://github.com/TU_USUARIO/barbershop-mobile-app.git

# Subir
git push -u origin main
```

Si pide usuario/contraseña, usa un **Personal Access Token**:
- Ve a GitHub > Settings > Developer settings > Personal access tokens > Generate new token
- Dale permisos: `repo`, `workflow`
- Usa el token como contraseña

#### 3. Activar GitHub Actions

1. Ve a tu repositorio en GitHub
2. Clic en la pestaña **"Actions"**
3. GitHub detectará automáticamente el workflow
4. Clic en **"I understand my workflows, go ahead and enable them"**

#### 4. Compilar el APK

Hay 2 formas:

**A) Compilación automática:**
- Cada vez que hagas `git push`, se compilará automáticamente

**B) Compilación manual:**
1. Ve a **Actions** en GitHub
2. Clic en **"Build Android APK"** (lado izquierdo)
3. Clic en **"Run workflow"** > **"Run workflow"**
4. Espera 5-10 minutos

#### 5. Descargar el APK

1. En **Actions**, clic en la compilación completada (check verde ✓)
2. Baja hasta **"Artifacts"**
3. Descarga **"app-debug"** (archivo .zip)
4. Extrae el .zip y obtendrás `app-debug.apk`

#### 6. Instalar en tu teléfono

- Copia el APK a tu teléfono
- Abre el archivo
- Habilita "Instalar apps desconocidas" si te lo pide
- ¡Instala la app!

---

## 🚀 **OPCIÓN 2: Appcircle (Alternativa)**

Servicio gratuito especializado en apps móviles.

### Pasos:

1. Registrarte en: https://appcircle.io
2. Conectar tu repositorio de GitHub
3. Seleccionar el proyecto
4. Appcircle compilará automáticamente
5. Descargar el APK desde el dashboard

---

## 📦 **OPCIÓN 3: Codemagic (Otra alternativa)**

Otra opción gratuita para compilar.

1. Registrarte en: https://codemagic.io
2. Agregar tu repositorio
3. Configurar build para Android
4. Descargar el APK

---

## 🔥 **OPCIÓN 4: EAS Build (Expo)**

Si quieres usar EAS Build:

```bash
# Instalar EAS CLI
npm install -g eas-cli

# Login
eas login

# Configurar (primera vez)
eas build:configure

# Compilar
eas build --platform android --profile preview

# Descargar APK del enlace que te da
```

Nota: Primero debes crear cuenta en https://expo.dev

---

## ⚡ Comparación

| Opción | Gratis | Tiempo | Dificultad |
|--------|--------|--------|------------|
| GitHub Actions | ✅ Sí | 5-10 min | Fácil |
| Appcircle | ✅ Sí (500 builds/mes) | 5-10 min | Fácil |
| Codemagic | ✅ Sí (500 min/mes) | 5-10 min | Fácil |
| EAS Build | ❌ Paga ($29/mes) | 5-10 min | Medio |

---

## 🎯 **Recomendación: GitHub Actions** ⭐

Es la más práctica porque:
- ✅ Totalmente gratis
- ✅ Sin límites (builds ilimitados para repos públicos)
- ✅ Ya está configurado en este proyecto
- ✅ Se integra con tu código
- ✅ Compilación automática en cada push

---

## 📝 Resumen Rápido

1. **Sube el proyecto a GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/TU_USUARIO/barbershop-mobile-app.git
   git push -u origin main
   ```

2. **Ve a GitHub > Actions > Run workflow**

3. **Espera 5-10 minutos**

4. **Descarga el APK de Artifacts**

5. **¡Instala en tu teléfono!**

---

## 🆘 Problemas Comunes

### "git push" pide contraseña
- Usa un Personal Access Token en lugar de contraseña
- GitHub > Settings > Developer settings > Personal access tokens

### Build falla en GitHub Actions
- Revisa los logs en la pestaña Actions
- Verifica que todas las dependencias estén en package.json

### APK no instala en el teléfono
- Habilita "Instalar apps desconocidas" en Ajustes
- Asegúrate de descargar el archivo correcto (app-debug.apk)

---

## 💡 Próximos Pasos

Después de compilar:
1. Instala el APK en tu teléfono
2. Configura la URL del servidor en `src/config/api.js`
3. Prueba la app
4. Reporta cualquier error para arreglarlo

---

**¡Listo! Sin instalar nada localmente, tendrás tu APK en minutos.**
