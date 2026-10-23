# Bitácora de push

Registro histórico. **No es un plan ni un procedimiento vigente.** Conservar el texto no equivale a comprobar hoy sus afirmaciones sobre servicios o dispositivos.

Procedencia: `docs/PUSH_REWORK_LOGBOOK.md`, blob `a6537f14ef8587380745f332a739b63f1a9f61b8`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [decisiones de push](../../decisiones/notificaciones-push.md) y [referencia](../../referencia/notificaciones.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:docs/PUSH_REWORK_LOGBOOK.md`.

Los sucesores explican el estado actual y sus correcciones. La fecha declarada del 23 de octubre en textos incorporados por un commit del 22 se conserva con ambas procedencias. El experimento Push 6 retirado no retiró el payload híbrido.

<details>
<summary>Texto original íntegro de docs/PUSH_REWORK_LOGBOOK.md</summary>

~~~~markdown
# Bitácora y Contexto Técnico: Auditoría y Rework de Web Push (iOS / Multi-plataforma)

> **Fecha:** 2026-10-20
> **Estado (2026-10-21):** Fase 1 (Auditoría Estática) ✅ | Fase 2 (Diagnóstico en Vivo iOS + Windows) ✅ | Fase 3 (Rework) revisada en [PUSH_REWORK_REVIEW.md](PUSH_REWORK_REVIEW.md) y reordenada en P0–P6 (ver `ROADMAP.md` §17). P0 hecha en código, **sin desplegar**; el resto ⏳

---

## 1. Resumen Ejecutivo de lo Descubierto y Resuelto

### 1.1. Lo que cambió y funcionó
Durante la auditoría y el diagnóstico en vivo contra la base de producción (`dbligiwkenckurmybwyw`) y el iPhone del usuario (`id: 7ca845aa-d56a-4f36-bdf2-e55edc6deee5`, `User-Agent: Version/27.0.1 Mobile/15E148 Safari/604.1`), el iPhone pasó de no recibir a recibir. En ese tiempo cambiaron **varias cosas a la vez**:

1. **Cifrado propio con Web Crypto** (RFC 8291 `aes128gcm` + RFC 8188), en lugar de `npm:web-push@3.6.7` sobre los polyfills de `node:crypto` de Deno.
2. **Bloque declarativo** (`"web_push": 8030` + `"notification"` con `"navigate"` absoluto) junto a los campos planos que lee el service worker. iOS reciente (`Version/27.0.1`) lo muestra desde `webpushd` sin levantar el worker.
3. **`Urgency` pasó de `normal` a `high`** (con `TTL: 86400`).
4. **Reinstalación del WebClip** en el iPhone, que tenía endpoints Apple antiguos acumulados (`QC1hKavVyq7...`, `QOnyfrtUby...`, `QEVBrX5xCoDW_LgT6Iz1W...`) y posible penalización previa.
5. Además, el `sub` de VAPID pasó de `https://udp-map.vercel.app` a `mailto:soporte@udp.cl` (el código sustituía el secreto).

**No se aisló cuál de estos cambios fue el decisivo.** Apple responde `201 Created` aunque el payload no se pueda descifrar, así que ese código no sirve para distinguirlos, y no se afirma que `npm:web-push` corrompiera el cifrado. Por eso `ROADMAP.md` §17 prohíbe tocar cifrado, cabeceras y forma del payload sin probar en un iPhone.

### 1.2. Lo que YA está desplegado y verificado en producción (`send-push`)
En [`supabase/functions/send-push/index.ts`](../supabase/functions/send-push/index.ts) (ya está en el commit `eba61ee` y **desplegado en Supabase producción**):
- Se eliminó por completo `npm:web-push@3.6.7`.
- Se implementó desde cero el cifrado **RFC 8291 (`aes128gcm`) + RFC 8188** y la firma **RFC 8292 (VAPID ES256)** usando exclusivamente **Web Crypto API nativa (`crypto.subtle`)**, validado bit a bit contra los vectores oficiales del **Apéndice A del RFC 8291**.
- Se envía `Urgency: high` y `TTL: 86400`.
- Se implementó el payload híbrido **Declarative Web Push (`"web_push": 8030`) + Service Worker tradicional**.
- Se añadió un arreglo `diagnostics` en la respuesta JSON de `send-push` que reporta `deliveryId`, `subscriptionId`, `endpointPrefix`, `outcome`, `httpStatus` y `apnsId` (cabecera `apns-id` de Apple).
- **Resultado comprobado en vivo:** Tras reinstalar/re-registrar el WebClip en el iPhone (`endpoint: https://web.push.apple.com/QOmC9o2RptIuKXL2SuDl7...`), las notificaciones llegaron instantáneamente tanto en **Windows (`notify.windows.com`)** como en **iPhone (`web.push.apple.com`)**.

> **Nota importante sobre `VAPID_SUBJECT`:**
> El código original (introducido en el commit `0bde5aa` del 2026-07-22 por `maxxee1 <maximiliano.adonis@gmail.com>`) tenía `mailto:soporte@udp.cl` como fallback. Como **UDP Map es un proyecto estudiantil independiente y aún no está afiliado oficialmente con la UDP**, en la Fase 3 debe cambiarse ese fallback por un correo de contacto propio del proyecto estudiantil (por ejemplo `mailto:contacto@udpmap.cl` o el correo que defina el equipo), manteniendo siempre el prefijo `mailto:`. Además, en los secretos de Supabase (`VAPID_SUBJECT`) hoy está configurado `https://udp-map.vercel.app` (sin `mailto:`), por lo que el normalizador en `send-push/index.ts` debe seguir forzando un `mailto:` válido si `VAPID_SUBJECT` no empieza con `mailto:`.

---

## 2. Hallazgos de la Auditoría Estática Pendientes de Resolver en la Fase 3

> **Nota (2026-10-21):** el plan de la Fase 3 fue revisado en [PUSH_REWORK_REVIEW.md](PUSH_REWORK_REVIEW.md), que descarta A.2, D.2 tal cual, D.4, E.2 literal y E.3 tal cual, y reordena el trabajo en P0–P6 (`ROADMAP.md` §17). Lo de abajo es el plan original; donde discrepe, manda la revisión.

Aunque el envío y recepción en iOS y Windows ya funcionan con la nueva Edge Function, el resto de la arquitectura tiene **fallos estructurales** que deben corregirse en el rework (Fase 3) para garantizar entrega universal y cero estados fantasma:

### Hallazgo A — Acumulación de endpoints huérfanos por dispositivo en `public.push_subscriptions`
- **Problema:** Cuando iOS rota el endpoint o el usuario se re-suscribe, `register_push_subscription(p_endpoint, p_p256dh, p_auth, p_user_agent)` hace `INSERT ... ON CONFLICT (endpoint) DO UPDATE`, creando una fila nueva sin borrar el endpoint anterior de ese mismo dispositivo. Durante las pruebas en vivo, el usuario llegó a tener 3 endpoints de iPhone simultáneos en la tabla.
- **Solución:**
  1. Modificar `public.register_push_subscription` para aceptar `p_old_endpoint text DEFAULT NULL` y eliminar cualquier fila previa de ese `auth.uid()` que coincida con `p_old_endpoint`.
  2. Además, para cubrir rotaciones silenciosas de iOS donde el endpoint anterior se perdió, si el nuevo endpoint es del mismo origen de push (`split_part(p_endpoint, '/', 3)`) y mismo `user_agent` para el mismo `user_id`, limpiar duplicados antiguos del mismo dispositivo o limitar/purgar suscripciones obsoletas del mismo par `(user_id, user_agent)`.

### Hallazgo B — Borrado en cascada (`ON DELETE CASCADE`) destruye la evidencia de fallos en `notification_push_deliveries`
- **Problema:** En [`supabase/schema/baseline.sql`](../supabase/schema/baseline.sql), `notification_push_deliveries.subscription_id` tiene `REFERENCES public.push_subscriptions(id) ON DELETE CASCADE`. Cuando `send-push` recibe HTTP `404` o `410` y borra la fila de `push_subscriptions`, Postgres borra en cascada todas las filas de `notification_push_deliveries` de esa suscripción. No queda rastro de que el push falló por expiración.
- **Solución:**
  1. Hacer `subscription_id` nullable en `public.notification_push_deliveries`.
  2. Cambiar la FK a `ON DELETE SET NULL`.
  3. Añadir columna `endpoint text` (o conservar trazabilidad en `last_error` / `apns_id text`) en `notification_push_deliveries` y permitir estado `'expired'` en el `CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'expired'))`.
  4. En `send-push`, ante un `404`/`410`, primero actualizar la fila de `notification_push_deliveries` a `status = 'expired'` con el detalle del error y luego borrar la suscripción de `push_subscriptions`.

### Hallazgo C — Condición de carrera entre `pg_cron` y `drainPushQueue()` (sin bloqueo atómico)
- **Problema:** Confirmado en vivo durante la Fase 2: `pg_cron` invoca `send-push` cada minuto (`* * * * *`). Cuando el cliente llama a `drainPushQueue()` al mismo tiempo, ambas ejecuciones hacen `SELECT ... WHERE status = 'pending'` sin bloqueo de fila (`FOR UPDATE SKIP LOCKED`), procesando o compitiendo por las mismas entregas.
- **Solución:**
  1. Crear una función RPC `public.claim_pending_push_deliveries(p_limit integer DEFAULT 100)` (`SECURITY DEFINER`, restringida a `service_role`) que reclame atómicamente las filas pendientes listas (`status = 'pending' AND next_attempt_at <= now()`) usando `FOR UPDATE SKIP LOCKED`, actualice su `status = 'processing'` (o incremente `next_attempt_at` temporalmente como lease de 2 minutos por si el worker muere a mitad de vuelo) y devuelva el conjunto reclamado junto con los datos de `notifications` y `push_subscriptions`.

### Hallazgo D — Falso estado «Activadas» (`subscribed`) en el cliente ([`src/features/notifications/pushStore.ts`](../src/features/notifications/pushStore.ts))
- **Problema:**
  1. `seedState()` y `resolvePushState()` confían ciegamente en `localStorage.getItem('udpmap.push.subscribed') === 'true'` y en `pushManager.getSubscription()` del navegador antes de saber si el endpoint existe en `public.push_subscriptions` para el usuario autenticado.
  2. `usePushForegroundSync()` en [`src/app/App.tsx`](../src/app/App.tsx) corre en el primer render, **antes** de que `useAuthStore.getState().init()` termine de restaurar la sesión de Supabase. Si la RPC `register_push_subscription` corre sin sesión o falla, `syncPushSubscription()` atrapa el error con `console.error` y deja la UI diciendo «Activadas».
  3. Si el usuario inicia sesión después de que `App` montó, nadie vuelve a disparar `syncPushSubscription()`.
  4. `subscribeToPush()` reutiliza `const current = await registration.pushManager.getSubscription()`. Si el usuario pulsa «Activar» para reparar una suscripción rota, el navegador le devuelve el mismo endpoint viejo en lugar de pedir uno fresco a APNs/FCM/WNS.
  5. `useAuthStore.signOut()` en [`src/features/auth/authStore.ts`](../src/features/auth/authStore.ts) desuscribe el navegador al cerrar sesión, pero **no resetea `usePushStore`** (`state` queda en `'subscribed'` y `localStorage` queda en `'true'`).
- **Solución:**
  1. En `subscribeToPush()`: si existe `current`, guardar `oldEndpoint = current.endpoint`, llamar a `await current.unsubscribe()` para forzar a APNs/FCM/WNS a emitir un endpoint nuevo, crear la nueva suscripción con `pushManager.subscribe(...)` y pasar `oldEndpoint` a `registerPushSubscription(subscription, oldEndpoint)`.
  2. En `syncPushSubscription()`: verificar que haya usuario autenticado en `useAuthStore`. Si `registerPushSubscription` confirma el registro, mantener `subscribed`; si no hay sesión o falla por autorización, no mentir en el estado.
  3. En `usePushForegroundSync()`: suscribirse también a los cambios de `useAuthStore` (`user?.id`) para que en cuanto la sesión termine de hidratarse o el usuario inicie sesión, se sincronice la suscripción push con la base.
  4. En `authStore.ts` (`signOut`): llamar a un helper `resetPushStateOnSignOut()` de `pushStore.ts` que limpie `usePushStore` (`state: 'idle'`, `endpoint: null`, `writeLastKnown(false)`).

### Hallazgo E — Hardening de [`public/push-sw.js`](../public/push-sw.js) y [`vite.config.ts`](../vite.config.ts)
- **Problema:**
  1. En `public/push-sw.js`, `self.registration.showNotification(title, options)` no tiene `.catch(...)` de respaldo. Si algún campo de `options` falla, la promesa rechaza y WebKit penaliza la suscripción por violar `userVisibleOnly`.
  2. Ahora que `send-push` envía formato híbrido Declarative Web Push (`data.notification`), `push-sw.js` debe leer `const notif = data.notification || data` para soportar tanto el bloque declarativo como el plano.
  3. En `pushsubscriptionchange`, debe aprovechar `event.oldSubscription?.endpoint` y re-suscribir usando `event.newSubscription` si el navegador ya la provee.
  4. En `vite.config.ts`, `includeAssets: ['favicon.svg', 'push-sw.js']` duplica entradas que ya captura `globPatterns: ['**/*.{js,css,html,svg,png,woff2}']` en Workbox (generando 5 entradas duplicadas en `dist/sw.js`), y falta `clientsClaim: true` en `workbox`.

### Hallazgo F — Diagnóstico detallado en [`src/features/admin/SettingsPanel.tsx`](../src/features/admin/SettingsPanel.tsx)
- **Problema:** Al pulsar «Enviar notificación de prueba», `SettingsPanel.tsx` solo muestra un texto genérico sin indicar si `send-push` encontró suscripciones activas, cuántos dispositivos recibieron `201 Created`, cuál fue el `apnsId` o si algún endpoint expiró/falló.
- **Solución:** Actualizar el tipo de retorno de `drainPushQueue()` en [`src/features/admin/api.ts`](../src/features/admin/api.ts) para incluir `diagnostics` y mostrar en `SettingsPanel.tsx` el resultado real por dispositivo (más un botón opcional para probar notificación local del Service Worker en el dispositivo actual).

---

## 3. Reglas Obligatorias del Repositorio (`CLAUDE.md` / `AGENTS.md`)

Cualquier agente o subagente que toque este repositorio **DEBE** cumplir sin excepción:

1. **Regla de los tres archivos de base de datos:** Si se toca el esquema SQL (tablas, columnas, constraints, funciones RPC, políticas RLS), en el mismo cambio se deben actualizar **los 3 archivos**:
   - Nueva migración en `supabase/migrations/<timestamp>_descripcion.sql`
   - [`supabase/schema/baseline.sql`](../supabase/schema/baseline.sql)
   - [`docs/DATABASE.md`](DATABASE.md)
   *(Recordar avisarle al usuario o aplicar la migración contra Supabase).*
2. **Modo Demo (`supabase === null`):** Toda función nueva en `api.ts` debe contemplar el camino sin credenciales de Supabase (`if (!supabase) ...`) para no romper el modo demo en memoria.
3. **Estilo e idioma:**
   - Comentarios en **español**, explicando **por qué** (no qué).
   - Textos de interfaz mediante `i18n` (`t('clave', 'respaldo')`) y actualizando los catálogos ES/EN si se añaden claves nuevas (`npm run check:i18n`).
4. **Verificación obligatoria antes de dar por terminado:**
   ```bash
   npm run typecheck && npx vitest run && npx eslint src
   ```
   *(En PowerShell de Windows, si `npx.ps1` está bloqueado por ExecutionPolicy, usar `npx.cmd` o `node`).*
5. **Seguridad:** Nunca guardar tokens (`sbp_...`) ni `service_role` dentro del repositorio.

~~~~

</details>
