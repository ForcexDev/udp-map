# La base de datos de UDP Map

Qué hay dentro, por qué está así, y qué hacer para manejarla.

Este documento describe el estado **real** de producción, leído de los catálogos
de Postgres el 3 de agosto de 2026 (PostgreSQL 17.6 sobre Supabase). Las
migraciones posteriores, hasta `20261021000200`, se documentaron a medida que se
escribían, no se leyeron de producción. La base manda sobre lo que dicen las
migraciones: unas cuantas cosas se hicieron a mano en el dashboard y solo
existen en la base. Para saber qué carpeta toca cada cambio, ver
[`REPO_MAP.md`](REPO_MAP.md).

---

## 1. Dónde vive cada cosa

| Archivo | Qué es |
|---|---|
| `supabase/schema/baseline.sql` | **La fuente de verdad del esquema.** Reconstruye la base entera sobre un proyecto vacío |
| `supabase/seed/badges.sql` | Las 6 insignias. Se escribe a mano |
| `supabase/seed/seed.sql` | Catálogo del campus. **Generado**, no editar |
| `supabase/seed/fic_dummy_50_pins.sql` | Pines de prueba de la FIC (pese al nombre, trae 56) para desarrollo. A mano, **no se aplica en producción** |
| `supabase/config.toml` | `verify_jwt = false` para `send-push` y `storage-gc`; el runbook de la sección 10 depende de eso |
| `src/shared/data/campusData.ts` | Campus, carreras y categorías. Y la **semilla** del catálogo de facultades: nombres, campus y chinchetas. **Sin geometría** |
| `scripts/gen_seed_full.ts` | Regenera `seed.sql` desde `campusData.ts`. No tiene script de npm: se ejecuta con un ejecutor de TypeScript (por ejemplo `tsx`) |
| `supabase/_archive/migrations/` | Las 33 migraciones históricas. Ya aplicadas. **No ejecutar** |
| `supabase/migrations/` | Migraciones nuevas, de aquí en adelante. Desde `20260827` cada una trae un `.down.sql` que la deshace, también a aplicar a mano |

La regla que evita que esto se vuelva a desordenar:

> Cada cambio en la base son **tres** cosas en el mismo commit: la **migración
> nueva** en `supabase/migrations/`, la actualización de **`baseline.sql`** y la
> de **este documento**. Si se separan, el baseline miente y la documentación
> deja de explicar por qué el esquema es como es.

La tercera se añadió después de comprobar que era la que siempre se caía: el
mapeo interior entero —`buildings`, `building_floors`, `areas`— se implementó
sin tocar este archivo, y reconstruir después el porqué de cada decisión costó
más que haberlo escrito en su momento. Hay un hook en
`.claude/hooks/check-database-docs.mjs` que avisa cuando se toca el esquema y
este documento sigue igual, y la regla está en `CLAUDE.md` para cualquier agente
de IA que trabaje en el repositorio.

Y una consecuencia de que `seed.sql` sea generado: para tocar una categoría, un
campus o una carrera se edita `campusData.ts` y se regenera. Editar `seed.sql`
directamente no sirve — el siguiente `gen_seed_full.ts` lo borra.

---

## 2. Los cuatro roles

El rol vive en `profiles.role` y lo lee la función `user_role()`, que devuelve
`'guest'` cuando no hay sesión. Casi todas las políticas de seguridad comparan
contra esa función.

Ojo con una distinción que confunde: `anon` y `authenticated` son roles **de
Postgres**, los que usa Supabase para conectarse. `guest`, `student`,
`moderator` y `admin` son roles **de la aplicación**, y viven en una columna.
Un usuario logueado siempre llega como `authenticated`; qué puede hacer lo
decide su fila en `profiles`.

Solo se registra quien tenga correo `@mail.udp.cl`: lo impone `handle_new_user`,
y el rechazo ocurre en el alta, no en la interfaz.

### Qué puede hacer cada uno

| Acción | guest | student | moderator | admin | Dónde se aplica de verdad |
|---|:---:|:---:|:---:|:---:|---|
| Ver el mapa, pines y fotos | ✅ | ✅ | ✅ | ✅ | políticas `..._read` con `using (true)` |
| Ver perfiles públicos | ✅ | ✅ | ✅ | ✅ | vista `profiles_public` + permisos por columna |
| Crear reporte o evento | ❌ | ✅ | ✅ | ✅ | RPC `create_pin_with_daily_limit` |
| Crear un lugar (`place`) | ❌ | ❌ | ✅ | ✅ | la misma RPC, comprobando el rol |
| Editar su propio pin | ❌ | ✅ | ✅ | ✅ | policy `pins_owner_update` + trigger de campos |
| Borrar su propio pin | ❌ | ✅ | ✅ | ✅ | policy `pins_owner_delete` |
| Comentar, votar, marcar favorito, RSVP | ❌ | ✅ | ✅ | ✅ | políticas con `user_role() <> 'guest'` |
| Publicar en el foro | ❌ | ✅ | ✅ | ✅ | policy `threads_insert_auth` |
| Publicar como entidad oficial | ❌ | ❌ | ✅ | ✅ | dentro de la propia policy de INSERT |
| Denunciar contenido | ❌ | ✅ | ✅ | ✅ | RPC `create_content_report` |
| Editar o borrar contenido ajeno | ❌ | ❌ | ✅ | ✅ | políticas `..._owner_or_mod` |
| Verificar un pin (hacerlo permanente) | ❌ | ❌ | ✅ | ✅ | RPC `verify_and_make_permanent` |
| Quitar la verificación de un pin | ❌ | ❌ | ✅ | ✅ | RPC `unverify_pin` |
| Extender el plazo de un pin | ❌ | ❌ | ✅ | ✅ | RPC `extend_pin_ttl` |
| **Trazar el mapeo interior** (edificios, plantas, áreas) | ❌ | ❌ | ✅ | ✅ | `buildings_write`, `building_floors_write`, `areas_write` |
| Cargar planos de planta | ❌ | ❌ | ✅ | ✅ | `floor_plans_admin` (el nombre engaña: es de moderador) |
| Mover un pin de sitio | ❌ | ❌ | ✅ | ✅ | trigger `trg_authorize_pin_move` |
| **Crear, editar o borrar una facultad** (y su perímetro) | ❌ | ❌ | ❌ | ✅ | `faculties_admin` |
| **Subir fotos de una facultad, edificio o área** | ❌ | ❌ | ❌ | ✅ | `place_photos_admin` |
| Entrar al panel de administración | ❌ | ❌ | ❌ | ✅ | cada RPC `admin_*` comprueba el rol |
| Ver el perfil completo de otro, con su correo | ❌ | ❌ | ❌ | ✅ | `profiles_read_admin` |
| Cambiar el rol de otro | ❌ | ❌ | ❌ | ✅ | RPC `admin_set_user_role` |
| Resolver denuncias | ❌ | ❌ | ❌ | ✅ | RPC `claim_moderation_report` y `resolve_moderation_report`, que comprueban `user_role() = 'admin'` por dentro |
| Ver denuncias | ❌ | ❌ | ⚙️ | ✅ | `content_reports_read_own_or_admin`: las propias, o `has_capability('reports')` (cada quien ve las que puso) |
| Enviar una notificación push a todo el mundo | ❌ | ❌ | ❌ | ✅ | RPC `admin_broadcast_push_notification` |
| Mandarse una push de prueba a uno mismo | ❌ | ❌ | ❌ | ✅ | RPC `admin_send_test_push_to_self` |
| Trazar el mapeo interior *(con la pieza `mapping`)* | ❌ | ❌ | ⚙️ | ✅ | `has_capability('mapping')` |
| Ver la cola de denuncias *(con la pieza `reports`)* | ❌ | ❌ | ⚙️ | ✅ | `has_capability('reports')` |
| Elegir qué avisos recibir | ❌ | ✅ | ✅ | ✅ | `notification_preferences_own` |
| Ver el registro de actividad | ❌ | ❌ | ❌ | ✅ | RLS `activity_log_read_admin` + RPC `admin_activity_log` |
| Ver quién recibe los avisos push | ❌ | ❌ | ❌ | ✅ | RPC `admin_push_subscribers` |
| Dar de baja el dispositivo de otro | ❌ | ❌ | ❌ | ✅ | RPC `admin_delete_push_subscription` |

**El eje que separa los dos roles es "contenido y mapa" contra "plataforma y
personas".** Un moderador manda sobre lo que se ve en el mapa: verifica, edita,
borra, traza edificios y áreas. Un administrador manda sobre el sistema:
facultades, roles, denuncias, correos, difusión.

Hay dos filas que se salen de ese eje y conviene mirarlas: **subir la foto de
una facultad y crear la facultad son de admin**, aunque son gestos de curaduría
de contenido. Si algún día los moderadores son los centros de alumnos de cada
facultad, esas dos filas quedan al revés de lo que se espera.

> ⚠️ **Ningún permiso está acotado por facultad.** `profiles.faculty_id` existe,
> pero **no lo usa ninguna política**: comprobado el 2026-08-10 sobre el
> baseline. Un moderador es moderador **de toda la universidad** — puede borrar
> un hilo de Derecho, verificar un pin de Arquitectura o borrar una planta
> entera de Medicina con sus áreas en cascada. Si la idea es que el rol lo
> lleven los centros de alumnos, esto es lo primero que hay que cambiar, y no es
> un ajuste de interfaz: son las políticas.

La columna de la derecha importa más de lo que parece. Un permiso que solo se
aplica en la interfaz es una sugerencia: cualquiera con la clave pública del
proyecto puede llamar la API directamente. **Ya no queda ninguno así**: mover un
pin era el último, y se cerró el 2026-08-26 con `trg_authorize_pin_move` (ver
más abajo, en `pins`).

### Las tres capas de seguridad

1. **Permisos de tabla y columna.** Quién puede siquiera nombrar la tabla. Aquí
   está la parte más sutil: `anon` y `authenticated` **no** tienen `SELECT` de
   tabla sobre `profiles`; lo tienen por columna, y `email` solo se le concede a
   `authenticated`. Por eso existe la vista `profiles_public`, que deja el correo
   fuera.
2. **Row Level Security.** Qué filas ve o toca cada quien. Activo en las 32
   tablas. Tres no tienen ninguna política a propósito — `pin_creation_events`,
   `notification_push_deliveries` y `storage_cleanup_queue` son internas y solo
   las tocan funciones `SECURITY DEFINER` y `service_role`.
3. **Triggers de protección.** Qué **columnas** puede cambiar. RLS decide si
   podés editar tu pin; `protect_pin_sensitive_fields` decide que al editarlo no
   puedas marcarte como verificado. Sin esta capa, `pins_owner_update` sería un
   agujero.

---

## 3. El ciclo de vida de un pin

Es el corazón de la aplicación y conviene entenderlo entero.

```
                  create_pin_with_daily_limit()
                            │
       ┌────────────────────┼────────────────────┐
       ▼                    ▼                    ▼
   type=report          type=event           type=place
   expira según         vive hasta           permanente
   ttl_hours            ends_at              (solo moderador)
       │
       ├──── el moderador extiende ──► extend_pin_ttl()  → nuevo plazo
       │
       ├──── el moderador verifica ──► verify_and_make_permanent()
       │                               is_permanent = true
       │                               type = 'place'
       │                               expires_at = null
       │                               +25 de karma al autor
       │                               2 verificados → insignia Cartógrafo
       │
       └──── se cumple el plazo ─────► lo borra el cron #1, cada 30 min
```

**Crear un pin no pasa por un `INSERT`.** No existe política de INSERT sobre
`public.pins`: se crea a través de la RPC o no se crea. Eso es lo que permite
imponer el límite de 10 pines al día por persona sin confiar en el navegador. El
límite se cuenta en días UTC sobre `pin_creation_events`, una bitácora aparte
cuyas filas sobreviven al borrado del pin — así, borrar y volver a crear no
reinicia el contador. Moderadores y administradores están exentos.

