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

**Cómo se aplica:** `SKIP_WAITING` al worker en espera si lo hay, espera lo primero que
llegue entre `controllerchange` y 1500 ms, y recarga siempre. No existe camino en el que
el botón quede esperando.

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

- El aviso puede salir antes de que el worker haya descargado el build nuevo. En esa
  ventana el primer toque recarga sobre la versión vieja y el aviso vuelve; el segundo
  entra, porque la navegación dispara el chequeo de `sw.js`.
- Sin red no se avisa: la detección depende del fetch.
- Fuera de Vercel, sin `VERCEL_GIT_COMMIT_SHA`, `buildId` queda fijo en `dev` y la
  detección se apaga en silencio.
