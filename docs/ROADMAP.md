# Hoja de ruta — UDP Map

> **Documento vivo.** Es el plan del repositorio: qué está hecho y qué falta. Se
> actualiza al cerrar algo, no al final del sprint. Última revisión: 2026-08-27.
>
> Nació como el plan de mapeo interior y onboarding, y absorbió el backlog que
> antes vivía repartido entre `PLAN.md` y `SPRINTS_STATUS.md`. Los dos se
> borraron el 2026-08-05: describían la v0.3, se contradecían entre sí y su
> contenido vivo está aquí. Git los conserva si alguna vez hicieran falta.
>
> **Alcance del bloque principal:** el editor y el motor se construyen genéricos;
> **el mapeo de la FIC se hace a mano**. No hace falta ningún dato de edificios
> para empezar a programar.

---

## 1. Diagnóstico: qué hay hoy de verdad

Verificado en código antes de planificar.

### 1.1 `pins.floor` existe en la base, pero nunca se escribe

| Capa | Estado |
|---|---|
| `pins.floor integer` y `pins.building text` | ✅ existen — `supabase/schema/baseline.sql:150-151` |
| Tipo TS `Pin.floor` | ✅ existe — `src/shared/types/database.ts:69` |
| RPC `create_pin_with_daily_limit` | ❌ **no recibe `p_floor` ni `p_building`** — `baseline.sql:680-693` |
| `createPin()` | ❌ **hardcodea `floor: null`** — `src/features/pins/api.ts:186-187` |
| `CreatePinModal`, filtros, marcadores, `FacultyDetail` | ❌ ignoran el piso por completo |

La base puede guardar pisos; **el camino de escritura no existe**. Los 20 pines actuales tienen `floor = null`.

A favor: `floor` y `building` **no** están protegidos por el trigger `protect_pin_sensitive_fields` (`supabase/migrations/20260803120200_pin_owner_field_rules.sql`), así que el autor puede editarlos con la policy `pins_owner_update` existente. **Editar el piso no requiere migración; solo crearlo con piso la requiere.**

### 1.2 Los planos indoor demo están a 694 metros del edificio real

El bug de tu foto 4/5, y no es de posición en pantalla: es geográfico.

- `DEMO_FLOOR_PLANS` (`src/shared/data/campusData.ts:201-238`) dibuja el "Edificio FIC" en `lng -70.65465…-70.65405` / `lat -33.45015…-33.44985`.
- El perímetro real de Ingeniería (hoy en `faculties.polygon`) está en `lng -70.66157…-70.66053` / `lat -33.45238…-33.45313`.
- Distancia: **694 m** (622 m al este, 307 m al norte).

Rectángulos inventados para la demo del Sprint 2, nunca georreferenciados. La UI además **no lee la tabla `floor_plans` de Supabase** en ningún punto.

**El perímetro de la FIC, en cambio, es fiable** — lo trazaste tú a mano. Es el ancla sobre la que se apoya todo el mapeo interior.

### 1.3 El selector de piso está anclado donde choca

`IndoorPanel.tsx:19` → `right-3 top-[136px]`. Ubicación y brújula están en `top-[72px]` y `top-[120px]` (`MapView.tsx:730`, `743`): el panel cae **encima de la brújula**, y en móvil lo tapa el bottom sheet.

### 1.4 Los datos de edificios de OSM están incompletos

Falta al menos un edificio de la FIC en OpenStreetMap. Los edificios 3D rojos salen de filtrar OSM con tu perímetro (`facultyLayers.ts:109-130`), así que heredan los mismos huecos. La importación automática queda descartada como camino principal y sobrevive solo como un modo de dibujo (§6.3).

### 1.5 Dos errores visibles en las categorías

Al revisar `campusData.ts:136-173` aparecieron dos que conviene arreglar de paso:

- **`casino` usa un icono de hospital.** Emoji `🏥` y un `svgPath` de cruz médica (círculo con cruz), para lo que es una cafetería. `campusData.ts:149`.
- **`feria` repite ese mismo `svgPath`** de círculo con cruz, que tampoco le corresponde. `campusData.ts:172`.

Ambos son un copiar-pegar antiguo. Se corrigen en la Fase 3 junto con las categorías nuevas.

### 1.6 Hay mensajes en español clavados en el código ✅ RESUELTO (2026-08-26)

`i18n` estaba montado (`shared/lib/i18n.ts`, es/en) pero varios avisos se
saltaban el sistema y salían siempre en español: los cuatro toasts de brújula y
ubicación de `MapPage`/`MapView`, sus dos `aria-label` y casi todos los textos
de las tarjetas de `TutorialModal`. Ya están en el catálogo, es y en.

Dos cosas que salieron al hacerlo y conviene saber:

- **`MapView` no usa el hook `useTranslation`**, porque sus avisos salen de
  callbacks imperativos y no del render. Usa la instancia (`import i18n from
  '@/shared/lib/i18n'`) y llama `i18n.t(...)`. Lo mismo el aviso de brújula de
  `MapPage`, que vive en un `useCallback` de dependencias vacías.
- **`map.outOfBounds` ya estaba en uso con otro significado** —"estás demasiado
  lejos del campus para trazar una ruta a pie", en `MapPage` y `PinDetail`—
  apoyado solo en su respaldo, porque la clave no existía en el catálogo. Meter
  ahí el "estás fuera del área del mapa" del botón de ubicación les habría
  cambiado el texto a los dos sin que nada fallara. El aviso nuevo se llama
  `map.locationOutOfBounds`; de paso quedaron definidas `outOfBounds`,
  `searchFaculty` y `noResults`, que en inglés salían en español.

### 1.7 Onboarding: nada coordina los diálogos

`TutorialModal` se abre para todos en el primer arranque (`uiStore.ts:116`), `ProfileSetupModal` si hay sesión sin facultad y sin poder cerrarse (`ProfileSetupModal.tsx:18`). Ambos se montan sueltos en `MapPage.tsx:753-754`: si alguien entra por primera vez y se registra en esa sesión, **compiten**.

---

## 2. Cómo funcionan los posts hoy

Me lo salté antes y tienes razón en pedirlo: es la base sobre la que se enchufa todo lo demás.

### 2.1 Un post es un pin

No hay dos sistemas. Todo lo que se publica es una fila en `pins`, con tres tipos:

| Tipo | Quién lo crea | Vida | Rasgos propios |
|---|---|---|---|
| `report` | estudiante | **efímera**, según la categoría | categoría con TTL, votos |
| `event` | estudiante (u oficial si es mod/admin) | hasta `ends_at` | RSVP, cronograma, late "en vivo" |
| `place` | moderador / admin | permanente | hoy son las facultades sembradas |

Los tres comparten el mismo motor: fotos, comentarios, votos y favoritos.

### 2.2 El ciclo de vida es lo que mantiene el mapa limpio

Cada categoría de reporte lleva un TTL (`campusData.ts:136-166`): un food truck dura 8 h, un baño 24 h, un objeto perdido 72 h. Al crearse, **el servidor** calcula `expires_at` desde `categories.ttl_hours` — no el navegador (migración `20260803120300`). En su última ventana de vida el marcador se desvanece y se dessatura (`expiryState` + `--pin-fade`, `MapView.tsx:429-465`), y al vencer desaparece.

Un moderador puede **verificar** un reporte y volverlo permanente: `promote_pin_to_permanent`, +25 de karma al autor e insignia de Cartógrafo. También puede extender el plazo (`extend_pin_ttl`, hasta 720 h) o deshacer (`unverify_pin`). Todo eso ya existe y funciona — y es la maquinaria sobre la que se apoyan las salas (§3).

### 2.3 Reglas de creación

- **Máximo 10 pines por estudiante y día UTC** (`baseline.sql:733`). Moderadores y administradores exentos.
- **Un punto exacto solo admite un pin vigente**: trigger `check_pin_location_available` → `PIN_LOCATION_OCCUPIED` (`baseline.sql:630-658`).
- **La facultad se asigna sola** por perímetro: `facultyIdAt(lat, lng)` al crear (`api.ts:165`) y al mover (`api.ts:518`).
- La creación pasa **solo** por la RPC `create_pin_with_daily_limit`; no hay policy de INSERT sobre `pins`.

### 2.4 Cómo se consumen

- **En el mapa**: un marcador por pin, con icono y color de su categoría (`MapView.tsx:29-58`).
- **En la facultad**: al tocar un perímetro se abre `FacultyDetail`, una grilla con los posts no-`place` de esa facultad — tu foto 2.
- **Filtros** (`filterStore.ts`): tipo, categoría, facultad y favoritos.
- **Realtime**: cualquier cambio en `pins` invalida la lista (`usePins.ts:53-64`).

### 2.5 Qué le falta

Hoy un post sabe **en qué facultad** está y nada más. Este plan le añade `building_id`, `floor` y `area_id`, todos deducidos del punto salvo el piso, que se elige. Pasa de "está en Ingeniería" a "está en el Edificio E441, piso 1, Sala S101".

**Los posts no cambian de naturaleza.** Siguen siendo efímeros, con su TTL y su verificación. Lo único que ganan es saber dónde están de verdad.

---

## 3. Decisión: la sala es un pin

Decidiste que las salas sean pines y no áreas dibujadas. **Queda así**, y tus razones se sostienen:

- No altera la naturaleza de la app: sigue siendo un mapa de pines.
- Cuadrar, mover y corregir un punto es trivial; un polígono no.
- Cualquiera puede aportar una sala en su ubicación aproximada sin saber dibujar.
- Reutiliza **todo** lo que ya existe: verificación, karma, insignias, comentarios, votos, fotos, denuncias y cola de moderación. Cero maquinaria nueva.

La contrapartida, para que quede escrita: un pin es un punto, así que las salas no se verán como los polígonos coloreados de la referencia de Mapbox. El interior se verá como **áreas grandes de contexto** (edificio, planta, hall, patio) **con pines encima**. A cambio, el trabajo baja de semanas a días y lo puede alimentar cualquiera. Es un intercambio razonable, y de todos modos el peso visual se resuelve en la §9 con el detalle por zoom.

### 3.1 Reparto de responsabilidades

| | **Áreas** (polígonos, las dibujas tú) | **Pines** (puntos, los pone cualquiera) |
|---|---|---|
| Qué son | la estructura del espacio | el contenido |
| Ejemplos | edificio, planta, hall, pasillo, patio, cancha | sala, baño, impresora, ascensor, rampa, comida, evento |
| Quién | admin, en `/admin/mapeo` | cualquier estudiante, desde el `+` |
| Vida | permanentes | efímeras salvo verificación |
| Para qué sirven | dar contexto y **nombre al lugar** donde cae un pin | decir qué hay y qué pasa |

Regla de oro: **el área es el lugar, el pin es lo que hay en el lugar.**

### 3.2 Las áreas son opcionales

Importante para que puedas avanzar por partes: **el sistema funciona con solo edificios y plantas dibujados.** Si de la FIC trazas nada más las cuatro huellas y sus plantas, ya tienes selector de pisos, filtrado por planta, y el pin diciendo "Edificio E441 · Piso 1". Las áreas interiores (hall, casino, pasillo) son un segundo pase que **suma contexto** al breadcrumb y al mapa, y se pueden ir agregando de a una sin que nada se rompa mientras tanto.

### 3.3 Categorías nuevas

```ts
{ id: 'sala',     kind: 'report', name: 'Sala',     ttl_hours: 720 },
{ id: 'ascensor', kind: 'report', name: 'Ascensor', ttl_hours: 720 },
{ id: 'rampa',    kind: 'report', name: 'Rampa',    ttl_hours: 720 },
```

Las tres describen infraestructura fija, así que su destino natural es ser **verificadas y volverse permanentes**. El TTL de 720 h es la ventana para revisarlas: si nadie las verifica en un mes, caducan solas y el mapa no se llena de datos dudosos. Al verificarse dejan de expirar y el autor recibe sus 25 de karma. **Cero lógica nueva**: son tres filas en `categories` y tres entradas en `campusData.ts`.

> **Nota futura:** Considerar evaluar si `computación` (laboratorios de computación) se trata como un tipo de sala fija permanente similar a `sala` en próximas iteraciones.

Cada una necesita su `svgPath` en el estilo de las demás (`campusData.ts:137-173`); `entrada` usa una variante de trazo aparte definida en `MapView.tsx:38`.

Sobre el **límite de 10 pines al día**: no lo toco. Mapear un edificio completo de salas es trabajo de moderador, y moderadores y admins están exentos (`baseline.sql:719`). El pin `sala` es para que un estudiante agregue **la sala suelta** que falta, no para mapeos masivos.

### 3.4 El código de sala

Formato UDP confirmado: **`E441.1.S101`** o **`A-302`** — codifica edificio, piso y número de sala.

Eso permite algo útil: al escribir el código en el formulario, **se deducen el edificio y el piso** y se preseleccionan solos. `E441.1.S101` → edificio `E441`, piso `1`, sala `S101`.

```ts
// src/shared/utils/roomCode.ts
parseRoomCode('E441.1.S101')  // { building: 'E441', floor: 1, room: 'S101' }
parseRoomCode('A-302')        // { building: 'A',    floor: 3, room: '302'  }
parseRoomCode('lo que sea')   // null → no se deduce nada, se elige a mano
```