**`description` admite hasta 1500 caracteres** (`pins_description_check`). Era
500 hasta el 2026-08-08: la descripción enlaza URLs, y una de correo o de Drive
mide 300 caracteres sola, así que un evento con dos párrafos y un enlace de
inscripción ya no cabía. El mismo tope está en el esquema del formulario
(`CreatePinModal.tsx`); si se cambia uno hay que cambiar el otro, o el navegador
deja pasar algo que la base rechaza.

Además, dos pines vivos no pueden ocupar exactamente la misma coordenada
(`prevent_occupied_pin_location`). Un pin ya expirado no reserva su sitio.

**Verificar es graduar un reporte a lugar.** Un estudiante reporta "hay un
microondas acá"; un moderador lo confirma y el pin deja de caducar, se convierte
en `type = 'place'` y muestra quién lo verificó. Conserva su categoría original
aunque esa categoría sea de tipo `report`: es intencional, un baño verificado
sigue siendo un baño. Por eso `categories.kind` solo admite `report` y `event`,
y no existe un `kind = 'place'`.

**El plazo lo pone el servidor.** `create_pin_with_daily_limit` ignora lo que
mande el cliente y lo deduce: un `place` no caduca, un `event` caduca cuando
termina (`ends_at`), y un `report` según el `ttl_hours` de su categoría, con 24
horas por defecto si no lo define. Eso convierte `categories.ttl_hours` en la
autoridad real; antes solo lo leía el navegador.

**Verificar tiene vuelta atrás.** `unverify_pin` devuelve el pin a reporte con
un plazo nuevo y le resta al autor los 25 de karma que le dio la verificación.
La insignia de Cartógrafo no se retira. Solo funciona sobre pines que salieron
de una verificación —se reconoce por `verifier_entity_name`—, así que un lugar
creado directamente por un moderador no se puede convertir en reporte.

**Qué puede editar el autor de un pin.** Título, descripción, facultad, y las
fechas `starts_at` / `ends_at` de su evento — incluido `expires_at`, siempre que
acompañe a `ends_at`, para que mover la fecha de fin funcione de verdad. La
categoría también, **salvo que el pin esté verificado**: ahí forma parte de lo
que un moderador confirmó, y el intento devuelve un error explícito en vez de
fallar en silencio.

Lo que el trigger revierte sin decir nada: `is_permanent`, `type`,
`is_official`, `official_entity_name`, `verifier_entity_name`, `creator_id`,
`reports` y los contadores de votos. Son campos que la interfaz nunca intenta
cambiar, así que un error ahí sería solo ruido.

---

## 4. Las tablas

32 en total, todas con RLS activo.

### Catálogo — se lee sin sesión, se escribe desde el seed

| Tabla | Qué guarda | Quién escribe |
|---|---|---|
| `campuses` | Los 3 campus con sus coordenadas | seed |
| `faculties` | 17 facultades y edificios, con su perímetro en GeoJSON | seed / **admin desde `/admin/mapeo`** |
| `careers` | 39 carreras, colgando de una facultad | seed |
| `categories` | 29 categorías de pin: color, icono SVG y `ttl_hours` | seed |
| `badges` | Las 6 insignias | `badges.sql` |
| `admin_emails` | Correos que reciben rol admin al registrarse | a mano |
| `floor_plans` | Planos de interior en GeoJSON | seed / moderador |

El `polygon` de una facultad hace dos cosas: pinta el contorno en el mapa y
asigna la facultad automáticamente a un pin que cae dentro cuando el estudiante
no la eligió. Está en formato GeoJSON, o sea `[longitud, latitud]` — al revés
que las columnas `lat`/`lng` de al lado, que es una fuente clásica de errores.

**Los perímetros viven SOLO aquí.** No hay copia en el repositorio, y es
deliberado: la hubo —`src/shared/data/facultyPerimeters.ts`— y se desincronizó
sin que nadie lo notara, porque el cliente no consultaba la tabla y por tanto la
copia mala era invisible. `seed.sql` tampoco los siembra. Una base nueva arranca
sin contornos y se trazan desde `/admin/mapeo`, igual que el mapeo interior.

En el cliente eso significa que `Faculty.polygon` tiene **un solo** significado:
el perímetro trazado, o `null`. No cae a ninguna huella aproximada, y
`facultyPerimeter(id)` no es más que un atajo para leerlo de `FACULTIES`. Si
alguna vez te ves tentado de añadir un índice de perímetros al lado del
catálogo, no lo hagas: ya se probó, y el editor acabó enseñando el nombre nuevo
de una facultad junto a un "sin trazar" que ya no era verdad.

**`polygon` null significa "sin perímetro trazado", y no es lo mismo que un
perímetro cualquiera.** Una facultad sin trazo no pinta contorno, no se puede
entrar a mapear su interior y no captura ningún pin. Durante un tiempo el
generador del seed rellenaba ese hueco con un cuadrado de ~100 m centrado en la
chincheta, y eso hacía que un pin en mitad de la calle se asignara a una
facultad por un contorno que nadie dibujó. La migración
`20260808000001_faculties_source_of_truth.sql` lo dejó en null donde
corresponde, y el generador ya no lo produce.

**Desde la fase 7B (2026-08-08) esta tabla es la fuente del catálogo.** Antes el
cliente no la consultaba nunca: las facultades salían de `FACULTIES`, un array
estático de `campusData.ts` del que dependen unos 26 archivos, y crear una
facultad en la base no la hacía aparecer en ninguna parte de la app. Ahora
`src/shared/data/facultyStore.ts` publica el catálogo en una caché de módulo
—el mismo patrón que `mappingCache`— **sembrada con ese array** y rehidratada
desde aquí al arrancar. Los 26 archivos siguen llamando `FACULTIES.find(...)`
igual que antes y no hay estados de carga que propagar, porque la lista nunca
está vacía: si la consulta falla, la app enseña el catálogo de siempre.

Lo que sí hay que saber al tocar esto:

- **`careers` no se crea sola.** Una facultad nueva no tiene carreras, y el
  selector del perfil filtra las del catálogo de siempre justamente por eso —la
  Biblioteca Nicanor Parra no es un sitio donde se estudie. A una facultad
  creada desde el editor no se le aplica ese filtro (`academicFaculties()` en
  `campusData.ts`), porque "sin carreras" ahí significa "todavía no se le
  cargaron", no "no es académica".
- **Borrarla casi nunca se puede.** `pins`, `forum_threads` y `profiles`
  apuntan a `faculties` **sin** `on delete cascade`. El editor solo ofrece el
  botón cuando la facultad está vacía de edificios, áreas y pines; es para
  deshacer una recién creada por error, no para retirar una de verdad.

`admin_emails` solo la puede leer un admin, y hay que insertar el correo
**antes** de que la persona se registre: el rol se asigna en el alta, no después.

### Mapeo interior — se dibuja desde `/admin/mapeo`

| Tabla | Qué guarda | Quién escribe |
|---|---|---|
| `buildings` | La huella de un edificio en GeoJSON, su altura y su planta por defecto | moderador / admin |
| `building_floors` | Qué plantas tiene cada edificio, con etiqueta opcional | moderador / admin |
| `areas` | Salas, halls, patios y demás recintos de una planta | moderador / admin |

A diferencia del catálogo, esto **no** sale del seed: se traza a mano con el
editor de mapeo y vive solo en la base.

Tres reglas del modelo que conviene tener presentes:

- **El nivel 0 no existe.** La planta baja es el `1` y el primer subterráneo el
  `-1`, y hay un `check (level <> 0)` que lo impone. Un edificio con "planta 0"
  y "planta 1" sería ambiguo en cuanto alguien lo tradujera.
- **La planta es un contexto de facultad, no de edificio.** El selector del mapa
  ofrece la unión de las plantas de todos los edificios de la facultad, no las
  de uno solo. La regla completa vive en `src/shared/utils/floorVisibility.ts`.
- **Un área siempre cuelga de una planta concreta**, salvo las exteriores
  (`building_id` nulo), que son suelo y se ven desde todas.

#### La planta de un pin la valida el servidor

`areas` no puede desviarse: tiene FK compuesta `(building_id, floor)` contra
`building_floors`. `pins` no puede tener esa FK —un pin puede estar en el piso 2
sin edificio, porque `building_id` se deduce de la huella y el mapeo puede estar
a medias— así que la regla la impone el trigger **`trg_validate_pin_floor`**, en
tres casos:

| Situación | Qué exige |
|---|---|
| `floor` nulo | Nada. Es un pin de exterior |
| `floor = 0` | Rechaza siempre. La baja es el `1` |
| Con `building_id` | El nivel tiene que estar en `building_floors` de ESE edificio → `INVALID_FLOOR_FOR_BUILDING` |
| Sin `building_id`, con facultad **ya mapeada** | El nivel tiene que existir en algún edificio de la facultad → `FLOOR_NOT_IN_FACULTY` |
| Sin `building_id`, facultad sin edificios | Nada. No hay contra qué comprobar |

El último caso es deliberado: exigir mapeo para poder decir "piso 2" apagaría la
planta en todo el campus que aún no se ha trazado.

Dos cosas que explican por qué está donde está:

- **Es un trigger, no un check dentro de `create_pin_with_daily_limit`.** `floor`
  es de los pocos campos que el autor escribe con un `UPDATE` directo a `pins`
  (`protect_pin_sensitive_fields` lo deja pasar a propósito: corregir el piso de
  una sala es la edición más común). Validar solo al crear no cerraría nada. Los
  triggers además se disparan para `service_role`, así que cubren lo que se
  escribe a mano desde el SQL Editor.
- **El nombre del trigger tiene que ordenar después de
  `trg_protect_pin_sensitive_fields`.** Postgres dispara los `BEFORE` en orden
  alfabético, y ese revierte `building_id` al valor viejo cuando quien edita no
  es moderador; validar antes compararía contra un edificio que no va a quedar
  escrito.

El síntoma de no tener esto no era un error, era un pin **invisible**: el
selector solo ofrece los niveles de `building_floors` y un pin se ve si su planta
es la activa, así que una planta que nadie declaró no tiene chip que la
seleccione. El pin existía, gastaba cupo diario y no lo veía ni su autor. El
trigger no arregla las filas que ya estaban mal — la migración
`20260810000000_pin_floor_server_validation.sql` trae al final la consulta que
las lista.

#### Mover un pin de sitio lo autoriza el servidor

Cerrado el 2026-08-26, y era el último permiso del proyecto que vivía solo en la
interfaz. `can(role, 'pin.update.location')` pide moderador y `PinDetail`
esconde el botón, pero esconder un botón no impide llamar a la API. El hueco
concreto: `pins_owner_update` deja al autor escribir su fila y
`protect_pin_sensitive_fields` protege `building_id` y `area_id` —los derivados
del punto— pero **no** `lat` ni `lng`. Un `PATCH` movía el pin de manzana y le
dejaba colgando el edificio viejo.

Lo cierra **`trg_authorize_pin_move`**, y tiene tres detalles que conviene no
deshacer sin querer:

- **Es un trigger aparte y no dos líneas más en `protect_pin_sensitive_fields`.**
  Por el orden alfabético de los `BEFORE`: `prevent` va antes que `protect`, así
  que mover a un punto ocupado habría respondido `PIN_LOCATION_OCCUPIED` —un
  error sobre un movimiento que se iba a rechazar igual— en vez de decir que
  falta el permiso. `authorize` ordena antes que los dos.
- **Solo se queja si el punto cambia de verdad.** El trigger está acotado a
  `update of lat, lng`, pero eso también dispara cuando se reescribe el mismo
  valor.
