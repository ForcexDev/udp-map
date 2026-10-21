# Revisión del sistema de push y del plan de rework

> **Fecha:** 2026-10-21 · **Sobre:** `main` en `eba61ee` · **Plan revisado:**
> [PUSH_REWORK_LOGBOOK.md](PUSH_REWORK_LOGBOOK.md) (Hallazgos A–F)

## Estado (2026-10-21): Push 0 y Push 1 hechas en código, sin desplegar

Resueltos en `send-push` y `_shared/webpush.ts` los hallazgos P0 **2–8 y 10**,
y el 1 a medias. Faltan despliegue manual (`npm run deploy:push`) y prueba en
un iPhone.

- **1 a medias:** el `sub` se firma igual que en `eba61ee` (si el secreto no es
  un `mailto:`, se usa `mailto:soporte@udp.cl`), porque cambiarlo es cambiar lo
  que hoy entrega en iPhone. Ahora deja un aviso en el log. Para quitar el correo
  de la UDP, poner en el secreto `VAPID_SUBJECT` un `mailto:` propio del
  proyecto, que se usa tal cual, y probar en un iPhone.
- **2** Cifrado y VAPID en `_shared/webpush.ts` con tests (vector RFC 8291, ida y vuelta, firma VAPID, clasificación).
- **3** Los errores de escritura en la base se comprueban y se registran.
- **4** Respuestas clasificadas; 429/5xx respetan `Retry-After`; 403 avisa de revisar VAPID.
- **5** Tope de 3993 B como fallo terminal. Queda para una migración la cota de longitud en la RPC de difusión.
- **6** Timeout de 10 s por envío.
- **7** Secretos VAPID validados al cargar; si están mal, 500 sin tocar la cola.
- **8** JWT VAPID reutilizado por origen 11 h.
- **10** `APP_ORIGIN` opcional.
- **9 queda:** `Urgency` no se toca; TTL por tipo y `Topic` pendientes.

Cifrado, cabeceras y forma del payload no cambian.

---

Revisión del envío de push tal como está desplegado y del plan de la siguiente
fase. Responde tres preguntas: si funciona, si es correcto y óptimo, y qué
cambiaría del plan.

---

## Cómo se hizo, y cuánto fiarse

Seis revisores independientes, uno por dimensión: protocolo, cola en la base,
cliente y service worker, crítica del plan, buenas prácticas con fuentes
externas, y calidad y cantidad de código. Detrás de cada uno iba un escéptico
por hallazgo.

**La ejecución quedó a medias por el límite semanal de la cuenta**, no por un
fallo del análisis:

- **Protocolo:** el revisor no terminó. Su tema quedó cubierto: otros **tres**
  revisores reprodujeron por su cuenta el cifrado contra el RFC.
- **Los otros cinco revisores** terminaron: 91 hallazgos en bruto, que aquí
  quedan en 34 tras quitar duplicados.
- **Escépticos:** solo 4 terminaron. Confirmaron sus hallazgos y bajaron la
  severidad de los cuatro.
- **El resto** los comprobé después contra el código, sin agentes.
- **Cierre:** tres agentes más verificaron cada afirmación externa en su fuente
  primaria, con cita literal, y volvieron a ejecutar las 12 simulaciones. Todas
  se reprodujeron. Los matices que salieron están anotados en cada hallazgo.

Cada hallazgo lleva su nivel de evidencia:

| Marca | Qué significa |
|---|---|
| **[ejecutado]** | Lo reproduje ejecutando código (el cifrado, contra el RFC) |
| **[simulado]** | Un revisor ejecutó `send-push` real contra una base simulada; es coherente con el código |
| **[código]** | Lo comprobé leyendo el código o las dependencias |
| **[revisor]** | Lo afirma un revisor citando líneas, y no lo contradice nada; no lo repasé línea a línea |
| **[fuente]** | Depende de documentación externa (Apple, WebKit, W3C, MDN, RFC, Deno). Verificada con cita literal en la fuente primaria, salvo que se diga lo contrario |
| **[dispositivo]** | Solo se puede confirmar en un iPhone o Android real |

