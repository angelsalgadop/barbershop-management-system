# Guía de Compilación Automática con GitHub Actions

## ¿Qué es GitHub Actions?

GitHub Actions es una plataforma de CI/CD (Integración Continua y Despliegue Continuo) que permite automatizar tareas directamente desde tu repositorio de GitHub. En este caso, la usamos para **compilar automáticamente el APK** de tu aplicación cada vez que haces cambios.

## ¿Cómo Funciona?

El workflow está configurado en `.github/workflows/android-build.yml` y se ejecuta automáticamente en los siguientes casos:

1. **Push a main/master**: Cuando subes cambios a la rama principal
2. **Pull Request**: Cuando creas o actualizas un PR
3. **Manualmente**: Desde la pestaña "Actions" en GitHub

## Proceso de Compilación

El workflow realiza los siguientes pasos:

1. **Checkout**: Descarga el código del repositorio
2. **Setup Node.js**: Instala Node.js 18 con caché de npm
3. **Instalar dependencias**: Ejecuta `npm ci` para instalar las dependencias
4. **Setup Java**: Instala Java 17 (requerido para Android)
5. **Cache Gradle**: Guarda en caché las dependencias de Gradle para builds más rápidos
6. **Compilar APK Debug**: Genera el APK de desarrollo
7. **Compilar APK Release**: Genera el APK de producción (firmado con debug keystore)
8. **Subir APKs**: Los APKs quedan disponibles como artefactos descargables

## Mejoras Implementadas

### Versión Actualizada
- Actualizado a las últimas versiones de las GitHub Actions (v4)
- Mejor rendimiento y seguridad

### Información del APK
- Muestra el tamaño del APK generado
- Lista los archivos creados

### Nombres Descriptivos
- Los artefactos incluyen el SHA del commit
- Ejemplo: `BarbershopApp-debug-a1b2c3d`

### Retención de Artefactos
- Los APKs se guardan por 30 días
- Puedes ajustar esto modificando `retention-days`

### Resumen del Build
- Al final muestra un resumen con:
  - Commit
  - Rama
  - Actor (quién lo ejecutó)
  - Estado de los APKs generados

## Cómo Descargar los APKs

### Método 1: Desde la interfaz web

1. Ve a tu repositorio en GitHub
2. Haz clic en la pestaña **Actions**
3. Selecciona el workflow run que quieres
4. Baja hasta la sección **Artifacts**
5. Descarga el APK que necesites:
   - `BarbershopApp-debug-xxxxx` → APK de desarrollo
   - `BarbershopApp-release-xxxxx` → APK de producción

### Método 2: Con GitHub CLI

```bash
# Listar los artifacts del último workflow
gh run list --workflow=android-build.yml

# Descargar un artifact específico
gh run download [RUN_ID] -n BarbershopApp-debug-xxxxx
```

## Disparar el Build Manualmente

### Desde la interfaz web:
1. Ve a **Actions** en GitHub
2. Selecciona **Build Android APK** en la barra lateral
3. Haz clic en **Run workflow**
4. Selecciona la rama
5. Clic en **Run workflow** (botón verde)

### Con GitHub CLI:
```bash
gh workflow run android-build.yml
```

## Personalización

### Cambiar las ramas que disparan el build

Edita el archivo `.github/workflows/android-build.yml`:

```yaml
on:
  push:
    branches: [ main, master, develop ]  # Añade más ramas aquí
```

### Cambiar la retención de artefactos

```yaml
- name: Upload Debug APK
  uses: actions/upload-artifact@v4
  with:
    name: BarbershopApp-debug-${{ github.sha }}
    path: android/app/build/outputs/apk/debug/app-debug.apk
    retention-days: 90  # Cambia de 30 a 90 días, por ejemplo
```

### Añadir notificaciones

Puedes añadir un paso para enviar notificaciones cuando el build falle o tenga éxito:

```yaml
- name: Notify on success
  if: success()
  run: echo "Build exitoso! 🎉"
  # Aquí puedes añadir integración con Slack, Discord, etc.
```

## Solución de Problemas

### El workflow no se ejecuta

- Verifica que el archivo esté en `.github/workflows/android-build.yml`
- Asegúrate de que GitHub Actions esté habilitado en tu repositorio
- Revisa que hayas hecho push a una rama incluida en el trigger

### El build falla

1. Ve a la pestaña **Actions**
2. Haz clic en el workflow que falló
3. Revisa los logs de cada paso
4. Los errores más comunes:
   - Dependencias faltantes en `package.json`
   - Errores de sintaxis en el código
   - Problemas con las versiones de Node/Java

### No encuentro los artefactos

- Los artefactos solo están disponibles en builds exitosos
- Verifica que el build haya completado sin errores
- Los artefactos expiran después de 30 días

## Próximos Pasos

### Firma de APK de Producción

Para publicar en Google Play Store, necesitas:

1. Generar un keystore de producción
2. Añadirlo como secreto en GitHub
3. Modificar el workflow para usar ese keystore

Consulta el archivo `COMPILAR-ONLINE.md` para más detalles.

### Despliegue Automático

Puedes extender el workflow para:
- Subir automáticamente a Google Play Store
- Publicar en Firebase App Distribution
- Crear releases en GitHub con los APKs adjuntos

## Recursos Adicionales

- [Documentación de GitHub Actions](https://docs.github.com/es/actions)
- [React Native CI/CD](https://reactnative.dev/docs/running-on-device)
- [Android Build Process](https://developer.android.com/studio/build)

## Verificar el Estado del Workflow

Puedes añadir un badge al README para mostrar el estado:

```markdown
![Build Status](https://github.com/angelsalgadop/barbershop-mobile-app/workflows/Build%20Android%20APK/badge.svg)
```

Este badge mostrará si el último build fue exitoso o falló.