- **Exime a `service_role`, al revés que `trg_validate_pin_floor`.** No es una
  incoherencia: una planta inexistente está mal la escriba quien la escriba,
  mientras que "quién puede mover un pin" no significa nada frente a la llave
  que **es** la administración — bloquearla solo haría fallar el mantenimiento a
  mano. `anon` no se cuela por esa exención, porque las dos políticas de
  `UPDATE` sobre `pins` exigen ser el autor o ser moderador.

`floor_plans` guarda planos de interior como imagen georreferenciada
(`image_overlay` y `bounds`). Las columnas existen desde el principio pero
todavía no las usa nadie: están previstas para poder calcar áreas sobre el plano
de una planta.

### Identidad

**`profiles`** es el espejo de `auth.users` con los datos de la aplicación. La
crea el trigger `on_auth_user_created`; nunca se inserta desde el cliente.
`karma` solo lo mueve `adjust_karma`, y `role` solo `admin_set_user_role`; los
dos caminos los custodia `protect_profile_privileged_fields`.

**`profiles_public`** es una vista con `security_invoker = true` que expone las
mismas filas sin el correo. Es lo que consulta la aplicación para mostrar el
nombre del autor de un pin o de un hilo.

### Contenido e interacción

| Tabla | Notas |
|---|---|
| `pins` | Ver la sección 3 |
| `pin_photos` | Fotos de un pin. `ON DELETE CASCADE` desde `pins`. Máximo 5, impuesto por trigger |
| `place_photos` | Galería de una facultad o de un edificio. Máximo 10. Ver abajo |
| `pin_comments` | Comentarios, entre 1 y 400 caracteres |
| `pin_schedule_items` | Programa opcional de un evento: bloques horarios. Sin política de `update`, la interfaz reemplaza el set completo |
| `pin_votes` | Un voto por persona y pin, `+1` o `-1` |
| `favorites` | Marcadores personales |
| `event_rsvps` | Asistencia a eventos. Un trigger comprueba que el pin sea de tipo `event`. **No se lee directamente**: ver más abajo. `reminded_at` guarda cuándo se creó su recordatorio y **solo lo escribe la base**: ver "El recordatorio de un evento se manda una vez" |
| `pin_creation_events` | Bitácora del límite diario. Interna, sin políticas |
| `storage_cleanup_queue` | Archivos pendientes de borrar del bucket. Interna, sin políticas |

Los contadores `votes_up` / `votes_down` de `pins` y `forum_threads` están
duplicados a propósito, para no recontar en cada lectura del mapa. Que no se
desincronicen depende de un mecanismo concreto: **solo las RPC `vote_pin` y
`vote_thread` pueden escribirlos.** Antes de tocarlos ponen una marca de sesión
(`udpmap.vote_rpc`) que el trigger `protect_vote_counters` exige ver. Cualquier
otro intento de cambiarlos lanza una excepción.

### Quién va a un evento no es público

Corregido el 2026-08-26 (era el SEC-007 del backlog). `event_rsvps_read` era
`using (true)`: cualquiera con la clave anon —que viaja en el bundle— podía
descargar la tabla entera y saber a qué eventos va cada persona. Es de las pocas
cosas del proyecto que son datos personales de verdad; un voto en el foro es una
opinión, esto es dónde va a estar alguien y a qué hora.

**La salida no fue taparlo, fue cambiar lo que se expone.** Cerrar la lectura y
ya está habría dejado la funcionalidad peor de lo que estaba: marcar "Iré"
guardaba una fila y no cambiaba nada en pantalla, y quien organiza una feria no
se enteraba de si iban 5 o 50. Así que la tabla se cerró y quedaron las dos
lecturas que sí tienen sentido, cada una con su dueño:

| Función | Quién | Qué devuelve |
|---|---|---|
| `event_rsvp_counts(pines[])` | cualquiera | Solo el número, por evento. Máximo 200 pines por llamada |
| `event_attendees(pin)` | quien creó el evento, y admin | La lista con nombre y avatar |

Las dos son `SECURITY DEFINER` porque leen una tabla que ya nadie lee
directamente, así que la autorización va dentro de la función. **Moderador no
basta para `event_attendees`, y es a propósito**: el eje de ese rol es
"contenido y mapa", y una lista de asistentes no es contenido.

No hizo falta una política de lectura para el organizador porque
`event_rsvps_all_own` es `for all` —incluye el `SELECT` de las filas propias—,
así que saber a qué eventos vas tú nunca dependió de la política pública.

El **umbral** con el que la interfaz decide desde qué número enseñar el conteo
(`RSVP_PUBLIC_THRESHOLD`) vive en el cliente y no aquí, porque no es privacidad:
la base devuelve el número exacto a cualquiera. Es que "2 personas van" dice
"esto no le importa a nadie" más fuerte que no decir nada.

### Galerías de lugares

**`place_photos`** es la galería que se ve al abrir la ficha de una facultad o al
acotarla por un edificio o por un área exterior. Antes una facultad tenía UNA
foto (`faculties.image`), y un edificio o un área, ninguna.

Lo que hay que saber de su forma: tiene **tres claves foráneas anulables**,
`faculty_id`, `building_id` y `area_id`, con un `check (num_nonnulls(...) = 1)`
que obliga a que vaya exactamente una. La alternativa habitual —un par
`(entity_type, entity_id)`— es la que **no** se usó: un `text` que apunta a tres
tablas no puede tener clave foránea, así que ni la base garantizaría que la
entidad existe ni el borrado arrastraría sus fotos. Con FK reales, borrar un
edificio desde el editor se lleva sus fotos por cascada.

El tope de 10 fotos lo impone `enforce_place_photo_limit()`, y **cuenta por los
tres ids**. Si se añade un cuarto tipo de dueño hay que tocar esa función además
del CHECK: mientras la columna nueva no entre en el `where`, todas las filas del
tipo nuevo comparten un mismo cajón y se agotan el tope entre ellas.

`sort_order` 0 es la **portada**: la que sale en la cabecera de la ficha sin
abrir el carrusel. No hay un campo "es portada" aparte, a propósito — conviviendo
con un orden manual daría dos verdades sobre lo mismo.

Lectura pública, escritura solo admin. `faculties.image` se conserva como
respaldo para una facultad que todavía no tenga galería.

### Foro

`forum_threads`, `forum_comments` (`parent_comment_id` permite anidar en la
base, pero la interfaz muestra un solo nivel: toda respuesta cuelga de su
comentario raíz y lleva `@autor`) y `forum_votes`. Un hilo con `faculty_id` nulo
es del tablón general, y `is_pinned` lo fija arriba. Los contadores de votos solo
se escriben por RPC, ver `vote_thread` en la sección 5. Marcar un hilo como oficial exige ser moderador y poner un nombre
de entidad no vacío, y eso se valida dentro de la propia política de INSERT.

### Moderación

**`content_reports`** guarda un `snapshot` en JSON del contenido denunciado, para
que un administrador pueda juzgarlo aunque el autor lo borre mientras tanto. Un
índice parcial impide que la misma persona tenga dos denuncias abiertas sobre el
mismo contenido, pero permite volver a denunciar una vez resuelta la anterior.

### Notificaciones

```
algo ocurre → trigger → create_notification() → fila en notifications
                                                      │
                                          trigger queue_notification_push
                                                      │
                                       una fila por suscripción del usuario
                                                      │
                                    notification_push_deliveries (cola)
                                    pending → sent | failed | expired
                                                      │
                                  cron cada minuto → Edge Function send-push
                       claim_push_deliveries → envía → finish_push_deliveries

recordatorio de evento:  cron cada minuto → enqueue_upcoming_event_notifications()
                         → create_notification() (una vez por asistencia: reminded_at)
```

`notifications` tiene un `unique (user_id, dedupe_key)` y `create_notification`
hace `on conflict do nothing`: es lo que impide avisar dos veces del mismo hecho.
`authenticated` no tiene `INSERT` sobre la tabla — solo `SELECT`, `DELETE` y
`UPDATE` limitado a la columna `read_at`, que es justo lo que hace falta para
marcar como leída. El `DELETE` con la política `notifications_delete_own` es lo
que permite que "Vaciar todo" del centro de avisos sea un `delete().eq('user_id',
…)` desde el cliente, sin RPC.

**Un aviso de difusión no es un logro** (migración `20260827000000`). Los avisos
que manda `/admin/difusion` tienen su propio `type = 'announcement'` y
`category = 'system'`. Antes reutilizaban `'achievement'`/`'profile'` porque era
lo que cabía en los CHECK, y eso tenía tres consecuencias que se veían en la
aplicación: un corte de agua llegaba disfrazado de logro, se mezclaba entre las
insignias al filtrar por "Perfil", y su `url` era `/admin` — o sea que tocarlo
mandaba al estudiante a una pantalla de la que rebota al mapa. Ahora apuntan a
`/`.

`admin_push_subscribers()` (migración `20260829000100`) enseña **quién** recibe
los avisos y no solo cuántos: `admin_count_push_subscribers()` devolvía un
`count(*)`, con el que no se puede responder a lo único que importa antes de
difundir algo a toda la universidad. Devuelve nombre, rol, `user_agent` y fechas
— **no el correo**, que es el dato que convierte una lista en un directorio—, y
comprueba el rol dentro de la función, no solo con el GRANT.

`admin_delete_push_subscription(endpoint)` (migración `20260830000000`) existe
para las suscripciones que ya no puede dar de baja su dueño: un teléfono
perdido, un navegador que nadie va a volver a abrir. `push_subscriptions_own`
solo deja borrar las propias, así que esas se quedaban inflando el "llegará a N
dispositivos" para siempre. La cola de entregas ya limpia sola las que el
servicio de push rechaza con 404 o 410, pero un endpoint válido de un teléfono
que nadie mira nunca da error. La baja queda registrada como
`push_unsubscribed`, porque es una acción de administración sobre alguien.

La misma migración añade `admin_send_test_push_to_self()`. Existe porque probar
el push obligaba a usar la difusión, que recorre **todas** las suscripciones:
comprobar "¿me llega a mí?" le hacía sonar el teléfono a la universidad entera.

### La cola de entregas push

Cada fila de `notification_push_deliveries` es "este aviso, a esta suscripción".
La crea `queue_notification_push` en `pending` y termina en uno de tres estados
(migración `20261021000000`):

| Estado | Qué significa |
|---|---|
| `sent` | El servicio push la aceptó |
| `failed` | Fallo terminal: el servicio la rechazó sin remedio (400, 401, 403, 413), las claves de la suscripción no sirven, el payload no cabe, o se agotaron los 5 intentos |
| `expired` | Ya no hay a quién enviarla: el servicio push contestó 404/410, o la suscripción se borró antes del envío. No es un fallo, y por eso no se mezcla con `failed` |

**Reclamo con lease, no estado `processing`.** Antes send-push leía las `pending`
con un SELECT y las marcaba al terminar. Entre una cosa y otra nada decía "esta ya
la tiene alguien": bastaba con que coincidieran el cron y el botón del panel, o
con que un lote durara más de un minuto, para enviar lo mismo dos veces. Ahora
`claim_push_deliveries` elige las filas listas con `for update skip locked` y, en
la misma sentencia, empuja su `next_attempt_at` al futuro (el *lease*, 120 s por
defecto) y suma uno a `attempts`. Mientras dure el lease nadie más las ve como
pendientes.

Un estado `processing` habría dado lo mismo a primera vista, pero el CHECK no lo
admitía y, sin un recuperador que devolviera a `pending` lo que dejó a medias una
ejecución muerta, esas filas se quedarían atascadas para siempre. El lease se
recupera solo: al vencer, la fila vuelve a ser reclamable **con el intento ya
contado**, de modo que una fila que mata la función cada vez agota sus intentos y
acaba `failed` en vez de dar vueltas.