> ⚠️ **Contrastado con los datos reales el 2026-08-10, y "se parte en tres" es
> falso.** Hay que partir por los **dos primeros** puntos y recortar espacios:
> `E441.4.L.D` trae cuatro trozos y `E441.5. LAB INF` trae un espacio después del
> punto. Un `split('.')` a secas pierde los tres laboratorios del piso 4 de la
> FIC. La regla completa, el catálogo de salas y —lo que faltaba de verdad— el
> mapa de **prefijo de edificio → dirección postal → facultad** están en
> **`docs/SALAS.md`**. Léelo antes de escribir `parseRoomCode`.

Dos reglas para que esto no se vuelva una fuente de errores:

- **Es una sugerencia, nunca una imposición.** Rellena los selectores y la persona puede cambiarlos. Si el código no calza con ningún formato conocido, se guarda igual como texto y no se deduce nada.
- **`room_code` se guarda aparte del título.** El título es lo que se lee ("Sala S101"); el código es lo que después cruzará con el sistema de salas libres. Guardarlos juntos obliga a parsear texto libre para siempre.

Los pines `sala` guardan el código en un campo propio, `pins.room_code`.

---

## 4. Accesibilidad: por qué `ascensor` y `rampa` importan

Documentado aquí porque es la razón de fondo de esas dos categorías, aunque la función completa quede fuera de este plan.

**Lo que hay hoy:** el botón de ruta accesible (`accessibleRoute` en `uiStore`) cambia el perfil de OpenRouteService de `foot-walking` a `wheelchair` (`routing.ts:27`). Eso resuelve la **vereda**: evita escalones y pendientes fuertes en la calle. La ruta apunta al `lat`/`lng` del pin de destino, sin más.

**Lo que le falta:** el perfil de ORS no sabe nada del interior de un edificio ni de cuál de sus entradas tiene rampa. Hoy la ruta accesible te deja en la puerta más cercana, que puede ser la de la escalera.

**Lo que habilitan estas categorías**, cuando haya suficientes pines:

1. **Destino accesible en vez de destino a secas.** Con el modo accesible activo, la ruta no apunta al centro del edificio sino al pin de `entrada` o `rampa` accesible más cercano de ese edificio.
2. **Continuación por dentro.** Si el destino está en el piso 3, tras llegar a la entrada accesible se indica el `ascensor` más cercano en lugar de la escalera.
3. **Advertencia honesta.** Si el edificio no tiene ningún `ascensor` ni `rampa` mapeados y el destino no está en planta baja, decirlo en vez de trazar una ruta que no sirve.

Requisitos que esto impone y que este plan ya cumple: los pines de `ascensor` y `rampa` deben tener `building_id` y `floor`, y los de `entrada` un modo de marcar si son accesibles. Lo dejo anotado; no está en ninguna fase todavía.

### 4.1 Falta la categoría `escalera` ✅ CREADA (2026-08-26)

Anotado el 2026-08-10. Hay `ascensor` y `rampa`, y **no hay escalera**. No es una
categoría más de la lista: es la que dice **por dónde no se puede pasar**. El
punto 3 de arriba —advertir en vez de trazar una ruta que no sirve— necesita
saber que lo único que sube a ese piso es una escalera; sin la categoría, "no hay
ascensor mapeado" no se distingue de "nadie mapeó nada todavía".

Como **área** ya está cubierta: `area_kind` tiene `'service'`, documentado en el
esquema como "baños, ascensores, escaleras". Como **pin** hay que crearla, con su
icono.

Y conviene que sea pin y no área salvo en cajas de escalera grandes: lo que
importa de una escalera es *por aquí se sube*, que es un punto. Dibujar su
contorno es trabajo que no devuelve nada.

**Creada el 2026-08-26**
(`20260826000000_stairs_category_and_computer_lab_rename.sql`), con TTL de 720 h
como el resto de la infraestructura fija. Ojo con lo que todavía NO resuelve:
una escalera que sube del 1 al 5 sigue siendo un pin de **una** planta, así que
se ve en una sola. Eso es la §4.2, y sin ella la categoría cuenta media verdad.

### 4.2 Un ascensor no vive en una planta: las atraviesa

Idea del 2026-08-10, y destapa un límite real del modelo.

`pins.floor` es **un entero**, o sea una sola planta. Y `pinVisibleOnFloor`
(`shared/utils/floorVisibility.ts`) enseña un pin solo cuando su planta es la
activa. Un ascensor que va del −1 al 5 es, hoy, un pin de una planta: en las
otras seis **no existe**. Lo mismo la escalera.

Comprobado de paso: **poner `floor = null` no lo arregla.** Un pin sin planta se
trata como exterior y se ve **solo en la planta baja**, que es lo correcto para
un food truck y lo contrario de lo que hace falta aquí.

Quedan dos caminos:

- **Un pin por planta, en las mismas coordenadas.** Funciona sin tocar nada —
  `PIN_LOCATION_OCCUPIED` solo choca con lat/lng **y** planta iguales, así que
  siete pines apilados en siete plantas son legales. Pero son **siete objetos**:
  siete verificaciones, siete hilos de comentarios, y "el ascensor está en pana"
  hay que decirlo siete veces y se lee seis veces incompleto.
- **Un rango de plantas en el pin.** Una columna más —`floor_to`, con `floor`
  como el extremo inferior— y `pinVisibleOnFloor` comprobando el rango en vez de
  la igualdad. Un objeto, una conversación, un aviso.

**Se elige la segunda**, y la razón no es la elegancia: es que el ascensor
averiado es **un hecho**, no siete. Un modelo que obliga a repetirlo garantiza
que quede desactualizado en algunas plantas.

> **Que quede sin ambigüedad: es UN pin, no varios.** Una sola fila en `pins`,
> un solo autor, un solo hilo de comentarios, una sola verificación. Lo que se
> repite es **el marcador dibujado**: el mismo pin aparece en su misma ubicación
> en cada planta del rango. Quien lo mire desde el piso 4 y quien lo mire desde
> el −1 están viendo, y comentando, la misma cosa.

Al construirlo, cuatro cosas que hay que tener presentes:

1. **El 0 no existe, y en Chile tampoco existe en la vida real.** Aquí se pasa
   del 1 al −1 directamente; no hay "planta baja" numerada como cero, que es una
   costumbre de otros países. La base ya lo impone (`check (level <> 0)` en
   `building_floors`), así que un rango de −1 a 5 cubre −1, 1, 2, 3, 4, 5. No es
   un caso raro que haya que contemplar: es el caso normal de cualquier ascensor
   con subterráneo.
2. **Los dos extremos tienen que validarse** contra `building_floors`, no solo
   el de abajo. Es ampliar `trg_validate_pin_floor`, que hoy mira un solo valor.
3. **Se pregunta "¿hasta qué piso llega?"**, que es como lo piensa quien lo está
   mapeando. No "elige las plantas": un desplegable con el tope y otro con el
   fondo.
4. **La pregunta va al crear Y al editar.** Un ascensor mal declarado se corrige
   igual que se corrige un piso mal puesto, que es la edición más común. Ojo con
   una consecuencia concreta: `floor` es de los pocos campos que el autor cambia
   con un `UPDATE` directo —`protect_pin_sensitive_fields` lo deja pasar a
   propósito— así que `floor_to` tiene que ir por el mismo camino, o el autor
   podrá corregir el piso de abajo y no el de arriba.

Y esto vale igual para **escaleras** (§4.1) que para ascensores: una escalera que
sube del 1 al 5 tiene el mismo problema y la misma solución.

Y una limitación que conviene aceptar en vez de resolver: **un ascensor que se
salta una planta intermedia** —de esos que no paran en el −2— no lo cubre un
rango. Es raro, y la alternativa es una lista de plantas por pin, que complica
el modelo entero para el caso menos frecuente. Si aparece, se anota en la
descripción.

---

## 5. Modelo de datos

### 5.1 Jerarquía

```text
Campus
 └─ Facultad                  perímetro GeoJSON        ← ya existe, el de la FIC es fiable
     ├─ Edificio              huella + plantas         ← NUEVO, lo dibujas tú
     │    └─ Piso  (-1, 1, 2, 3…)                      ← NUEVO, lo defines tú
     │         └─ Área        hall, pasillo, casino…   ← NUEVO, opcional (§3.2)
     └─ Área exterior         patio, cancha, bicicletero
```

Un pin cae en un punto y de ahí se deducen sus contenedores, igual que hoy `facultyIdAt` deduce la facultad. **El piso no se deduce de coordenadas** — desde arriba, el 1 y el 3 son el mismo punto: lo elige la persona, con el piso activo del mapa preseleccionado y, si escribió un código de sala, ya deducido de él.

Cuando dos áreas se solapan, **gana la de menor superficie**: un quiosco dentro del casino resuelve "quiosco".

### 5.2 Tablas nuevas

```sql
-- ── Edificios ────────────────────────────────────────────────────────────
create table public.buildings (
  id             text        primary key,        -- 'fic-e441'
  faculty_id     text        not null references public.faculties(id),
  code           text,                           -- 'E441'  ← calza con el código de sala
  name           text        not null,           -- 'Edificio Ejército 441'
  short_name     text,
  aliases        text[]      not null default '{}',  -- {'edificio del KAEA'}
  footprint      jsonb       not null,           -- Polygon GeoJSON [lng,lat]
  default_floor  integer     not null default 1,
  height_m       numeric,                        -- solo si falta en OSM
  color          text,
  sort_order     integer     not null default 0,
  updated_at     timestamptz not null default now()
);

-- ── Plantas: una fila por planta existente ──────────────────────────────
create table public.building_floors (
  building_id  text     not null references public.buildings(id) on delete cascade,
  level        integer  not null check (level <> 0),  -- 1 = planta baja, -1 = subte
  label        text,                                  -- 'Zócalo', 'Entrepiso'
  primary key (building_id, level)
);

-- ── Áreas: contexto dentro de una planta, o al aire libre ───────────────
create table public.areas (
  id           text        primary key,
  faculty_id   text        not null references public.faculties(id),
  building_id  text        references public.buildings(id) on delete cascade,
  floor        integer,                          -- null ⇔ building_id null
  kind         public.area_kind not null,
  name         text        not null,             -- 'Hall central', 'Casino'
  polygon      jsonb       not null,
  color        text,
  sort_order   integer     not null default 0,
  updated_at   timestamptz not null default now(),
  constraint areas_floor_coherent check (
    (building_id is null and floor is null) or
    (building_id is not null and floor is not null)
  ),
  foreign key (building_id, floor)
    references public.building_floors(building_id, level) on delete cascade
);

create type public.area_kind as enum (
  'hall', 'corridor', 'cafeteria', 'kiosk', 'office', 'service', 'lab',
  'courtyard', 'sports', 'parking', 'green', 'other'
);
```

Dos decisiones que vale la pena justificar:

- **`building_floors` es una tabla, no un rango `min/max`.** Con rango, añadir un subterráneo a un edificio ya mapeado obliga a recalcular, y no hay dónde poner "Zócalo". Con una fila por planta, agregas o quitas una y ya. Es exactamente la variabilidad que describiste: uno con tres plantas sin subterráneo, otro con subterráneo, otro sin.
- **`buildings.code`** existe para casar con el prefijo del código de sala (`E441.1.S101` → `E441`). Es lo que permite la deducción de la §3.4.

RLS: lectura pública, escritura solo moderador y admin. Mismo patrón que `floor_plans` (`baseline.sql:2195-2199`).

### 5.3 Cambios en tablas existentes

| Cambio | Por qué |
|---|---|
| `pins.building_id`, `pins.area_id`, `pins.room_code` | contenedores + código de sala |
| `create_pin_with_daily_limit` + `p_floor`, `p_building_id`, `p_area_id`, `p_room_code` | único camino de creación |
| `check_pin_location_available` → incluir `floor` | dos pines en la misma vertical y distinta planta son legítimos |
| Categorías `sala`, `ascensor`, `rampa`; arreglo de icono de `casino` y `feria` | §3.3, §1.5 |
| `pins.building` (texto libre) | queda obsoleta; la reemplaza `building_id` |

**Ubicación única y pisos.** El trigger de `baseline.sql:630-658` lanza `PIN_LOCATION_OCCUPIED` si hay un pin vigente en el mismo `lat`/`lng`. En un edificio de salas eso es lo normal, así que hay que añadir:

```sql
and existing.floor is not distinct from new.floor
```

El equivalente en el cliente está en `src/shared/utils/pinLocation.ts:16-21`, con su test al lado.

**Trampa con la RPC.** `create or replace function` con firma distinta **crea una sobrecarga, no reemplaza**. La migración debe hacer primero:

```sql
drop function public.create_pin_with_daily_limit(
  public.pin_type, text, text, text, text, double precision, double precision,
  boolean, text, timestamptz, timestamptz, timestamptz);
```

Si no, quedan dos versiones y PostgREST falla por ambigüedad.

### 5.4 Contrato de datos: qué pasa cuando tú agregues las áreas

Para que agregar datos no obligue a tocar código, tres invariantes que el motor respeta siempre:

1. **Todo es opcional y degrada hacia arriba.** Sin áreas, el breadcrumb muestra `Facultad · Edificio · Piso`. Sin plantas, `Facultad · Edificio`. Sin edificios, `Facultad`, que es lo que hay hoy. Ninguna pantalla se rompe por datos que faltan.
2. **Los datos mandan sobre el código.** El selector de plantas se construye leyendo `building_floors`; nada está escrito a mano. Si mañana agregas un cuarto subterráneo, aparece solo.
3. **Una sola fuente, dos destinos.** Dibujas en el editor → se guarda en Supabase → el botón "Exportar" vuelca `buildings.ts` y `areas.ts` a `src/shared/data/` para versionarlos en git y alimentar el modo demo. Los perímetros de facultad ya no siguen ese camino: viven solo en la base (fase 7B).

