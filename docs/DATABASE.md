# La base de datos de UDP Map

Qué hay dentro, por qué está así, y qué hacer para manejarla.

Este documento describe el estado **real** de producción, leído de los catálogos
de Postgres el 3 de agosto de 2026 (PostgreSQL 17.6 sobre Supabase). No describe
lo que dicen las migraciones: unas cuantas cosas se hicieron a mano en el
dashboard y solo existen en la base.

---

## 1. Dónde vive cada cosa

| Archivo | Qué es |
|---|---|
| `supabase/schema/baseline.sql` | **La fuente de verdad del esquema.** Reconstruye la base entera sobre un proyecto vacío |
| `supabase/seed/badges.sql` | Las 6 insignias. Se escribe a mano |
| `supabase/seed/seed.sql` | Catálogo del campus. **Generado**, no editar |
| `src/shared/data/campusData.ts` | Campus, carreras y categorías. Y la **semilla** del catálogo de facultades: nombres, campus y chinchetas. **Sin geometría** |
| `scripts/gen_seed_full.ts` | Regenera `seed.sql` desde `campusData.ts` |
| `supabase/_archive/migrations/` | Las 33 migraciones históricas. Ya aplicadas. **No ejecutar** |
| `supabase/migrations/` | Migraciones nuevas, de aquí en adelante |

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
| Ver y resolver denuncias | ❌ | ❌ | ❌ | ✅ | `content_reports_read_own_or_admin`, RPC `claim_moderation_report` y `resolve_moderation_report` |
| Enviar una notificación push a todo el mundo | ❌ | ❌ | ❌ | ✅ | RPC `admin_broadcast_push_notification` |
| Mandarse una push de prueba a uno mismo | ❌ | ❌ | ❌ | ✅ | RPC `admin_send_test_push_to_self` |

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
2. **Row Level Security.** Qué filas ve o toca cada quien. Activo en las 23
   tablas. Dos no tienen ninguna política a propósito — `pin_creation_events` y
   `notification_push_deliveries` son internas y solo las tocan funciones
   `SECURITY DEFINER` y `service_role`.
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

29 en total, todas con RLS activo.

### Catálogo — se lee sin sesión, se escribe desde el seed

| Tabla | Qué guarda | Quién escribe |
|---|---|---|
| `campuses` | Los 3 campus con sus coordenadas | seed |
| `faculties` | 17 facultades y edificios, con su perímetro en GeoJSON | seed / **admin desde `/admin/mapeo`** |
| `careers` | 14 carreras, colgando de una facultad | seed |
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
| `event_rsvps` | Asistencia a eventos. Un trigger comprueba que el pin sea de tipo `event`. **No se lee directamente**: ver más abajo |
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

`forum_threads`, `forum_comments` (anidables mediante `parent_comment_id`) y
`forum_votes`. Marcar un hilo como oficial exige ser moderador y poner un nombre
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
                                                      │
                                  cron cada minuto → Edge Function send-push
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

La misma migración añade `admin_send_test_push_to_self()`. Existe porque probar
el push obligaba a usar la difusión, que recorre **todas** las suscripciones:
comprobar "¿me llega a mí?" le hacía sonar el teléfono a la universidad entera.

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
una tabla o función. Dos no lo hacen — ver la sección 11.

### Las que puede llamar la aplicación

| Función | Quién | Qué hace |
|---|---|---|
| `user_role()` | cualquiera | El rol efectivo de quien pregunta |
| `create_pin_with_daily_limit(...)` | estudiante+ | Único camino para crear un pin |
| `vote_pin(pin, valor)` | estudiante+ | Vota; votar lo mismo dos veces retira el voto |
| `vote_thread(hilo, valor)` | estudiante+ | Igual, en el foro |
| `create_content_report(...)` | estudiante+ | Denuncia contenido |
| `register_push_subscription(...)` | estudiante+ | Registra el navegador para notificaciones |
| `event_rsvp_counts(pines[])` | cualquiera | Cuánta gente va a cada evento. Solo el número |
| `event_attendees(pin)` | quien organiza / admin | Quién va, con nombre. La tabla ya no se lee directamente |
| `extend_pin_ttl(pin, horas)` | moderador+ | Alarga el plazo de un pin no permanente |
| `verify_and_make_permanent(pin, verificador)` | moderador+ | Verifica y premia al autor |
| `unverify_pin(pin, horas)` | moderador+ | Deshace la verificación y devuelve los 25 de karma |
| `claim_moderation_report(id)` | admin | Se asigna una denuncia |
| `resolve_moderation_report(id, acción, nota)` | admin | La resuelve, borrando el contenido o descartándola |
| `admin_set_user_role(usuario, rol)` | admin | Cambia el rol de otro. No puede cambiar el propio |
| `admin_count_push_subscribers()` | admin | Cuántos navegadores suscritos |
| `admin_broadcast_push_notification(t, c)` | admin | Difunde un aviso a todo el que tenga push activado |
| `admin_send_test_push_to_self()` | admin | La misma tubería, pero solo a quien la llama |