El lease tiene que ser más largo que el peor lote: 50 filas a 10 envíos a la vez
son 5 tandas de hasta 10 s de timeout, 50 s, más el cifrado y el cierre. Si
venciera antes de terminar, otra ejecución reclamaría las mismas filas y
volveríamos al principio.

**Cierre con fencing.** send-push cierra el lote con una sola llamada a
`finish_push_deliveries`. Cada resultado lleva el `attempts` que se le dio al
reclamar, y la escritura solo se aplica si la fila sigue `pending` **y** con ese
mismo `attempts`. Si el lease venció y otra ejecución la reclamó (ahora con
`attempts + 1`), o el trigger la pasó a `expired`, el cierre atrasado no hace nada
y no pisa el resultado bueno. La función devuelve los ids que sí cerró. `attempts`
no se toca al cerrar: ya se contó al reclamar.

**El rastro de un fallo sobrevive a la suscripción.** `subscription_id` es
anulable y su clave foránea es `on delete set null`. Con `cascade`, el 410 que
manda borrar la suscripción se llevaba también las entregas que contaban qué había
pasado. Pero `set null` por sí solo deja huérfanas las `pending` de la suscripción
borrada: ni el `push_subscriptions!inner` del send-push anterior ni
`claim_push_deliveries` (que exige `subscription_id is not null`) las ven, así que
no se cerrarían nunca. Y el borrado no siempre pasa por el 410: desactivar el
push, cerrar sesión, `admin_delete_push_subscription`, el cascade desde `profiles`.

Por eso hay un trigger `BEFORE DELETE` sobre `push_subscriptions`,
`push_subscriptions_expire_deliveries`, que pasa a `expired` sus entregas
`pending` (con `last_error = 'suscripción borrada antes del envío'`) y cubre todos
esos caminos a la vez. Tiene que ser `BEFORE`: en `AFTER`, la acción `set null` de
la clave foránea ya habría vaciado `subscription_id` y el trigger no encontraría
qué expirar. Y `SECURITY DEFINER`, porque quien borra es `authenticated` y ese rol
no tiene ningún permiso sobre la cola. El `unique (notification_id,
subscription_id)` sigue ahí; Postgres trata cada NULL como distinto, así que caben
varias entregas huérfanas de un mismo aviso.

**`push_host`, no el endpoint.** Cada entrega guarda el host del servicio push
(`web.push.apple.com`, `fcm.googleapis.com`…), copiado de la suscripción al
encolarla. No el endpoint completo: es una URL de capacidad que identifica un
dispositivo concreto y no tiene por qué sobrevivir a su baja. El host basta para la
pregunta que importa después de un fallo, qué servicio push es el que rechaza:

```sql
select push_host, status, count(*)
from public.notification_push_deliveries
group by 1, 2 order by 1, 2;
```

Como la migración dejó el índice `notification_deliveries_subscription_idx` sobre
`subscription_id`, `register_push_subscription` (que borra por esa columna en cada
vuelta a primer plano), el trigger y la propia acción `set null` encuentran sus
filas sin recorrer la cola.

### Una suscripción que cambia de endpoint

Migración `20261021000100`. Cuando el navegador entrega un endpoint nuevo
(reinstalar la PWA en el iPhone, borrar los datos del sitio),
`register_push_subscription` creaba una fila y dejaba la anterior: inflaba el
"llegará a N dispositivos" de Difusión y arrastraba entregas pendientes hacia un
endpoint que ya no existe. Ahora el cliente le dice cuál fue el último endpoint que
el servidor confirmó (`p_old_endpoint`, opcional) y la base, en el mismo acto, mueve
a la suscripción nueva las entregas `pending` de la vieja y la borra.

- **La firma de cuatro argumentos se borró** antes de crear la de cinco. Con las dos
  conviviendo, PostgREST responde "could not choose the best candidate function".
  El frontend de antes sigue funcionando sin cambios: `p_old_endpoint` tiene valor
  por defecto, así que su llamada con cuatro argumentos con nombre resuelve a la
  nueva.
- **Solo se busca entre las suscripciones de quien llama.** El endpoint viejo lo
  manda el cliente; sin ese filtro, cualquiera podría retirar el dispositivo de
  otra persona con solo conocer su endpoint. Y solo se mueven las entregas cuyo
  aviso es de quien llama.
- **Se mueve con el `attempts` y el lease intactos.** El fencing de
  `finish_push_deliveries` se apoya en esos campos: una ejecución de `send-push`
  que ya tuviera la entrega reclamada tiene que poder cerrarla. Si la suscripción
  nueva ya tenía una entrega del mismo aviso, la de la vieja no se mueve (el
  `unique` no lo permite) y el trigger `BEFORE DELETE` la expira al borrar la
  suscripción. Lo ya cerrado (`sent`, `failed`, `expired`) no se mueve: se queda
  como rastro, sin suscripción y con su `push_host`.
- Un `p_old_endpoint` igual al nuevo, en blanco, inexistente o de otra persona no
  hace nada y no es un error.

### La cola no crece sin límite

Migración `20261021000200`. Ni las entregas ni los avisos se borraron nunca, y la
cola es la tabla que más crece del esquema: una fila por aviso y por dispositivo.
`prune_push_history()` los borra por edad, una vez al día (cron
`udp-map-prune-push-history`, 04:17 UTC), y devuelve cuántos se llevó:
`{"deliveries": n, "notifications": m}`.

| Qué | A partir de |
|---|---|
| Entregas `sent` y `expired` | 30 días |
| Entregas `failed` | 90 días: es lo único que alguien va a querer mirar con calma |
| Avisos leídos | 180 días |
| Avisos sin leer | 365 días |

La edad es siempre `created_at`. Una entrega `pending` nunca se borra por edad. Las
entregas de un aviso que se borra se van con él por la cascada y no entran en la
cuenta de `deliveries`.

**Es segura gracias a `reminded_at`.** Sin ella, borrar el aviso de un evento
todavía próximo lo habría hecho reaparecer en el siguiente barrido.

Se niega por dentro a cualquier rol que no sea el del servicio, no solo por el
`GRANT` (`EXECUTE` solo para `service_role`): `auth.role()` nulo —pg_cron corre sin
JWT— o `service_role` pasan, y todo lo demás, un administrador incluido, se niega.
Desde el SQL Editor funciona: el SQL Editor corre como `postgres` y sin JWT.

### Ver qué servicio push rechaza

`admin_push_delivery_stats(días)` (migración `20261021000100`), solo admin:
agrupa las entregas creadas en los últimos `días` (por defecto 7, acotado a 1–90) por
`push_host` y `status`, con `total`, la fecha de la más reciente (`last_at`) y el
último error no nulo (`last_error`). Una entrega sin host sale como `(sin host)`.

`last_error` sale con cualquier URL recortada a su host: las entregas anteriores a
`4eae308` podían guardar el endpoint entero, que es una URL de capacidad.

**La ventana de 90 días no es simétrica con la purga.** `días` admite hasta 90,
pero `prune_push_history` borra las entregas `sent` y `expired` a los 30 días y las
`failed` a los 90. Con más de 30 días la consulta todavía ve todos los fallos y ya
no ve los envíos ni las caducidades de más de 30 días: las proporciones entre
estados se inclinan hacia `failed`. Para comparar estados, 30 días o menos; de 31 a
90 solo sirve para rastrear fallos. No se acota a 30 a propósito, porque los
`failed` se guardan 90 días justamente para poder mirarlos. Las `pending` no se
purgan por edad. El código no cambia; el comentario de la función dice lo mismo.

Existe porque los `failed` se quedaban en la cola sin que nadie los mirara. Si el
panel pregunta por qué no llegan los avisos a los iPhone, la respuesta está en la
fila `web.push.apple.com` / `failed`. Como `service_role` no es admin
(`user_role()` da `guest`), tampoco puede llamarla: el SQL Editor no sirve, y para
mirar desde ahí está la consulta de arriba.

### El recordatorio de un evento se manda una vez

Migración `20261021000100`. La única barrera contra repetir el recordatorio era la
fila de `notifications` (el `unique (user_id, dedupe_key)`), y esa fila la puede
borrar su dueño (`notifications_delete_own`): el siguiente barrido de
`enqueue_upcoming_event_notifications`, que corre cada minuto, la recreaba y el push
volvía a sonar en menos de un minuto. La idempotencia no puede vivir en algo que el
usuario puede vaciar, así que pasó a la asistencia: **`event_rsvps.reminded_at`**.

- `enqueue_event_reminder` no hace nada si `reminded_at` ya está. Lo marca cuando el
  recordatorio **existe**: recién creado, o ya estaba (`create_notification`
  devuelve null en los dos casos, así que lo distingue mirando `notifications`).
- **Si las preferencias lo silencian, no marca.** El barrido sigue intentándolo cada
  minuto mientras el evento esté en los 20 días, y si la persona reactiva los avisos
  de eventos recibe el recordatorio que se le debía.
- `enqueue_upcoming_event_notifications` filtra `reminded_at is null`. Misma firma y
  mismo retorno que antes.
- **Cancelar la asistencia y volver a apuntarse es una asistencia nueva**: fila nueva,
  sin marca. Si el aviso sigue ahí no se duplica, pero se marca.
- **El backfill** marcó, al aplicar la migración, a quien el barrido ya había
  atendido: quien tiene el aviso (aunque lo haya borrado) o no tiene silenciados los
  avisos de eventos. A quien los tenía apagados y no tenía el aviso lo dejó sin
  marcar, para no quitarle el recordatorio para siempre.
- **`authenticated` no puede escribir `reminded_at`.** `event_rsvps` tenía `grant all`,
  y con un `UPDATE` de tabla entera cada quien podía ponerse o borrarse su propia
  marca (borrarla reabría el recordatorio; ponerla lo apagaba). `INSERT` y `UPDATE`
  pasaron a columnas (`pin_id`, `user_id`, `status`): son las tres que escribe el
  `upsert` del cliente. Las políticas RLS no cambiaron.
- **La comprobación de rol de `enqueue_upcoming_event_notifications` usa `<>` a
  propósito y no debe pasar a `is distinct from`.** pg_cron corre sin JWT,
  `auth.role()` es null, la condición da null (no true) y el `if` no se cumple, así
  que el cron pasa. Con `is distinct from`, como en `claim_push_deliveries`, lo
  dejaría fuera. Un estudiante (`authenticated`) y un visitante (`anon`) sí caen en
  la excepción.

El barrido ya no vive dentro de `send-push`: tiene su propio trabajo de pg_cron,
`udp-map-event-reminders`, cada minuto. Ver la sección 8.

### Qué avisa la aplicación, y qué no avisaba

Nueve tipos. `pin_verified` y `pin_comment` son de la migración
`20260829000000`, y `event_official` de la `20260831000100` (ver más abajo, en
"El evento oficial avisa a su facultad"):

| Tipo | Categoría | Cuándo | Adónde lleva |
|---|---|---|---|
| `forum_reply` | forum | Responden tu hilo | `/foro?thread=…` |
| `achievement` | profile | Ganas una insignia | `/perfil?tab=badges` |
| `event_reminder` | events | Empieza un evento que marcaste | `/eventos?event=…` |
| `moderation_report` | moderation | Entra una denuncia *(a admins)* | `/moderacion?report=…` (lo que guarda el aviso; la app lo redirige a `/admin/moderacion?report=…`) |
| `moderation_update` | profile | Se resuelve la denuncia **que pusiste** | `/perfil` |
| `announcement` | system | Difusión del panel | la ruta que elija quien difunde |
| **`pin_verified`** | **pins** | Un moderador verifica tu publicación | `/mapa?pin=…` |
| **`pin_comment`** | **pins** | Alguien comenta tu publicación | `/mapa?pin=…` |
| `event_official` | events | Un moderador marca como oficial un evento de tu facultad | `/eventos?event=…` |

