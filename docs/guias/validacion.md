# Validación

Esta guía distingue comprobaciones locales de pruebas con backend, servicios y
dispositivos. Una prueba presente no es una prueba ejecutada; aceptar HTTP no
demuestra que una persona recibió un push.

## Comprobaciones locales

Antes de cerrar un cambio:

```bash
npm run typecheck
npx vitest run
npx eslint src
```

Los tres deben pasar. `npm run build` añade construcción y worker generado.
`npm run lint` ejecuta `eslint .`, el alcance de CI, más amplio que `src`.
`npm run format:check` verifica el formateo con Prettier (`npm run format` para aplicar).

CI usa Node 24, instala con `npm ci` y ejecuta lint, typecheck, tests y build.
Pide historial completo para calcular versión. No aplica SQL, despliega funciones
ni comprueba automáticamente `check:i18n` o los derivados de instrucciones.

Según el cambio:

```bash
npm run check:i18n
node scripts/gen_agents.mjs --check
```

i18n comprueba claves e interpolaciones ES/EN, no todos los literales JSX.
Puede pasar aunque falten traducciones. El segundo comando comprueba coincidencia
exacta de derivados con `CLAUDE.md`.

## Alcance de las pruebas

Vitest usa Vite y `src/test/setup.ts`. Hay pruebas de utilidades, componentes,
permisos de interfaz, APIs con dobles y ciclo push. Los módulos puros de
criptografía y cola Edge tienen pruebas en `supabase/functions` sin desplegar.

El typecheck incluye `src` y `vite.config.ts`: no es `deno check` de las Edge
Functions. ESLint excluye `supabase/functions` y `scripts`. Las pruebas del
worker usan `self` simulado; no reproducen permisos Safari ni toques en una
PWA instalada. No hay suite E2E o integración Supabase versionada que certifique
esos recorridos.

Los [originales históricos](../README.md#antecedentes) registran ensayos PGlite,
consultas y dispositivos. Sus arneses temporales no están aquí como suite
reproducible. Leer el registro no vuelve a ejecutar el ensayo.

## Datos, roles y demo

Prueba invitado, estudiante, moderador con y sin capacidades y administrador.
Separa interfaz, privilegios, RLS y RPC. Consulta
[roles y capacidades](../referencia/base-de-datos.md#roles-y-capacidades).

En demo comprueba formularios, creación, edición y cascadas; recarga para
detectar persistencia accidental. Repite contratos en un backend de prueba:
demo no certifica cupos, permisos, triggers, concurrencia ni Storage.

Para pines interiores, incluye exterior `null`, planta 1, subterráneo, planta
inexistente, edificio de una planta, facultad sin edificios y traslado a otro
edificio que no tenga la planta. Distintas plantas pueden compartir coordenadas.
Comprueba `area_id` al cambiar piso, categoría permanente y ubicación al editar.

La geometría usa aproximaciones: contención por vértices/anillo exterior y
muestreo en solapes cóncavos. Prueba vacíos y umbrales. El porcentaje de cobertura
no prueba que todos los interiores estén trazados.

<a id="push-y-moderacion"></a>

## Push y moderación

Prepara el entorno con [despliegue](despliegue.md). Registra fecha, commit,
migraciones y dispositivo; distingue esperado, observado y pendiente.

| Caso                                   | Qué comprobar                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Activar                                | Gesto, permiso, suscripción local y confirmación remota independiente                                                    |
| Reabrir o volver a primer plano        | Sincronizar sin permiso nuevo; no confundir «Activadas» con registro remoto                                              |
| Fallo de registro                      | `serverSync` y reintento; conservar suscripción sana                                                                     |
| Desactivar y cerrar sesión             | Navegador primero, servidor después; reintentar baja y cerrar sesión aun con error                                       |
| Fin de sesión fuera del botón          | Baja local; no dar de baja por el mero arranque                                                                          |
| Rotación o cambio de cuenta            | Endpoint confirmado, `p_old_endpoint`, pendientes y reasociación                                                         |
| Sin API, denegado, iPhone no instalado | Pista apropiada y resto de aplicación utilizable                                                                         |
| Concurrencia de cola                   | Cron/panel, lease vencido, cierre atrasado, fencing y error de cierre                                                    |
| Servicio push                          | 404/410, 400/413/401/403, 429 y `Retry-After`, 5xx, timeout/red                                                          |
| Recepción                              | Notificación visible real; aceptación del servicio no basta                                                              |
| Toque                                  | Ventana controlada/no controlada, nueva ventana, destino y marcado leído                                                 |
| Worker                                 | Híbrido, campos faltantes, datos ilegibles y fallo de `showNotification`; también puede fallar el respaldo               |
| Autotest                               | Solo su aviso, aun si cron reclamó antes; mirar `notification.error`                                                     |
| Bandeja                                | Grupos temporales, filtros sin marcado automático, leído/no leído, borrado, vaciar con confirmación y rollback optimista |
| Moderación                             | Lectura RLS y RPC; detectar discrepancias de asignación y privacidad de nota                                             |

Incluye escritorio Chrome/Edge, Android e iPhone/PWA según el alcance. No cambies
cifrado, cabeceras, `sub` o payload solo porque pasan mocks. El camino declarativo,
el worker y los toques necesitan pruebas de dispositivo.

Comprueba `cron.job_run_details`, `net._http_response` y logs Edge. El job puede
figurar exitoso por encolar HTTP y recibir después 401/500. Cron con `EdgeRuntime`
recibe 202; el panel espera 200 y resumen.

<a id="comprobar-una-actualizacion-pwa"></a>

## Comprobar una actualización PWA

El mecanismo está en [PWA](../referencia/pwa.md). Para probar **detección**:

```bash
VERCEL_GIT_COMMIT_SHA=a npm run build
npm run preview
```

```powershell
$env:VERCEL_GIT_COMMIT_SHA = 'a'
npm run build
npm run preview
```

Cambia `buildId` en `dist/update-info.json` con la página abierta y vuelve a hacerla
visible. El aviso debe aparecer; descartarlo persiste para ese ID y otro ID
puede volver a mostrarlo. Esto solo prueba detección.

Para probar **relevo**, sirve dos builds coherentes con IDs distintos. Comprueba
descarga, `waiting`, `SKIP_WAITING`, cambio de controlador y versión activa.
Incluye red lenta, instalación fallida, sin red y reapertura. No deduzcas
instalación correcta de una recarga. Los tests de `waitForWaitingWorker` cubren
el helper, no toda la secuencia en navegador real.

## Documentación y evidencia

Tras mover archivos comprueba enlaces, anclas, referencias en comentarios y
consumidores con rutas literales. Los cuerpos originales archivados como fuente
Markdown son registros, no instrucciones actuales.

Conserva `docs/CHANGELOG.md` y su extracción de guiones. Comprueba generador y
hook de documentación DB. Cada sección relevante necesita destino en la matriz:
conservada, corregida o sustituida por un equivalente identificado.

Registra comandos y resultados. Si faltan entorno, fixture o dispositivo, dilo;
no cierres la incertidumbre con un test de cliente o el nombre de una migración.
