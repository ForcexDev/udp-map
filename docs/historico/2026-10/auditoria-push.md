# Auditoría y revisión de push

Registro histórico. **No es un plan ni un procedimiento vigente.** Conservar el texto no equivale a comprobar hoy sus afirmaciones sobre servicios o dispositivos.

Procedencia: `docs/PUSH_REWORK_REVIEW.md`, blob `9d76e2149d5a361aaea156a16cfe270ca7c7d944`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [decisiones de push](../../decisiones/notificaciones-push.md), [referencia](../../referencia/notificaciones.md) y [operación](../../guias/despliegue.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:docs/PUSH_REWORK_REVIEW.md`.

Los sucesores explican el estado actual y sus correcciones. La fecha declarada del 23 de octubre en textos incorporados por un commit del 22 se conserva con ambas procedencias. El experimento Push 6 retirado no retiró el payload híbrido.

<details>
<summary>Texto original íntegro de docs/PUSH_REWORK_REVIEW.md</summary>

~~~~markdown
# Revisión del sistema de push y del plan de rework

> **Fecha:** 2026-10-21 · **Sobre:** `main` en `eba61ee` · **Plan revisado:**
> [PUSH_REWORK_LOGBOOK.md](PUSH_REWORK_LOGBOOK.md) (Hallazgos A–F)

## Estado (2026-10-22): Push 0–6 hechas en código, sin desplegar

Nada de lo de abajo está aplicado en la base, desplegado ni probado en un iPhone.
El detalle de cada fase y el orden de despliegue están en ROADMAP §17.

- **Push 3** resuelve los hallazgos **11, 15–19** y el tope de la difusión que
  quedaba del **5**: `reminded_at` (11), purga y vista de fallos por servicio
  (15), `wants_notification` cerrada (16), recordatorios en su propio cron (17),
  cron de `send-push` versionado con timeout (18) y difusión que cuenta bien y
  con límites (19). Migraciones `20261021000100` y `20261021000200`, y `send-push`
  sin recordatorios.
- **Push 4** resuelve **20–29 y 33**: `serverSync`, baja única, sesión que termina
  sin `signOut`, pista de iOS, «Reintentar», menos RPC, service worker con
  respaldo, tests, demo e i18n (en el 29 siguen con texto fijo los avisos de baja
  de dispositivo de `BroadcastPanel`).
- **Push 5** resuelve **F**: el autotest del panel pasa `notificationId` a
  `send-push` y lee sus entregas por estado, y una tarjeta cuenta las entregas por
  servicio.
- **Push 6** resuelve el **37 %** del payload duplicado, **tras el secreto**
  `PUSH_PAYLOAD_FORMAT`: apagada por defecto, y solo se activa con el service
  worker nuevo adoptado y probado en un iPhone.
- **Quedan fuera:** el `sub` VAPID (1, a medias), TTL por tipo y `Topic` (9),
  recordar los endpoints caducados (30) y `_shared/auth.ts` con la versión fija
  de `supabase-js` (31 y 32).

**Push 2** resuelve los hallazgos **12, 13 y 14** con la migración
`20261021000000_push_queue_lease` y el `send-push` que reclama por RPC: lease,
fencing, trigger `BEFORE DELETE` e índice. El detalle y el orden de despliegue
están en ROADMAP §17.

**Push 0 y 1:**

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
- **5** Tope de 3993 B como fallo terminal. La cota de longitud de la RPC de difusión (60 y 180 caracteres) llegó con Push 3, y quitar el `payload` duplicado, con Push 6 y su secreto.
- **6** Timeout de 10 s por envío.
- **7** Secretos VAPID validados al cargar; si están mal, 500 sin tocar la cola.
- **8** JWT VAPID reutilizado por origen 11 h.
- **10** `APP_ORIGIN` opcional.
- **9 queda:** `Urgency` no se toca; TTL por tipo y `Topic` pendientes.

Cifrado, cabeceras y forma del payload no cambian.

---

## Balance del rework (2026-10-22)

Comparación entre `eba61ee`, lo que está en producción, y `d298270`, el rework
entero en código. Todo lo de la columna "después" está probado en tests y en
Postgres real (PGlite), pero **nada se ha probado todavía en un iPhone ni contra
el Supabase de producción**.

### Qué cambió de verdad, en una frase

Lo que se le manda al servicio push **no cambió**: cifrado, cabeceras, payload y
`sub` VAPID son byte a byte los de `eba61ee`. Lo comprueba `golden.test.ts`, y se
verificó descifrando los envíos de las dos versiones en 28 casos. Cambió todo lo
de alrededor: cómo se reparte la cola, qué queda escrito en la base y cómo el
cliente cuenta su propio estado.

### Antes y después

| Aspecto | Antes (`eba61ee`) | Después |
|---|---|---|
| Dos ejecuciones a la vez (cron + panel, o un lote de más de 60 s) | Envían lo mismo dos veces | Reclamo con *lease* y `skip locked`; un cierre atrasado no pisa nada (*fencing*) |
| Ritmo | En serie, ~100 por minuto, ~102 llamadas a la base por lote | 10 envíos a la vez, lotes de 50 con un cierre por lote, hasta 300 por pasada |
| Un servicio push colgado | Frena el lote entero | Timeout de 10 s por envío |
| Errores 400/401/403/413 | Se reintentan 5 veces | Fallo terminal al momento; un 403 avisa de revisar VAPID |
| 429 y 5xx | Backoff fijo, sin mirar `Retry-After` | Respetan `Retry-After`, acotado a 1–60 min |
| Configuración VAPID rota | Cada entrega la cobra como fallo; agota la cola en ~2 h | 500 al cargar, sin tocar la cola |
| Una ejecución que muere a mitad | Nada la recupera | Sus entregas vuelven solas al vencer el lease, con el intento ya contado |
| Suscripción caducada (410) | El CASCADE borra el rastro de sus fallos | Quedan como `expired`, con el host del servicio que las rechazó |
| Baja de suscripción por otros caminos (signOut, admin, borrar cuenta) | Borra el rastro igual | El trigger las pasa a `expired`; ninguna se queda `pending` para siempre |
| Errores de escritura en la base | Se ignoran | Se comprueban y van al diagnóstico |
| JWT VAPID | Uno por envío | Reutilizado por origen 11 h |
| Payload | Sin control de tamaño | Más de 3993 B es fallo terminal; el formato declarativo (37 % menos) está listo tras un secreto, apagado |
| Recordatorio de evento | Vuelve a sonar al minuto si el usuario borra el aviso | `reminded_at`: no se repite |
| Recordatorios | Se recalculan dentro de `send-push` cada minuto | Cron propio en SQL, que solo mira los RSVP sin recordatorio |
| Cron de `send-push` | Solo en el runbook; pg_net corta a los 5 s | Versionado en migración, con timeout de 10 s; al cron se le contesta 202 y la pasada sigue en segundo plano |
| Historial | No se borra nada nunca | Purga diaria: entregas a los 30 y 90 días, avisos a los 180 y 365 |
| iPhone que rota su endpoint | La fila vieja se queda colgando | `p_old_endpoint` la reemplaza y le pasa las entregas pendientes |
| Preferencias de avisos | Cualquier usuario con sesión podía leer las de otro | Cerradas a la API |
| Difusión | Cuenta mal, choca si hay dos en el mismo segundo, sin límite de longitud | Cuenta solo lo creado, `dedupe_key` por uuid, 60 y 180 caracteres |
| Autotest del panel | Vacía los 100 avisos más antiguos de todos | Sigue solo su aviso y dice cuántas entregas salieron, quedaron pendientes o fallaron |
| Saber qué servicio falla | Imposible desde el panel | Tarjeta de entregas por servicio, con el último error |
| «Activadas» | Aunque el servidor no sepa nada del dispositivo | Lo dice aparte (`serverSync`) y deja reintentar |
| Cerrar sesión | Borra la fila antes de desuscribir; si falla, sigue llegando lo de la cuenta anterior | Desuscribe primero el navegador; la sesión que caduca sola también da de baja |
| Pista «añadir a pantalla de inicio» en Safari de iOS | No aparece nunca | Aparece |
| Un push que no se puede pintar | No se muestra nada, y Safari puede revocar el permiso | Se muestra un aviso mínimo |
| Tests de push | Ninguno de la criptografía ni del ciclo de vida | Vector del RFC 8291, cola, payload, regla de oro, ciclo de vida, service worker, panel |
| Reconstruir la base desde el baseline | Falla a mitad | Corre de una pasada |

### Cuánto cuesta

- **Código.** De `eba61ee` a `d298270` cambian 41 archivos:
  - ~1.840 líneas netas de código de la app y de la Edge Function;
  - ~1.800 de SQL, entre migraciones y baseline;
  - ~2.780 de tests;
  - ~950 de documentación.
  - `send-push/index.ts` pasa de 458 a 687 líneas, `pushStore.ts` de 307 a 587 y `push-sw.js` de 99 a 138. Los tests van de 290 a 475.
- **Piezas que mantener.** Tres migraciones que se aplican a mano y en orden, dos cron nuevos, dos RPC de cola con su contrato, un secreto opcional y más estados en el cliente (`serverSync`, la operación en curso, el endpoint confirmado).
- **Orden de despliegue estricto.**
  - El `send-push` nuevo exige las tres migraciones. Sin la `000200` deja de encolar recordatorios sin avisar a nadie.
  - Deshacer la `000200` exige volver antes a un `send-push` que todavía los encole.
- **Comportamientos que cambian a propósito:**
  - La purga borra avisos leídos de más de 180 días.
  - Un push de texto plano, que hoy solo manda el botón de DevTools, ya no enseña ese texto: sale el aviso mínimo.
- **Riesgos pequeños que quedan:**
  - Con 10 envíos a la vez, una suscripción caducada puede recibir hasta 10 envíos inútiles antes del primer 410. El usuario no ve duplicados.
  - Una entrega movida por `p_old_endpoint` justo cuando se estaba enviando puede acabar `expired`.
  - El límite de CPU de 2 s de la Edge Function no está medido con una difusión real.

### Veredicto

**Bueno, con una condición.** El rework arregla lo que fallaría en cuanto hubiera
concurrencia, errores o más volumen: duplicados, colas atascadas, reintentos
inútiles, rastro perdido y estados falsos en el cliente. Además lo deja medido y
con tests donde antes no había ninguno. El código crece, pero casi la mitad de lo
nuevo son tests, y lo que se añade a la app es lógica que antes faltaba, no
relleno.

La condición es que nada de esto ha pasado todavía por un iPhone. Lo que hoy
entrega no se tocó, y eso baja el riesgo, pero el service worker y el cliente sí
cambiaron. Por eso el orden de despliegue de ROADMAP §17 pide probar en el
dispositivo después de cada paso, y deja la vuelta atrás a un redespliegue de
`4eae308`.

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
2. ✅ en código. **Cola sin duplicados ni atascos.** Una sola migración B+C, porque las dos
   tocan el CHECK de estado: estado `expired`, trigger `BEFORE DELETE`, RPC de
   reclamo con *lease*, `revoke`/`grant` e índice de `subscription_id`, con su
   `.down.sql`, el baseline y DATABASE.md. Después, `send-push` con la RPC, en
   lotes, con envíos en paralelo y cierre en bloque. Para volver atrás,
   redesplegar la versión anterior.
3. **Suscripciones y avisos.** Migración A (borrar la versión de cuatro
   argumentos y crear la nueva con `p_old_endpoint default null`), `reminded_at`
   para el recordatorio que reaparece, recordatorios en su propio cron, purga,
   cron de `send-push` versionado, `wants_notification` cerrada y conteo de la
   difusión. ✅ en código
4. **Cliente:** D (versión corregida) y E (versión corregida), con tests. ✅ en
   código
5. **F:** filtrar por `notificationId`. ✅ en código
6. **Opcional:** adelgazar el payload, solo con el service worker nuevo
   adoptado y probado en iPhone. ✅ en código, apagada por defecto tras el secreto
   `PUSH_PAYLOAD_FORMAT`

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

~~~~

</details>