**Los dos de pines tapan huecos que se vieron al inventariar los seis anteriores:**

- **Verificar no avisaba a nadie.** `verify_and_make_permanent` da +25 de karma
  al autor y ahí se acababa: la persona se enteraba solo si volvía a mirar su
  pin. Era el único momento en que alguien recibe algo por lo que hizo, y pasaba
  en silencio.
- **Comentar un pin tampoco.** El foro sí avisaba (`notify_forum_reply`), los
  pines no. Alguien publica "Sala libre en la FIC", otro comenta "ya no está", y
  el autor no se entera — que es la conversación que más importa de las dos,
  porque corrige el mapa.

La categoría `pins` es nueva porque ninguno de los dos es tu perfil, ni el foro,
ni un evento: son **tu contenido en el mapa**. Meterlos en `profile` habría
repetido el error que ya se corrigió con los avisos de difusión, que llegaban
disfrazados de logro.

`admin_broadcast_push_notification` pasa a tener un tercer argumento, `p_url`, y
la firma de dos se retira — dejar las dos conviviendo haría que PostgREST
eligiera por los argumentos recibidos y acabara llamándose la que no lleva
destino sin que nadie se enterara. El destino se valida contra
`^/[A-Za-z0-9/_?=&%.-]*$`: **tiene que ser una ruta interna**, porque un aviso
que puede mandar a toda la universidad a una web ajena con un toque es phishing
servido por la propia aplicación.

Tres cosas más de la difusión (migración `20261021000100`, misma firma y mismo
retorno):

- **Cuenta solo lo que creó.** El contador subía por cada suscriptor aunque
  `create_notification` devolviera null (la persona silenció los avisos del
  sistema, o el dedupe), así que Difusión prometía más gente de la real. Ahora solo
  cuentan los ids no nulos, y `broadcast_sent` anota esos destinatarios.
- **Una clave de dedupe por difusión**: `'announcement_' || gen_random_uuid()`. Antes
  era el segundo de la época, y la segunda difusión del mismo segundo caía en el
  `on conflict do nothing` de todos y no llegaba a nadie. La misma clave para todos
  los destinatarios de una difusión no choca entre sí: el `unique` es
  `(user_id, dedupe_key)`.
- **Topes de 60 caracteres el título y 180 el cuerpo**, los `maxLength` del panel.
  Un RPC directo no pasa por el panel, y el payload cifrado tiene un tope de 3993 B
  que el formato híbrido, al repetir el texto, alcanza antes. Se cuentan caracteres,
  no bytes.

### Cada quien elige qué avisos quiere

`notification_preferences` (migración `20260831000000`), con **dos ejes**: la
categoría dice DE QUÉ es el aviso, y el canal POR DÓNDE llega. Alguien puede
querer ver en la app que le comentaron un pin sin que le suene el teléfono a las
once de la noche; un solo interruptor por categoría no permite decir eso.

**La ausencia de fila es "sí a todo".** No se siembra nada al crear una cuenta:
seis filas por usuario que casi siempre valen `true` son almacenamiento y
mantenimiento a cambio de nada. Solo hay fila cuando alguien cambia algo, así
que la tabla pesa lo que pesan las excepciones. La regla entera vive en
`wants_notification(usuario, categoría, canal)`, y va como función —y no como
subconsulta suelta— para que `create_notification` y `queue_notification_push`
no puedan discrepar.

**Solo `service_role` puede llamarla** (migración `20261021000100`). Es `SECURITY
DEFINER` y no mira `auth.uid()`, así que con `EXECUTE` para `authenticated` cualquier
sesión podía preguntar si un tercero silenció los avisos de foro. Nadie la llama
desde fuera: ni una política RLS, ni el cliente, ni `send-push`. Las dos funciones
que la usan son `SECURITY DEFINER`, y una función definer comprueba `EXECUTE` contra
su dueño, no contra quien dispara el trigger. El `revoke` incluye `public`: la
migración que la creó solo le quitó `anon`, y una función nace con `EXECUTE` para
`PUBLIC`, que incluye a `authenticated`.

Se aplica en dos sitios: `create_notification` no crea la fila si el canal
`in_app` está apagado, y `queue_notification_push` no encola la entrega si lo
está el `push`. El CHECK `push_needs_in_app` impide el estado imposible de
"mándamelo al teléfono pero no lo guardes".

**Los avisos de `audience = 'admin'` no son silenciables.** Quien modera tiene
que enterarse de una denuncia; dejar que se apaguen sería quedarse sin vigilar
la cola sin que nadie lo haya decidido.

### El evento oficial avisa a su facultad

`notify_faculty_official_event` (migración `20260831000100`). El ROADMAP §13.1
lo resume: "el evento de campus no falla porque se te olvide, falla porque nunca
te enteraste". El recordatorio ya existía para quien marcó, pero marcar exige
haberse enterado — ese era el eslabón que faltaba.

**Acotado a eventos oficiales, y eso es la mitad del diseño.** Marcar un evento
como oficial es permiso de moderador, así que no puede usarlo cualquiera para
escribirle a media universidad. Si valiera para cualquier evento, en una semana
la gente apagaría los avisos enteros.

Va solo a quien tiene esa facultad en su perfil, nunca a quien lo publica, y en
UPDATE solo cuando **cruza** a oficial — sin eso, editarle el título a un evento
ya oficial volvería a avisar a toda la facultad.

### El registro de actividad

```
alguien hace algo → trigger sobre la tabla → log_activity() → activity_log
                                                                   │
                                                    admin_activity_log() ← el panel
```

**Por qué existe** (migración `20260828000000`). Antes "Actividad" no era un
registro: el cliente leía los últimos 15 pines y las últimas 15 denuncias y los
mezclaba. Eso solo enseñaba **lo que todavía existe**, así que al borrar un pin
desaparecía también el rastro de que se creó — justo lo que un administrador
querría auditar. Tampoco sabía de nada que no fuera esas dos tablas: un cambio
de rol o una verificación no dejaban huella, y ninguna entrada tenía autor.

**Tres decisiones de espacio**, que es lo que originó el rediseño:

- La clave es `bigint generated always as identity`, no uuid: 8 bytes en vez de
  16, y al ser una tabla de solo-añadir, ordenar por `id` ya es ordenar por
  fecha.
- **No se guarda el contenido.** Se guarda `summary` —una línea ya legible, con
  tope de 200 caracteres— y los ids para ir a buscar el resto si sigue vivo.
  Una fila anda por los 150-250 bytes.
- Hay poda: `prune_activity_log(dias)`, con mínimo de 7 días. **No se ejecuta
  sola**; hay que programarla con `pg_cron` o llamarla a mano. Un registro sin
  poda es una tabla que solo crece.

**Se alimenta con triggers, no llamando desde cada función.** Meter la llamada
dentro de `create_pin_with_daily_limit`, `verify_and_make_permanent` y las
demás obligaría a reescribir el cuerpo entero de cada una en la migración, que
es la forma más fácil de que una se quede atrás. Los triggers capturan el hecho
sin tocar a nadie: `on_pin_activity_log` (alta, baja y el cruce de
`is_permanent`), `on_report_activity_log` (alta y cambios de estado) y
`on_role_change_activity_log`.

`log_activity` traga sus propios errores con un `raise warning`. Es
deliberado: que no se apunte la creación de un pin es molesto; que no se pueda
crear el pin porque el registro falló, no.

Solo lo lee administración (`activity_log_read_admin`), y nadie lo escribe ni
lo borra desde la API — un log que sus propios sujetos pueden editar no sirve
para auditar nada.

---

## 4.bis Permisos por persona, no por rol entero

`moderator_capabilities` (migración `20260831000200`). Antes "moderador" era un
paquete cerrado: dárselo a alguien para que ayudara a mapear le entregaba de
paso el poder de borrar cualquier hilo del foro. Eso empuja a no dar el rol a
nadie, que es como se queda el trabajo sin hacer.

Cinco piezas: `mapping` (trazar edificios, plantas y áreas), `reports` (ver y
resolver denuncias), `verify` (verificar pines y alargar plazos), `content`
(editar y borrar contenido ajeno) y `official` (marcar eventos y publicar como
entidad).

`has_capability(pieza)` sustituye a `user_role() in ('moderator','admin')` allí
donde se ha migrado. **`admin` siempre da true**: el administrador no necesita
que le concedan nada, y hacerlo dependiente de una fila abriría el caso de un
proyecto sin ningún administrador capaz de repararse a sí mismo.

Se concede **solo por RPC** (`admin_set_capability`). Si un moderador pudiera
escribir en la tabla, se concedería a sí mismo lo que quisiera — por eso
`authenticated` solo tiene `SELECT`. Y solo se reparte entre moderadores:
concederle capacidades a un estudiante crearía un moderador encubierto, con
permisos reales y sin el rol que se lo explique a quien mire la lista.

**Alcance actual.** Se aplica a las políticas del mapeo (`buildings`,
`building_floors`, `areas`, `floor_plans`) y a la lectura de la cola de
denuncias. Las demás —`pins_owner_or_mod`, el foro— siguen mirando el rol a
secas. Reescribir las treinta políticas de golpe es la forma de meter un agujero
sin darse cuenta; se irán moviendo una a una, con su comprobación.

**Al aplicar la migración, los moderadores que ya existían reciben las cuatro
capacidades que hoy tienen.** No es generosidad: quitarle permisos a alguien en
silencio, durante una migración, es romperle el trabajo sin avisarle. Recortar
se hace después, desde el panel y a propósito.

---

## 5. Las funciones

Casi todas son `SECURITY DEFINER`: se ejecutan con los permisos de `postgres`,
no con los de quien llama. Eso es lo que permite que un estudiante cree un pin
sin tener `INSERT` sobre la tabla, y que las políticas puedan leer `profiles`
pese a que nadie tiene `SELECT` de tabla sobre ella.

La contrapartida: **en una función `SECURITY DEFINER`, el permiso de `EXECUTE`
no es control de acceso.** Si la función no comprueba el rol por dentro,
cualquiera que pueda llamarla hace lo que la función haga. Por eso todas las
`admin_*` empiezan verificando `user_role()`.

Y por eso también todas deben fijar `set search_path`: sin eso, quien llame
puede anteponer un esquema propio y hacer que la función ejecute *su* versión de
una tabla o función. Todas lo fijan; si añades una función, hazlo también. La
sección 12 cuenta las dos que no lo hacían y ya se corrigieron.

### Las que puede llamar la aplicación

