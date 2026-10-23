# Base de datos

Esta referencia describe el esquema versionado, sus contratos y discrepancias.
La fuente de reconstrucción es
[`supabase/schema/baseline.sql`](../../supabase/schema/baseline.sql); las
migraciones son cambios incrementales. Ninguna de las dos acredita por sí sola
qué está aplicado en un proyecto Supabase concreto.

El documento anterior partía de una lectura de producción del 3 de agosto de
2026 y agregó después migraciones conforme se escribían. Ese alcance histórico
se conserva [con su procedencia](../historico/2026-10/documentacion-anterior.md#docsdatabasemd).
Las consultas, reconstrucción y rollback están en
[despliegue](../guias/despliegue.md).

## Fuentes y modelo

El baseline define tipos, tablas, constraints, índices, funciones, triggers,
vista, RLS, privilegios, Storage y publicación Realtime. Los trabajos cron y la
configuración de servicios requieren pasos adicionales. El catálogo público
sale de `campusData.ts` y del seed; insignias se cargan antes desde `badges.sql`.
No reapliques las migraciones archivadas para reconstruir: usa el baseline.

| Dominio | Entidades y relación |
|---|---|
| Catálogo | `campuses`, `faculties`, `careers`, `categories` y `badges` |
| Identidad | `profiles`, vista `profiles_public` y `admin_emails` |
| Interior | `buildings` → `building_floors` → `areas`; `floor_plans` es una estructura anterior sin consumo activo del mapa actual |
| Navegación | `nav_nodes` y `nav_edges`: grafo por facultad para «cómo llegar» hasta la puerta de una sala |
| Publicación | `pins` con fotos, comentarios y `pin_schedule_items` |
| Lugares | `place_photos` con un único destino facultad, edificio o área |
| Interacción | `pin_votes`, `favorites`, `event_rsvps` y `user_badges` |
| Foro | `forum_threads`, `forum_comments` y `forum_votes` |
| Moderación | `content_reports` y `moderator_capabilities` |
| Avisos | `notifications`, `notification_preferences`, `push_subscriptions` y `notification_push_deliveries` |
| Operación | `pin_creation_events`, `storage_cleanup_queue` y `activity_log` |

Los catálogos no son un recuento de producción. Facultades y perímetros se
rehidratan desde la base en el arranque; el array activo conserva referencia.
No existe una copia operativa de los perímetros en el seed. `polygon: null`
significa sin trazar, no una geometría aproximada que pueda asignar pines.

## Roles y capacidades

`guest`, `student`, `moderator` y `admin` son roles de la aplicación en
`profiles.role`. No son los roles de conexión PostgreSQL `anon`,
`authenticated` y `service_role`. `user_role()` resuelve el rol de aplicación;
sin perfil se comporta como invitado. `handle_new_user` rechaza altas fuera
de `@mail.udp.cl` y consulta `admin_emails` al crear el perfil.

`can()` es la matriz mínima de **interfaz**. La autorización efectiva combina
privilegios, políticas y controles internos de RPC/Edge; revisa las
discrepancias de esta referencia antes de llamarla uniforme.

| Acción | Contrato local del servidor |
|---|---|
| Leer mapa, pines, fotos y perfiles públicos | Lectura pública según políticas/vista; la exposición de correo en la tabla es una discrepancia |
| Crear reporte o evento | Sesión no invitada y RPC de creación |
| Crear lugar permanente, verificar, desverificar, extender | Rol moderador/admin en las funciones actuales |
| Editar o borrar pin propio | RLS de autor, con triggers que limitan campos; permanentes tienen restricciones |
| Editar/borrar contenido ajeno u oficializar | Políticas/funciones que aún comprueban rol moderador/admin |
| Trazar edificios, plantas, áreas y `floor_plans` | Admin o moderador con `mapping` |
| Leer reportes | Propios o `has_capability('reports')` |
| Tomar/resolver reporte | RPC solo admin; no equivale al permiso de lectura |
| Roles, capacidades, difusión, autotest y gestión push | RPC solo admin |
| Preferencias | Filas propias |
| Registro de actividad | Administración |
| Cola push y limpieza Storage | Tablas internas, sin acceso ordinario del cliente |

`moderator_capabilities` permite `mapping`, `reports`, `verify`,
`content` y `official`. `has_capability` da true a admin sin exigir una fila;
solo moderadores reciben capacidades mediante `admin_set_capability`.
La migración concedió a los moderadores existentes mapping, verify, content y
official; no reports. No permitir escritura directa sobre la tabla evita que
alguien se conceda capacidades.

**Alcance real:** están aplicadas al mapeo y a lectura de reportes. Otras
políticas y RPC todavía comprueban el rol completo, no verify/content/official;
reports no habilita resolución. `AdminLayout` admite solo admin, incluso si
SQL permite mapear. Tampoco hay autorización por `profiles.faculty_id`:
un moderador no está acotado a su facultad.

`GRANT` controla operaciones/columnas y `EXECUTE` invocación; RLS controla filas.
Las políticas permisivas se combinan con OR. Un `SECURITY DEFINER` ejecuta con
privilegios del dueño: necesita autorización interna, `search_path` seguro y
ACL explícita. Revocar invocación y validar identidad/objeto son controles
complementarios. Las funciones `RETURNS trigger` no son RPC normales aunque
algunas tengan `EXECUTE` concedido; no es correcto afirmar que se revocó a
todas las funciones internas.

## Ciclo de vida de un pin

Un post es un `pin`, de tipo `report`, `event` o `place`. La categoría expresa
qué es y el tipo determina vida y permisos. Verificar un reporte puede
convertirlo en lugar sin cambiar la categoría; no existe un `kind = place`
en el catálogo de categorías.

`create_pin_with_daily_limit` es el camino de INSERT; las políticas no ofrecen
un alta libre equivalente. Para estudiante impone 10 creaciones por día UTC.
`pin_creation_events` lleva esa cuenta separada: borrar el pin no devuelve cupo.
Los roles moderador/admin tienen la exención escrita en la función.

El servidor calcula caducidad e ignora el plazo propuesto por el navegador:
categoría/TTL para reportes, fin del evento para eventos y permanencia cuando
corresponde. Un evento sin `ends_at` usa el respaldo de 24 horas de la RPC.
La descripción admite hasta 1500 caracteres. El catálogo conserva TTL distintos,
incluidos sala (720 horas) y sala-libre (6 horas).

`prevent_occupied_pin_location` serializa altas con advisory lock y compara
`lat`, `lng` y `floor` con igualdad que trata NULL como NULL. Un pin vencido
no reserva el lugar y distintas plantas pueden compartir el punto. El helper
cliente anticipa el rechazo; no sustituye el control SQL.

`extend_pin_ttl` y `unverify_pin` comprueban rol y estado y explican los rechazos.
`verify_and_make_permanent` hace permanente, registra verificador y premia
con 25 de karma. La insignia de creador verificado requiere al menos dos pines
verificados; no se concede por cada primera verificación. Desverificar resta
el premio y devuelve un plazo; las insignias no se retiran.

`protect_pin_sensitive_fields` limita al autor no moderador: conserva campos
administrados como tipo, permanencia, oficialidad, autoría y contadores fuera
de la RPC de voto. La categoría de un permanente no puede cambiarse.
Un autor de evento puede cambiar `ends_at` y `expires_at` juntos bajo las
condiciones de la función; no vaciar la fecha para volverlo eterno.
`floor` y `room_code` son editables: cambiar la planta libera `area_id`,
no acepta una nueva asociación arbitraria del cliente.

La interfaz esconde vencidos antes de la purga. `expire-pins` borra periódicamente
los no permanentes vencidos; la expiración no es una Edge Function.
El desvanecido visual significa «por vencer» para los reportes correspondientes;
los eventos usan estado temporal propio.

<a id="ubicacion-y-plantas"></a>
## Ubicación y plantas

`buildings` usa ID de texto, facultad, `footprint`, nombre, `short_name`,
`aliases`, `default_floor` y altura opcional. No hay `buildings.code`.
`building_floors` identifica edificio + nivel; el nivel y la planta por defecto
nunca son cero. `areas.id` es UUID, no texto.
`area_kind` admite `other` con `custom_kind`: la taxonomía no obliga a
inventar un tipo SQL para cada recinto.

Un área interior tiene edificio y planta juntos; la FK compuesta exige que esa
planta exista y borra en cascada al eliminarla. Un área exterior lleva ambos
en NULL, con facultad y polígono. Esto no es la regla más laxa de un pin, que
puede expresar contexto sin un recinto dibujado.

`pins/api` resuelve facultad e interior sobre catálogo/caché y geometrías al
crear o mover. `trg_authorize_pin_move` exige moderador/admin cuando cambia
`lat/lng`. Exime `auth.uid() IS NULL` para mantenimiento sin sesión; las
políticas siguen impidiendo el UPDATE anónimo ordinario.

Los BEFORE se ordenan por nombre: autorizar antes de comprobar ocupación,
proteger campos y validar planta evita responder «ocupado» a quien ni siquiera
puede mover. `validate_pin_floor` valida también operaciones de servicio;
el permiso de mantenimiento no vuelve válida una planta inexistente.

- `floor IS NULL` es exterior y no necesita validación de nivel.
- Con edificio, este debe pertenecer a la facultad indicada y tener la planta.
- Sin edificio, si la facultad tiene edificios, la planta debe existir en
  alguno de ellos.
- Si no hay facultad o aún no hay edificios, la regla admite el contexto sin
  exigir un trazado inexistente.

El helper cliente es un anticipo: permite casos de snapshot incompleto que SQL
puede rechazar, como un edificio desconocido en la caché. No lo describas como
réplica perfecta del servidor. Un traslado puede recalcular edificio y hacer
inválida la planta anterior; no descartes ese error.

El régimen sin JWT que autoriza mover no implica que todos los triggers
eximan al mantenimiento: `protect_pin_sensitive_fields` todavía puede conservar
campos según `user_role()`. Inspecciona el resultado completo en operaciones manuales.

<a id="navegacion-interior"></a>
## Navegación interior

Migración `20261023000000_indoor_navigation`. `nav_nodes` son puntos donde la
persona puede estar o decidir; `nav_edges`, tramos recorribles. El grafo es
explícito: deducir pasillos de los polígonos de `areas` es frágil, y unas
decenas de nodos por planta se rutean y prueban sin esfuerzo. Quien mapea
dibuja el eje del pasillo y marca puertas; el editor genera el resto.

| Columna | Contrato |
|---|---|
| `kind` | `walk`, `door`, `room` (destino), `stairs`, `elevator`, `entrance` (empalme con la calle) u `outdoor` |
| `building_id`, `floor` | Juntos o ambos NULL (exterior), como en `areas`; la FK compuesta exige la planta y borra en cascada |
| `lng`, `lat` | Coordenadas reales. El cliente proyecta a metros al cargar: la base no conoce planos locales |
| `landmark` | Lo que se ve, con su artículo («los torniquetes»). Alimenta las instrucciones; ≤ 80 |
| `via` | Solo exterior: por dónde se camina hasta el nodo («la vereda de Vergara») |
| `area_id` | Sala de un nodo `room` o `door`; `SET NULL` al borrar el área |
| `room_code` | Llave con `pins.room_code`. Se guarda como se escribió y se compara normalizado (índice en `upper`) |
| `shaft` | Obligatorio en `stairs` y `elevator`: agrupa un núcleo entre plantas |
| `width_m` | Ancho del vano (0–10 m): dibuja la puerta y corta el muro en 3D |

Las aristas no tienen sentido: `nav_edges_pair_uniq` impide repetir `(a, b)`
como `(b, a)`, y `a <> b`. `step_free = false` marca escalones o un torniquete
sin pase ancho; una arista `stairs` nunca es apta, lo impone un CHECK. Las
aristas verticales unen nodos del mismo `shaft` en plantas consecutivas y las
genera el editor; no se dibujan a mano.

`faculty_id` va en las dos tablas porque el grafo se carga por facultad, que es
la unidad del mapa, y una ruta puede cruzar edificios por nodos `outdoor`.
No hay trigger que compruebe que un nodo con edificio pertenezca a la facultad
de ese edificio, ni que una arista una nodos de su facultad: `areas` tampoco lo
tiene. Ver [observaciones](#discrepancias-y-observaciones-abiertas).

Lectura pública, como el resto del mapeo: sin ella un invitado no puede pedir
una ruta. Escritura con `has_capability('mapping')`; ocultar la herramienta del
editor no protege las tablas. `nav_nodes.updated_at` usa el mismo trigger que
`buildings` y `areas`.

El cliente rutea por tiempo (escalera 16 s por piso al subir y 11 al bajar,
ascensor 40 s de espera una sola vez más 4 s por piso, 1,3 m/s a pie). Esas
constantes viven en `shared/utils/indoor/graph.ts`, no en la base. La ruta de
calle hasta la entrada no se guarda: se pide a ORS/OSRM solo para la entrada
elegida. Sin grafo, «Cómo llegar» vuelve a la guía de tres pasos.

## Interacción, foro y perfiles

`vote_pin` y `vote_thread` actualizan voto y contadores en una transacción y
ponen `udpmap.vote_rpc` para los triggers de protección. Un voto positivo
ajusta karma del autor en +10 y uno negativo en −2; cambiar de signo ajusta
la diferencia. Guardián cuenta votos emitidos, no recibidos.
`adjust_karma` limita el mínimo a cero y marca su actualización interna.

Las funciones de insignias insertan sin retirarlas: Explorador se revisa al
crear pines, Anfitrión en eventos, Fotógrafo al añadir fotos, Guardián al votar
y Pionero al variar karma. Sus umbrales y condiciones viven en `check_*_badge`
y `badges.sql`; no conviertas la tabla de insignias en un contador manual aparte.

`forum_threads` permite facultad o tablón general con `faculty_id NULL`.
Publicación oficial y fijación tienen controles adicionales de rol. La protección
de campos del hilo y votos no debe sustituirse por ocultar botones.

`event_rsvps` no se lee públicamente fila por fila. `event_rsvp_counts(uuid[])`
ofrece agregados a cualquiera, con límite de 200 pines por llamada;
`event_attendees` ofrece nombres a autor del evento o admin, no a todo asistente.
Valida que el destino sea de tipo evento. El umbral visual de `EventCard` no
es una barrera de privacidad.

`profiles_public` omite correo, y el cliente público la usa. La tabla de origen
tiene una discrepancia de lectura expuesta más abajo; usar una vista segura no
revoca por sí mismo el acceso a la tabla. `careers.id` es serial sin ID fijado
en seed; `profiles.career` guarda el nombre y no debe depender de aquellos IDs.

## Fotos, galerías y Storage

`pin_photos` tiene límite de 5 fotos por pin. `place_photos` permite exactamente
un destino entre facultad, edificio y área, y límite de 10 fotos por galería.
Las FK y cascadas vinculan el contenido a su dueño; no hay herencia automática
de una galería de facultad a cada edificio.

Los límites se imponen en triggers AFTER con advisory lock. Contar después
permite considerar una inserción de varias filas; la excepción revierte la
sentencia y el lock serializa subidas concurrentes. El recuento de galería
considera todos sus destinos, para no mezclar áreas con otros IDs nulos.

El bucket público es `pin-photos`. Sus rutas distinguen:

- `pins/{user_id}/{uuid}.jpg`: propietario en la carpeta del usuario.
- `places/{kind}/{id}/{uuid}.jpg`: galerías de facultad, edificio o área
  administradas por admin.

La lectura es pública. Subida/borrado se rigen por las políticas de Storage del
baseline: carpeta propia para pines y control admin para galerías; moderación
puede borrar según la política. La compresión cliente en `photos.ts` limita
lado a 1200 px, JPEG 0.75, entrada de 20 MB y tipos jpeg/png/webp. El bucket no
tiene esos límites de tamaño/tipos como garantía equivalente.

Borrar una fila de `pin_photos` o `place_photos` encola la ruta mediante trigger.
Así se cubren autor, panel, resolución, expiración y cascadas sin repetir la
limpieza en cada cliente. `storage-gc` elimina por API de Storage:
borrar solo metadatos de `storage.objects` no elimina el binario.

Hay una excepción importante al dueño central de limpieza: `uploadPinPhotos`
llama `storage.remove` para compensar una subida fallida antes de tener filas
confirmadas. El GC atiende las filas borradas; la compensación atiende archivos
sin fila. Crear pin, fotos y programa desde el navegador no es una transacción
atómica única.

`storage_cleanup_queue` conserva intentos, error y cierre. `remove()` sobre
archivo ya ausente es idempotente; se reintenta hasta 5 veces y después se
cierra con el error visible. Si se borra el binario y falla marcar la cola,
el siguiente pase puede repetir sin duplicar daño.
[Operación de Storage](../guias/despliegue.md#storage-y-recuperacion) explica cómo inspeccionarla.

## Avisos y cola push

La matriz de orígenes, presentación y contratos HTTP está en
[notificaciones](notificaciones.md). Aquí vive el contrato persistente.

`notifications` conserva tipo, categoría, audiencia, destino, actor y dedupe.
Para el cliente ordinario, RLS limita SELECT/UPDATE/DELETE a filas propias;
`authenticated` no tiene INSERT y su UPDATE está concedido solo sobre
`read_at`. No puede crear o reescribir libremente el aviso por tener sesión.
Esto no describe como inexistentes los otros privilegios auxiliares que conserva
el baseline: debe revisarse la ACL concreta para cada operación.

`create_notification` y `queue_notification_push` consultan
`wants_notification` para no discrepar entre canales.
La ausencia de fila en `notification_preferences` significa permitir:
se guardan excepciones, no filas predeterminadas para todos. `in_app` y `push`
son ejes separados; `push_needs_in_app` impide push sin aviso en la bandeja.
La audiencia admin no es silenciable.

`wants_notification` es DEFINER y consulta preferencias de terceros; por eso
se revocó `EXECUTE` también a PUBLIC y solo se concede al servicio.
Las funciones internas definer que la usan comprueban ACL con su dueño, no
con el rol cliente que originó el trigger.

### Suscripciones y recordatorios

`register_push_subscription` acepta `p_old_endpoint` opcional. Borra antes la
antigua firma de cuatro argumentos para evitar ambigüedad PostgREST; los
argumentos nombrados antiguos resuelven por el valor predeterminado.
Solo busca el endpoint viejo entre suscripciones de quien llama y solo mueve
pendientes de sus avisos.

El traslado conserva `attempts` y lease para que un envío en curso pueda cerrar.
Si ya existe entrega equivalente en la nueva suscripción, la antigua no se
mueve y expira al borrar la vieja. Estados cerrados quedan como rastro; un
endpoint viejo igual, vacío, ajeno o inexistente no es error ni autoriza borrarlo.
No se identifica un dispositivo por `user_agent` como si fuera único.

`event_rsvps.reminded_at` fija la idempotencia del recordatorio: borrar
`notifications` no debe volver a hacerlo sonar. La asistencia se marca cuando
el aviso existe, creado o previamente presente. Si las preferencias lo silencian,
no se marca y el barrido puede intentarlo dentro de la ventana de 20 días.
Cancelar y volver a apuntarse crea una asistencia nueva; el dedupe evita
duplicado si el aviso anterior sigue.

La migración hizo backfill según avisos/preferencias para no reemitir
indiscriminadamente ni quitar para siempre el aviso a quien lo tenía silenciado.
`authenticated` solo inserta/actualiza `pin_id`, `user_id` y `status`:
no puede borrar o ponerse `reminded_at`.

`enqueue_upcoming_event_notifications` es trabajo SQL separado del sender.
Su tratamiento de `auth.role() NULL` permite pg_cron sin JWT y rechaza roles
cliente: no sustituyas mecánicamente `<>` por `IS DISTINCT FROM`.
En cambio claim/finish exigen explícitamente `service_role` y rechazan NULL.

<a id="reclamo-cierre-y-conservacion"></a>
### Reclamo, cierre y conservación

Cada fila de `notification_push_deliveries` representa aviso + suscripción.
`pending` termina en `sent` (aceptado por el servicio), `failed` (terminal)
o `expired` (no existe destinatario). Aceptación no prueba visualización.

`claim_push_deliveries` usa `FOR UPDATE SKIP LOCKED`, incrementa `attempts` y
mueve `next_attempt_at` al futuro en la misma operación. Ese lease reemplaza
un estado processing con recuperación externa: al vencer se puede reclamar,
con el intento ya contado. Se admiten 1–200 filas y lease 30–900 segundos;
los predeterminados son 50 y 120 segundos.

`finish_push_deliveries` recibe resultados con id y `attempts` del reclamo.
Solo escribe si siguen `pending` con ese intento: fencing. Devuelve los IDs
cerrados. Un cierre atrasado no pisa otra reclamación o expiración, y repetir
el cierre no vuelve a aplicarlo. Los intentos se cuentan al reclamar, no al cerrar.

`subscription_id` es anulable y la FK hace `ON DELETE SET NULL`. El trigger
`push_subscriptions_expire_deliveries` debe ser **BEFORE DELETE** y DEFINER:
expira los pending antes de perder el ID y puede escribir en la cola interna
aunque quien borra sea authenticated. Cubre 410, baja local, admin y cascade
de perfil; evita pendientes huérfanos. Los estados cerrados sobreviven.

`push_host` guarda el servicio, no el endpoint de capacidad del dispositivo.
El índice por suscripción evita recorrer toda la cola al mover/borrar.
El unique aviso/suscripción admite varios NULL como rastro separado.

`prune_push_history` elimina entregas sent/expired de más de 30 días y failed
de más de 90. No purga pending por edad. Borra avisos leídos de más de 180 días
y sin leer de más de 365; sus entregas pueden desaparecer por la FK del aviso.
La función acepta servicio o ejecución sin JWT para cron. Los datos purgados
no vuelven al deshacer la función.

`admin_push_delivery_stats` agrupa por host en SQL. Solo admin, no service_role
como sustituto de una sesión admin. La RPC acota `p_days` a 1–90 y aplica esa
ventana a todos los estados. La purga, en cambio, retiene sent/expired 30 días
y failed 90, sin purgar pending por edad. En consultas mayores de 30 días las
proporciones quedan sesgadas por esa retención; pending de 31–90 días sí puede
aparecer. Para comparar estados usa una ventana de hasta 30 días; ventanas
mayores sirven para rastrear fallos y pendientes. La guía incluye la consulta
equivalente desde SQL Editor.

## Moderación y actividad

`create_content_report` valida autoría ajena, contenido existente, motivo y
detalle con tope; produce snapshot servidor y dedupe de casos activos.
Notifica a administradores. Las RPC de tomar/resolver siguen siendo admin.
`claim_moderation_report` respeta asignación; `resolve_moderation_report`
bloquea resueltos y valida acción/nota, pero **no** exige que el caso esté
asignado a quien resuelve. Reasigna al resolver.

El aviso al reportante omite la nota de resolución; la tabla permite leer la
fila propia con esa columna. Son propiedades distintas, no privacidad completa
de «nota interna». La [referencia de avisos](notificaciones.md#moderacion)
describe el flujo UI sin convertirlo en una garantía del endpoint.

`activity_log` es append-only desde funciones/triggers para altas, bajas,
verificaciones, reportes y cambios de rol. Guarda resumen de hasta 200
caracteres, IDs y metadatos, no una copia íntegra del contenido.
`admin_activity_log` permite lectura administrativa.
`log_activity` registra warning si falla para no abortar la operación original.
`prune_activity_log` acepta días con mínimo 7; **no tiene poda automática
programada** por el mero hecho de existir. No confundirla con la purga push.

## Realtime y efectos en cadena

La publicación versionada incluye pines, comentarios de pines, hilos,
comentarios de foro, notificaciones y reportes. La publicación no sustituye RLS.

Crear, votar, verificar, responder, subir fotos o confirmar asistencia puede
disparar karma, insignias y avisos; estos pueden encolar una entrega por
suscripción. Escribir directamente un contador o deducir efectos solo de la
llamada cliente rompe esa lectura. Consulta `CREATE TRIGGER` y funciones
referidas en el baseline para el orden completo.

## Discrepancias y observaciones abiertas

Estas diferencias se registran sin cambiar código o decisiones durante la
reorganización. Lo externo requiere comprobación separada.

- **Correo de perfiles.** `profiles_read_public USING (true)` y SELECT de email
  para authenticated permiten leer correos ajenos en el SQL versionado. La vista
  pública no revoca ese acceso inferior.
- **Campos privilegiados de perfil.** `protect_profile_privileged_fields` es
  DEFINER y exime `current_user` privilegiado. Con dueño postgres, esa condición
  puede saltarse la protección pretendida, junto con UPDATE general y RLS de
  fila propia. La garantía de modificar rol/karma solo por RPC no está demostrada.
  Hay que comprobar dueño y efectividad; no se afirma explotación en producción.
  El mantenimiento SQL privilegiado tampoco se describe como rechazado siempre.
- **Reportes.** Lectura por capacidad, resolución admin, asignación no exigida al
  resolver y nota legible en fila propia difieren de la garantía anterior.
- **Votos.** El documento previo registró grants restaurados en producción; el
  baseline conserva permisos que permiten revisar escritura directa frente a
  RPC/contadores. Hay que contrastar ACL y políticas reales antes de cerrar el
  pendiente; no se repite como inspección actual.
- **Paridad baseline/migración.** `prevent_occupied_pin_location` aparece sin
  DEFINER en el baseline y con DEFINER en la última migración que lo define.
  Los cuerpos coinciden, pero no son la misma propiedad de ejecución.
- **Alcance de moderador.** No se acota por facultad; varias capacidades no
  sustituyen todavía el rol en políticas/RPC y no abren el panel.
- **Campos y coste heredados.** `pins.reports` no tiene productor/lector activo;
  denuncias reales usan `content_reports`. Hay FK sin índices auxiliares,
  incluidas las observadas en favorites.pin_id, pin_votes.user_id,
  forum_votes.user_id, notifications.actor_id y content_reports.reporter_id.
  Su coste necesita datos; no se presume volumen actual.
- **Procedencia manual.** `profiles_admin_update` fue registrado como política
  creada fuera de migraciones; el baseline la incluye. Los IDs seriales de
  carreras cambian al reconstruir y no son claves públicas estables.
- **Coherencia de facultad del grafo.** `nav_nodes` y `nav_edges` no comprueban
  que el edificio del nodo ni los extremos de una arista sean de su
  `faculty_id`, igual que `areas`. El editor los escribe coherentes; una carga
  manual inconsistente partiría el grafo entre facultades sin error SQL.
- **Reconstrucción y entorno.** Git registra una prueba PGlite tras ordenar las
  funciones del log antes de triggers/permisos. No se reproduce aquí ni demuestra
  pg_cron, Vault, PostgREST o producción. El baseline no provisiona esos entornos.

El [plan](../ROADMAP.md#seguridad-y-permisos) mantiene el seguimiento; las
[pruebas](../guias/validacion.md) separan casos locales, SQL y dispositivos.
