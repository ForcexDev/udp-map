# Plan de implementación — Mapeo interior, salas, pisos y onboarding

> Documento de trabajo. Última revisión: 2026-08-04.
> **Alcance:** el editor y el motor se construyen genéricos; **el mapeo de la FIC lo haces tú a mano**.
> No hace falta ningún dato de edificios para empezar a programar.

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
- El perímetro real de Ingeniería (`src/shared/data/facultyPerimeters.ts:12-33`) está en `lng -70.66157…-70.66053` / `lat -33.45238…-33.45313`.
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

### 1.6 Hay mensajes en español clavados en el código

`i18n` está montado (`shared/lib/i18n.ts`, es/en), pero varios avisos se saltan el sistema y salen siempre en español:

- `MapPage.tsx:99` — "Brújula bloqueada. Permite acceso a…"
- `MapPage.tsx:336` — "Debes activar la ubicación en tu dispositivo o navegador."
- `MapView.tsx:714` y `722` — "Estás fuera del área del mapa", "Debes activar la ubicación…"
- `TutorialModal.tsx` — casi todos los textos de las tarjetas.

Se limpia junto con el trabajo de mensajes de la §10.

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
3. **Una sola fuente, dos destinos.** Dibujas en el editor → se guarda en Supabase → el botón "Exportar" vuelca `buildings.ts` y `areas.ts` a `src/shared/data/` para versionarlos en git y alimentar el modo demo. Es el mismo papel que hoy cumple `facultyPerimeters.ts`.

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

Un pin de sala es infraestructura fija; uno de comida es una novedad. Que compitan visualmente igual es un error. Los pines permanentes verificados —salas, ascensores, rampas, baños— se dibujan **más pequeños y con menos peso**: 18 px, sin sombra fuerte, en un tono apagado, y con la etiqueta del código de sala al lado a zoom alto. Los avisos efímeros mantienen el marcador actual de 26 px con color saturado.

Así el interior de un edificio se lee como un plano —salas en gris con su número— con las novedades destacando encima, que es justamente el efecto de tu captura de referencia.

### 9.3 Remates

- **Abanico**: dos o más pines a menos de ~30 px se colapsan en un chip con el número y se abren en abanico al tocarlo.
- **Tamaño según zoom** con `--pin-scale`: 20 px a zoom 17, 26 px a 18, 30 px a 19+.

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

### 10.5 Transversales

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
- [x] **El selector de plantas del mapa ocupaba el doble de lo necesario.**
      Columna de ancho fijo y la sigla de la facultad en la cabecera —**FIC**,
      no "FACULTAD D…"— vía `facultyShortName()`, que arma el acrónimo
      saltándose las palabras vacías en vez de pedir un campo más en los datos.

### Fase 4 — Densidad (2-3 días)

- [ ] Detalle por zoom: facultad → edificio → pin, con transiciones.
- [ ] Estilo diferenciado de pines permanentes vs efímeros (§9.2).
- [ ] Abanico para colisiones a menos de 30 px; `--pin-scale` según zoom.
- [ ] Chips de edificio y planta en `FacultyDetail`, sincronizados con el mapa.

**Verificación:** con la FIC mapeada y sus salas cargadas, la vista de campus muestra 4-5 marcadores.

### Fase 5 — Onboarding y limpieza de mensajes (2 días)

- [ ] Orquestador en `uiStore`; `TutorialModal` → carrusel de 3 slides.
- [ ] `src/features/onboarding/` con `TourOverlay` y `tours.ts`.
- [ ] Tour del mapa y tour de facultad; submenú en el sidebar.
- [ ] Migrar a i18n los mensajes clavados de la §1.6.

---

## 13. Anotado para el futuro, fuera de fases

- **Salas libres.** Cruzar `room_code` con el repositorio de salas de la universidad, vía Edge Function que cachea horarios, para pintar en verde las que están libres ahora. El modelo ya lo soporta; falta el acceso a esa fuente.
- **Ruteo accesible fino** (§4): destino en la entrada o rampa accesible más cercana, y continuación por ascensor hasta la planta correcta.
- **Interior como imagen.** Si algún día consigues el plano de una planta en imagen, se puede poner bajo el mapa ajustando las cuatro esquinas y usarlo de calco para dibujar las áreas encima. `floor_plans.image_overlay` y `floor_plans.bounds` ya existen sin usar (`baseline.sql:196-208`), y MapLibre soporta un source `type: 'image'`.
- **Capacidad de sala**, para "busco una sala libre para 6 personas". Un campo más en el pin `sala` cuando haga falta.