| Función | Quién | Qué hace |
|---|---|---|
| `user_role()` | cualquiera | El rol efectivo de quien pregunta |
| `create_pin_with_daily_limit(...)` | estudiante+ | Único camino para crear un pin |
| `vote_pin(pin, valor)` | estudiante+ | Vota; votar lo mismo dos veces retira el voto |
| `vote_thread(hilo, valor)` | estudiante+ | Igual, en el foro |
| `create_content_report(...)` | estudiante+ | Denuncia contenido |
| `register_push_subscription(endpoint, p256dh, auth, user_agent, endpoint_viejo)` | estudiante+ | Registra el navegador para notificaciones. `endpoint_viejo` es opcional: si viene y es una suscripción de quien llama, se retira y sus entregas pendientes pasan a la nueva |
| `event_rsvp_counts(pines[])` | cualquiera | Cuánta gente va a cada evento. Solo el número |
| `event_attendees(pin)` | quien organiza / admin | Quién va, con nombre. La tabla ya no se lee directamente |
| `extend_pin_ttl(pin, horas)` | moderador+ | Alarga el plazo de un pin no permanente |
| `verify_and_make_permanent(pin, verificador)` | moderador+ | Verifica y premia al autor |
| `unverify_pin(pin, horas)` | moderador+ | Deshace la verificación y devuelve los 25 de karma |
| `claim_moderation_report(id)` | admin | Se asigna una denuncia |
| `resolve_moderation_report(id, acción, nota)` | admin | La resuelve, borrando el contenido o descartándola |
| `admin_set_user_role(usuario, rol)` | admin | Cambia el rol de otro. No puede cambiar el propio |
| `admin_count_push_subscribers()` | admin | Cuántos navegadores suscritos |
| `admin_broadcast_push_notification(t, c, url)` | admin | Difunde un aviso a todo el que tenga push activado; `url` debe ser una ruta interna, el título tiene tope de 60 caracteres y el cuerpo de 180. Devuelve a cuántas personas les creó el aviso |
| `admin_send_test_push_to_self()` | admin | La misma tubería, pero solo a quien la llama |
| `admin_push_subscribers()` | admin | Quién recibe los avisos push, y desde qué dispositivo |
| `admin_push_delivery_stats(días)` | admin | Entregas de los últimos `días` (1–90, 7 por defecto) por host del servicio push y estado, con el último error. Con más de 30 días solo los `failed` están completos: la purga borra antes los `sent` y `expired` |
| `admin_delete_push_subscription(endpoint)` | admin | Da de baja un dispositivo concreto |
| `admin_set_capability(usuario, pieza, sí/no)` | admin | Concede o quita una pieza de moderación |
| `admin_user_capabilities(usuario)` | admin | Qué piezas tiene concedidas alguien |
| `has_capability(pieza)` | cualquiera | Si quien pregunta puede hacer eso. Lo usan las políticas |
| `admin_activity_log(limite)` | admin | El registro de actividad, con el nombre de quien actuó |
| `prune_activity_log(dias)` | admin | Poda el registro. Mínimo 7 días |

### Las que solo llama el servicio

Solo `service_role` —la Edge Function `send-push`, con la clave de servicio— tiene
`EXECUTE`. Las dos de la cola de push devuelven o escriben datos de suscripciones
(`p256dh` y `auth` incluidos), y comprueban dentro `auth.role() is distinct from
'service_role'`. Es `is distinct from` y no `<>` a propósito: con `<>`, un rol nulo
daría `null`, el `if` no se cumpliría y la función dejaría pasar a cualquiera.

`enqueue_upcoming_event_notifications` y `prune_push_history` las llama pg_cron, que
corre sin JWT (`auth.role()` nulo). `prune_push_history` lo permite expresamente (`auth.role() is
not null and auth.role() <> 'service_role'`). `enqueue_upcoming_event_notifications`
usa `<>`, y por eso el cron pasa sin más; ver "El recordatorio de un evento se manda
una vez" en la sección 4 antes de tocarla.

| Función | Qué hace |
|---|---|
| `claim_push_deliveries(límite, lease_s, aviso)` | Reclama hasta `límite` entregas listas (1–200, 50 por defecto) y las reserva `lease_s` segundos (30–900, 120 por defecto). Devuelve el aviso y la suscripción con sus claves. `aviso` es opcional y limita el reclamo a los envíos de ese aviso |
| `finish_push_deliveries(resultados)` | Cierra un lote con una llamada. `resultados` es un array jsonb de `{id, attempts, status, next_attempt_at, last_error}`. Solo cierra lo que sigue `pending` con ese `attempts`, y devuelve los ids que cerró |
| `enqueue_upcoming_event_notifications()` | Crea el recordatorio de los eventos de los próximos 20 días a quien se apuntó y aún no lo tiene (`reminded_at is null`). Devuelve cuántos creó. La llama el cron `udp-map-event-reminders` cada minuto; el `send-push` anterior (`20eee7e` o antes) también la llama en cada pasada, y no duplica nada |
| `prune_push_history()` | Borra por edad entregas (`sent`/`expired` 30 días, `failed` 90) y avisos (leídos 180, sin leer 365). Devuelve `{"deliveries": n, "notifications": m}`. La llama el cron `udp-map-prune-push-history` |
| `wants_notification(usuario, categoría, canal)` | Si esa persona quiere ese aviso. Antes la podía llamar cualquier sesión; ver "Cada quien elige qué avisos quiere" |

### Las internas

Nadie puede invocarlas desde la API: se les revocó el `EXECUTE`. Solo las llaman
otros triggers y funciones.

`adjust_karma` · `create_notification` · `log_activity` · `enqueue_event_reminder` ·
`check_explorer_badge` ·
`check_guardian_badge` · `check_host_badge` · `check_photographer_badge` ·
`check_pioneer_badge` · `handle_new_user` · y todos los `notify_*`, `on_*` y
`protect_*`. También las de trigger que no encajan en esos patrones:
`authorize_pin_move`, `validate_pin_floor`, `prevent_occupied_pin_location`,
`validate_rsvp_targets_event`, `enforce_*_photo_limit`,
`enqueue_*_photo_cleanup`, `queue_notification_push`,
`expire_pending_push_deliveries`, `set_notification_updated_at` y `trg_log_*`.

---

## 6. Los triggers y sus efectos en cadena

Esta es la parte que más sorprende al tocar la base a mano: una sola escritura
puede desencadenar karma, insignias, notificaciones y envíos push.

**Al crear un pin:** se comprueba que la coordenada esté libre, y después
`on_pin_badge` revisa si el autor llegó a 5 pines (insignia Explorador) o, si
es un evento, a 2 eventos (Anfitrión).

**Al mover un pin:** `trg_authorize_pin_move` comprueba que quien lo mueve sea
moderador antes que nada, y después se vuelve a comprobar que la coordenada de
destino esté libre y que la planta que el pin ya traía exista en el edificio
nuevo.

**Al votar un pin o un hilo:** `on_*_vote_karma` ajusta el karma del autor
—`+10` por un voto positivo, `-2` por uno negativo, y 12 puntos de diferencia
si alguien cambia de signo— y `on_*_vote_badge` revisa la insignia Guardián a
los 10 votos emitidos. Cambiar el karma dispara a su vez `on_profile_badge`,
que revisa Pionero a los 100 puntos.

**Al conceder una insignia:** `notify_badge_awarded` crea una notificación, que
a su vez encola una entrega push por cada navegador registrado del usuario.

**Al responder en el foro:** `notify_forum_reply` avisa al autor del hilo, o al
del comentario padre si es una respuesta anidada. No se avisa a sí mismo.

**Al confirmar asistencia a un evento:** si el evento empieza dentro de los
próximos 20 días, se crea el recordatorio en el acto y la asistencia queda marcada
(`reminded_at`). Si el evento todavía está más lejos, lo crea el cron
`udp-map-event-reminders` cuando entre en la ventana. Una asistencia ya marcada no
vuelve a avisar, aunque la persona borre el aviso.

**Al denunciar contenido:** se notifica a **todos** los administradores.

**Al borrar una suscripción push:** `push_subscriptions_expire_deliveries` pasa a
`expired` todas sus entregas `pending`, y justo después la clave foránea (`on
delete set null`) les quita la suscripción. Da igual quién borre: el 410 de
`send-push`, desactivar el push, cerrar sesión, `admin_delete_push_subscription` o
el cascade al borrar un perfil. Las entregas ya cerradas (`sent`, `failed`,
`expired`) se quedan, sin suscripción, como rastro. Sin este trigger, el `set null`
dejaría `pending` huérfanas para siempre.

**Al subir una foto:** `enforce_pin_photo_limit` y `enforce_place_photo_limit`
comprueban el tope (5 por pin, 10 por galería). Los dos son triggers `AFTER` y
no `BEFORE`, y no es un descuido: dentro de un `INSERT` de varias filas, un
`BEFORE` no ve las filas que la propia sentencia acaba de insertar y contaría de
menos. En `AFTER` la cuenta es exacta, y la excepción revierte la sentencia
entera igual. Los dos toman un `pg_advisory_xact_lock` para que dos subidas
simultáneas no se pasen del tope entre las dos.

Las insignias **nunca se retiran**. Todas las funciones `check_*_badge`
insertan y ninguna borra, deliberadamente: bajar de 5 pines no te quita
Explorador.

---

## 7. Storage

Un solo bucket, `pin-photos`, público.

La ruta no es libre. Las políticas restringen dónde y quién puede subir:
- **`pins/{user_id}/{uuid}.jpg`**: fotos de pines. El bucket lee el segundo segmento para saber de quién es el archivo.
- **`places/{kind}/{id}/{uuid}.jpg`**: galerías de lugares (`faculty`, `building` o `area`). Solo para administradores.

| Operación | Quién |
|---|---|
| Leer | cualquiera, incluso sin sesión (el bucket es público) |
| Subir | cualquiera con sesión, y solo dentro de su propia carpeta |
| Borrar | el dueño de la carpeta, o un moderador |

La compresión —lado mayor 1200 px, JPEG calidad 0.75, máximo 20 MB, tipos
`jpeg`/`png`/`webp`— ocurre **en el navegador**, en
[`photos.ts`](../src/features/pins/photos.ts). El bucket no impone límite de
tamaño ni lista de tipos, de modo que es una cortesía de la interfaz y no una
garantía del servidor. El máximo de 5 fotos por pin sí lo impone la base, con un
trigger sobre `pin_photos`.

### Cómo se borran los archivos

Postgres no puede borrar un archivo de Storage: eliminar la fila de
`storage.objects` quita el metadato pero deja el binario en S3, invisible y
facturable. De ahí el rodeo:

```
se borra una fila de pin_photos  (por su autor, por el panel de admin,
o de place_photos                       al resolver una denuncia, o en cascada
        │                         cuando el cron expira el pin o entidad)
        ▼
trigger on_pin_photo_deleted / on_place_photo_deleted
        │ → encola la ruta en storage_cleanup_queue
        ▼
cron cada 10 min → Edge Function storage-gc → borra de verdad
```

Los cuatro caminos de borrado terminan en lo mismo —una fila de `pin_photos` que
desaparece—, así que un único trigger los cubre todos. El cliente ya no borra
nada de Storage por su cuenta: hay un solo dueño de esa limpieza.

La cola es idempotente. `remove()` no falla por un archivo que ya no está, así
que reprocesar una entrada no rompe nada, y tras 5 intentos fallidos la fila se
cierra con su error a la vista para no bloquear el resto.

---

## 8. Tareas programadas, secretos y Edge Functions

Cinco trabajos de `pg_cron`:

| # | Nombre | Frecuencia | Qué hace |
|---|---|---|---|
| 1 | `expire-pins` | cada 30 min | `delete from pins where is_permanent = false and expires_at < now()` |
| 2 | `udp-map-send-push-every-minute` | cada minuto | Llama a la Edge Function `send-push`, con `timeout_milliseconds := 10000` |
| 3 | `udp-map-storage-gc` | cada 10 min | Llama a la Edge Function `storage-gc` |
| 4 | `udp-map-event-reminders` | cada minuto | `select public.enqueue_upcoming_event_notifications()`: crea los recordatorios de eventos. SQL puro, sin Vault |
| 5 | `udp-map-prune-push-history` | diario, 04:17 UTC | `select public.prune_push_history()`: borra por edad entregas y avisos. SQL puro, sin Vault |

Los #2, #4 y #5 están versionados en la migración `20261021000200`. El #2 usa el
**mismo nombre** que el del runbook, a propósito: `cron.schedule` con un nombre que
ya existe lo reemplaza, así que el trabajo creado a mano queda sustituido por el
de la migración, con el timeout y sin desprogramar nada antes. El de `pg_net` por
defecto es de 5 s: `send-push` contesta 202 en seguida, pero un arranque en frío
o un servicio lento a la hora punta lo pasa, y `net._http_response` se llena de
timeouts que no son un fallo real.