Con eso, cuando termines de mapear, el único ajuste previsible es afinar colores y tamaños de etiqueta, que es cosa de un rato.

---

## 6. El editor `/admin/mapeo`

Editor propio, para computador, solo admin. **Se construye sin necesitar ningún dato tuyo.**

### 6.1 Disposición

```text
┌─────────────┬──────────────────────────────────────┬──────────────┐
│ ÁRBOL       │  MAPA (mismo MapLibre y estilo       │ PROPIEDADES  │
│             │        que la app real)              │              │
│ FIC         │                                      │ Nombre       │
│ ├ E441      │   ░░ planta inferior en fantasma ░░  │ Tipo   ▾     │
│ │  ├ Piso 3 │   ▓▓ áreas de la planta activa ▓▓    │ Color  ●     │
│ │  ├ Piso 2 │   ● pines existentes de esta planta  │              │
│ │  └ Piso 1 │                                      │ 62,4 m²      │
│ ├ E333      │   ── huella del edificio ──          │ 4 vértices   │
│ │  ├ Piso 1 │                                      │              │
│ │  └ Subt.  │   [R] rect [P] polígono [D] dividir  │ [Eliminar]   │
│ └ + Edificio│                                      │              │
└─────────────┴──────────────────────────────────────┴──────────────┘
```

El árbol es el mapa mental completo. Un clic en una planta la pone en edición. Botones `+ Piso` y `+ Subterráneo` por edificio, y `−` para quitarlo: ahí resuelves la variabilidad sin ninguna configuración especial.

Los **pines ya existentes de esa planta se ven en el mapa** mientras dibujas. Sirve para dos cosas: comprobar que las áreas quedan donde debían, y detectar pines mal ubicados.

### 6.2 Puedes añadir tu propio edificio

Las teselas de OpenFreeMap son de solo lectura, pero MapLibre pinta **tus capas encima** — es lo que ya hace `facultyLayers.ts` con los perímetros. Para el edificio que falta en OSM: dibujas su huella, le pones `height_m` (18 m ≈ 4 plantas) y una capa `fill-extrusion` alimentada por `buildings` lo levanta en 3D junto a los de OSM, en rojo UDP.

### 6.3 Dibujar: cuatro modos y tres aceleradores

**Modos**

1. **Rectángulo rotado** (`R`, por defecto). Dos clics marcan la diagonal, un tirador rota. La mayoría de edificios, halls y patios son rectángulos girados: **tres clics**.
2. **Polígono libre** (`P`). Clic a clic, `Enter` para cerrar. Para formas en L.
3. **Calcar de OSM** (`T`). Clic en un edificio existente y su contorno pasa a ser tu polígono, editable. Para los que **sí** están en OSM, con precisión catastral.
4. **Duplicar** (`Ctrl+D`).

**Aceleradores** — los tres que convierten horas en minutos:

- **Modo ortogonal** (`Shift`). La primera arista fija la orientación del edificio; desde ahí los vértices se ajustan a múltiplos de 90° y 45° **respecto de esa orientación, no del norte**. Los edificios son rectilíneos pero casi nunca están alineados al norte: es lo que hace que un plano a mano salga limpio en vez de torcido.
- **Dividir en N** (`D`). Dibujas un rectángulo sobre un tramo y lo partes en N iguales a lo largo del eje mayor.
- **Copiar planta** (`Ctrl+Shift+V`). Duplica todas las áreas del piso 1 al 2 de un golpe. Y al editar una planta, **la de abajo se ve en fantasma** para calcar.

**Vértices:** arrastrables, con puntos fantasma en el medio de cada arista para insertar, `Supr` para borrar, flechas del teclado para mover 10 cm. `Ctrl+Z` / `Ctrl+Y`.

**Imanes:** un vértice a menos de ~1 m del borde del edificio, del perímetro de la facultad o de un área vecina se pega a él; `Alt` lo desactiva.

**Lectura en vivo:** superficie en m² y longitud de la arista actual. Si un hall te da 600 m² en vez de 60, te enteras mientras dibujas.

### 6.4 Reubicar pines en lote

Pestaña aparte, y es la que te resuelve los 20 pines de hoy y los que vengan: tabla de los pines de un edificio con selector de **planta** por fila y guardado en lote. Sin esto, asignarle piso a los pines existentes sería uno por uno desde el mapa. `ContentPanel.tsx` ya lista y borra pines vía `fetchAdminPins`; falta un `adminSetPinFloor` en `src/features/admin/api.ts`.

### 6.5 Validaciones

- Un área con edificio debe estar **dentro de su huella**; un área exterior, dentro del **perímetro de la facultad**. Tolerancia ~1 m.
- **Solapes**: permitidos, pero avisa cuánta superficie, porque casi siempre es error de trazado.
- **Cobertura**: un botón pinta en gris lo que queda de la planta activa sin área asignada.
- Superficie mínima, para que un doble clic no cree un área de 2 m².
- **Borrar una planta que tiene áreas o pines dentro**: confirmación explícita diciendo cuántos, porque el `on delete cascade` se lleva las áreas por delante.

#### Qué está hecho de verdad (comprobado el 2026-08-10)

Contra `src/features/mapping/validation.ts` y `MappingCanvas.tsx`. Lo de arriba
es la especificación; esto es el estado.

**Contención — "esto tiene que caber dentro de aquello".** Cada cosa que se
dibuja tiene un contenedor, y el editor comprueba que no se salga. Si se sale,
o no te deja guardar (**error**) o te avisa y te deja seguir (**aviso**):

| Si dibujas… | …tiene que caber dentro de… | Si se sale |
|---|---|---|
| Un área de un edificio | la huella de ese edificio | **no te deja guardar** |
| Un área exterior | el perímetro de la facultad | **no te deja guardar** |
| Un edificio | el perímetro de la facultad | solo te avisa |

Que lo del edificio sea aviso y no error es deliberado y está razonado en el
código: hay edificios que asoman del perímetro trazado y no es motivo para
impedir guardarlos.

> **"Área exterior" no quiere decir "patio".** Son dos cosas distintas que es
> fácil confundir. **Exterior** significa `building_id` nulo: es suelo del
> campus, no está en ningún edificio y se ve desde todas las plantas. **Patio,
> jardín o cancha** son valores de `kind`, y describen **qué es** el área, no
> dónde está.
>
> Un `kind = 'green'` puede vivir perfectamente **dentro** de un edificio: el
> pastito de la Biblioteca en las plantas 3 y 5 es un área con
> `building_id = biblioteca`, `floor = 3` y `kind = 'green'`, y como tal ya se
> valida contra la huella del edificio — que es lo correcto. Lo mismo un casino
> en el piso 2. Nada de lo que se propone abajo lo estorba.

**Solape — "esto no debería pisar aquello".** Aquí están los huecos:

| ¿Se comprueba que no se pisen? | Estado |
|---|---|
| Un área contra las otras áreas **de su misma planta** | ✅ Avisa, si comparten más del 1 % o 2 m² |
| Un área exterior contra las otras áreas exteriores | ✅ Avisa, por la misma vía |
| **Un edificio contra otro edificio** | ❌ **No se comprueba nada** |
| **Un área exterior contra la huella de un edificio** | ❌ **No se comprueba nada** |

O sea: **hoy se puede trazar un edificio encima de otro, o un patio del campus
encima de un edificio, y el editor no dice ni una palabra.**

**El imán ya hace lo que hace falta para trazar salas pegadas.** Verificado en
`snapToPolygons`: con 1 m de tolerancia, se pega **primero a los vértices y, si
no hay ninguno cerca, al borde** del polígono más próximo. Y sus referencias
(`snapReferences`) incluyen el perímetro de la facultad, **todas** las huellas de
edificios y **las áreas de la planta activa**, menos la que se está editando.

Traducido al caso real: dibujas la sala 1, empiezas la sala 2 a su derecha, y al
acercarte a menos de un metro los vértices se clavan en la esquina de la sala 1;
si vas por mitad de la pared, se clava en el borde. Las salas quedan pegadas sin
hueco ni solape, que es justo lo que se busca. **Esto ya funciona hoy**, y no hay
que confundirlo con las validaciones: el imán es una ayuda de trazado y la
validación es lo que salta cuando el imán no se usó.

**Por qué el solape entre áreas es aviso y no error:** porque a veces es
correcto. Un quiosco dentro del casino es un área dentro de otra, y el editor no
está en posición de saber si el solape es un error de trazado o una anidación
deliberada.

Eso vale para casinos y quioscos. **Para salas no vale**: dos salas de clases no
pueden ocupar el mismo metro cuadrado, nunca. Cuando exista el tipo de área
`'room'` (`docs/SALAS.md` §12.6), el solape entre dos áreas de ese tipo debería
ser **error**.

**Lo que falta, en orden:**

1. **Solape edificio contra edificio**, como **aviso**, no como error. Es el
   hueco más grande —un edificio mal trazado desplaza todas las áreas que
   cuelguen de él— pero prohibirlo del todo sería pasarse: hay casos reales de
   huellas que se tocan o se montan, como dos cuerpos unidos por una pasarela, o
   `E278A` y `E278B`, que comparten medianera. El coste de un error falso es que
   no puedes guardar nada; el de un aviso falso es leer una línea. Con el aviso
   basta para cazar el 99 % de los casos, que son de trazado.
2. **Solape de área exterior contra huella de edificio**, como aviso. Recordando
   la distinción de arriba: esto solo afecta a áreas **sin edificio**. Un jardín
   en la planta 3 no entra aquí.
3. **Solape entre áreas de tipo sala: error, no aviso.** Es el único caso donde
   sí conviene impedir guardar, porque no hay lectura legítima. Depende de que
   exista `'room'` en `area_kind`.

### 6.6 Sin dependencias nuevas

Se escribe a mano, unas 400-500 líneas. El repo ya trabaja así (`MapView.tsx:390-421`, `campusBoundary.ts`, `facultyLayers.ts`), y es lo único que permite el modo ortogonal, dividir-en-N y copiar-planta.

---

## 7. Qué cambia en el editor de pines

Cuatro cosas, todas pequeñas:

1. **Selector de planta.** Si la ubicación cae dentro de un edificio con más de una planta, aparece con la planta activa del mapa preseleccionada. Si el edificio tiene una sola, no aparece y se guarda esa.
2. **Campo de código de sala**, solo para la categoría `sala`. Al escribirlo se deducen edificio y planta (§3.4), como sugerencia editable.
3. **Confirmación de dónde queda.** Bajo el título, en gris: `Edificio E441 · Piso 1 · Hall central`, calculado en vivo. Comprobación antes de publicar.
4. **Aviso de sala duplicada.** Si ya hay un pin `sala` con el mismo `room_code` en ese edificio, se avisa antes de guardar — sin bloquear, porque puede ser una corrección legítima.

El resto del formulario —título, descripción, categoría, fotos, fechas— queda igual.

---

## 8. Cómo se ve en el mapa

### 8.1 Edificios y áreas

**El color por defecto identifica el tipo, la etiqueta identifica el lugar**, y puedes cambiar el color de cualquier área a mano. Doce áreas en doce colores fuertes se ve a parches; el mismo tono con su nombre encima se lee al instante.

| Tipo | Relleno por defecto |
|---|---|
| `hall` | ámbar suave, opacidad 0.18 |
| `corridor` | gris cálido, 0.14 |
| `cafeteria` | ámbar, 0.22 |
| `kiosk` | ámbar oscuro, 0.24 |
| `lab` | azul, 0.20 |
| `office` | gris azulado, 0.18 |
| `service` | gris, 0.14 |
| `courtyard` | verde apagado, 0.18 |
| `sports` | azul, 0.18 |
| `parking` | gris, 0.16 |
| `green` | verde claro, 0.15 |

Capas nuevas en `facultyLayers.ts`, sobre `faculty-perimeter-fill`:

- `building-fill` / `building-line` — huellas, desde zoom 16.
- `building-extrusion` — solo para edificios con `height_m`.
- `area-fill` / `area-line` — **solo de la planta activa**, desde zoom 17.5.
- `area-label` — `symbol` con nombre e icono por tipo.

Al entrar a un edificio, lo que queda fuera se atenúa para que la planta activa mande visualmente. Al hacer clic en un área: se satura y aparece una **etiqueta compacta** con nombre, planta y actividad reciente. Prioridad de clic: pin > área > edificio > perímetro de facultad (este último ya en `MapView.tsx:210-239`).

### 8.2 Selector de planta

Columna vertical **a la derecha, centrada verticalmente** (`right-3 top-1/2 -translate-y-1/2`), como en Apple y Google Maps y como en la referencia que mandaste. No choca con ubicación y brújula arriba ni con sede y 2D/3D abajo. Aparece cuando el centro del mapa entra en un edificio de más de una planta, o al abrir un edificio o un pin con planta; se va al salir. Lista las plantas de `building_floors` de arriba abajo con su `label`, más un chip **"Todo"**. Entra en `default_floor`.

