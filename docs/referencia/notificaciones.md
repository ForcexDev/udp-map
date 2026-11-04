# Notificaciones, push y moderación

Contrato actual del circuito de avisos: generación SQL, bandeja, suscripciones,
envío y toque. El modelo persistente vive en
[base de datos](base-de-datos.md#avisos-y-cola-push); los motivos y alternativas,
en [decisiones push](../decisiones/notificaciones-push.md).
La [guía operativa](../guias/despliegue.md) configura el entorno y
[validación](../guias/validacion.md#push-y-moderacion) separa pruebas de código
y dispositivos.

## Orígenes y destinos

`create_notification` usa tipo, categoría, audiencia y dedupe por usuario.
La categoría agrupa presentación y preferencias; no es el tipo del evento.

| Tipo                | Categoría / audiencia | Origen y destino                                                                                 |
| ------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| `forum_reply`       | forum / personal      | Respuesta al hilo o comentario padre; `/foro?thread=…`                                           |
| `achievement`       | profile / personal    | Insignia; `/perfil?tab=badges`                                                                   |
| `event_reminder`    | events / personal     | Evento marcado dentro de la ventana de 20 días; `/eventos?event=…`                               |
| `moderation_report` | moderation / admin    | Denuncia nueva; SQL guarda `/moderacion?report=…` y el router conserva el parámetro al redirigir |
| `moderation_update` | profile / personal    | Resolución del reporte propio; `/perfil`                                                         |
| `announcement`      | system / personal     | Difusión o autotest; ruta elegida o `/`                                                          |
| `pin_verified`      | pins / personal       | Verifican una publicación propia; `/mapa?pin=…`                                                  |
| `pin_comment`       | pins / personal       | Comentan la publicación propia; `/mapa?pin=…`                                                    |
| `event_official`    | events / personal     | Evento oficial de la facultad; `/eventos?event=…`                                                |

No se notifica la autorrespuesta. El recordatorio de quien marcó asistencia y
el aviso de evento oficial a su facultad resuelven casos distintos: no hace
falta haber descubierto/marcado el evento para recibir el segundo. La audiencia
oficial se limita según facultad y condiciones de `notify_faculty_official_event`,
no es una difusión universal de cualquier evento.

Las preferencias son categoría × canal `in_app/push`. Sin fila se permite;
push no puede estar habilitado si in_app está apagado. Los avisos de audiencia
admin no se silencian. Las reglas de permisos y dedupe están en la referencia DB.

## Bandeja y avisos del equipo

`NotificationCenter` muestra audiencia personal, agrupada en Hoy, Esta semana
y Antes, con filtros por categoría. No limita a tres avisos por sección ni
marca todo como leído por abrir un filtro. Abrir un aviso lo marca; los botones
permiten cambiar leído/no leído, marcar todos y borrar. «Vaciar todo» pide
confirmación y borra solo personales: no destruye trabajo administrativo oculto.

`useNotifications` comparte caché, invalida por realtime y aplica mutaciones
optimistas con copia/restauración ante error. Un fallo de consulta tiene estado
de error y reintento, no se representa como «no tienes avisos».
`notificationMeta` elige icono/color y agrupa por día de calendario; una
categoría desconocida tiene respaldo para no romper el render.

Los avisos de equipo están en `ReportsPanel/TeamInbox`, dentro de
`/admin/moderacion`. Su lectura masiva es una acción explícita; montar el panel
no acredita que los casos hayan sido atendidos.
`NotificationBanner` es la presentación en primer plano y no sustituye Web Push.

## Estado del dispositivo y sesión

`pushStore` es una instancia fuera de React. `App` monta
`usePushForegroundSync(userId)` por encima del Sidebar, que puede desmontarse.
Resolver estado y volver a primer plano sincronizan una suscripción existente;
no piden permiso ni crean una nueva por el mero arranque.

El estado local del navegador y el registro del servidor son distintos.
`seedState` reduce el parpadeo de la tarjeta al arrancar: resuelve
primero instalación iOS, soporte y permiso. Con permiso default siembra idle;
con permiso concedido usa subscribed si recuerda una suscripción local y
unknown si no la recuerda. Solo unknown muestra esqueleto. La consulta del
worker corrige esa siembra; la memoria local no confirma registro remoto.
`serverSync` informa si el servidor confirmó o necesita sesión/reintento.
Un error de red no debe aparentar que se guardó ni destruir una suscripción sana.

Al activar se usa gesto de usuario, permiso y clave VAPID pública. Se reutiliza
una suscripción existente en lugar de romperla antes de conseguir otra.
Se evita repetir registros recientes del mismo usuario/endpoint durante una hora.
El último endpoint confirmado se conserva como `udpmap.push.endpoint` y permite
enviar `p_old_endpoint` cuando rota. La API conserva reintento sin ese argumento
si falta la migración correspondiente.

`disablePushOnThisDevice` es la baja común: desuscribe el navegador antes de
borrar la fila remota. Si falla el navegador, el reintento sigue siendo baja;
si falla el servidor después, la suscripción local ya no recibe. `signOut`
la intenta antes de cerrar sesión para conservar credenciales y después reinicia
el estado, aunque la baja falle.

Si la sesión termina por otra pestaña o sin pasar por el botón, el efecto de
primer plano detecta el cambio y hace la baja local; un inicio de sesión posterior
vuelve a resolver/sincronizar. No se da de baja indiscriminadamente al arrancar.
Cambiar de cuenta reasocia el endpoint mediante RPC, sin permitir retirar un
endpoint ajeno solo porque el cliente lo conoce.

En demo no se muestra la tarjeta push. Sin API, con permiso denegado o en
iPhone fuera de pantalla de inicio se presentan los estados/pistas previstos.
La compatibilidad real de cada navegador sigue necesitando prueba; no se deduce
de mocks.

## Servicio de envío

`send-push` usa `_shared/auth.ts` y el cliente de servicio. Acepta cron mediante
`x-cron-secret` o una sesión validada cuyo perfil sea admin. No se envía el
service role desde cron o frontend. El gateway tiene `verify_jwt = false`
para que llegue el cron; la función autoriza por su cuenta.

CORS permite los orígenes locales 5173, 4173 y 3000, más `APP_ORIGIN`
(predeterminado `https://udp-map.vercel.app`) y los adicionales de
`ALLOWED_ORIGINS`. Omitir la cabecera CORS bloquea lectura desde el navegador;
no reemplaza la autorización servidor.

Reclama lotes de 50 y envía con concurrencia 10. El lease debe cubrir las tandas
con timeout de 10 segundos por envío, cifrado y cierre. La pasada tiene
presupuesto aproximado de 40 segundos y máximo de 6 lotes; no es una promesa
de throughput real. Cierra en bloque con fencing y un reintento seguro de cierre.
Errores de claim, cierre y eliminación quedan diferenciados en el resumen.
La cola y sus estados se explican una sola vez en
[reclamo y conservación](base-de-datos.md#reclamo-cierre-y-conservacion).

| Resultado del servicio push                        | Tratamiento                                                                         |
| -------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Aceptado                                           | `sent`: no prueba recepción visible                                                 |
| 404/410                                            | `expired`, cerrar antes de borrar suscripción; expirar otros pendientes por trigger |
| 400/413/401/403                                    | Fallo terminal; 401/403 orientan a revisar VAPID                                    |
| 429/5xx/red                                        | Reintento, con `Retry-After` si existe                                              |
| Claves de suscripción inválidas o payload excesivo | Fallo terminal                                                                      |

Hay como máximo 5 intentos; el retraso de `Retry-After` se acota a 1–60 minutos.
Un endpoint que ya devolvió 410 no se reenvía dentro de la misma pasada una vez
conocido el resultado, aunque la concurrencia permita solicitudes ya en vuelo.

### Contrato HTTP

`OPTIONS` responde al preflight. Para otras peticiones:

| Código | Condición                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------ |
| 405    | Método distinto de POST                                                                          |
| 401    | No autorizado                                                                                    |
| 400    | Admin proporcionó `notificationId` presente pero no UUID                                         |
| 500    | Fallo detectado de configuración VAPID; o fallo inicial de claim/excepción de la pasada síncrona |
| 202    | Cron con `EdgeRuntime`: `{"accepted":true}` y trabajo en segundo plano                           |
| 200    | Pasada terminada; admin espera el resumen. Sin `EdgeRuntime` el cron también espera en línea     |

La configuración VAPID se valida al cargar: base64url, tamaño y prefijo esperados.
Un fallo **detectado** devuelve 500 sin consumir la cola; esto no certifica
pertenencia a curva o correspondencia del par criptográfico.

El cuerpo opcional solo se interpreta para admin. Vacío, no JSON, no objeto o
sin `notificationId`/con NULL significa cola completa. Un UUID se normaliza y
limita el reclamo a su aviso. Un valor presente inválido responde 400, en lugar
de drenar silenciosamente la cola general. Cron ignora el cuerpo.

El resumen contiene `processed`, `sent`, `failed`, `expiredSubscriptions`,
`batches`, `skipped` y `fenced`; diagnósticos por entrega hasta 200, con
`diagnosticsOmitted` para el resto; `claimError`, `closeErrors` y `deleteErrors`.
Con ID añade conteos `notification.deliveries` por pending/sent/failed/expired.
Si ese conteo falla, devuelve `notification.error` y mantiene 200 porque la
pasada ya ocurrió. El panel no debe interpretar ese caso como cero entregas.

### Cifrado y payload

`_shared/webpush.ts` implementa Web Crypto para RFC 8291/8188 y VAPID ES256.
La cabecera mantiene `Urgency: high` y `TTL: 86400`. La caché reutiliza JWT
VAPID por origen durante 11 horas. `VAPID_SUBJECT` con `mailto:` se usa tal cual;
otros valores o ausencia caen al respaldo `mailto:soporte@udp.cl` con warning.
Cambiarlo por un contacto propio es un pendiente operativo con prueba iPhone,
no un cambio realizado aquí.

El payload sigue siendo híbrido: `web_push: 8030` y `notification` más campos
planos `notificationId/title/body/url/type/category/payload` y datos dentro
de `notification.data`. `golden.test.ts` protege la forma del mensaje.
`MAX_PLAINTEXT_BYTES` limita a 3993 bytes; excederlo cierra failed.
El formato puro tras `PUSH_PAYLOAD_FORMAT` se retiró sin activarse: no configures
ese secreto como si fuera una opción vigente.

## Worker y toque

`public/push-sw.js` lee bloque declarativo y campos planos **campo a campo**.
Un bloque incompleto no debe perder ID/destino/tag por reemplazar toda la raíz.
Si no puede interpretar o mostrar el aviso intenta uno mínimo; ese segundo
`showNotification` también puede fallar. No hay una garantía de visibilidad real
por la mera existencia del catch.

El icono y el badge cumplen papeles distintos. `notification-badge.png` es
silueta con transparencia porque Android usa la máscara alfa; un cuadrado opaco
produce un bloque blanco.

En `notificationclick` cierra el aviso, resuelve el destino contra el origen,
descarta otro origen y añade `?notification=ID`. Intenta enfocar primero una
ventana del mismo origen y luego navegar; si falla, abre otra. `NotificationUrlHandler`
marca leído mediante API y quita el parámetro al resolver.
No se asume qué camino atiende el toque en cada versión de iOS.

`pushsubscriptionchange` intenta suscribir con la clave de la suscripción
perdida y cae a una constante pública. La conciliación autenticada ocurre al
abrir la página. El registro histórico señala que iOS no disparaba ese evento;
no es una reparación universal y debe verificarse en el dispositivo actual.
Al rotar VAPID, revisa clave pública del frontend, par Edge, fallback del worker
y suscripciones existentes siguiendo [despliegue](../guias/despliegue.md#configuracion-por-entorno).

## Panel, difusión y moderación

`admin_send_test_push_to_self` crea un aviso y devuelve su ID. El panel pide
drenar solo ese aviso y consulta sus entregas, incluso si otro proceso reclamó
antes. `admin_push_delivery_stats` agrupa por host, no por endpoint completo;
sus ventanas de retención están en la referencia DB.

`admin_count_push_subscribers` cuenta navegadores registrados, no personas.
`admin_push_subscribers` permite a admin listar nombre, rol, endpoint,
User-Agent y fechas sin devolver correo. El endpoint identifica la suscripción
que se administra; las estadísticas conservadas usan host.

`admin_delete_push_subscription` da de baja ese endpoint y devuelve booleano
según borró una fila; registra `push_unsubscribed` al hacerlo. Permite retirar
un teléfono perdido o un cliente que no vuelve a abrir: un endpoint aún válido
no responderá necesariamente 404/410 para que el sender lo limpie solo.
La baja remota no revoca por sí misma el permiso ni ejecuta `unsubscribe` en
el navegador perdido; no confundirla con la baja local del dispositivo abierto.

La difusión usa `admin_broadcast_push_notification(título,cuerpo,url)`, con
topes SQL de 60/180 caracteres. Cuenta avisos realmente creados, no meros
candidatos; dedupe usa UUID por difusión y usuario. La validación regex de ruta
no acredita por sí sola aislamiento de origen (admite formas como `//…`);
el sender y el worker realizan controles adicionales. No describas la regex
como garantía suficiente.

<a id="moderacion"></a>

## Moderación

`create_content_report` acepta contenido ajeno existente, genera snapshot
servidor y valida motivo y detalle de hasta 1000 caracteres. Evita duplicar
casos activos del mismo reportante/destino. La cola conserva el snapshot al
resolver aunque el original desaparezca.

`ReportsPanel` permite filtrar, tomar, descartar o eliminar. Las RPC solo
admiten admin. Tomar comprueba asignación; resolver **no** verifica que quien
resuelve sea el asignado y registra a quien lo hizo. El aviso al reportante no
incluye la nota de hasta 1000 caracteres, pero la RLS de su fila no oculta esa
columna. Estas discrepancias no se arreglan por ocultar controles en UI.

Lectura por capacidad, alcance de moderadores y observaciones de privacidad
tienen su fuente principal en
[base de datos](base-de-datos.md#discrepancias-y-observaciones-abiertas).
El [plan](../ROADMAP.md#seguridad-y-permisos) mantiene su seguimiento.