Los #2 y #3 leen los mismos dos secretos de **Vault**:
`udp_map_project_url` y `udp_map_send_push_cron_secret`. Están cifrados, no se
pueden exportar y **no están en ningún archivo del repositorio**. Hay que volver
a crearlos a mano después de un reset. Los #4 y #5 no los necesitan y corren sin
JWT, como `postgres`.

Edge Functions en `supabase/functions/`:

- **`send-push`** — drena `notification_push_deliveries` y envía las
  notificaciones Web Push. **Ya no encola los recordatorios de eventos**: desde la
  migración `20261021000200` los crea el trabajo #4. Reclama la cola por RPC
  (`claim_push_deliveries`) en lotes de 50, envía 10 a la vez y cierra cada lote con
  una sola llamada a `finish_push_deliveries` (con un reintento, seguro por el
  fencing); mientras queda presupuesto (unos 40 s y como mucho 6 lotes, 300
  entregas, por ejecución: el tope de lotes protege el límite de CPU) reclama otro
  lote. En `last_error` el endpoint se cambia por su host, como en `push_host`. Al
  cron le responde 202 en seguida y la
  pasada sigue en segundo plano, porque `pg_net` corta a los 5 s; el panel
  (sesión de administrador) espera el resultado. Se invoca con `x-cron-secret` o
  con sesión de administrador. Se despliega con `npm run deploy:push`, **después**
  de aplicar las migraciones `20261021000000`, `20261021000100` y `20261021000200`:
  la versión nueva llama a RPC que antes no existían, y sin la última nadie crea los
  recordatorios. La `000100` comprueba al principio que existe `push_host` (de la
  `000000`) y para con un mensaje si no: plpgsql no valida las columnas al crear una
  función, así que sin esa guarda pasaría entera y fallarían después
  `register_push_subscription` y `admin_push_delivery_stats`. La anterior (`20eee7e` o
  antes) sigue funcionando con el esquema nuevo, también con el cron de
  recordatorios corriendo a la vez, porque `reminded_at` impide duplicar. Cifrado y
  VAPID viven en `_shared/webpush.ts`. Secretos: `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (un `mailto:` se usa tal cual; cualquier
  otro valor, o ninguno, firma con el `mailto:` de respaldo, igual que la versión
  que entrega en iPhone), `APP_ORIGIN` (opcional; por defecto
  `https://udp-map.vercel.app`) y `PUSH_PAYLOAD_FORMAT` (opcional: `hybrid`, el
  por defecto, que es el formato que entrega en iPhone, o `declarative`; ver
  «El contrato de `send-push`» más abajo).
  Acepta un cuerpo JSON opcional `{ "notificationId": "<uuid>" }`, que solo cuenta si
  llama un administrador (el cron lo ignora): reclama únicamente las entregas de ese
  aviso, y la respuesta añade `notification.deliveries` con el conteo por estado. El
  detalle del cuerpo, de la respuesta y del payload está en «El contrato de
  `send-push`», al final de esta sección.
  Clasifica la respuesta del servicio push: 404/410 suscripción expirada,
  400/413/401/403 fallo terminal sin reintentos, 429/5xx/red reintento
  (respetando `Retry-After`). Un 404/410 cierra la entrega como `expired` y
  **después** borra la suscripción; el trigger expira las demás entregas pendientes
  de esa suscripción. Con la configuración VAPID inválida responde 500 sin tocar
  la cola.
- **`storage-gc`** — drena `storage_cleanup_queue` y borra los archivos.
  `npx supabase functions deploy storage-gc`.

Las dos van declaradas con `verify_jwt = false` en `supabase/config.toml`. Es
imprescindible: el cron las llama con una cabecera `x-cron-secret` y sin
`Authorization`, así que con la verificación de JWT activa la pasarela de
Supabase responde 401 antes de que la función llegue a ejecutarse. El control de
acceso lo hace cada función por su cuenta — compara el secreto de cron, o valida
el token y exige rol admin.

### El contrato de `send-push`

Sale de `send-push/index.ts` y `_shared/pushPayload.ts`; si cambia alguno de los dos,
cambia esto.

**Códigos de respuesta**, en el orden en que se comprueban:

| Código | Cuándo |
|---|---|
| 405 | El método no es `POST` (el `OPTIONS` del preflight contesta `ok`) |
| 401 | Ni `x-cron-secret` válido ni sesión de administrador |
| 400 | Solo con sesión de administrador: `notificationId` presente y que no es un uuid. `{"error": "notificationId tiene que ser un uuid."}`, antes de tocar la cola |
| 500 | La configuración VAPID es inválida (`{"error": …}`, sin tocar la cola); o, para el panel, falla el primer reclamo de la cola o salta una excepción inesperada |
| 202 | Al cron, pasadas las comprobaciones de arriba: `{"accepted": true}`. La pasada sigue en segundo plano y su resumen solo queda en el log. Sin `EdgeRuntime` no hay segundo plano y se espera en línea |
| 200 | La pasada terminó; el panel recibe el resumen de abajo |

**El cuerpo.** Opcional, y solo se lee si llama un administrador: al cron se le
ignora aunque mande otra cosa, porque su pasada es siempre la cola entera y un
cuerpo raro no puede costarle el minuto con un 400. Para un administrador, un
cuerpo vacío, que no es JSON, que no es un objeto, o sin `notificationId` (o con
`null`), es «sin aviso» y recorre la cola entera. Un `notificationId` que es un
uuid (se pasa a minúsculas) acota la pasada a ese aviso. Cualquier otra cosa en
`notificationId` —un número, una cadena que no es uuid— da 400. Es un error y no un
«sin aviso» a propósito: callarlo haría creer al panel que vació el aviso que pidió
cuando en realidad vació la cola entera.

**La respuesta 200**, JSON:

- `engine` (`webcrypto-aes128gcm-v1`) y **`payloadFormat`** (`hybrid` o
  `declarative`): el formato con el que viajó la pasada, para saber qué valor del
  secreto está vivo sin ir a mirarlo.
- `processed`, `sent`, `failed`, `expiredSubscriptions`, `batches`, `skipped` y
  `fenced`: los contadores de la pasada.
- `diagnostics` (una entrada por entrega procesada, hasta 200; `diagnosticsOmitted`
  cuenta el resto), `claimError`, `closeErrors` y `deleteErrors`.
- Con `notificationId`, `notification`: `{ "id", "deliveries": { "pending", "sent",
  "failed", "expired" } }`, contadas por estado **después** del cierre. Si el conteo
  falla, en su lugar va `{ "id", "error": "<mensaje>" }` y la respuesta sigue siendo
  **200**: la pasada ya se hizo y sus números son buenos, y un conteo caído no debe
  tumbarla. Quien lee tiene que mirar `notification.error` antes de fiarse de
  `deliveries`.

**El payload.** Los dos formatos pasan por el mismo cifrado, el mismo tope
(`MAX_PLAINTEXT_BYTES`, 3993 B; si se pasa, la entrega se cierra `failed` con
«payload demasiado grande»), el mismo `TTL`, `Urgency` y VAPID. Cambia solo lo que va
dentro:

- **`hybrid`**, el de siempre y el que entrega en iPhone: el bloque `web_push: 8030` /
  `notification` más los campos planos de la raíz (`notificationId`, `title`, `body`,
  `url`, `type`, `category`, `payload`) y `payload` también dentro de
  `notification.data`. Sigue en `index.ts`, literal.
- **`declarative`**: solo el bloque, sin campos planos y sin `payload` en ningún
  sitio. Lo construye `pushPayload.ts`, con los mismos valores y respaldos que el
  bloque `notification` del híbrido:

  ```json
  {
    "web_push": 8030,
    "notification": {
      "title": "<título; «UDP Map» si viene vacío>",
      "body": "<cuerpo; «Tienes una nueva notificación.» si viene vacío>",
      "navigate": "<URL absoluta de la app con ?notification=<id>; «<APP_ORIGIN>/» si el destino es de otro origen>",
      "icon": "<APP_ORIGIN>/pwa-192x192.png",
      "lang": "es",
      "tag": "<id del aviso>",
      "data": {
        "url": "<destino tal cual; «/» si viene vacío>",
        "notificationId": "<id del aviso>",
        "type": "<tipo>",
        "category": "<categoría>"
      }
    }
  }
  ```

  Le falta, respecto al bloque híbrido, solo `data.payload`: el navegador no lo usa y
  en un payload sin campos planos cada byte cuenta contra el tope.

**Elegir el formato: `PUSH_PAYLOAD_FORMAT`.**

- Ausente, vacío o `hybrid` (sin distinguir mayúsculas ni espacios sobrantes): híbrido.
- `declarative`: declarativo.
- **Cualquier otro valor cae en `hybrid`**, con un `console.warn` en el log de la
  función (`PUSH_PAYLOAD_FORMAT="…" no es 'hybrid' ni 'declarative'; se envía el
  payload híbrido.`). A propósito: un secreto mal escrito no puede cambiar lo que
  viaja a los teléfonos, pero tampoco puede pasar callado, porque quien lo puso
  creerá que está probando `declarative`. `payloadFormat` en la respuesta lo
  deja a la vista.
- Se lee **una vez, al cargar la función**. Cambiarlo exige
  `npx supabase secrets set PUSH_PAYLOAD_FORMAT=declarative` (o
  `npx supabase secrets unset PUSH_PAYLOAD_FORMAT` para volver al híbrido) y una
  instancia nueva de la función; no cambia entre dos entregas de una pasada.
- **Está apagado por defecto y solo se activa con el service worker nuevo adoptado y
  probado en un iPhone.** El `push-sw.js` anterior leía solo los campos planos, que el
  declarativo no trae: un teléfono que aún lo tenga en caché mostraría los textos
  genéricos. Y si en iOS 18.4+ pinta la notificación el bloque declarativo o el
  service worker, no se sabe sin un dispositivo. El orden del despliegue está en
  `docs/ROADMAP.md` (Push 6).

---

## 9. Realtime

Seis tablas emiten eventos por websocket a los clientes suscritos:
`pins`, `pin_comments`, `forum_threads`, `forum_comments`, `notifications` y
`content_reports`.

Que una tabla esté en la publicación no salta RLS: cada cliente recibe solo los
eventos de las filas que podría leer.

---

## 10. Runbook

### Reconstruir la base desde cero

Sobre un proyecto Supabase nuevo y vacío, desde el SQL Editor:

1. `supabase/schema/baseline.sql`
2. `supabase/seed/badges.sql`
3. `supabase/seed/seed.sql`

Y después, a mano, porque nada de esto se puede exportar:

4. **Autenticación** — activar el proveedor de Google en Authentication →
   Providers y poner las credenciales OAuth.
5. **Vault** — crear los dos secretos:
   ```
   udp_map_project_url            https://<ref>.supabase.co
   udp_map_send_push_cron_secret  <la cadena que espera send-push>
   ```
6. **Edge Functions** — desplegar las dos:
   ```bash
   npm run deploy:push
   npx --yes supabase functions deploy storage-gc
   ```
   Comprobar después que las dos quedaron con `verify_jwt` en `false`
   (`npx supabase functions list`). Si alguna sale en `true`, el cron recibirá
   401 y no funcionará: revisar que estén declaradas en `supabase/config.toml`
   y volver a desplegar.