Los scripts y el material en bruto quedaron en el scratchpad de la sesión
(`push-review/`, con `rescatado.md` y `rescatado-raw.json`). Es temporal; lo
importante está en este documento.

---

## Veredicto

**¿Funciona?** Sí, en el camino feliz:

- **El cifrado es correcto.** El código de `send-push` produce bit a bit el
  mensaje del RFC 8291, Apéndice A. Un descifrador independiente lo abre, también
  con texto multibyte. **[ejecutado]**
- **VAPID es correcto.** La firma ES256 verifica, `aud` es el origen del
  endpoint, `exp` vence a las 12 h y `k` va sin relleno. **[ejecutado]**
- **El service worker** pinta bien el payload híbrido actual y no abre orígenes
  ajenos al tocar la notificación. **[simulado]**
- **El permiso** solo se pide desde un clic, como exige iOS. **[código]**

**¿Es correcto y óptimo?** No del todo. Nada de lo siguiente rompe la entrega
hoy, con poco volumen, pero falla en cuanto haya concurrencia, errores o
crecimiento:

- dos ejecuciones simultáneas envían lo mismo dos veces;
- los errores de escritura en la base se ignoran;
- el bucle va en serie y sin timeout;
- todo error que no sea 404/410 se reintenta igual;
- se firma un JWT por cada envío;
- el payload va duplicado y no se controla su tamaño;
- las 206 líneas nuevas de criptografía y transporte no tienen ni un test;
- producción firma con el correo de la UDP como contacto.

**Calidad y cantidad.**

- **`send-push`:** pasó de 188 a 458 líneas. De ellas, 163 son criptografía
  propia y 43 transporte HTTP.
- **El subsistema entero** ronda las 3.300 líneas. **No está inflado.**
- **Recorte realista:** 70–90 líneas y un payload un 37 % menor.
- **Lo que de verdad falta** no es quitar código, sino unas 80 líneas de tests
  de la criptografía con los vectores del RFC.
- **Cambiar a una librería** quitaría unas 150 líneas, pero el payload, los
  errores y la cola seguirían siendo propios. Conviene mantener el código propio
  con tests. Si se prefiere no mantener criptografía, `@pushforge/builder` es la
  opción con más señales de mantenimiento (2.0.5, de abril de 2026, sin
  dependencias). `@block65/webcrypto-web-push` (2.0.0, septiembre de 2026)
  también existe. `jsr:@negrel/webpush` avisa en su README de que no la ha
  revisado ningún experto en criptografía. `npm:web-push` no publica versión
  desde la 3.6.7, de enero de 2024. **[fuente]**

**¿El plan está bien?**

- **El diagnóstico** de A, B, C, D.1, D.3, D.5 y E.4 es correcto.
- **Varias soluciones son peligrosas o se apoyan en premisas falsas:** A.2,
  B con `SET NULL`, C con `processing`, D.2, D.4, E.2 y E.3.
- **Le falta:** tests, clasificación de errores HTTP, control de tamaño,
  timeouts, purga, observabilidad, el orden de las migraciones y su entrada en
  ROADMAP.

---

## Lo que hizo llegar las notificaciones al iPhone

**El hecho, confirmado por el equipo:** hasta el despliegue de `eba61ee` las
notificaciones no llegaban al iPhone, y con él sí llegan. Eso no está en
discusión, y todo lo de este documento parte de ahí.

Lo que no se sabe es **cuál de los cuatro cambios de ese despliegue fue el
decisivo**: el cifrado propio, el bloque declarativo, `Urgency: high` o
reinstalar el WebClip. La consecuencia práctica es una regla: **ninguno de los
cuatro se toca sin volver a probar en un iPhone.** Por eso este documento no
propone volver a `npm:web-push`. Bajar la urgencia, quitar el bloque declarativo
o adelgazar el payload van, como mucho, de últimos y con prueba en el
dispositivo.

