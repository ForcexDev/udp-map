# Web Push y cola de moderación — etapas y Definition of Done

La implementación está separada en etapas comprobables. Solo debe marcarse una etapa como lista después
de validar su Definition of Done en Supabase y en navegadores reales.

> **Estado (verificado 2026-10-21):** las etapas 1 a 7 están implementadas en el código. Las
> casillas se conservan como criterio de verificación, no como plan pendiente. Los tipos de aviso,
> las categorías y las tablas vigentes están en [DATABASE.md](DATABASE.md) §4 (la matriz de abajo
> es la lista de orígenes con su destino); dónde tocar cada pieza, en [REPO_MAP.md](REPO_MAP.md).

## Matriz de notificaciones

| Audiencia | Sección | Origen | Destino |
|---|---|---|---|
| Personal | Perfil | Nueva insignia/logro | `/perfil?tab=badges` |
| Personal | Foro | Respuesta al hilo o comentario del usuario | `/foro?thread={id}` |
| Personal | Eventos | Evento con RSVP dentro de los próximos 20 días | `/eventos?event={id}` |
| Personal | Perfil | Resolución de un reporte enviado | `/perfil` |
| Personal | Pines | Un pin tuyo queda verificado (`pin_verified`) | `/mapa?pin={id}` |
| Personal | Pines | Comentario en un pin tuyo (`pin_comment`) | `/mapa?pin={id}` |
| Personal | Eventos | Evento oficial de tu facultad (`event_official`) | `/eventos?event={id}` |
| Personal | Sistema | Difusión del panel de administración (`announcement`) | La ruta que elija quien difunde (`/` por defecto) |
| Administrador | Moderación | Nuevo contenido reportado | `/admin/moderacion?report={id}` (el SQL guarda `/moderacion?report={id}` y la app lo redirige) |

Los administradores conservan sus avisos personales, pero Moderación se muestra en un bloque
**Administración** separado. Los moderadores no acceden a esa cola.

## Etapa 1 — Esquema y RLS

Alcance: el esquema vigente en `supabase/schema/baseline.sql`. La migración original
`20260722000001_notifications_and_moderation.sql` se archivó en `supabase/_archive/migrations/`.

### Definition of Done

- [ ] La migración se aplica completa sin errores.
- [ ] Un estudiante solo lee sus notificaciones y sus reportes.
- [ ] Un estudiante no inserta notificaciones, no lee entregas push y no modifica reportes directamente.
- [ ] Solo `admin` consulta la cola completa; `student` y `moderator` no pueden hacerlo.
- [ ] Dos reportes activos del mismo usuario contra el mismo contenido producen un solo caso.
- [ ] Las claves privadas VAPID y el service role no aparecen en el frontend ni en tablas públicas.

## Etapa 2 — Generación automática

### Definition of Done

- [ ] Una insignia nueva crea exactamente un aviso `achievement` para su dueño.
- [ ] Un comentario raíz notifica al creador del hilo; una respuesta anidada, al comentario padre.
- [ ] Las autorrespuestas no generan notificación.
- [ ] Un RSVP cuyo evento comienza entre ahora y 20 días crea un solo `event_reminder`.
- [ ] Ejecutar varias veces `enqueue_upcoming_event_notifications()` no duplica recordatorios.
- [ ] Resolver un reporte avisa al reportante sin exponer notas internas.

## Etapa 3 — Suscripción Web Push

Configuración requerida:

1. Generar un par VAPID.
2. Configurar `VITE_VAPID_PUBLIC_KEY` en el frontend.
3. Configurar como secretos de `send-push`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT`, `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y opcionalmente `ALLOWED_ORIGINS` (lista de dominios separados por coma).
4. Servir producción por HTTPS.
5. **Configuración de CORS estricto:** La Edge Function autoriza por defecto únicamente coincidencias exactas con `http://localhost:5173`, `http://localhost:4173`, `http://localhost:3000` y `https://udp-map.vercel.app`. Si el dominio cambia en el futuro, se puede configurar en Supabase la variable de entorno `ALLOWED_ORIGINS=https://nuevo-dominio.cl`.

### Definition of Done

- [ ] **Activar** pide permiso y crea una suscripción asociada al usuario actual.
- [ ] Recargar mantiene el estado activado; **Desactivar** desuscribe el navegador y, después, borra la fila
  (si el servidor falla, el dispositivo queda dado de baja igual). Si falla el navegador, **Reintentar** vuelve
  a desactivar, no a activar.
- [ ] Cerrar sesión usa esa misma baja —navegador primero, fila después— antes de cerrar la sesión, y deja el
  estado de push reiniciado.
- [ ] Si la sesión termina sin pasar por **Cerrar sesión** (otra pestaña, token caducado), el navegador se
  desuscribe solo en local; al iniciar sesión de nuevo se vuelve a resolver y sincronizar. El arranque nunca da
  de baja nada.