`IndoorPanel` se reescribe como `FloorSelector`: pierde el botón de cerrar (deja de ser un modo del que se sale y pasa a ser un contexto) y lee de `building_floors`.

**`DEMO_FLOOR_PLANS` se borra, no se corrige.**

---

## 9. Densidad de pines

Con las salas como pines, esta sección deja de ser un remate y pasa a ser **crítica**: un edificio de 40 salas son 40 pines más. Sin esto, mapear la FIC empeora el mapa en vez de mejorarlo.

Tenías razón en las dos objeciones iniciales. Los filtros **no** pueden ser el mecanismo — resolver un problema visual pidiéndole trabajo al usuario es trasladarle el problema. Y **pines más pequeños tiene poco recorrido**: hoy miden 26 px más 2 px de borde con el icono a 16 px (`src/styles/index.css:317-331`); bajo ~22 px se vuelven difíciles de tocar y el icono ilegible.

### 9.1 Detalle por zoom (el mecanismo principal)

| Zoom | Qué se ve | Al tocar |
|---|---|---|
| **< 16** — campus | un marcador por **facultad** con contador | abre `FacultyDetail` |
| **16 – 17.5** — facultad | un marcador por **edificio** o área exterior, con contador | abre ese edificio |
| **≥ 17.5** — interior | **pines individuales**, filtrados por la planta activa | abre el pin |

Los 20 pines de tu foto 1 se vuelven 4 o 5 marcadores de facultad; al acercarte, 4 o 5 de edificio; al entrar, los de esa planta. Encaja porque es la metáfora de la app y porque `FacultyDetail` ya existe y ya lista los posts.

**El filtrado por planta es lo que salva las salas.** 40 salas repartidas en 4 plantas son 10 visibles a la vez, no 40.

### 9.2 Las salas se ven distinto de los avisos

Un pin de sala es infraestructura fija; uno de comida es una novedad. Que compitan visualmente igual es un error. Los pines de infraestructura fija se dibujan **más pequeños** que los avisos, que mantienen su marcador de 26 px.

> **Corregido el 2026-08-26, al verlo en pantalla: son 22 px, no 18, y la
> condición es la CATEGORÍA.** Con 18 px el icono dentro del círculo dejaba de
> leerse, y multiplicado por la escala de zoom de la §9.3 daba pines de 14 px
> que no se podían ni tocar. Y "permanente verificado" no es la condición
> correcta: las facultades también son pines permanentes —sembradas además con
> la categoría `entrada`—, así que cualquier regla derivada de `is_permanent`
> las encogía y dejaba el mapa sin sus anclas. La lista vive en `campusData`
> (`isFixedInfraCategory`) y hoy son cuatro: sala, ascensor, rampa y escalera.
> `entrada` queda fuera a propósito: es una referencia para orientarse de
> lejos, no un detalle del interior. La etiqueta con el código de sala al lado
> a zoom alto sigue pendiente.

> **Corregido el 2026-08-05: solo el tamaño, nunca el tono.** La versión anterior
> pedía además dibujarlos "sin sombra fuerte, en un tono apagado". Eso choca de
> frente con el lenguaje visual que ya existe: **el desvanecido significa "por
> vencer"** (`MapView.tsx`, `expiry.status === 'fading'`, aplicado con
> `filter: opacity()`). Atenuar un pin permanente le haría decir exactamente lo
> contrario de la verdad, porque los permanentes son los que nunca vencen. Ya se
> tropezó una vez con esto: a los eventos se les quitó el estado de expiración
> porque parpadeaban en su última hora y se leía mal. La diferencia de tamaño
> sirve y no choca con nada; el tono queda descartado.

Así el interior de un edificio se lee como un plano —salas pequeñas con su número— con las novedades destacando encima.

### 9.3 Abanico y tamaño por zoom

- **Abanico**: dos o más pines a menos de ~30 px se colapsan en un chip con el número y se abren en abanico al tocarlo.
- **Tamaño según zoom** con `--pin-scale`: 26 px hasta zoom 18 y hasta 30 px de 19 en adelante. *(Los 20 px a zoom 17 que decía este plan se probaron el 2026-08-26 y se descartaron: de lejos el problema no es el tamaño de los pines sino su número, y encogerlos solo los volvía ilegibles.)*

> **Repriorizado el 2026-08-05: el abanico deja de ser un remate.** Esta sección
> estaba escrita como el adorno final de la §9.1, y es al revés. El detalle por
> zoom resuelve el amontonamiento **de lejos**, que es un problema futuro —
> aparece cuando hay muchos pines y hoy no los hay. El problema real y presente
> es el de **cerca**: dos pines a un metro se tapan aunque estés al máximo zoom,
> porque el marcador mide 26 px y ese metro son 10 px, y acercarse más ya no
> ayuda. Eso solo lo arregla el abanico.
>
> Ojo al construirlo: es el punto más delicado de la fase. Hay que recalcular
> posiciones proyectadas en cada movimiento del mapa y tocar el DOM de los
> marcadores, y en `MapView.tsx` ya hay dos comentarios de peleas pasadas con el
> parpadeo por rehacer marcadores de más. La insignia de planta ya distingue dos
> pines de pisos distintos en la misma vertical: el abanico solo tiene que
> atacar el solape del **mismo** piso.

A los filtros les queda el papel que debieron tener siempre: **refinar por intención**, no salvar el mapa.

---

## 10. Mensajes y manejo de estados

Pedido explícito, y hoy es el punto más flojo: hay mensajes clavados en español (§1.6), estados vacíos sin texto y errores que se comen en silencio. Reglas y catálogo.

### 10.1 Cuatro reglas

1. **Nada de texto clavado.** Todo mensaje nuevo entra en `shared/lib/i18n.ts` con su par `es`/`en`. Los existentes de la §1.6 se migran de paso.
2. **Un error que la persona puede corregir va en el formulario, no en un toast.** El toast es para lo que ya pasó y no tiene arreglo inmediato; lo corregible va al lado del campo.
3. **Errores de base de datos: `isUserFacingDbError`.** Ya existe (`shared/utils/dbError.ts`) y distingue por SQLSTATE los mensajes escritos para el usuario (`P0001`) de los técnicos. Los técnicos nunca se muestran tal cual: mensaje genérico y el detalle a consola.
4. **Un estado vacío siempre ofrece salida.** "No hay nada aquí" a secas es un callejón; siempre acompañado de la acción que corresponda.

### 10.2 Creación de pines

| Situación | Dónde | Mensaje |
|---|---|---|
| `PIN_LOCATION_OCCUPIED` | toast | "Ya hay un pin en este punto **de esta planta**. Muévelo un poco o cambia de piso." ← hay que actualizar el actual, que no menciona el piso |
| `DAILY_PIN_LIMIT_REACHED` | inline | ya resuelto, con la hora de reinicio vía `nextDailyPinReset` |
| Invitado intenta publicar | modal de login | ya resuelto por `useGuard` |
| Fuera del perímetro de toda facultad | inline, aviso | "Este punto queda fuera de las facultades mapeadas. Se publicará sin facultad asignada." |
| Edificio con plantas y no eligió ninguna | inline, bloquea | "Elige en qué piso está." |
| Código de sala sin formato conocido | inline, aviso | "No se reconoce el formato. Se guardará igual; elige el piso a mano." |
| Código de sala repetido en el edificio | inline, aviso | "Ya existe un pin para S101 en este edificio." |

**El título se sugiere según la categoría.** Anotado el 2026-08-10. Hoy el campo
de título está igual de vacío tanto si publicas un baño como una sala, y el
resultado son cincuenta formas de escribir lo mismo: "Sala 403", "sala403",
"S403 libre", "la 403". Un catálogo de salas con títulos así no se puede ni
ordenar ni buscar.

La salida es barata: **un texto de ejemplo en el campo, distinto por categoría**,
y para `sala` además el título **propuesto** a partir del código —escribes
`E441.4.S403` y aparece "Sala 403". Dos reglas para que no moleste:

- **Es una sugerencia, no una imposición.** Se puede borrar y escribir otra cosa.
  Igual que el propio código de sala (§3.4): el editor propone, la persona
  decide.
- **Si la persona ya escribió algo, no se le pisa.** La propuesta solo rellena un
  campo vacío.

### 10.3 Pisos y áreas

| Situación | Qué se hace |
|---|---|
| Edificio sin plantas definidas | no aparece el selector; el pin se guarda sin `floor`. Silencioso, no es un error |
| Planta sin ningún pin | estado vacío: "Nada publicado en este piso todavía" + "Ver todo el edificio" y "Publicar algo aquí" |
| Fallo al cargar edificios y áreas | **el mapa sigue funcionando** sin ellos, con un aviso discreto y reintento. Nunca bloquear el mapa por datos de contexto |
| Pin sin `building_id` (exterior) | breadcrumb degradado a `Facultad`; sin mensaje de error |
| Área con nombre pero sin pines | ficha normal con "Sé el primero en publicar aquí" |

### 10.4 Editor

Todas inline junto al elemento, nunca como toast, porque son correcciones en curso: fuera del perímetro, solape con superficie, área bajo el mínimo, planta duplicada, y confirmación destructiva al borrar una planta con contenido ("Se eliminarán 12 áreas de esta planta"). Si falla el guardado, **el trazado no se pierde**: queda en borrador local con un botón de reintentar.

### 10.5 Lo que la app nunca explica

Anotado el 2026-08-10. Las tablas de arriba cubren **errores**; esto es lo
contrario, y es un hueco más grande: **cuando todo sale bien, la app tampoco
cuenta nada.** Un estudiante publica un reporte y no se entera de que caduca en
12 horas, de que alguien puede verificarlo, ni de qué gana si lo hacen. Las
reglas existen, están implementadas y son buenas —el TTL por categoría, la
verificación, el karma—; simplemente no se dicen en ninguna parte.

Cuatro cosas concretas, de menos a más trabajo:

1. **Decir qué va a pasar ANTES de publicar, no después.** En el propio
   formulario, según la categoría elegida: cuánto dura, si puede volverse
   permanente, y qué pasa si un moderador lo verifica. El caso de la sala está
   escrito como ejemplo en `docs/SALAS.md` §12.5, y sirve de molde para el
   resto.
2. **Notificar el karma, con el motivo.** Hoy `adjust_karma` mueve el número y
   **nadie se entera de por qué**: no hay ningún mensaje del tipo "ganaste 25 de
   karma porque verificaron tu sala". Un contador que sube solo no enseña nada y
   no motiva a nadie. Hace falta el evento y el texto, y una idea de dónde se
   lee el historial.
3. **Explicar la verificación y el cambio de tipo.** Cuando verifican un
   reporte, pasa a `type = 'place'` y deja de caducar. Es de las mejores cosas
   que hace la aplicación y es completamente invisible: ni el autor recibe aviso
   claro, ni se entiende qué cambió.
4. **Una página de preguntas frecuentes.** Cuánto dura cada tipo de pin, cómo se
   gana karma, qué hace un moderador, qué es una sala verificada, por qué mi pin
   desapareció. Va enlazada desde el menú y desde el formulario de creación.

Ojo con el orden: el punto 1 y el 4 se pisan si se hacen a la vez. Primero los
mensajes en contexto —que es donde la persona tiene la duda— y la página después,
como sitio donde ampliar.

### 10.6 Transversales

- **Sin conexión**: banner de solo lectura; las acciones de escritura quedan deshabilitadas con explicación, no fallando al pulsarlas.
- **Carga**: esqueletos donde ya se usan; nunca un spinner a pantalla completa sobre el mapa.
- **Permisos**: cuando una acción está fuera del rol, se explica qué rol hace falta en lugar de esconder el botón sin más.

---

## 11. Onboarding

### 11.1 Primero, un orquestador

Nada coordina hoy `TutorialModal` y `ProfileSetupModal`. Antes de añadir un tercer paso hace falta una cola en `uiStore`:

```ts
type OnboardingStep = 'welcome' | 'profileSetup' | 'mapTour' | 'facultyTour' | null
// un solo `currentStep`; nunca dos a la vez.
```

### 11.2 Slides y coach marks, en momentos distintos

No es slides *o* videojuego: son los dos. Las slides explican **qué es** la app; los coach marks enseñan **dónde tocar**.

| Paso | Quién | Qué | Cuándo |
|---|---|---|---|
| **1. Bienvenida** | todos, 1ª vez | `TutorialModal` como **carrusel de 3 slides**; la tarjeta de instalar PWA pasa a ser la última | al abrir |
| **2. Selección de facultad** | al registrarse | `ProfileSetupModal` tal cual | tras login, si `faculty_id === null` |
| **3. Tour del mapa** | todos, tras la bienvenida | **coach marks**: fondo oscuro con agujero, tooltip abajo, "Saltar" | al cerrar el paso 1 |
| **4. Tour de facultad** | recién registrados | 2 pasos: "esta es tu facultad" → "publica tu primer post" | tras el paso 2 |

**Los 5 pasos del tour del mapa:**

1. Toca una facultad → se abre con sus posts *(espera el toque real)*
2. Cada área es un lugar: edificios, patio, hall
3. Este selector cambia de planta
4. El botón **+** publica algo aquí, incluida una sala que falte
5. Filtros arriba; abajo Eventos, Foro y Perfil

Los pasos 2 y 3 son la razón de ser del tour: **áreas y plantas son lo menos evidente de la app.**

### 11.3 Implementación