Lo único que se discute es la explicación que da la bitácora. Según §1.1 y el
comentario de `send-push/index.ts` (cerca de la l.62), el fallo venía de que el
polyfill `node:crypto` de `npm:web-push` "corrompe el cifrado". Hay datos que no
encajan:

- **El 2026-08-27, con `npm:web-push`, el iPhone mostraba las notificaciones.**
  El bug de ese día era que tocarlas no hacía nada (ROADMAP, "Tocar la
  notificación no hacía nada en la PWA instalada de iOS", commit `e1022ea`, que
  importaba `npm:web-push@3.6.7`). Un cifrado corrupto no se habría podido
  mostrar. **[código]**
- **El experimento de la Fase 2 cambió cuatro cosas a la vez:** el cifrado, el
  formato declarativo, `Urgency` de `normal` a `high` y la reinstalación del
  WebClip. No aísla ninguna.
- **El fallo conocido de Deno con `web-push`** era de AES-GCM en el
  `node:crypto` de Deno ("AES-GCM decryption failed"). Lo reportaron usuarios de
  Chrome y Brave, y se cerró el 28 de agosto de 2024 con el PR #25261 (deno#23693).
  Supabase corre un runtime compatible con Deno 2.1 en todas las regiones desde
  agosto de 2025. No se encontró ningún fallo de `web-push` en Deno específico de
  iOS; es una ausencia, no una prueba. **[fuente]**

Puede que la reinstalación del WebClip (causa nº 3 de la bitácora) pesara
tanto como el cifrado. Si fue así, A, D y E.1 importan más de lo que el plan les
da, porque son los que evitan volver a quedar con suscripciones revocadas o
huérfanas.

**Qué hacer:** dejar la §1.1 como "lo que cambió y funcionó", sin afirmar cuál
pieza lo arregló. En el comentario de `index.ts`, decir que se dejó `web-push`
porque está sin mantenimiento desde la 3.6.7 y porque la versión propia funciona
en iPhone.

---

## Hallazgos, por prioridad

### P0 — Solo en `send-push`, sin migración