- [ ] «Activadas» sale del navegador. Si el servidor no pudo registrar el dispositivo (error o sin sesión), la
  tarjeta lo avisa y ofrece reintentar la sincronización; no se queda en «Activadas» sin más.
- [ ] Otro usuario en el mismo navegador reasigna el endpoint mediante RPC, sin romper RLS.
- [ ] Si el navegador rota el endpoint, el cliente manda el último que el servidor confirmó
  (`p_old_endpoint`, guardado en `localStorage` como `udpmap.push.endpoint`) para que la base mueva las
  entregas pendientes. Con la migración `20261021000100` sin aplicar se reintenta sin él.
- [ ] La página no repite el registro del mismo usuario y endpoint hace menos de una hora.
- [ ] En iPhone fuera de la pantalla de inicio sale la pista de instalación aunque Safari no exponga la Push API.
- [ ] Un navegador sin Push API o con permiso denegado sigue usando la app sin errores. En modo demo (sin
  Supabase) la tarjeta de push no se muestra.

## Etapa 4 — Envío y service worker

Despliegue requerido:

1. Desplegar `send-push` respetando `supabase/config.toml`. La función autoriza por
   `x-cron-secret` o por una sesión de administrador.
2. Programar cada minuto un `POST` a
   `https://{project-ref}.supabase.co/functions/v1/send-push` con
   `x-cron-secret: {CRON_SECRET}`.
3. Nunca enviar el service role desde el cron ni desde el cliente.

### Definition of Done

- [ ] El cron responde 200 con `processed`, `sent` y `failed`.
- [ ] Se crea una entrega por dispositivo y una entrega exitosa no se reenvía.
- [ ] Errores transitorios usan backoff y terminan tras cinco intentos.
- [ ] Respuestas 404/410 eliminan el endpoint vencido.
- [ ] Pulsar el push abre/enfoca la PWA, navega al destino y marca leído el aviso.
- [ ] `push-sw.js` lee cada campo del bloque declarativo y, si falta, del campo plano; con el payload
  actual pinta lo mismo que antes. Si no puede leer el payload o `showNotification` falla, muestra una
  notificación mínima (Safari revoca el permiso si un push no muestra nada). `pushsubscriptionchange` usa la
  clave de la suscripción perdida y cae a la constante; iOS no dispara ese evento. Lo prueba
  `pushServiceWorker.test.ts`.
- [ ] El payload no contiene correos, secretos ni notas internas.

## Etapa 5 — Sidebar de Notificaciones

### Definition of Done

- [ ] **Comunidad** se reemplaza por **Notificaciones** (`Notifications` en inglés).
- [ ] Perfil, Foro y Eventos muestran contadores separados y hasta tres avisos recientes.
- [ ] Abrir un aviso lo marca leído; abrir una sección marca leída esa categoría.
- [ ] Realtime actualiza los contadores sin recargar.
- [ ] Invitados no ven datos privados.
- [ ] Administradores ven **Tus notificaciones** y **Administración** por separado.

## Etapa 6 — Reportes de contenido

### Definition of Done

- [ ] Un usuario autenticado reporta contenido ajeno en pines, comentarios, hilos y respuestas.
- [ ] Invitados y autores del contenido no tienen la acción disponible.
- [ ] Los motivos y el máximo de 1000 caracteres se validan también en servidor.
- [ ] La RPC verifica que el contenido exista y guarda un snapshot generado en servidor.
- [ ] Cada reporte crea un aviso para cada administrador, sin avisar al autor reportado.

## Etapa 7 — Cola administrativa

### Definition of Done

- [ ] La cola vive en `/admin/moderacion` y solo entran administradores: `AdminLayout` redirige a `/mapa` a
  cualquier otro rol. La ruta vieja `/moderacion` se conserva porque `notify_content_report` sigue guardando
  esa url en los avisos; `LegacyModerationRedirect` la reenvía a `/admin/moderacion` conservando `?report=`.
- [ ] Admin filtra Pendientes, En revisión, Resueltos y Descartados.
- [ ] **Tomar caso** asigna el reporte; otro admin no puede resolverlo mientras está asignado.
- [ ] **Descartar** conserva el contenido y registra administrador, nota y hora.
- [ ] **Eliminar** borra el original, conserva el snapshot y registra la resolución.
- [ ] El reportante recibe un aviso de cierre sin ver la nota interna.
- [ ] Cola y avisos administrativos se actualizan en tiempo real.

## Etapa 8 — Cierre operativo

### Definition of Done

- [ ] Se validan los casos en Chrome/Edge de escritorio y Android como PWA instalada.
- [ ] Se validan permiso denegado, endpoint vencido y cambio de usuario.
- [ ] El cron funciona al menos un ciclo completo y no deja entregas sobre cinco intentos.
- [ ] Ningún secreto aparece en `dist`, variables `VITE_*` o payloads push.