- `src/features/onboarding/` con `TourOverlay.tsx` (agujero + tooltip) y `tours.ts` (pasos declarativos).
- El agujero, con un `div` a pantalla completa y `clip-path` sobre el rectángulo del objetivo (`getBoundingClientRect`). Framer Motion ya está.
- Flags versionadas por tour: `udpmap.tour.map.v1`.
- Submenú "Ver tutorial" en el sidebar, sobre el punto que ya existe (`Sidebar.tsx:258`).
- Nunca arranca si ya estás haciendo algo: se pospone.

---

## 12. Fases

Ordenadas para que **nada dependa de datos que aún no tienes**.

### Fase 0 — Limpieza ✅ HECHA

- [x] Borrar `DEMO_FLOOR_PLANS` de `campusData.ts` y sus tres consumidores.
- [x] Quitar el botón "Planos interiores" del `PinDetail`; `IndoorPanel` eliminado.

> Sacó de producción lo que estaba visiblemente roto: el arreglo de la foto 4/5.

### Fase 1 — El editor ✅ HECHA

- [x] Migraciones: `area_kind`, `buildings`, `building_floors`, `areas`, con RLS
      (`20260804100000_indoor_mapping.sql`).
- [x] Ruta `/admin/mapeo`: árbol, mapa y panel de propiedades.
- [x] Modos rectángulo rotado, polígono libre, calcar de OSM, duplicar.
- [x] Aceleradores: ortogonal, dividir-en-N, copiar planta, calco de la planta inferior.
- [x] Vértices, imanes, deshacer/rehacer, atajos, lectura de m².
- [x] Validaciones y mensajes inline (§10.4), 11 pruebas.
- [x] Pestaña de reubicación de pines en lote (§6.4).
- [x] Guardado en Supabase + botón "Exportar".

**Segunda pasada tras mapear la FIC** (`20260804140000_mapping_refinements.sql`):

- [x] **Rotar e inclinar el mapa.** Estaba bloqueado en vista cenital fija, que
      impedía revisar si un área quedó pegada a la fachada correcta. El trazado
      no sufre: `unproject()` ya tiene en cuenta el ángulo de la cámara.
- [x] **Botón "Cerrar forma"** flotante sobre el lienzo. Cerrar el polígono
      acertándole al primer vértice era la única salida y no se adivinaba.
      `Enter` hace lo mismo.
- [x] **Tipo libre en "Otro"** (`areas.custom_kind`): bodega, auditorio, sala de
      máquinas. La lista cerrada siempre se queda corta.
- [x] **Color por edificio** y **`has_rooms`** para los que son solo oficinas: a
      esos no se les pide código, porque su código no es prefijo de nada.
- [x] **Vista "Por planta"**: el piso N de TODOS los edificios a la vez, más el
      exterior. El edificio de un área nueva se deduce del punto.
- [x] **Cobertura**: cuánto del perímetro de la facultad está mapeado.
- [x] **Aviso en móvil**: el editor necesita ratón y teclado.

**Aquí paro y terminas de mapear la FIC.** El resto se apoya en esos datos.

### Fase 2 — Todo eso en el mapa real ✅ HECHA

> No dependía de tener la FIC mapeada: el mapa lee `buildings` y `areas` de la
> base y pinta lo que haya. Con cero áreas no se ve nada, con veinte se ven
> veinte. Lo que dibujes en `/admin/mapeo` aparece en `/mapa` sin tocar código.


- [x] `buildingAt()` y `areaAt()` con desempate por menor superficie.
- [x] Capas de edificios y áreas (`mappingLayers.ts`), filtradas por planta activa.
- [x] Clic en área y edificio → etiqueta compacta (`PlaceLabel`).
- [x] Migración `pins.building_id` / `area_id` / `room_code`; `createPin` los deduce y
      `updatePinLocation` los recalcula con la planta que el pin ya tiene.
- [x] Breadcrumb en `PinDetail`: `Facultad · Edificio · Piso · Área`.
- [x] Búsqueda del mapa: encuentra edificios, áreas y alias.
- [x] Entrada y salida automática de un edificio según zoom y centro.

### Fase 3 — Plantas y salas ✅ HECHA

- [x] Migración: `drop` + recrear `create_pin_with_daily_limit` con `p_floor`,
      `p_building_id`, `p_area_id`, `p_room_code`.
- [x] Migración: la ubicación única compara también `floor`, y el trigger de
      UPDATE escucha `floor` (antes, cambiar de planta se saltaba la comprobación).
- [x] Categorías `sala`, `ascensor` y `rampa`; arreglados los iconos de `casino`
      (usaba una cruz médica) y `feria`.
- [x] `roomCode.ts` con 9 pruebas. Solo deduce la planta, y calla si no reconoce
      el formato: `SMV-03` es un código válido que no dice nada.
- [x] `createPin` manda la planta; `pinLocation.ts` la compara, con 5 pruebas.
- [x] `IndoorFields` en el formulario: selector de planta, código de sala y
      confirmación de dónde queda.
- [x] `FloorSelector` a la derecha, centrado.
- [x] `MapView`: filtrado por planta activa + insignia de planta en el marcador.

**Verificación:** dos pines en el mismo punto y distinta planta conviven; en la misma, `PIN_LOCATION_OCCUPIED`.

**Segunda pasada tras probarlo en el mapa real** (`20260804200000_pin_floor_edit.sql`):

Las fases 1–3 dejaron el motor funcionando y la base bien, pero el mapa público
enseñaba mal casi todo lo que ese motor producía. Siete arreglos:

- [x] **Los posts del feed no se leían.** Una tarjeta sin foto pintaba un
      degradado rojo al 20 % con el título en blanco encima: blanco sobre rosa
      pálido. Como casi ningún post lleva foto, era el caso normal. Ahora la
      tarjeta sin foto es superficie neutra con el icono de la categoría en su
      color y el título en el color de texto del tema.
- [x] **Los edificios no tenían nombre.** No existía capa de etiqueta para
      `buildings` — solo para `areas`, y por eso lo único que se leía era
      "Patio". Capa `mapping-buildings-label`: nombre corto desde zoom 16,5,
      completo desde 18. Las etiquetas de área bajan de 18 a 17,5, el mismo
      umbral al que ya se pinta el área.
- [x] **El mapa parpadeaba al panear y al hacer zoom.** `usePins` mantenía una
      suscripción a los bounds cuyo valor no usaba nadie: re-renderizaba
      `MapPage` en cada `moveend`, `pins` salía de un `.filter()` —array nuevo
      cada vez— y `MapView` rehacía el `innerHTML` de los 30 marcadores. Fuera
      la suscripción, `useMemo` en `pins`, y el marcador solo se repinta si
      cambia su clave de render (categoría, tipo, planta). Medido: 0 nodos
      recreados en 12 paneos y 2 zooms.
- [x] **El mapeo interior "a veces ni aparecía".** Dos causas. La primera,
      `if (map.isStyleLoaded()) … else map.once('style.load', …)`:
      `isStyleLoaded()` es false mientras quede una tesela por cargar, así que
      si los edificios llegaban de la base en ese hueco se esperaba un evento
      que ya había pasado y el `setData` no se llamaba nunca. Sustituido por un
      contador `styleEpoch` que también cubre el `setStyle` del modo oscuro,
      que hasta ahora vaciaba el mapeo. La segunda, la entrada y salida de un
      edificio oscilaba alrededor de zoom 17,5 y del borde de la huella: ahora
      se entra a 17,5, se sale por debajo de 17,2 y hace falta estar a más de
      5 m de la fachada.
- [x] **Un toque abría dos fichas.** El clic en el perímetro y el clic en las
      capas del mapeo eran manejadores independientes y corrían los dos: se
      abría el feed de la facultad con la ficha del edificio asomando detrás.
      Un único manejador con prioridad `área > edificio > facultad`, y los tres
      estados del store se excluyen entre sí.
- [x] **No se podía editar la planta ni el código de sala.** `IndoorFields`
      estaba tras `{!editingPin && …}` y `updatePin` no mandaba los campos. La
      base ya lo permitía para el autor. Al cambiar de planta, el trigger suelta
      `area_id`: el área colgaba del piso anterior y no se puede recalcular en
      el servidor.
- [x] **El perímetro deja de rellenarse.** Marcar la facultad entera de rojo
      tapaba las calles y competía con los pines, y el relieve que debía
      sustituirlo no existía: en 2D las extrusiones están ocultas y en 3D el
      filtro `within` sobre OSM casi nunca acierta. Ahora la facultad se lee por
      su contorno y por sus edificios —huella con nombre en 2D, volumen en 3D—,
      que es además la estructura de la que cuelgan las áreas. La capa de
      relleno se queda con opacidad 0: sigue siendo el blanco de clic que abre
      el feed.

**Tercera pasada, revisando el mapa contra el editor** (sin migración):

- [x] **El contorno del perímetro vuelve.** Se había quitado junto con el
      relleno, y con él desapareció lo único que sitúa una facultad cuando
      todavía no se ven sus edificios. Ahora se dibuja el borde y nada más, sin
      `minzoom`, en 2D y en 3D.
- [x] **El patio dejaba de verse al alejar.** Las áreas entraban a zoom 17,5 y
      los edificios a 16: en esa vista y media se veían las huellas pero no el
      patio, y al alejarte desaparecía él solo. Un mapeo es una cosa; ahora
      entra entero al mismo umbral (`MAPPING_MIN_ZOOM`), y las áreas exteriores
      se ven en todas las plantas.
- [x] **La planta pasa a ser de la FACULTAD, no del edificio.** Atada al
      edificio bajo el centro del mapa, cruzar de uno a otro cambiaba de piso
      solo y el resto de la facultad seguía enseñando todos sus pisos
      superpuestos —con cuarenta salas mapeadas, cuarenta marcadores encimados—.
      Ahora `activeFacultyId` + `activeFloor`: el selector lista la unión de
      plantas de la facultad (`facultyLevels`), elegir el 2 enseña el segundo
      piso de los cuatro edificios, y el que no llega a esa planta se atenúa en
      vez de desaparecer. Un pin sin planta cuenta como planta baja. La regla
      vive en `shared/utils/floorVisibility.ts` con 8 pruebas.
- [x] **Un solo panel de contenido.** `PlaceLabel` —la tarjeta por edificio y
      por área— se elimina. Repartía los posts de una facultad entre cuatro
      fichas que casi siempre decían "Nada publicado aquí todavía". Área,
      edificio y perímetro abren ahora la misma ficha; lo que se tocó solo
      preselecciona un chip de lugar dentro de ella (`placeFocus`). La ficha
      gana esa fila de chips con su contador, y cada tarjeta dice en qué
      edificio y piso cae.
- [x] **La grilla ya no se recorta.** La ficha anidaba un `overflow-y-auto`
      dentro del que ya trae la hoja, así que la última fila de tarjetas se
      cortaba contra un alto que no era el que se desplazaba.
- [x] **El editor enseña lo mismo que el mapa.** `/admin/mapeo` pintaba el
      perímetro relleno y las huellas al 0,1: se dibujaba contra una referencia
      que después no existía. Mismas opacidades en los dos.
- [x] **La altura 3D sale del valor asignado.** Había un 12 fijo para todos, de
      donde venía que en 3D todos los edificios salieran igual de altos. Ahora
      manda `buildings.height_m`, lo que se escribe en `/admin/mapeo`.

**Cuarta pasada, afinando** (sin migración):

- [x] **La altura 3D vale 0 por defecto y entonces no se genera nada.** En la
      pasada anterior, sin altura asignada se deducía una de las plantas
      definidas. Estaba mal planteado: casi todos los edificios del campus YA
      están en OpenStreetMap con su altura y el estilo del mapa los levanta
      solo, así que generarles encima un volumen propio dibuja dos veces el
      mismo edificio. La altura se rellena **solo para los que le faltan a OSM**;
      hasta entonces es 0 y `mapping-buildings-3d` los descarta por filtro. El
      formulario enseña 0 y guarda `null`, porque `buildings_height_m_check` no
      admite el 0 y las dos cosas significan lo mismo — sin esa traducción,
      guardar reventaba con un `23514`.
- [x] **El campo de descripción medía media pantalla.** Seis filas y 132 px de
      alto mínimo para un texto que casi siempre son dos líneas. Tres filas y
      84 px, y sigue estirable a mano.
- [x] **El piso al publicar aparece siempre.** El selector solo salía si el
      punto caía dentro de la huella de un edificio con dos o más plantas, o
      sea: nunca en el patio, nunca en un edificio de una planta, nunca entre
      dos. Ahora ofrece las plantas de la FACULTAD más un chip **Exterior**
      (que es `floor` null, para patio y calle), con la planta que se estaba
      mirando en el mapa ya elegida y editable. Automático y manual a la vez.
      **Cerrado de verdad el 2026-08-05.** Estaba marcado como hecho pero solo
      lo estaba a medias: `facultyLevels()` existía y lo consumía únicamente el
      selector del mapa, mientras `IndoorFields` seguía usando las plantas del
      edificio y devolvía `null` fuera de toda huella. Publicar desde el panel
      de una facultad deja el punto en su centroide, casi siempre patio, así
      que el formulario salía sin ningún selector de planta.
- [x] **El selector de plantas del mapa ocupaba el doble de lo necesario.**
      Columna de ancho fijo y la sigla de la facultad en la cabecera —**FIC**,
      no "FACULTAD D…"— vía `facultyShortName()`, que arma el acrónimo
      saltándose las palabras vacías en vez de pedir un campo más en los datos.