| # | Hallazgo | Evidencia | Qué hacer |
|---|---|---|---|
| 1 | **Producción firma con `mailto:soporte@udp.cl`.** El secreto vale `https://udp-map.vercel.app`, que RFC 8292 §2.1 admite, y el código lo cambia en silencio por el correo de una institución con la que el proyecto no está afiliado (l.8-10) | [código] [fuente] | Aceptar `mailto:` y `https:` tal cual; si falta, fallar al arrancar. Quitar el correo de la UDP del código. Apple acepta ambos, pero el `sub` es parte de lo que hoy funciona: probar en iPhone después del cambio |
| 2 | **Ningún test cubre la criptografía.** `tsconfig` solo incluye `src`, eslint ignora `supabase/functions`, no hay tests ni `deno check` en CI. Apple responde 201 aunque el payload no se pueda descifrar, así que un error de un byte no se nota | [código] | Mover l.16-222 a `supabase/functions/_shared/webpush.ts`, que no usa nada de Deno, y testearlo con vitest en entorno node: vector del RFC, ida y vuelta y firma VAPID. Unas 80 líneas |
| 3 | **Se ignoran los errores de escritura en la base** (l.381, 409, 426). Si falla el `delete` tras un 410 o el `update` de reintento, la entrega se reenvía cada minuto, sin backoff ni tope, hasta que el fallo pase | [código]; escéptico: severidad baja | Comprobar `error` en cada escritura, como ya hace `storage-gc`, y llevarlo a `diagnostics`. No evita el duplicado: lo que deduplica es el `tag` del cliente |
| 4 | **400, 403 y 413 se reintentan 5 veces; 429 ignora `Retry-After`.** Un 403 masivo por rotar VAPID pasa horas en reintentos | [código] [fuente] | 404/410 → expirada; 400/413 → `failed` de inmediato; 403 → `failed` y alerta; 429/5xx/red → reintento respetando `Retry-After` |
| 5 | **No se controla el tamaño del payload.** Cifra 5000 B sin quejarse. El híbrido duplica el 37 %: con él caben unos 1730 caracteres de cuerpo frente a 3849 sin duplicar. La RPC de difusión no acota la longitud | [ejecutado] | Rechazar más de 3993 B como fallo terminal, acotar la RPC, quitar el `payload` duplicado dentro de `notification.data` |
| 6 | **`fetch` sin timeout.** Un servicio push colgado frena el lote entero | [código] | `signal: AbortSignal.timeout(10_000)` |
| 7 | **Secretos leídos con `!` sin validar.** Un VAPID ausente o corrupto se cobra como fallo de cada entrega y agota la cola en unas 2 h | [ejecutado] | `requireEnv()` y validar el par VAPID una vez antes de tocar la cola; si falla, responder 500 |
| 8 | **Se firma un JWT VAPID por envío.** Apple pide no renovarlo más de una vez por hora; RFC 8292 §5 anima a reutilizarlo | [código] [fuente] | Guardarlo por `aud` a nivel de módulo y renovarlo cuando le quede menos de 1 h |
| 9 | **`Urgency: high` y `TTL` de 24 h para todo, sin `Topic`.** Un recordatorio puede llegar cuando el evento ya pasó | [código] [fuente]; RFC 8030 §5.3 reserva `high` para alertas urgentes, mientras Apple lo pide para "entregar de inmediato" | **No bajar `Urgency`**: es una de las cuatro cosas que cambiaron cuando el iPhone empezó a recibir. Sí: TTL por tipo y `Topic` con el id del aviso sin guiones, probando en iPhone |
| 10 | **Origen fijo `https://udp-map.vercel.app`** en el bucle, en CORS y en el icono. Desde local o staging, `navigate` lleva a producción (solo en la ruta declarativa) | [código] | `APP_ORIGIN` por variable de entorno, una vez |

### P1 — Base de datos (migraciones)

| # | Hallazgo | Evidencia | Qué hacer |
|---|---|---|---|
| 11 | **Borrar un aviso hace que el recordatorio de evento vuelva a sonar en menos de un minuto.** La única barrera es la fila de `notifications`, que el usuario puede borrar (`notifications_delete_own`). `enqueue_upcoming_event_notifications` corre en cada pasada y la recrea | [código] | Sacar la idempotencia de la bandeja: `event_rsvps.reminded_at`, o borrado lógico de avisos |
| 12 | **Sin reclamo atómico, dos ejecuciones envían lo mismo dos veces.** Basta con el cron y el botón del panel, o con un lote que dure más de 60 s | [código] [simulado] | Reclamar con *lease*: `update … set next_attempt_at = now() + lease, attempts = attempts + 1 … for update skip locked returning …`, sin estado nuevo. Escrituras finales con *fencing* por `attempts`. `revoke execute` a `public`, `anon` y `authenticated`, porque devuelve claves |
| 13 | **B tal como está escrito deja entregas `pending` huérfanas para siempre.** Con `SET NULL`, cualquier borrado que no pase por el 410 deja filas con `subscription_id` nulo que el `!inner` descarta: desactivar, cerrar sesión, baja por admin, la propia purga de A | [código] | Trigger `BEFORE DELETE` en `push_subscriptions` que pase sus entregas pendientes a `expired`. Guardar el host del servicio, no el endpoint completo |
| 14 | **Falta un índice en `notification_push_deliveries.subscription_id`.** `register_push_subscription` borra por esa columna en cada vuelta a primer plano | [código] | `create index … (subscription_id)` |
| 15 | **No se purga nada y los `failed` no se ven.** Ni las entregas ni los avisos se borran nunca; no hay vista ni alerta | [código] | Job de pg_cron: `sent`/`expired` a los 30 días, `failed` a los 90; RPC de admin con los fallos por host |
| 16 | **`wants_notification` deja leer las preferencias de cualquiera.** Es `SECURITY DEFINER`, no comprueba `auth.uid()` y tiene `grant` a `authenticated` | [código] | Revocar `execute` a `authenticated`; las funciones que la usan ya son definer |
| 17 | **Los recordatorios se recalculan cada minuto dentro de `send-push`.** Recorren todos los RSVP de los próximos 20 días | [código] | Llevarlos a su propio job de pg_cron en SQL |
| 18 | **El cron de `send-push` no está versionado.** Solo vive en el runbook, y pg_net corta a los 5 s por defecto | [código] [fuente] | Migración con `cron.schedule` y timeout explícito |
| 19 | **La difusión cuenta destinatarios aunque no se cree el aviso**, y dos difusiones en el mismo segundo chocan en el `dedupe_key` | [código] | Contar solo ids no nulos; clave con `gen_random_uuid()` |

