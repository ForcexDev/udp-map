# Actualización de la PWA

Cómo la app detecta y aplica una versión nueva. Implementación en
[UpdatePrompt.tsx](../src/shared/ui/UpdatePrompt.tsx), decisión pura en
[pwa.ts](../src/shared/utils/pwa.ts), stamps en [vite.config.ts](../vite.config.ts).

## Diseño

La detección **no** usa eventos del service worker. Compara dos stamps:

| Stamp | Origen |
|---|---|
| `__BUILD_ID__` | Incrustado en el bundle por `define` en build time |
| `buildId` de `/update-info.json` | Emitido por el plugin `udp-map-update-info` en el mismo build |

Ambos valen `process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev'`. Cada despliegue es un commit
distinto, así que los dos cambian juntos. Si el bundle que corre trae un `buildId`
distinto al que responde el servidor, hay versión nueva.

`update-info.json` no entra al precache (`globPatterns` no incluye `.json`) y se pide con
`cache: 'no-store'`, así que la respuesta viene del servidor y no del worker instalado.
Si eso cambia, el stamp queda congelado y la detección deja de funcionar.

**Cuándo se comprueba:** al montar y en cada `visibilitychange` con la pestaña visible.

**Cómo se aplica:** `registration.update()` para forzar la comprobación, se **espera** a
que haya un worker instalado (`waitForWaitingWorker`, hasta 30 s), se le manda
`SKIP_WAITING`, se espera al `controllerchange` (hasta 10 s) y se recarga. El `finally`
recarga pase lo que pase, así que no existe camino en el que el botón quede esperando.

Los 30 s no son generosidad: **el precache son 9 MB**. Ese es el tiempo que tarda el
worker nuevo en instalarse con datos móviles, y esperarlo es justo lo que arregla el
bucle de más abajo.

**Descarte:** "Más tarde" guarda el `buildId` del servidor en
`localStorage['udp-update-dismissed-build']`. Sobrevive recargas y arranques en frío;
reaparece cuando el servidor sirve un id distinto.

## Restricciones

- `registerType: 'prompt'` en `vite.config.ts`. El registro lo inyecta el plugin en
  `index.html` vía `registerSW.js`; no se importa `virtual:pwa-register`.
- `sw.js` es generado (`generateSW`) y no se edita.
- La versión visible (`__APP_VERSION__`, `0.SPRINT+COMMITS`) es solo para mostrar. No
  sirve como identificador de despliegue: Vercel construye desde un clon superficial y
  el conteo de commits se repite entre despliegues.

## Probar en local

Ambos stamps valen `dev` en un build local, así que el aviso nunca aparece solo. Hay que
forzar dos ids:

```bash
VERCEL_GIT_COMMIT_SHA=a npm run build && npm run preview
```

Con eso corriendo, editar `buildId` en `dist/update-info.json` a otro valor y volver a la
pestaña: el aviso aparece.

## Límites conocidos

- ~~El aviso puede salir antes de que el worker haya descargado el build nuevo. En esa
  ventana el primer toque recarga sobre la versión vieja y el aviso vuelve; el segundo
  entra.~~ **Esto no era un límite: era el bug** (arreglado el 2026-08-27). Y no se
  arreglaba solo al segundo intento — el usuario reportó "le doy a actualizar como 40
  veces".

  El aviso y el arreglo eran dos mecanismos que no se hablaban: el aviso sale con una
  petición de 200 bytes a `update-info.json`, y activar la versión exige instalar 9 MB de
  precache. Al pulsar no había nada en `waiting`, el `SKIP_WAITING` caía al vacío, se
  recargaba a los 1500 ms sobre la versión vieja, y **cada recarga reiniciaba la
  instalación desde cero**, así que no convergía nunca. Encima el botón se rehabilitaba
  con un `setTimeout` de 3 s aunque la descarga siguiera, que es literalmente lo que
  invitaba a pulsarlo otra vez.

  Ahora se espera al worker antes de pedirle el relevo, el botón no se rehabilita solo, y
  mientras tanto se dice que está descargando. Cubierto por `updateWorker.test.ts`.
- Sin red no se avisa: la detección depende del fetch.
- Fuera de Vercel, sin `VERCEL_GIT_COMMIT_SHA`, `buildId` queda fijo en `dev` y la
  detección se apaga en silencio.