### Fase 4 — Densidad

Repriorizada el 2026-08-05 (ver §9.2 y §9.3). El orden de abajo es el nuevo.

- [ ] **Abanico para colisiones a menos de 30 px.** Sigue siendo lo primero: es
      el único punto que ataca el solape a zoom alto, que es el problema que
      existe hoy. **Se intentó el 2026-08-26 y se retiró**: colapsar el grupo en
      un marcador con el número encima y abrirlo al tocarlo se veía mal en el
      mapa real —el pin "cabeza" tapaba a los otros y el número competía con la
      insignia de planta, que vive en la misma esquina—. La lógica de
      agrupación por distancia en pantalla funcionaba y estaba probada; lo que
      no funciona es esa presentación. Cuando se retome, el problema a resolver
      es **cómo se ve un grupo**, no cómo se calcula.
- [x] Estilo diferenciado de pines permanentes vs efímeros: **solo tamaño**,
      nunca tono (§9.2). Hecho el 2026-08-26. Dos cosas que salieron al
      probarlo en pantalla y que conviene no volver a descubrir:
      - **22 px, no 18.** Los 18 px del plan dejaban el icono ilegible dentro
        del círculo, y multiplicados por la escala de zoom daban pines de 14 px
        imposibles de tocar.
      - **Qué cuenta como "fijo" lo dice el catálogo**, no una regla derivada.
        "Permanente" no sirve —las facultades también lo son— y "permanente y
        con categoría" tampoco: en la base las facultades están sembradas con la
        categoría `entrada`, así que caían dentro igual y el mapa se quedaba
        sin sus anclas. Ahora es una lista explícita en `campusData`
        (`isFixedInfraCategory`): sala, ascensor, rampa y escalera.
- [x] `--pin-scale` según zoom. Hecho el 2026-08-26, con una corrección sobre
      la §9.3: **nunca baja de 1.** Encoger a 20 px por debajo de zoom 18 se vio
      en el mapa y quedó mal — de lejos el problema no es que los pines sobren
      de tamaño, es que sobran de número, y eso lo arregla el detalle por zoom.
      Así que crece de cerca (hasta 30 px a zoom 19) y no encoge de lejos.
- [ ] Detalle por zoom: facultad → edificio → pin, con transiciones. Pospuesto
      hasta que haya más edificios mapeados: resuelve el amontonamiento de
      lejos, que todavía no duele, y sin datos indoor no luce.
- [x] **Chips de edificio y planta en `FacultyDetail`, sincronizados con el mapa.**
      Entregado con la reestructuración del panel de posts: la planta es un solo
      dato en `uiStore`, así que el chip de la ficha y el selector vertical del
      mapa son dos vistas de lo mismo y se mueven juntos.

**Verificación:** con la FIC mapeada y sus salas cargadas, la vista de campus muestra 4-5 marcadores.

### Fase 5 — Onboarding y limpieza de mensajes (2 días)

- [ ] Orquestador en `uiStore`; `TutorialModal` → carrusel de 3 slides.
- [ ] `src/features/onboarding/` con `TourOverlay` y `tours.ts`.
- [ ] Tour del mapa y tour de facultad; submenú en el sidebar.
- [x] Migrar a i18n los mensajes clavados de la §1.6. Hecho el 2026-08-26.

### Fase 6 — La ficha de facultad ✅ HECHA (2026-08-05)

- [x] **Los lugares volvieron al feed.** Estaban excluidos con un `p.type !==
      'place'` en `FacultyDetail`, así que los lugares que añade la
      administración —y los reportes que ascienden a lugar al verificarse—
      desaparecían de la ficha justo al volverse permanentes.
- [x] **Tres secciones apiladas** en vez de una lista: Ahora (reportes, por
      recencia o por confirmaciones), Próximo (eventos, por fecha de inicio, los
      que están en curso arriba) y En este lugar (lugares, alfabético). Los tres
      tipos no comparten noción de tiempo, así que no hay un orden único que
      sirva para todos; el orden de los bloques es lo que explica la diferencia.
- [x] **Acento de color por tipo**, porque en rojo UDP los tres se veían igual.
- [x] **Galería por entidad** (`place_photos`): la facultad tiene la suya y cada
      edificio la suya, y acotar por un chip de edificio cambia la portada. Sin
      herencia: enseñar la fachada de la facultad como si fuera la del edificio
      sería una foto que miente. Gestor de fotos para admin, con RLS que lo
      impone en la base.
- [x] **El carrusel salió de `PinDetail`** a `shared/ui/PhotoCarousel.tsx` y
      ahora lo comparten la ficha de pin y la de facultad. De paso arregla un
      bug latente: buscaba su contenedor de scroll por `getElementById`, así que
      con dos carruseles montados las flechas de uno movían el otro.
- [x] **Tercer punto de anclaje** en la hoja (`peekRatio`, opcional para no
      cambiarle el gesto a `PinDetail`) y portada que se pliega al expandir.

### Fase 7 — Facultades desde el editor ✅ HECHA (2026-08-08, alcance B)

Se hizo la **B** directamente. La A —solo perímetros— habría dejado el trabajo a
medias y habría obligado a volver a pasar por aquí.

Lo que la bloqueaba era que el cliente **nunca consultaba la tabla `faculties`**:
las facultades salían de `FACULTIES`, un array estático de `campusData.ts` del
que dependen 26 archivos, así que una facultad creada en el editor se guardaba
bien y era invisible para todos.

- [x] **`FACULTIES` pasa a ser una caché de módulo sembrada con el array de
      siempre** (`shared/data/facultyStore.ts`), rehidratada desde la base al
      arrancar. Mismo patrón que `mappingCache.publishMapping`. Los 26 archivos
      siguen llamando `FACULTIES.find(...)` igual que antes y no hay estados de
      carga que propagar, porque la lista nunca está vacía: si la consulta
      falla, la app enseña el catálogo de siempre. Se reemplaza **en el sitio**
      con `splice` y no reasignando, porque esos 26 archivos guardan la
      referencia.
- [x] **`useFaculties()`** para lo que sí tiene que repintar cuando llegue la
      lista: sidebar, búsqueda del mapa, filtros, foro, perfil y el editor.
- [x] **Crear y editar facultades desde `/admin/mapeo`**: nombre, nombre en
      inglés, campus, imagen de respaldo y perímetro. La chincheta sale del
      **centroide del perímetro**, no de dos campos de coordenadas al lado del
      polígono que un día acabarían diciendo cosas distintas.
- [x] **`facultyIdAt()` y los contornos leen los perímetros vivos.**
      `facultyPerimeters.ts` **se borró**: la geometría vive solo en la base y
      `seed.sql` ya no la siembra. De paso desaparece el ciclo de importación
      que ese archivo tenía con `campusData`. `facultyLayers` sincroniza capas
      en vez de solo añadirlas: redibujar un perímetro tenía que quitar la capa
      del trazo viejo, no dejarla encima.
- [x] **Editar una forma ya guardada** arrastrando sus vértices, con el botón
      "Editar forma". Vale igual para un área, la huella de un edificio y el
      perímetro de una facultad: siembra el borrador con el anillo existente y
      reutiliza la maquinaria de trazado que ya había.
- [x] **La altura 3D se previsualiza en el editor.** Era el único dato que no se
      podía comprobar sin guardar, ir al mapa y volver. El volumen sigue al
      campo mientras se escribe —también en un edificio que todavía no existe— y
      un botón 2D/3D inclina la cámara, porque desde arriba un volumen es su
      propia huella y parecía que no funcionaba. La regla de altura
      (`buildingHeightM`) se mudó a `mapping/areaStyles.ts` para que el mapa y
      la vista previa no puedan discrepar.
- [x] **Modo demo**, contra el mismo almacén en memoria que el resto.

**Dos cosas que el plan de arriba no había visto**, y que salieron al verificar:

- [x] **La base mentía.** `biblioteca` y `ciencias-sociales` tenían las dos el
      mismo polígono grande, de una versión vieja en la que compartían manzana,
      y `postgrado-derecho` tenía un cuadrado inventado que el generador del
      seed producía a partir de la huella aproximada. Cambiar de fuente sin
      arreglarlo habría movido el mapa solo. La migración
      `20260808000001_faculties_source_of_truth.sql` vuelca los perímetros
      reales y deja en null los que no están trazados; el generador ya no
      inventa cuadrados.
- [x] **El mapa se contradecía consigo mismo.** El repintado de contornos se
      descartaba si `isStyleLoaded()` daba false, y MapLibre sigue devolviendo
      false un rato DESPUÉS de `style.load`: en una carga en frío el aviso se
      perdía y el mapa se quedaba con la semilla, mientras que al volver desde
      otra pestaña se remontaba y sí leía la base. Ahora se encola.
- [x] **El catálogo y los perímetros eran dos contenedores.** El editor llegó a
      enseñar el nombre nuevo de una facultad junto a un "sin trazar" que ya no
      era cierto. Todo se deriva de `FACULTIES`, así que no pueden discrepar.
- [x] **El selector de facultad del perfil filtra por `CAREERS`,** que es
      estático, así que una facultad nueva no habría aparecido ahí — justo uno
      de los puntos que la B prometía. Ahora el filtro se aplica solo al
      catálogo de siempre (`academicFaculties()`): "sin carreras" significa "no
      es un sitio donde se estudie" para la Biblioteca, pero "todavía no se le
      cargaron" para una recién creada.

**Lo que queda fuera a propósito:** borrar una facultad con vida encima. `pins`,
`forum_threads` y `profiles` la referencian sin cascada, así que el botón solo
aparece cuando está vacía de edificios, áreas y pines. Es para deshacer una
recién creada por error, no para retirar una de verdad; retirar una de verdad es
un problema de migración de datos y no de un botón.

### Backlog

Heredado del antiguo `SPRINTS_STATUS.md` y **reverificado contra el código el
2026-08-05**, porque arrastraba cosas que ya estaban hechas y otras que nadie
sabía qué eran.

**Seguridad**

- [x] **Lectura pública de `event_rsvps`** (SEC-007). Cerrado el 2026-08-26
      (`20260826000200_event_rsvps_private.sql`), y no tapándolo: la política se
      borró y en su lugar quedaron las dos lecturas que sí tienen sentido —el
      conteo agregado para cualquiera (`event_rsvp_counts`) y la lista con
      nombres solo para quien organiza (`event_attendees`)—. Con eso sale
      también el punto 1 de la §13.1, que era el que más rendía de esa lista.
- [x] **Dependencias con vulnerabilidades altas.** Cerrado el 2026-08-26:
      `npm audit` da 0. `react-router` fue de 7.18.1 a 7.18.2 —un parche, no el
      salto de mayor que se temía— y el resto (`undici`, `postcss`,
      `brace-expansion`, `fast-uri`, `js-yaml`, `nanoid`) salió con
      `npm audit fix`, sin `--force` y sin cambios de comportamiento.
- [ ] **El rol `moderator` no está acotado por facultad** (§13.4). Ninguna
      política usa `profiles.faculty_id`, así que un moderador lo es de las
      diecisiete facultades. Si el rol lo van a llevar los centros de alumnos,
      esto hay que cerrarlo antes de repartirlo.
- [x] **"Mover un pin de sitio" solo se comprueba en la interfaz.** Cerrado el
      2026-08-26 con el trigger `trg_authorize_pin_move`
      (`20260826000100_pin_move_server_authorization.sql`). Era el último
      permiso del proyecto en esa situación. El alcance real era más chico de lo
      que decía esta línea —`pins_owner_update` limita a los pines propios, así
      que no se podían reubicar los ajenos— pero un estudiante sí podía
      arrastrar el suyo a otra manzana con un `PATCH`, porque
      `protect_pin_sensitive_fields` protege `building_id` y `area_id` y no
      `lat`/`lng`. El trigger va aparte y no dentro de esa función por el orden
      alfabético de los `BEFORE`, y exime a `service_role` a propósito: el
      razonamiento entero está en `docs/DATABASE.md` §4.
- [ ] Repaso de RLS y funciones que queden sin endurecer.

**Funcionalidad**

- [ ] Búsqueda de texto completo y filtro por tags en el foro. Comprobado que no
      existe: ni `tsvector` en la base ni filtro en la interfaz.
- [ ] **Cargar las salas como pines** (bloquea §13.3 y "Salas libres" de §14).
      **El importador ya está** (2026-08-26): `/admin/mapeo` lee el `data.json`
      de la FIC y, con un edificio seleccionado, enseña sus salas marcando
      cuáles ya tienen pin. Al elegir una que falta, el siguiente clic en el
      mapa la crea con el código y la planta puestos. Lo que queda es el
      trabajo humano: **pasar por los edificios poniendo los puntos**, que es lo
      único que la fuente no puede dar — un alta masiva las apilaría en el
      centroide y además la rechazaría `prevent_occupied_pin_location`.
      Empezar por `E441` (23 salas). Antes hay que declarar sus plantas en el
      mismo editor, o `trg_validate_pin_floor` rechaza el `INSERT`; el
      importador avisa de las que faltan.
      **El catálogo se volvió a derivar el 2026-08-26 y creció: 82 salas en 11
      edificios**, no las 61 de agosto. Está en `docs/SALAS.md` §5.1, con tres
      rarezas nuevas que conviene leer antes de mapear.