### P1 — Cliente y service worker

| # | Hallazgo | Evidencia | Qué hacer |
|---|---|---|---|
| 20 | **«Activadas» aunque el servidor no lo sepa.** `syncPushSubscription` se traga el error y el estado queda en `subscribed` | [código] [simulado] | Mantener el navegador como autoridad, porque evita el parpadeo, y añadir un campo aparte `serverSync: 'ok' \| 'failed' \| 'no-session'` |
| 21 | **Cerrar sesión borra la fila antes de desuscribir.** Si el borrado falla, el navegador sigue recibiendo los avisos de la cuenta anterior. Además no reinicia `usePushStore` (D.5) | [código] | Desuscribir primero en el navegador, en un `finally`; una sola función de baja en `pushStore`, borrando `removeCurrentBrowserPushSubscription` |
| 22 | **Si la sesión termina sin `signOut`** (otra pestaña, token caducado) **no se limpia nada**, y entrar sin recargar no resincroniza | [código] [simulado] | Un efecto que observe `user?.id`: de un id a nulo, baja local; de nulo a un id, `resolvePushState()` |
| 23 | **La pista «añade la app a la pantalla de inicio» no aparece nunca en Safari de iOS.** `iosNeedsInstall()` exige `pushApiSupported()`, y en una pestaña de Safari iOS no existen esas API | [código] [simulado] [dispositivo]. WebKit solo dice que Web Push es para apps de pantalla de inicio; la ausencia de las API en una pestaña viene de fuentes secundarias | Decidir `ios-not-installed` antes de comprobar el soporte |
| 24 | **«Reintentar» después de un fallo al desactivar vuelve a activar**, y mientras se desactiva el botón dice «Activando…» | [código] | Recordar qué operación falló |
| 25 | **Dos RPC de registro en cada arranque** y otra en cada vuelta a primer plano | [simulado] | Quitar el `onVisible()` inicial; saltar la RPC si el endpoint no cambió |
| 26 | **La clave VAPID está copiada a mano en `push-sw.js`** | [código] | Usar `event.oldSubscription?.options.applicationServerKey`, o generar el archivo en el build |
| 27 | **`showNotification` sin respaldo.** Si falla y no se muestra nada, Safari revoca el permiso | [fuente] | En el `catch`, mostrar una notificación mínima (no basta con registrar el error) |
| 28 | **Los tests no cubren el ciclo de vida** (subscribe, unsubscribe, sync, signOut) **ni el service worker** | [código] | Usar de base los tests de `push-review/` |
| 29 | **El modo demo deja una suscripción huérfana, y los mensajes de push están fuera de i18n** (`pushErrorMessage`, `PUSH_STATE_LABEL`) | [código] | Ocultar `PushCard` en demo; pasar los textos a `t()` |
| 30 | **Cada vuelta a primer plano puede revivir un endpoint que ya devolvió 410** | inferido, [dispositivo] | Que el servidor recuerde los endpoints caducados y se lo diga al cliente |