### Las internas

Nadie puede invocarlas desde la API: se les revocó el `EXECUTE`. Solo las llaman
otros triggers y funciones.

`adjust_karma` · `create_notification` · `enqueue_event_reminder` ·
`enqueue_upcoming_event_notifications` · `check_explorer_badge` ·
`check_guardian_badge` · `check_host_badge` · `check_photographer_badge` ·
`check_pioneer_badge` · `handle_new_user` · y todos los `notify_*`, `on_*` y
`protect_*`.

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
próximos 20 días, se crea el recordatorio en el acto.

**Al denunciar contenido:** se notifica a **todos** los administradores.

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
- **`places/{kind}/{id}/{uuid}.jpg`**: galerías de lugares (`faculty` o `building`). Solo para administradores.

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

Tres trabajos de `pg_cron`:

| # | Nombre | Frecuencia | Qué hace |
|---|---|---|---|
| 1 | `expire-pins` | cada 30 min | `delete from pins where is_permanent = false and expires_at < now()` |
| 2 | `udp-map-send-push-every-minute` | cada minuto | Llama a la Edge Function `send-push` |
| 3 | `udp-map-storage-gc` | cada 10 min | Llama a la Edge Function `storage-gc` |

Los dos últimos leen los mismos dos secretos de **Vault**:
`udp_map_project_url` y `udp_map_send_push_cron_secret`. Están cifrados, no se
pueden exportar y **no están en ningún archivo del repositorio**. Hay que volver
a crearlos a mano después de un reset.

Edge Functions en `supabase/functions/`:

- **`send-push`** — drena `notification_push_deliveries` y envía las
  notificaciones Web Push. Se despliega con `npm run deploy:push`.
- **`storage-gc`** — drena `storage_cleanup_queue` y borra los archivos.
  `npx supabase functions deploy storage-gc`.

Las dos van declaradas con `verify_jwt = false` en `supabase/config.toml`. Es
imprescindible: el cron las llama con una cabecera `x-cron-secret` y sin
`Authorization`, así que con la verificación de JWT activa la pasarela de
Supabase responde 401 antes de que la función llegue a ejecutarse. El control de
acceso lo hace cada función por su cuenta — compara el secreto de cron, o valida
el token y exige rol admin.

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

7. **Cron** — los tres trabajos, ya con las funciones desplegadas:

   ```sql
   -- #1 Borrar los pines cuyo plazo venció
   select cron.schedule(
     'expire-pins',
     '*/30 * * * *',
     $$ delete from pins where is_permanent = false and expires_at < now() $$
   );

   -- #2 Enviar las notificaciones push encoladas
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
       body := '{}'::jsonb
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
   `<timestamp>_descripcion.sql`.
2. Ejecutarla en el SQL Editor. En este proyecto las migraciones se aplican a
   mano: no hay `db push` en CI ni en los scripts de npm.
3. **Actualizar `baseline.sql` con el mismo cambio.**
4. **Actualizar este documento**: qué tabla o función cambió y por qué.
5. Si toca el catálogo, editar `campusData.ts` y regenerar el seed.

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
al 42; sobre una base nueva irían del 1 al 14. No afecta a nada, porque
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
| La Edge Function `expire-pins`, código muerto | Borrada del repositorio; nunca llegó a estar desplegada |
| La planta de un pin podía ser cualquier número | `20260810000000` — trigger `trg_validate_pin_floor` |
| Mover un pin solo se comprobaba en la interfaz | `20260826000100` — trigger `trg_authorize_pin_move` |
| Quién va a qué evento lo podía leer cualquiera (SEC-007) | `20260826000200` — tabla cerrada + `event_rsvp_counts` y `event_attendees` |