7. **Cron** — los cinco trabajos, ya con las funciones desplegadas. Los #2, #4 y #5
   son lo que hace la migración `20261021000200` (idempotente, y reemplaza por
   nombre al #2): se puede ejecutar ese archivo en vez de pegar sus bloques.

   ```sql
   -- #1 Borrar los pines cuyo plazo venció
   select cron.schedule(
     'expire-pins',
     '*/30 * * * *',
     $$ delete from pins where is_permanent = false and expires_at < now() $$
   );

   -- #2 Enviar las notificaciones push encoladas. El timeout de 10 s es explícito:
   -- el de pg_net por defecto es 5 s.
   select cron.schedule(
     'udp-map-send-push-every-minute',
     '* * * * *',
     $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'udp_map_project_url')
              || '/functions/v1/send-push',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'udp_map_send_push_cron_secret')
       ),
       body := '{}'::jsonb,
       timeout_milliseconds := 10000
     ) as request_id;
     $$
   );

   -- #3 Borrar de Storage los archivos encolados
   select cron.schedule(
     'udp-map-storage-gc',
     '*/10 * * * *',
     $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'udp_map_project_url')
              || '/functions/v1/storage-gc',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'udp_map_send_push_cron_secret')
       ),
       body := '{}'::jsonb
     ) as request_id;
     $$
   );

   -- #4 Crear los recordatorios de eventos (antes lo hacía send-push). En una
   -- base ya existente necesita la migración 20261021000100; el baseline ya la
   -- incluye. No usa Vault.
   select cron.schedule(
     'udp-map-event-reminders',
     '* * * * *',
     'select public.enqueue_upcoming_event_notifications()'
   );

   -- #5 Purgar entregas y avisos viejos. En una base ya existente necesita la
   -- migración 20261021000200 (que crea prune_push_history); el baseline ya la
   -- incluye. No usa Vault.
   select cron.schedule(
     'udp-map-prune-push-history',
     '17 4 * * *',
     'select public.prune_push_history()'
   );
   ```

   Para comprobar que funcionan, además del estado del trabajo hay que mirar la
   respuesta HTTP: `cron.job_run_details` dice `succeeded` en cuanto `pg_net`
   encola la petición, aunque la función responda 401.

   ```sql
   select j.jobname, d.status, d.start_time
   from cron.job_run_details d join cron.job j on j.jobid = d.jobid
   order by d.start_time desc limit 5;

   select status_code, left(content, 120), created
   from net._http_response order by created desc limit 5;
   ```
8. **Administradores** — insertar los correos **antes** de que esas personas se
   registren:
   ```sql
   insert into public.admin_emails (email) values ('alguien@mail.udp.cl');
   ```
   Si ya se registró, hay que actualizar su perfil a mano desde el SQL Editor:
   `admin_set_user_role` exige que quien la llame ya sea admin, así que el
   primero de todos no puede crearse solo.
9. **Variables del frontend** — `.env` con `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY` y `VITE_VAPID_PUBLIC_KEY`. Sin ellas la
   aplicación arranca en modo demo con datos en memoria.

### Aplicar un cambio

1. Escribir la migración en `supabase/migrations/`, con nombre
   `<timestamp>_descripcion.sql`. Desde `20260827`, escribir también
   `<timestamp>_descripcion.down.sql`, que la deshace; se aplica a mano igual.
2. Ejecutarla en el SQL Editor. En este proyecto las migraciones se aplican a
   mano: no hay `db push` en CI ni en los scripts de npm.
3. **Actualizar `baseline.sql` con el mismo cambio.**
4. **Actualizar este documento**: qué tabla o función cambió y por qué.
5. Si toca el catálogo, editar `campusData.ts` y regenerar el seed.

### Probar la cola de push desde el SQL Editor

`claim_push_deliveries` y `finish_push_deliveries` solo contestan a `service_role`,
y el SQL Editor no entra como tal: `auth.role()` vale `null` y las dos se niegan. Hay
que fijar el rol, y deshacer todo al final para no gastar un intento ni marcar como
enviado algo que no salió. El SQL Editor solo enseña el resultado de la última
sentencia, así que un `begin … rollback` no deja ver nada; este bloque termina con
una excepción a propósito, que muestra los números en el mensaje de error y deshace
todo lo que hizo:

```sql
do $prueba$
declare
  v_lote     jsonb;
  v_cerradas integer;
begin
  -- `true`: el rol vale solo hasta el fin de la transacción.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  -- Reclama hasta 5 entregas con un lease de 60 s y prepara su cierre como
  -- enviadas con el attempts que devolvió el reclamo. No leas p256dh ni auth:
  -- son las claves de los dispositivos.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', delivery_id, 'attempts', attempts, 'status', 'sent')), '[]'::jsonb)
    into v_lote
    from public.claim_push_deliveries(5, 60);

  select count(*) into v_cerradas from public.finish_push_deliveries(v_lote);

  -- Cerrar dos veces el mismo lote no cierra nada la segunda: es el fencing.
  raise exception 'Prueba deshecha: % reclamadas, % cerradas, % al repetir el cierre',
    jsonb_array_length(v_lote), v_cerradas,
    (select count(*) from public.finish_push_deliveries(v_lote));
end;
$prueba$;
```

Lo esperado es `N reclamadas, N cerradas, 0 al repetir el cierre`. Sin el
`set_config`, las dos fallan con "Solo el servicio puede…".

### Mirar los cron y la cola desde el SQL Editor

El SQL Editor corre como `postgres` y sin JWT (`auth.role()` nulo): las dos
funciones del servicio que aceptan un cron (`enqueue_upcoming_event_notifications`
y `prune_push_history`) contestan, pero `admin_push_delivery_stats` se niega, porque
exige un administrador con sesión. La consulta equivalente se escribe a mano:

```sql
-- Qué trabajos hay programados, y con qué comando
select jobname, schedule, active, left(command, 80) from cron.job order by jobname;

-- Entregas de la última semana por servicio push y estado
select coalesce(push_host, '(sin host)') as push_host, status, count(*)
from public.notification_push_deliveries
where created_at >= now() - interval '7 days'
group by 1, 2 order by 1, 2;

-- Lo que el cron haría ahora mismo (cuenta lo que borró / lo que creó)
select public.prune_push_history();
select public.enqueue_upcoming_event_notifications();
```

Los dos últimos hacen efecto de verdad: borran y crean avisos. Una purga a deshora
es inofensiva; un barrido a deshora también, porque `reminded_at` impide repetir.

### Cosas que no conviene hacer a mano

- **Cambiar permisos con `GRANT ALL ON ALL TABLES IN SCHEMA public`.** Es el
  atajo habitual cuando algo devuelve "permission denied", y deshace en un
  segundo candados puestos a propósito. Ya pasó: ver la sección 11.
- **Escribir `profiles.karma` o `profiles.role` con un `UPDATE`.** Los triggers
  lo rechazan. Se hace con `adjust_karma` y `admin_set_user_role`.
- **Escribir `votes_up` / `votes_down`.** Solo las RPC de votación.
- **Borrar filas de `pin_photos` o de `pins` sin limpiar Storage.** Ver la
  sección 11.

---

## 11. Observaciones abiertas

Detectadas al levantar este documento y todavía sin arreglar. Lo que sí se
arregló está en la sección 12.

### El correo de cualquiera es legible por cualquier usuario con sesión

`profiles` tiene una política `profiles_read_public` con `using (true)`, y a
`authenticated` se le concedió `SELECT` sobre la columna `email`. Combinando las
dos, cualquier estudiante puede pedir `select id, email from profiles` y obtener
los correos de todos. La vista `profiles_public` existe precisamente para evitar
eso, pero no sirve de nada mientras la tabla siga siendo legible por debajo.

### Los permisos de votos se restauraron por accidente

La migración `20260721000003` revocó `INSERT`/`UPDATE`/`DELETE` a `anon` y
`authenticated` sobre `pin_votes` y `forum_votes`, para que votar pasara solo por
las RPC. En producción esos permisos están otra vez completos: alguien reaplicó
un `GRANT` masivo sobre el esquema. Las políticas de INSERT siguen ahí, así que
hoy se puede insertar un voto directamente sin pasar por `vote_pin` — el voto
queda registrado pero los contadores del pin no se actualizan.

### `pins.reports` no se usa

Columna heredada de la v1. Siempre vale 0: nada la incrementa y nada la lee. El
sistema real de denuncias es `content_reports`. Se conserva porque borrar una
columna es lo único irreversible del lote, no porque sirva.

### Faltan índices en varias claves foráneas

`favorites.pin_id`, `pin_votes.user_id`, `forum_votes.user_id`,
`notifications.actor_id` y `content_reports.reporter_id` no están indexadas. Con
el volumen actual da igual; se nota al crecer, sobre todo en los borrados en
cascada.

### Una política creada a mano

`profiles_admin_update` existe en la base y no viene de ninguna migración.
Permite a un administrador editar cualquier perfil. Se conserva porque es el
comportamiento que se quiere, pero conviene saber de dónde salió.

### Los identificadores de las carreras cambian al reconstruir

`careers.id` es `serial` y el seed no fija los valores. En producción van del 29
al 42 (dato histórico, de cuando el seed tenía menos carreras); sobre una base
nueva, con las 39 de hoy, irían del 1 al 39. No afecta a nada, porque
`profiles.career` guarda el nombre y no el identificador.

---

## 12. Resuelto

Lo que estaba en la lista de arriba y ya no está, con la migración que lo
arregló. Se deja anotado para que nadie vuelva a tropezar buscándolo.

| Problema | Cómo se resolvió |
|---|---|
| Tres de los cuatro caminos de borrado dejaban los archivos en Storage | `20260803120000` — cola + trigger + Edge Function `storage-gc` |
| El límite de 5 fotos solo existía en el navegador | `20260803120100` — trigger sobre `pin_photos` |
| Un estudiante no podía cambiar la fecha de fin de su evento | `20260803120200` — el trigger acepta `expires_at` si acompaña a `ends_at` |
| La categoría de un pin verificado se podía cambiar desde la API | `20260803120200` — excepción explícita |
| El plazo de un pin lo decidía el navegador | `20260803120300` — lo calcula el servidor desde `ttl_hours` |
| `extend_pin_ttl` y `verify_and_make_permanent` fallaban en silencio | `20260803120400` — comprueban antes y explican |
| Esas dos eran `SECURITY DEFINER` sin `search_path` | `20260803120400` |
| No había forma de deshacer una verificación | `20260803120400` — `unverify_pin` |
| `set_pin_permanent`, código muerto | `20260803120400` — eliminada |
| Un reintento al subir fotos las duplicaba | Subida atómica en `src/features/pins/api.ts` |
| La regla de extender o verificar vivía en un componente | Se eliminó: es una decisión por pin, no por categoría |
| Borrar el aviso de un recordatorio de evento lo hacía sonar de nuevo en menos de un minuto | `20261021000100` — `event_rsvps.reminded_at`; el barrido de `enqueue_upcoming_event_notifications` ya no depende de la fila de `notifications` |
| `wants_notification` dejaba leer las preferencias de cualquier persona | `20261021000100` — `EXECUTE` solo para `service_role` |
| Difusión contaba destinatarios sin aviso, y dos en el mismo segundo chocaban | `20261021000100` — cuenta los ids no nulos, clave con `gen_random_uuid()` y topes de 60 y 180 caracteres |
| Ni las entregas ni los avisos se purgaban, y el cron de `send-push` solo vivía en el runbook | `20261021000200` — `prune_push_history` y los tres trabajos versionados, el de `send-push` con timeout de 10 s |
| La Edge Function `expire-pins`, código muerto | Borrada del repositorio; nunca llegó a estar desplegada |
| La planta de un pin podía ser cualquier número | `20260810000000` — trigger `trg_validate_pin_floor` |
| Mover un pin solo se comprobaba en la interfaz | `20260826000100` — trigger `trg_authorize_pin_move` |
| Quién va a qué evento lo podía leer cualquiera (SEC-007) | `20260826000200` — tabla cerrada + `event_rsvp_counts` y `event_attendees` |
| `baseline.sql` no reconstruía la base desde cero: los triggers y permisos del registro de actividad nombraban funciones definidas al final del archivo | Solo baseline (producción no cambia): las funciones de §5.10 se movieron antes de §6. Comprobado ejecutando el archivo entero en PGlite de una sola pasada |
