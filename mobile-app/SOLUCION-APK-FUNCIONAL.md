# Solución: APK Funcional con Bundle JavaScript

## Problema Identificado

El APK Debug generado anteriormente mostraba este error al abrirlo:

```
Unable to load script. Make sure you're either running Metro
(run 'npx react-native start') or that your bundle
'index.android.bundle' is packaged correctly for release.
```

### ¿Por qué ocurría este error?

**APK Debug vs APK Release:**

- **APK Debug**: Diseñado para desarrollo. NO incluye el bundle JavaScript. Espera conectarse a un servidor Metro corriendo en tu PC.
- **APK Release**: Diseñado para producción. INCLUYE el bundle JavaScript empaquetado dentro del APK.

Cuando compilamos con GitHub Actions, no hay un servidor Metro corriendo, por lo que el APK Debug no puede cargar el código JavaScript.

## Solución Aplicada

He modificado el workflow de GitHub Actions para:

### ✅ Generar solo APK Release

- Se eliminó la compilación de APK Debug
- Ahora solo se genera **APK Release**
- El APK Release incluye el bundle JS empaquetado
- **Funcionará sin necesidad de servidor Metro**

### Cambios en el Workflow

**Antes:**
```yaml
- Build Android Debug APK
- Upload Debug APK
- Build Release APK (continue-on-error)
- Upload Release APK (if success)
```

**Ahora:**
```yaml
- Build Release APK
- Upload Release APK ✅ Listo para instalar
```

## Cómo Descargar e Instalar el Nuevo APK

### 1. Espera a que termine el nuevo build

El workflow se está ejecutando ahora. Tarda unos 5-10 minutos.

### 2. Descarga el APK Release

**Opción A: Desde GitHub (Web)**

1. Ve a: https://github.com/angelsalgadop/barbershop-mobile-app/actions
2. Clic en el workflow más reciente (debe estar en verde ✅)
3. Baja a la sección **"Artifacts"**
4. Descarga: `BarbershopApp-release-[commit]`
5. Descomprime el ZIP → `app-release.apk`

**Opción B: Con GitHub CLI**

```bash
cd /root/TU/mobile-app

# Ver último workflow
gh run list --repo angelsalgadop/barbershop-mobile-app --limit 1

# Descargar (reemplaza RUN_ID con el ID que veas)
gh run download [RUN_ID] --repo angelsalgadop/barbershop-mobile-app

# Encontrar el APK
find . -name "app-release.apk"
```

### 3. Instala en tu Dispositivo Android

1. **Transfiere el APK** a tu dispositivo:
   - Por cable USB
   - Por email
   - Por Telegram/WhatsApp
   - Por Google Drive/Dropbox

2. **Instala el APK**:
   - Abre el archivo en tu dispositivo
   - Android pedirá permiso para "Instalar aplicaciones desconocidas"
   - Concede el permiso
   - Instala la app

3. **¡Listo!** La app debería abrir sin errores

## Sobre el Logo de la App

El logo actual es el icono predeterminado de React Native. Para cambiar el logo:

### Agregar un Logo Personalizado

1. **Prepara tu logo**:
   - Formato: PNG con fondo transparente
   - Tamaño recomendado: 1024x1024 px
   - Diseño simple que se vea bien pequeño

2. **Genera los iconos en diferentes tamaños**:

   Opción fácil - Usa una herramienta online:
   - https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html
   - Sube tu logo
   - Descarga el ZIP con todos los tamaños

3. **Reemplaza los iconos**:

   Copia los archivos descargados a:
   ```
   android/app/src/main/res/
   ├── mipmap-hdpi/
   ├── mipmap-mdpi/
   ├── mipmap-xhdpi/
   ├── mipmap-xxhdpi/
   └── mipmap-xxxhdpi/
   ```

4. **Haz commit y push**:
   ```bash
   git add android/app/src/main/res/
   git commit -m "Agregar logo personalizado de la app"
   git push origin main
   ```

El siguiente build incluirá tu logo personalizado.

## Diferencias Clave

| Característica | APK Debug | APK Release |
|----------------|-----------|-------------|
| **Bundle JS** | ❌ No incluido | ✅ Incluido |
| **Necesita Metro** | ✅ Sí | ❌ No |
| **Tamaño** | Más pequeño | Más grande |
| **Para** | Desarrollo | Producción/Testing |
| **Optimizado** | ❌ No | ✅ Sí |
| **Firmado** | Debug keystore | Debug/Release keystore |

## Próximas Compilaciones

Ahora cada vez que hagas `git push` a `main`:

1. ✅ GitHub Actions compilará automáticamente
2. ✅ Generará un APK Release funcional
3. ✅ Estará disponible en Artifacts
4. ✅ Listo para instalar sin errores

## Si Aún Tienes Errores

Si el nuevo APK Release sigue dando error:

1. **Verifica que descargaste el APK Release**, no el Debug
2. **Desinstala la app anterior** antes de instalar la nueva
3. **Revisa los permisos** de la app en Android
4. **Revisa los logs**: `adb logcat | grep "ReactNative"`

## Referencias

- [React Native - Running On Device](https://reactnative.dev/docs/running-on-device)
- [React Native - Signed APK Android](https://reactnative.dev/docs/signed-apk-android)
- [Metro Bundler](https://facebook.github.io/metro/)