- [ ] **Confirmar tres direcciones en terreno** (`docs/SALAS.md` §4). Si
      `E278A/B` son de Ciencias Sociales o salas comunes, el número por Ejército
      de la Biblioteca Nicanor Parra, y si Ejército 219 y 141 tienen salas
      docentes. Es ir a mirar la placa de la puerta. `E306` ya está resuelto:
      es la Facultad de Comercio.
- [x] **Decidir si la sala se dibuja como área o como pin.** Cerrado el
      2026-08-10 (`docs/SALAS.md` §12): **la sala se ve y se usa como un pin, el
      mismo front**, y el área es solo la geometría que un moderador dibuja
      encima después. El estudiante propone la sala con un pin, gana karma al
      verificarse, y el trazo queda como curaduría.
- [ ] **Flujo de sugerencia de sala** (`docs/SALAS.md` §12.5). Aviso antes de
      publicar, entrada a la cola de administración, plazo de gracia y botón que
      resuelve la sugerencia entera. Depende de §13.2.
- [ ] **Preguntar a la EIT quién mantiene `data.json`** y con qué periodicidad
      se republica (`docs/SALAS.md` §1). No es un trámite: de la respuesta
      depende si se puede leer en producción o si conviene pedir algo más
      estable. Los autores de `salas-vacias` tienen el contacto.
- [ ] **Atribución oficial dinámica por facultad/CEE** (§13.4). Ya con alcance:
      hay tres nombres clavados —dos de ellos contradictorios— y la base asume
      que todo moderador es del Centro de Alumnos de Ingeniería. Va junto con el
      alcance por facultad, porque necesita saber de qué facultad es quien firma.
- [x] **Renombrar `computacion` a "Sala de computación"** (`docs/SALAS.md`
      §12.6). Hecho el 2026-08-26 en la misma migración que `escalera`. Mismo
      id, mismo SVG, mismo color: solo `name` y `name_en`, en la base, el seed y
      `campusData.ts`. "Computación" nombra una materia; lo que se marca es un
      recinto.
- [x] **Categoría `escalera`** (§4.1). Creada el 2026-08-26. Es la que dice por
      dónde no se puede pasar: sin ella el ruteo accesible no distinguía "no hay
      ascensor" de "nadie lo mapeó". Queda a medias hasta la §4.2: una escalera
      que sube del 1 al 5 hoy se ve en una sola planta.
- [ ] **Rango de plantas para ascensores y escaleras** (§4.2). Hoy un ascensor
      del −1 al 5 solo se ve en una planta. Una columna `floor_to` y
      `pinVisibleOnFloor` comprobando el rango.
- [ ] **Solapes que el editor no comprueba** (§6.5). Hoy se puede trazar un
      edificio encima de otro, o un patio encima de un edificio, sin un solo
      aviso. Y cuando existan las salas, el solape entre dos de ellas tiene que
      ser error, no aviso.
- [ ] Moderación con IA: Edge Function con proveedor principal y respaldo,
      evaluación de falsos positivos y cola administrativa.
- [ ] Pruebas E2E con Playwright. Comprobado que no hay ningún rastro en el
      repositorio.

**Ya estaba hecho, y el backlog viejo decía que no**

- [x] **Rate limit de 10 pines por día UTC.** La migración
      `20260721000001_pin_daily_limit.sql` está en `supabase/_archive/migrations/`
      —o sea, aplicada en producción— y `create_pin_with_daily_limit` está en el
      baseline. Figuraba como "preparado, falta validar" desde julio.

**Retirados**

"Accesibilidad AA final" y "Guía formal de despliegue en producción" salen de la
lista. No eran tareas: no tenían definición de terminado y nadie sabía qué
faltaba exactamente para darlas por cerradas. Un pendiente que nadie entiende no
se hace nunca y solo ensucia el resto. Si algún día importan, se escriben con un
alcance concreto.

---

## 13. Lo que hay que rehacer, no parchear

Aparte de las fases. Son partes que existen y funcionan a medias, y que se
levantaron deprisa: el problema no es que les falte un arreglo, es que su diseño
no da más de sí. Ninguna bloquea nada hoy.

### 13.1 Los RSVP no llevan a ningún sitio

Verificado el 2026-08-05: `event_rsvps` solo se lee **para el usuario actual**
(`features/events/api.ts`), para saber si ya marcó. No hay conteo de asistentes,
no hay sección "mis eventos", y **quien creó el evento no se entera de nada**.
Marcar "Iré" guarda una fila y programa tu propio recordatorio; ahí termina.

En orden de lo que más rinde:

1. - [x] **Que el creador vea quién va.** Hecho el 2026-08-26. La tarjeta del
     evento enseña "N van · M interesados" a quien lo creó, y ese número abre la
     lista con nombres (`EventAttendeesDialog`). Sale de `event_attendees`, que
     comprueba en la base que quien pregunta sea el autor: no es un `if` de
     interfaz.
2. - [ ] **Sección "Mis eventos" en el perfil.** Hoy aprietas "Iré" y no cambia
     nada en pantalla. Que el evento aparezca en algún sitio tuyo es lo que hace
     que el botón se sienta como que hizo algo. Sigue pendiente.
3. - [x] **Conteo público, pero con umbral.** Hecho el 2026-08-26, con las dos
     salidas que proponía esta línea a la vez: se suma "interesados" y "voy" en
     una cifra **y** hay umbral (`RSVP_PUBLIC_THRESHOLD`, hoy 5). Por debajo no
     se enseña nada; a quien organiza se le enseña siempre, porque para preparar
     algo el 2 también sirve. El umbral vive en el cliente a propósito: la base
     devuelve el número exacto a cualquiera, así que esto es diseño y no
     privacidad.

**Esto resolvió de paso el SEC-007 del backlog**, que era el objetivo: la
política `using (true)` se borró y lo que quedó expuesto es el conteo agregado
en vez de las filas. Un problema de seguridad y una funcionalidad que salieron
con el mismo cambio. El detalle está en `docs/DATABASE.md`, sección "Quién va a
un evento no es público".

Lo que sigue abierto: **si "Me interesa" y "Iré" tienen que ser dos botones.**
Duplican la decisión. Ahora al menos "interesado" sirve para algo —engorda el
conteo público—, que era la única condición que esta línea les ponía para
justificarse, así que la pregunta se puede dejar dormida.

Y la idea que probablemente vale más que las tres: **avisar a la facultad cuando
se publica un evento oficial.** El evento de campus no falla porque se te
olvide, falla porque nunca te enteraste; el recordatorio ya existe para quien
marcó, y el hueco está en quien no sabe que el evento existe. La tubería está
puesta: hay notificaciones y hay facultad en el perfil. Acotarlo a **eventos
oficiales** para no provocar fatiga de notificaciones.

### 13.2 Notificaciones, panel de administración y cola de moderación

Los tres se levantaron deprisa y hay que **rehacerlos bien**, no seguir
remendándolos. Antes de tocar nada, decidir qué tiene que hacer cada uno; el
estado actual no sirve de especificación.

**Lo que administración necesita y no tiene** (anotado el 2026-08-10, a raíz del
flujo de salas de `docs/SALAS.md` §12.5):

- **Una cola de sugerencias pendientes.** Hoy un reporte que merece volverse
  permanente no aparece en ninguna lista: alguien tiene que toparse con él en el
  mapa. Con las salas eso deja de ser aceptable, porque el flujo entero depende
  de que el moderador se entere.
- **Aviso al moderador cuando entra una sugerencia.** Es el mismo hueco que la
  §10.5 punto 2, visto desde el otro lado: no hay notificaciones hacia el equipo,
  solo hacia el usuario.
- **Resolver la sugerencia sin salir del plano.** Acomodar el pin si quedó mal
  puesto, aceptar o rechazar **con motivo** —que le llega a quien la sugirió— y,
  al aceptar, trazar el área ahí mismo. Hoy eso son tres sitios distintos; por
  61 salas, 183 pantallas. El flujo entero está en `docs/SALAS.md` §12.5.
- ~~**Cerrar "mover un pin de sitio" en el servidor.**~~ **Hecho el 2026-08-26**
  (`trg_authorize_pin_move`). Era el último permiso que solo se comprobaba en la
  interfaz. Matiz sobre lo que decía esta línea: los pines **ajenos** nunca
  estuvieron expuestos —`pins_owner_update` exige `creator_id = auth.uid()`—;
  lo que estaba abierto era que el autor moviera el suyo.
- **Decidir si la cola es de moderador o de admin.** Hoy un moderador puede
  verificar una sala y dibujar su área, pero **no puede entrar al panel de
  administración**, que es donde estaría la cola. Está desarrollado en
  `docs/SALAS.md` §12.5. Ver también §13.4.
- **Distinguir "reporte que se queda reporte" de "reporte que se vuelve lugar".**
  El esquema ya lo hace (`type` pasa de `report` a `place` al verificar) pero la
  interfaz de administración no lo enseña, así que quien modera no sabe qué
  decisión está tomando.

#### Todo lo de administrar vive en el panel, y en ningún otro sitio

La regla que ordena el resto: **si es una herramienta de administración, está en
`/admin`.** Había piezas sueltas por la aplicación, y esa dispersión era la
razón de que nadie supiera qué existe.

**Recogidas el 2026-08-27**, con el rediseño del panel:

- **La cola de denuncias se mudó a `/admin/moderacion`.** Vivía en
  `/moderacion`, fuera del panel y dentro del `Layout` público — o sea con la
  barra de navegación de estudiante debajo de una pantalla que solo ve un
  administrador. El panel ni la mencionaba: su cifra de "reportes pendientes"
  era un número muerto que no llevaba a ninguna parte. La ruta vieja redirige y
  **conserva el `?report=`**, porque las notificaciones ya emitidas apuntan ahí
  y la función SQL que las crea sigue generándolo.
- **Los datos de una facultad salieron del editor** a `/admin/facultades`:
  nombre, nombre en inglés, campus e imagen. Corregir una tilde ya no exige
  abrir el editor de polígonos en un computador. La geometría **no** se toca
  ahí, y el formulario reenvía `polygon`, `lat` y `lng` tal cual — mandar
  `polygon: null` borraría un perímetro que no está en el repositorio.
- **Las secciones del panel son rutas**, no un `useState`. Antes no había
  enlace profundo, ni historial, ni "atrás": el panel entero era una sola URL.

El caso concreto, **cerrado el 2026-08-26**: el botón "Probar notificación"
estaba para todo el mundo, invitados incluidos, en una sección de
`shared/ui/Sidebar.tsx` sin ninguna comprobación de rol. Matiz: disparaba una
notificación **local** (`new Notification`), no una push, así que no filtraba
nada del servidor — era una herramienta de depuración enviada a todos los
usuarios, con sus textos clavados en español. Ya tenía casa
(`features/admin/PushTestPanel.tsx`), así que no hubo que construir nada: se
quitó.

Activar las notificaciones **no** se perdió con él. La pestaña de avisos del
mismo Sidebar monta `NotificationCenter`, que ya trae el interruptor de verdad
con todos sus estados —suscrito, denegado, no soportado, iOS sin instalar—. El
botón que se quitó era el duplicado inútil, no el bueno.

**Y destapó un bug que nadie estaba mirando.** Ese mismo trozo del Sidebar era
el único sitio que montaba `usePushSubscription` a nivel de aplicación, y el
comentario del hook decía que corría "app-wide vía el Sidebar siempre montado".
El Sidebar **no** está siempre montado: hace `if (!isOpen) return null`. O sea
que la resincronización al volver a primer plano —la que existe porque en iOS el
endpoint de push rota en silencio y solo la página puede avisar del nuevo— solo
corría mientras el panel estaba abierto. Se mudó a `App`, que sí está siempre
montado, y el comentario ahora dice la verdad.

#### El panel dejó de parecerse a otra aplicación ✅ (2026-08-27)

Era la queja de fondo: el panel se construyó aparte y quedó con su propio
dialecto. Tarjetas a `rounded-2xl` donde la app usa `rounded-3xl`, botones
cuadrados donde la app usa cápsulas, `<select>` nativos sin estilar habiendo un
`CustomSelect`, y **ninguna sección con título ni subtítulo** — algo que todas
las pantallas públicas tienen. Ahora comparte el lenguaje: `AdminScreen` pone la
cabecera canónica de `EventsPage`, y los estados vacíos, las píldoras de filtro
y las tarjetas son los mismos.

Tres cosas que salieron al medirlo en pantalla y que conviene no deshacer:

- **La tabla de usuarios se parte en tarjetas por debajo de `lg`, no de `md`.**
  A 768 px no cabe: la última columna —el selector de rol— quedaba recortada por
  el `overflow` de la tarjeta, o sea inalcanzable. Se probó.
- **`FilterPills` se alineó con las píldoras de Eventos** (cápsula, borde y fondo
  blanco cuando está inactiva) y subió a 44 px de alto. Antes eran objetivos
  táctiles de 29 px. Solo la usa el panel, así que el cambio no toca nada más.
- **Borrar un pin pide confirmación.** Antes bastaba un toque, mientras que
  cambiar un rol —bastante menos grave— sí preguntaba.

Y "Push Test" pasó a ser **Difusión**, que es lo que siempre fue: su botón manda
una notificación real al teléfono de todo el mundo. Ahora enseña a cuánta gente
va a llegar antes de escribir nada, tiene vista previa y pide confirmación; la
prueba de verdad —"¿me llega a mí?"— es un botón aparte que no molesta a nadie.