### P2 — Calidad y tamaño

| # | Hallazgo | Evidencia | Qué hacer |
|---|---|---|---|
| 31 | **`isAuthorized`, las variables de entorno y `createClient` están copiados idénticos en `send-push` y `storage-gc`.** `supabase-js@2` va sin versión fija | [código]; escéptico: severidad baja | `_shared/auth.ts`, fijar la misma versión del lock (`2.110.1`) |
| 32 | **El estado HTTP viaja metido en un `Error`, `diagnostics` se arma en tres bloques casi iguales, y `responseBody` y `engine` no los lee nadie** | [código]; escéptico: el `catch` de la URL no es código muerto | Devolver `{status, apnsId, error?}` sin lanzar; un solo helper de diagnóstico. Unas 20-28 líneas menos |
| 33 | **Las dos funciones de desuscribir** (`api.ts` y `pushStore.ts`) son la causa de D.5 | [código] | Dejar una |
| 34 | **El plan vive fuera de ROADMAP y su "Fase 3" choca con la Fase 3 de mapeo** | [código] | Registrar A–F en ROADMAP con un enlace a la bitácora y renombrar la fase |

---

## El plan, hallazgo por hallazgo

| Hallazgo | ¿Diagnóstico correcto? | ¿Solución correcta? | Qué cambiar |
|---|---|---|---|
| **A** endpoints huérfanos | Sí | **A.1 sí; A.2 no** | Dos iPhone, o un iPad y un Mac, comparten user agent: el navegador lo congela (Chrome reduce la versión a `<mayor>.0.0.0` con una plataforma fija, y Safari congeló la versión de iOS del UA en 18.6). Purgar por `(user_id, user_agent)` da de baja dispositivos sanos sin que nadie se entere. Quedarse con A.1 (`p_old_endpoint`) y, si hace falta, un `installation_id` en IndexedDB. **[fuente]** |
| **B** el CASCADE borra el rastro | Sí | **Incompleta** | Con `SET NULL` quedan `pending` huérfanos por cinco caminos de borrado. Usar un trigger `BEFORE DELETE`. |
| **C** carrera entre cron y panel | Sí | **Arriesgada** | `processing` no cabe en el CHECK actual y, sin recuperador, deja filas atascadas. El *lease* sobre `next_attempt_at` resuelve lo mismo sin estado nuevo. Falta el *fencing* y el `revoke`. |
| **D.1** «Activadas» falso | Sí | Con matices | No volver a pintar desde el servidor (reintroduce el parpadeo): campo `serverSync` aparte. |
| **D.2** carrera con `init()` | **No** | **No** | supabase-js espera a `initializePromise` antes de cada petición (`_getAccessToken` → `getSession`, comprobado en `node_modules`). Cortar la sincronización según `useAuthStore.user` la saltaría en casi todos los arranques. **[código]** |
| **D.3** resincronizar al iniciar sesión | Sí | Sí | Un único disparador, que cubra también el cierre de sesión implícito. |
| **D.4** forzar `unsubscribe()` + `subscribe()` | Caso sin base | **No** | Si `subscribe()` falla después, el dispositivo pierde una suscripción sana. Rotar solo con una señal: 410 visto, cambio de clave VAPID o un botón «Reparar». **[dispositivo]** |
| **D.5** `signOut` no reinicia el store | Sí | Mejor otra | Unificar las dos funciones de baja en vez de añadir una tercera. |
| **E.1** `showNotification` sin `catch` | Sí | Incompleta | El `catch` debe **mostrar** una notificación. |
| **E.2** leer `data.notification \|\| data` | Innecesario hoy | **Rompe** | Con esa línea el clic abre `/` y se pierde el `tag` **[simulado]**. Leer campo a campo con precedencia, y solo después quitar los campos planos. |
| **E.3** `pushsubscriptionchange` | Premisa falsa | **No** | Safari iOS no dispara ese evento: en MDN browser-compat-data figura `version_added: false`, frente a Safari de escritorio desde la 16, Chrome desde la 138 y Firefox parcial **[fuente]**. Reconciliar desde la página con el último endpoint confirmado. |
| **E.4** precache duplicado | Sí, pero inocuo | Baja prioridad | Tres de los cinco duplicados vienen de `includeManifestIcons`. |
| **F** diagnóstico en el panel | Sí | **Engañosa** | Vaciar la cola procesa los 100 avisos más antiguos de todos. Pasar `notificationId` a `send-push` y filtrar por él. |

