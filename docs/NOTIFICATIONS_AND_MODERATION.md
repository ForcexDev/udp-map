# Web Push y cola de moderación — etapas y Definition of Done

La implementación está separada en etapas comprobables. Solo debe marcarse una etapa como lista después
de validar su Definition of Done en Supabase y en navegadores reales.

## Matriz de notificaciones

| Audiencia | Sección | Origen | Destino |
|---|---|---|---|
| Personal | Perfil | Nueva insignia/logro | `/perfil?tab=badges` |
| Personal | Foro | Respuesta al hilo o comentario del usuario | `/foro?thread={id}` |
| Personal | Eventos | Evento con RSVP dentro de los próximos 20 días | `/eventos?event={id}` |
| Personal | Perfil | Resolución de un reporte enviado | `/perfil` |
| Administrador | Moderación | Nuevo contenido reportado | `/moderacion?report={id}` |

Los administradores conservan sus avisos personales, pero Moderación se muestra en un bloque
**Administración** separado. Los moderadores no acceden a esa cola.

## Etapa 1 — Esquema y RLS

Alcance: migración `20260722000001_notifications_and_moderation.sql`.

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
   `VAPID_SUBJECT`, `CRON_SECRET`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
4. Servir producción por HTTPS.

### Definition of Done

- [ ] **Activar** pide permiso y crea una suscripción asociada al usuario actual.
- [ ] Recargar mantiene el estado activado; **Desactivar** borra la fila y desuscribe el navegador.
- [ ] Cerrar sesión elimina la suscripción antes de cerrar la sesión.
- [ ] Otro usuario en el mismo navegador reasigna el endpoint mediante RPC, sin romper RLS.
- [ ] Un navegador sin Push API o con permiso denegado sigue usando la app sin errores.

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

- [ ] `/moderacion` redirige a estudiantes y moderadores.
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