#### Un panel de moderador, aparte del de administración

Anotado el 2026-08-10. Hoy `/admin` es de admin y punto; un moderador no entra
(§13.4). Pero el moderador tiene trabajo que hacer —cola de sugerencias,
contenido denunciado de su facultad, verificar pines— y ese trabajo necesita una
pantalla.

Dos maneras, y conviene elegir antes de construir:

- **Un panel propio de moderador**, con lo suyo y nada más. Más claro, y encaja
  con el eje de §13.4.
- **El mismo panel, con secciones según el rol.** Menos código, pero es fácil
  que se filtre algo que no debía verse.

Lo que no sirve es lo de hoy: que el moderador tenga permisos y no tenga dónde
ejercerlos.

#### El panel tiene que funcionar en el teléfono. El editor de mapeo, no. ✅ (2026-08-27)

Dos casos que parecen el mismo y no lo son:

- **`/admin/mapeo` es de computador, y está bien que lo sea.** Trazar polígonos
  con el dedo no es un problema de diseño responsive, es una herramienta que
  pide ratón. No hay que "arreglarlo" para móvil.
- **El panel de administración sí funciona ya en el teléfono.** Revisar una
  denuncia o mirar quién se registró son gestos de lectura y de un toque.

  Lo que estaba roto no era "faltan estilos": `hidden sm:` se llevaba en móvil
  el branding, el nombre de quien miraba y las etiquetas de la navegación, y
  dejaba un "VOLVER AL MA…" cortado junto a dos iconos mudos. Peor: la barra de
  pestañas se desplazaba en horizontal pero Radix la recentraba en la activa, así
  que **al arrastrarla para alcanzar otra pestaña te la quitaba de debajo del
  dedo**. Era inutilizable, no incómoda.

  Ahora la identidad y el avatar no se esconden nunca, y las secciones se eligen
  con un botón que abre la lista —el mismo recurso que usa el Foro para sus
  canales bajo `lg:`—. La tabla de usuarios se convierte en tarjetas.

**Y el caso mezclado se resolvió:** los **datos** de una facultad —nombre,
nombre en inglés, campus e imagen— salieron del editor a `/admin/facultades`.
El nombre del centro de alumnos (§13.4) tendrá su sitio ahí cuando exista.

#### El centro de notificaciones

Se rehace con lo de arriba, y hay dos cosas concretas:

- ~~**Falta borrar.**~~ **Esto ya no es cierto** (comprobado el 2026-08-27):
  borrar una notificación suelta existe de punta a punta —papelera por fila en
  `NotificationCenter.tsx`, `useDeleteNotification`, `deleteNotification` y la
  política `notifications_delete_own`—. Lo que sigue faltando es **vaciar de
  golpe**: no hay equivalente de `markAllNotificationsRead` para el borrado, así
  que una lista larga se limpia de una en una. Y no hay confirmación ni deshacer:
  un toque destruye la notificación.
- **La presentación.** Es de lo más flojo de la aplicación visualmente —tipografía
  de 9 a 11 px casi entera, tres radios distintos en el mismo componente y ni una
  cadena por i18n—, y es además donde va a caer todo lo nuevo: el karma con su motivo (§10.5), la
  respuesta a una sugerencia de sala con su motivo (`docs/SALAS.md` §12.5) y los
  avisos hacia el equipo. Rehacerlo antes de colgarle esas tres cosas, no
  después.

### 13.3 Buscar dentro de una facultad, no solo facultades

Hoy el buscador solo encuentra facultades. La idea es que, **estando dentro de
una facultad**, sirva para encontrar lo que hay dentro: qué salas están libres
ahora y qué ramo se está dando en cada una.

Dependía de conseguir acceso al repositorio de salas y horarios de la
universidad, que era el mismo bloqueo que tenía "Salas libres" en la §14. El
modelo ya lo soporta: `pins.room_code` existe justamente para cruzar con ese
sistema. **Ese bloqueo se levantó el 2026-08-10** (ver §14 y `docs/SALAS.md`);
lo que ahora falta es que existan los pines de sala contra los que cruzar. Las
dos cosas siguen saliendo del mismo trabajo.

### 13.4 El moderador no tiene facultad, y debería

Levantado el 2026-08-10 al preguntarse qué separa de verdad a un moderador de un
administrador. La lista real está en `docs/DATABASE.md` §2, ya corregida — la que
había estaba incompleta.

**El eje actual es "contenido y mapa" contra "plataforma y personas".** El
moderador verifica pines, edita y borra contenido ajeno, y traza edificios,
plantas y áreas. El administrador maneja facultades, roles, denuncias, correos y
difusión push. Es un eje razonable y encaja con la idea de fondo: **moderador =
centro de alumnos u otra gente de confianza; administrador = quien trabaja en la
UDP y quien desarrolla el sistema.**

**Pero falta la pieza que hace que esa idea funcione: el alcance.**
`profiles.faculty_id` existe y **ninguna política lo usa**. Un moderador lo es de
**toda la universidad**: puede borrar un hilo de Derecho, verificar un pin de
Arquitectura, o borrar una planta de Medicina y llevarse sus áreas por cascada.
Nombrar al centro de alumnos de una facultad significa hoy darle poder sobre las
diecisiete.

Y hay dos permisos que quedan **al revés** de esa idea:

- **Subir la foto de una facultad es de admin** (`place_photos_admin`). O sea que
  el centro de alumnos no puede poner la foto de su propia facultad, que es
  justo lo que querría hacer.
- **Crear o editar una facultad es de admin** (`faculties_admin`). Esta sí tiene
  sentido donde está, pero conviene decirlo junto a la anterior para no
  confundirlas.

**Lo que habría que hacer, en orden:**

1. **Acotar al moderador por facultad** en las políticas de contenido y mapeo,
   contra `profiles.faculty_id`. Es el cambio grande y es de RLS, no de
   interfaz.
2. **Mover las galerías de facultad, edificio y área** al moderador de esa
   facultad. Es curaduría de contenido, que es su eje.
3. **Dejar el panel de administración solo para admin**, como está. Encaja con la
   idea, y la cola de sugerencias de salas entonces vive en `/admin/mapeo`
   —donde el moderador sí entra— y no en el panel (`docs/SALAS.md` §12.5).
4. **Decidir si hace falta un moderador sin facultad**, para quien coordine
   varias. Si hace falta, es un `faculty_id` nulo con significado de "todas", y
   más vale que sea explícito y no el estado por defecto de hoy.

Mientras el punto 1 no exista, **conviene ser conservador repartiendo el rol
`moderator`**: hoy no es "moderador de mi facultad", es "moderador de todo".

#### El nombre de la organización no es uno solo

Contrastado el 2026-08-10, y el sistema hoy da por hecho lo contrario.

Cada facultad organiza a sus estudiantes con **su propio nombre**: centro de
estudiantes, centro de alumnos, consejo, federación, y con siglas distintas
según la facultad. No hay un "el Centro de Alumnos UDP" que valga para las
diecisiete. Y cuando un moderador publica algo como entidad oficial o verifica
un pin, **lo que se enseña es ese nombre** — así que acertarlo no es un detalle
cosmético: es lo que hace que la atribución sea creíble.

Hoy hay **tres cadenas clavadas, y dos se contradicen**:

| Dónde | Qué dice |
|---|---|
| `verify_and_make_permanent`, valor por defecto del parámetro | `'Centro de Alumnos FIC'` |
| La misma función, respaldo si llega vacío | `'Centro de Alumnos UDP'` |
| `CreateThreadModal.tsx:62` y `:174` | `role === 'moderator' ? 'Centro de Alumnos FIC' : 'Administración UDP'` |

O sea: **la base asume que todo moderador es del Centro de Alumnos de
Ingeniería**, y el cliente lo repite. Un moderador de Psicología que verifique
un pin lo firma hoy como FIC. Además esas cadenas están en español dentro del
código, sin pasar por i18n, contra la regla de la §10.1.

Esto es la parte concreta y hacedora de "atribución oficial dinámica por
facultad/CEE", que estaba en el backlog como una línea sin alcance:

1. **El nombre de la organización es un dato de la facultad**, no una constante.
   Una columna en `faculties` —`student_org_name`— con el nombre tal como se
   llama cada una.
2. **Al verificar o publicar como oficial, el nombre sale de ahí**, de la
   facultad del moderador. Sin valor por defecto clavado: si la facultad no lo
   tiene cargado, no se firma con un nombre inventado.
3. **Quitar las tres cadenas** de la base y del cliente.

Ojo con el orden: el punto 2 necesita saber **de qué facultad es el moderador**,
que es justo lo que hoy no existe (el alcance de arriba). Los dos cambios son el
mismo trabajo y conviene hacerlos juntos.

### 13.5 La barra lateral: de lista de facultades a índice del campus

Idea del 2026-08-10. Hoy `Sidebar.tsx` enseña las facultades agrupadas por campus
y, al tocar una, vuela el mapa hasta ella. Es un buscador, y funciona.

Lo que podría ser: **que cada facultad se despliegue y muestre sus edificios**,
cada uno con su nombre y su foto. Así la barra deja de ser una lista de nombres y
pasa a ser el índice visual del campus — que es la forma natural de encontrar
algo cuando no sabes cómo se llama, que es el caso de casi cualquier estudiante
nuevo.

Lo que hace falta ya existe casi todo: `buildings` con su nombre, y
`place_photos.building_id` para la galería. Lo que no existe es que la barra
consulte el mapeo — hoy solo lee el catálogo de facultades.

Dos cuidados:

- **Una facultad sin edificios mapeados no puede quedar rota.** Hoy solo la FIC
  tiene mapeo; las otras dieciséis se desplegarían vacías. O no se despliegan, o
  dicen algo útil.
- **Que no se vuelva una segunda ficha de facultad.** `FacultyDetail` ya existe y
  ya lista los posts. La barra es para llegar, no para quedarse.

---

## 14. Anotado para el futuro, fuera de fases

- **Salas libres.** Cruzar `room_code` con el repositorio de salas de la universidad para pintar en verde las que están libres ahora. El modelo ya lo soporta. **La fuente apareció el 2026-08-10** (`salas.docencia-eit.cl/data.json`, 799 bloques de la FIC, con `Access-Control-Allow-Origin: *`), así que ni siquiera hace falta la Edge Function que se había supuesto: se puede leer desde el navegador y cachear con `ETag`. Lo que queda no es acceso técnico sino acordarlo con quien la mantiene — y, antes de eso, **cargar las salas como pines**. Todo el levantamiento está en `docs/SALAS.md`.
- **Ruteo accesible fino** (§4): destino en la entrada o rampa accesible más cercana, y continuación por ascensor hasta la planta correcta.
- **Interior como imagen.** Si algún día consigues el plano de una planta en imagen, se puede poner bajo el mapa ajustando las cuatro esquinas y usarlo de calco para dibujar las áreas encima. `floor_plans.image_overlay` y `floor_plans.bounds` ya existen sin usar (`baseline.sql:196-208`), y MapLibre soporta un source `type: 'image'`.
- **Capacidad de sala**, para "busco una sala libre para 6 personas". Un campo más en el pin `sala` cuando haga falta.
- ~~Validación de plantas por edificio en servidor.~~ **Hecha el 2026-08-10**, ver §15.

---

## 15. Validación de plantas en servidor ✅ HECHA (2026-08-10)

Estaba en §14 como "anotado para el futuro" y no debía estarlo: no era una idea,
era un agujero abierto con un síntoma concreto.

**Lo que pasaba.** `pins.floor` era un `integer` suelto. La única comprobación
del servidor era `floor <> 0`, dentro de `create_pin_with_daily_limit`. Que la
planta existiera en el edificio lo garantizaba solo `IndoorFields.tsx`. Tres
caminos se saltaban eso: la RPC acepta cualquier `p_floor` y la clave anon viaja
en el bundle; `pins_owner_update` deja al autor cambiar `floor` con un `PATCH`
directo, porque `protect_pin_sensitive_fields` no lo protege a propósito; y el
SQL Editor escribe como `service_role` sin pasar por nada.

**Por qué importaba.** No es seguridad — nadie escala privilegios con esto. Es
que el pin se vuelve **invisible**: el selector solo ofrece los niveles de
`building_floors` y un pin se ve si su planta es la activa, así que una planta
que nadie declaró no tiene chip que la seleccione. El pin existe, gasta cupo
diario y no lo ve ni su autor. Es lo que pasó con los pines de prueba cargados a
mano en plantas −1 a −3.

**Lo que se hizo.** Trigger `trg_validate_pin_floor` (`BEFORE INSERT OR UPDATE`),
no un check dentro de la RPC: validar solo al crear no cerraba el camino del
`UPDATE`, y un trigger además cubre `service_role`. Tres casos, con las fronteras
razonadas en `docs/DATABASE.md`. En el cliente, `shared/utils/floorValidation.ts`
replica la regla para el modo demo, con una desviación deliberada: un edificio
que no está en el snapshot del mapeo no se juzga, porque el snapshot empieza
vacío y viene acotado a una facultad.

**Queda pendiente:** las filas que ya estaban mal no se corrigen solas. La
migración `20260810000000_pin_floor_server_validation.sql` trae al final la
consulta que las lista. Mientras una siga mal, editarla fallará — es correcto,
pero conviene saberlo.