**Lo que le falta al plan:** los P0 de arriba, la purga y la observabilidad, y
**el orden de las migraciones**. Añadir `p_old_endpoint` con
`create or replace` crea una segunda versión de la función y PostgREST no sabrá
cuál elegir. Hay que borrar primero la de cuatro argumentos, como hizo
`20260829000000`. Las funciones nuevas nacen con `EXECUTE` para `PUBLIC`, y cada
migración necesita su `.down.sql`.

### Orden propuesto

Se llaman **Push 0…6** para no chocar con las Fases 0–7 del mapeo.

0. **Proteger lo que funciona**, sin cambiar lo que se envía: cifrado a
   `_shared/webpush.ts` con tests, secretos validados al cargar, errores de
   escritura comprobados. ✅ en código
1. **`send-push` más robusto, sin migración:** clasificación HTTP, tope de
   payload, timeout, JWT reutilizado, `APP_ORIGIN`. ✅ en código
2. **Cola sin duplicados ni atascos.** Una sola migración B+C, porque las dos
   tocan el CHECK de estado: estado `expired`, trigger `BEFORE DELETE`, RPC de
   reclamo con *lease*, `revoke`/`grant` e índice de `subscription_id`, con su
   `.down.sql`, el baseline y DATABASE.md. Después, `send-push` con la RPC, en
   lotes, con envíos en paralelo y cierre en bloque. Para volver atrás,
   redesplegar la versión anterior.
3. **Suscripciones y avisos.** Migración A (borrar la versión de cuatro
   argumentos y crear la nueva con `p_old_endpoint default null`), `reminded_at`
   para el recordatorio que reaparece, recordatorios en su propio cron, purga,
   cron de `send-push` versionado, `wants_notification` cerrada y conteo de la
   difusión.
4. **Cliente:** D (versión corregida) y E (versión corregida), con tests.
5. **F:** filtrar por `notificationId`.
6. **Opcional:** adelgazar el payload, solo con el service worker nuevo
   adoptado y probado en iPhone.

---

## Lo que no se puede cerrar sin un dispositivo

- **En iOS 18.4 o superior con el service worker instalado**, ¿la notificación
  la pinta el bloque declarativo o el service worker? Las fuentes se
  contradicen, verificado:
  - **El blog de WebKit** dice que con service worker *"a push event is
    dispatched to it like before"*, y que la declarativa solo es respaldo.
  - **El borrador W3C** solo despacha `push` si `mutable` es `true`, y
    `send-push` no lo envía.

  De eso depende si al tocarla corre `notificationclick` o `navigate`. Probar con
  una marca distinta en cada camino.
- **¿Se agota la activación del gesto en Safari** con un `await` más antes de
  `subscribe()`? (D.4)
- **¿Qué hace Apple con un `Topic` repetido** y con un JWT renovado por envío?
- **¿Una pestaña de Safari iOS de verdad no expone `PushManager`?** (n.º 23)
