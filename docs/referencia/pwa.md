# Actualización y caché de la PWA

Contrato del mecanismo versionado y sus límites. Las pruebas están en
[validación](../guias/validacion.md#comprobar-una-actualizacion-pwa);
la configuración de hosting, en [despliegue](../guias/despliegue.md).

## Detección por identidad de build

Vite define `__BUILD_ID__` y emite `/update-info.json` con el mismo `buildId`:
`VERCEL_GIT_COMMIT_SHA` o `dev` si falta. `UpdatePrompt` compara el ID del bundle
con el del servidor; `shouldShowUpdate` centraliza la decisión.

Comprueba al montar con página visible y al volver a hacerla visible. El fetch
usa `cache: 'no-store'` y los patrones de precache no incluyen JSON. Si cambia
alguna condición, revisa que el detector no lea el stamp del worker antiguo.

La identidad es la SHA suministrada, no cada ejecución de despliegue. Reconstruir
la misma SHA puede no cambiarla. Sin variable todos los builds usan `dev` y
el aviso queda desactivado de hecho.

«Más tarde» guarda el ID en `localStorage['udp-update-dismissed-build']`:
sobrevive recargas y reaperturas; otro ID puede volver a avisar. Sin red no
se detecta una versión nueva.

## Aplicación del relevo

`shared/utils/swUpdate.ts::applyUpdate`:

1. Busca el registro e intenta `registration.update()`.
2. Espera un worker en `waiting` con `waitForWaitingWorker` hasta
   `WAIT_FOR_WORKER_MS` (30 segundos).
3. Si existe, envía `SKIP_WAITING` y espera `controllerchange` o
   `CONTROLLER_CHANGE_MS` (10 segundos).
4. Recarga en `finally` al terminar la secuencia.

Las esperas del helper y controlador están acotadas; `registration.update()`
no tiene timeout propio. Recargar es un respaldo, no una garantía de instalar
el nuevo build si faltó red, falló la instalación o no hubo worker preparado.

`0d3ed85` registra por qué se añadió espera real: recargar demasiado pronto
podía reiniciar una instalación aún en curso. La cifra de precache que acompañó
aquel diagnóstico es histórica; luego se excluyó `fic.png`. No es una medida actual.

## Registro y caché

`VitePWA` usa `registerType: 'prompt'` y genera `sw.js`; inyecta el registro en
el HTML. No se importa `virtual:pwa-register`. No edites el worker generado:
`public/push-sw.js` sí es fuente mantenida y se incorpora con
`workbox.importScripts`. Su contrato está en
[notificaciones](notificaciones.md#worker-y-toque).

El precache incluye JS, CSS, HTML, SVG, PNG y fuentes con el límite de Vite.
`fic.png` queda fuera para no descargarla en cada instalación/actualización;
su primera apertura requiere red o caché del navegador. Reducirla es un
pendiente, no una transformación aplicada.

Teselas y glyphs OpenFreeMap usan `CacheFirst` en `openfreemap-tiles`, con
máximo de entradas configurado y retención de 30 días. Reutiliza lo descargado;
no descarga todo el campus. Datos Supabase, rutas y fuentes externas no se
convierten en una base offline por instalar la PWA.

## Versión visible y notas

`computeAppVersion` toma `MAJOR.MINOR` de `package.json` y añade los commits
accesibles a Git. Sin Git usa la versión del paquete. Es una etiqueta visible,
no identidad fiable de despliegue.

Hay un registro de conteos repetidos en clones superficiales de Vercel.
El TODO no acredita la configuración remota actual. CI sí pide historial
completo. No reconstruyas el antiguo vínculo con `SPRINTS_STATUS.md`:
el build ya no depende de planificación.

`updateInfoJson` lee [`docs/CHANGELOG.md`](../CHANGELOG.md) y convierte **todas**
las líneas cuyo texto recortado empieza por guion en mejoras. Conserva la ruta
y evita listas auxiliares, auditorías o un histórico acumulativo que termine
mostrándose entero como novedad de una versión.
