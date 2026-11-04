# Plan de implementación — Navegación interior "Cómo llegar" en UDP Map

> **Para quién es esto.** Para un agente (o persona) que va a implementar la
> navegación interior en el repositorio **`ForcexDev/udp-map`** y que **no tiene
> acceso al código del prototipo** donde se validó la idea. Todo lo necesario está
> en este documento: decisiones, modelo de datos, algoritmos con el código clave,
> fases con criterios de aceptación y los errores que ya costaron tiempo.
>
> El prototipo (PoC) se hizo en `NuggetNuclear/PoC-map` sobre el Edificio
> Vergara 432 de la Facultad de Ingeniería y Ciencias (FIC). Funcionó: rutas
> correctas, instrucciones legibles y animación fluida en móvil. Este plan lo lleva
> a la app real.

---

## 0. Antes de escribir una línea

1. **Lee `CLAUDE.md` de `udp-map` y el índice `docs/README.md`.** Mandan sobre este
   plan cuando choquen. Lo que más afecta a este trabajo:
   - Cambio de esquema = **migración nueva + `supabase/schema/baseline.sql` +
     `docs/referencia/base-de-datos.md`**, en el mismo commit.
   - Archivos o rutas nuevas → `docs/referencia/repositorio.md`.
   - Pendientes/decisiones → `docs/ROADMAP.md`. Comportamiento visible → `docs/CHANGELOG.md`.
   - Las migraciones se aplican **a mano** en el SQL Editor de Supabase. Avisa a
     quien te lo pidió de que tiene que aplicarla.
   - Antes de dar algo por terminado: `npm run typecheck && npx vitest run && npx eslint src`.
   - Toda función de datos cubre `supabase === null` (modo demo, `demoStore.ts`).
   - Textos de interfaz por i18n: `t('clave', 'respaldo')`. Comentarios en español,
     explicando el porqué.
   - **Nunca `Co-Authored-By` ni atribución a una IA** en commits ni PRs.
   - La planta visible es **contexto de facultad** (`shared/utils/floorVisibility.ts`);
     no reimplementes esa regla.
   - Lee `docs/referencia/salas.md` antes de tocar códigos de sala.
2. **Lee lo que ya existe** (sección 2). Hay un `WayfinderSheet` de tres pasos
   que este trabajo **extiende**, no reemplaza a ciegas.
3. **Haz las preguntas abiertas de la sección 10** a quien pidió el trabajo. Sin
   el plano real de al menos un piso, la fase 6 no se puede cerrar.

---

## 1. Qué se quiere

Que un estudiante busque una sala (p. ej. `V432.4.S413`) y la app le muestre
**cómo llegar hasta la puerta**, giro a giro:

- Desde la calle (o su ubicación) hasta la entrada correcta del edificio.
- Dentro: lobby, pasillos, escalera o ascensor, y el pasillo del piso de destino.
- Con instrucciones que nombran lo que la persona ve ("pasando la Sala 412 a tu
  derecha", "es la 2.ª puerta a tu izquierda").
- Con una **animación**: una figura recorre la ruta, la cámara la sigue y gira
  en cada maniobra, el selector de piso cambia solo al subir.
- Con un **modo sin escaleras** real (silla de ruedas, coche, lesión).
- Con una **microdirección** por sala: "Vergara 432 · Piso 4 · Pasillo central,
  lado sur — Saliendo de la escalera, a la derecha: 1.ª puerta a tu izquierda".
- Con los **pisos de un edificio separables en 3D** ("vista explotada") para
  entender dónde está cada cosa.

### Fuera de alcance (por ahora)

Posicionamiento en interiores (beacons, Wi-Fi). La persona avanza la animación o
la sigue; la app no sabe en qué pasillo está. Tampoco: horarios en vivo,
ocupación de salas, recalcular la ruta en tiempo real.

---

## 2. Lo que ya existe en `udp-map` (rama `main`)

| Pieza | Dónde | Qué aporta |
|---|---|---|
| `buildings` | tabla | `id` (= prefijo del código de sala, p. ej. `V432`), `faculty_id`, `footprint` (GeoJSON Polygon), `default_floor`, `height_m` |
| `building_floors` | tabla | `(building_id, level)`, `label`. **El nivel 0 no existe**: baja = 1, subterráneo = −1 |
| `areas` | tabla | Salas, halls, pasillos por planta: `building_id`, `floor`, `kind` (enum `area_kind`), `name`, `polygon`. Exterior = `building_id` y `floor` null. FK `(building_id, floor)` → `building_floors` |
| `pins.room_code` | columna | Código de sala libre (`V432.4.S413`). Es la llave natural entre un pin de sala y su nodo de navegación |
| `pins.building_id`, `pins.area_id`, `pins.floor` | columnas | Dónde está un pin interior |
| RLS de mapeo | baseline | Lectura pública; escritura con `public.has_capability('mapping')` |
| `parseRoomCode`, `floorFromRoomCode` | `src/shared/utils/roomCode.ts` | Parten `EDIFICIO.PISO.SALA` por los **dos primeros** puntos (la sala puede tener puntos: `E441.4.L.D`) |
| `useMapping()`, `buildingAt`, `areaAt`, `floorsOf`, `facultyLevels` | `src/features/mapping/useMapping.ts` | Datos de mapeo cacheados con react-query |
| `FloorSelector` | `src/features/map/FloorSelector.tsx` | Selector de planta de la **facultad** (unión de plantas de sus edificios) |
| `addMappingLayers`, `updateMappingData` | `src/features/map/mappingLayers.ts` | Pinta huellas y áreas; ya usa `fill-extrusion` para edificios |
| `getWalkingRoute(from, to, accessible)` | `src/features/map/routing.ts` | Ruta de **calle**: ORS (perfil `wheelchair` si accesible) → OSRM → línea recta |
| `WayfinderSheet` | `src/features/map/WayfinderSheet.tsx` | "Cómo llegar" de **tres pasos fijos** a partir de pines: 1) entrar por el pin `entrada`/`rampa` del edificio, 2) usar el pin `ascensor`/`escalera`, 3) destino. No tiene grafo ni giros |
| `uiStore` | `src/shared/stores/uiStore.ts` | `accessibleRoute`, `routeTarget`, `activeFloor`, `selectPin` |

**Regla de convivencia:** el `WayfinderSheet` actual queda como **respaldo**
cuando el edificio de destino no tiene grafo de navegación. Con grafo, se muestra
la navegación nueva. Nunca las dos a la vez.

---

## 3. Decisiones de diseño (y por qué)

Cada una salió de probar la alternativa en el PoC o de un error real.

1. **Grafo explícito de nodos y aristas, no inferido de los polígonos.** Inferir
   pasillos a partir de `areas` (esqueletos, visibilidad) es frágil y caro. Un
   grafo pequeño (~30 nodos por piso) es trivial de rutear y de testear, y el
   editor lo puede **generar** casi entero (decisión 5).
2. **El costo de la ruta se mide en segundos, no en metros.** En planta, la
   escalera mide 0 m y ganaría siempre; con tiempo, el ascensor gana cuando
   corresponde. Constantes del PoC: caminar 1,3 m/s; escalera 16 s/piso al subir
   y 11 s/piso al bajar; ascensor 40 s de espera + 4 s/piso. Con eso la escalera
   gana siempre hasta tres pisos, y al quinto decide la distancia: a una sala
   junto a la escalera se sube a pie y a una junto al ascensor, en ascensor.
3. **La espera del ascensor se paga una sola vez.** El estado del Dijkstra es
   `(nodo, dentro_del_ascensor)`. Sin eso, subir cuatro pisos costaría cuatro
   esperas y el ascensor nunca ganaría.
4. **La lógica trabaja en metros, en un plano local; lng/lat solo al pintar.**
   Ángulos, lados (izquierda/derecha) y distancias salen exactos y testeables sin
   mapa. Se proyecta cada edificio a un plano equirectangular centrado en su
   huella (sección 6.1).
5. **El pasillo se genera a partir de las puertas.** Por cada puerta que da al
   pasillo se crea un nodo de pasillo enfrente, y esos nodos se encadenan en
   orden a lo largo del eje. Quien mapea solo dibuja el eje del pasillo y marca
   las puertas. Así cada puerta queda naturalmente a la izquierda o a la derecha
   del recorrido.
6. **La geometría decide la maniobra y el grafo pone las referencias.** "Gira a
   la derecha" sale del ángulo entre tramos. "Pasando la Sala 412" sale de qué
   puertas cuelgan del nodo de pasillo por el que pasas. Dentro de un edificio no
   hay nombres de calle: lo que orienta son las cosas que se ven.
7. **El último giro no es "gira", es "llegaste".** "La Sala 413 está a tu
   izquierda, es la 2.ª puerta a tu izquierda" es la instrucción más útil de toda
   la ruta.
8. **La microdirección se deriva, no se escribe.** Es una ruta corta desde la
   escalera del piso, pasada por el mismo generador de instrucciones. Si alguien
   mueve una puerta en el editor, se corrige sola.
9. **Todo lo 3D es `fill-extrusion` con `base`/`height` por objeto.** Losa, muro,
   peldaño, cinta de ruta, figura. MapLibre no levanta otra cosa del suelo sin un
   renderer propio, y basta.
10. **Vista explotada = sumar un `gap` a la altura de cada planta.** Altura del
    piso `L` = `(L − 1) · (3,6 m + gap)`. Con `gap = 0` el edificio se ve como es.
11. **Las etiquetas en altura van en HTML, posicionadas con la matriz de MapLibre.**
    Las capas `symbol` siempre se dibujan a nivel de suelo: el nombre de una sala
    del piso 5 separado quedaría en la calle (sección 6.9).

---

## 4. Modelo de datos

### 4.1 Migración

Nombre sugerido: `supabase/migrations/<timestamp>_indoor_navigation.sql` (más su
`.down.sql`, como hacen las migraciones recientes del repositorio). Cópiala
también en `baseline.sql` y explícala en `docs/referencia/base-de-datos.md`.

```sql
-- Grafo de navegación interior. Un nodo es un punto donde la persona puede
-- estar o decidir; una arista, un tramo que se puede recorrer.
-- El exterior usa el mismo modelo que `areas`: building_id y floor null a la vez.

create type public.nav_node_kind as enum (
  'walk',      -- punto de pasillo, hall o lobby
  'door',      -- vano de puerta (de sala, de núcleo o de fachada)
  'room',      -- dentro de una sala: es el destino de una ruta
  'stairs',    -- descanso de escalera en una planta
  'elevator',  -- cabina de ascensor en una planta
  'entrance',  -- puerta de fachada: donde se empalma la ruta de calle
  'outdoor'    -- punto exterior (patio, vereda)
);

create type public.nav_edge_kind as enum ('walk', 'stairs', 'elevator');

create table if not exists public.nav_nodes (
  id           uuid         primary key default gen_random_uuid(),
  faculty_id   text         not null references public.faculties(id) on delete cascade,
  building_id  text         references public.buildings(id) on delete cascade,
  floor        integer,
  kind         public.nav_node_kind not null,
  lng          double precision not null,
  lat          double precision not null,
  -- Lo que la persona ve en este punto: "los torniquetes", "frente a los baños".
  -- Alimenta las instrucciones; nulo = punto sin referencia.
  landmark     text         check (landmark is null or char_length(landmark) <= 80),
  -- Solo exterior: por dónde se camina hasta aquí ("la vereda de Vergara").
  via          text         check (via is null or char_length(via) <= 80),
  -- Sala a la que pertenece un nodo `room` o `door`.
  area_id      uuid         references public.areas(id) on delete set null,
  -- Llave con pins.room_code. Normalizado en mayúsculas y sin espacios dobles.
  room_code    text         check (room_code is null or char_length(room_code) between 1 and 40),
  -- Agrupa los nodos de un mismo núcleo vertical ("ESC-A", "ASC-1") a través de
  -- las plantas. El editor genera las aristas verticales a partir de esto.
  shaft        text         check (shaft is null or char_length(shaft) <= 20),
  -- Ancho del vano, para dibujar la puerta y cortar el muro.
  width_m      numeric      check (width_m is null or (width_m > 0 and width_m <= 10)),
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),

  constraint nav_nodes_floor_coherent check (
    (building_id is null and floor is null) or
    (building_id is not null and floor is not null)
  ),
  constraint nav_nodes_floor_fkey foreign key (building_id, floor)
    references public.building_floors(building_id, level) on delete cascade,
  constraint nav_nodes_vertical_has_shaft check (
    kind not in ('stairs', 'elevator') or shaft is not null
  )
);

create table if not exists public.nav_edges (
  id          uuid     primary key default gen_random_uuid(),
  faculty_id  text     not null references public.faculties(id) on delete cascade,
  a           uuid     not null references public.nav_nodes(id) on delete cascade,
  b           uuid     not null references public.nav_nodes(id) on delete cascade,
  kind        public.nav_edge_kind not null default 'walk',
  -- false = no apta para silla de ruedas (escalones, torniquete sin pase ancho).
  -- Las de escalera son siempre false; el check lo impone.
  step_free   boolean  not null default true,
  constraint nav_edges_not_loop check (a <> b),
  constraint nav_edges_stairs_not_step_free check (kind <> 'stairs' or step_free = false)
);

-- Una arista no dirigida no se repite en ningún sentido.
create unique index if not exists nav_edges_pair_uniq
  on public.nav_edges (least(a, b), greatest(a, b));
create index if not exists nav_nodes_faculty_idx on public.nav_nodes (faculty_id);
create index if not exists nav_nodes_building_floor_idx on public.nav_nodes (building_id, floor);
create index if not exists nav_nodes_room_code_idx on public.nav_nodes (upper(room_code)) where room_code is not null;
create index if not exists nav_edges_faculty_idx on public.nav_edges (faculty_id);

alter table public.nav_nodes enable row level security;
alter table public.nav_edges enable row level security;

create policy nav_nodes_read on public.nav_nodes for select using (true);
create policy nav_nodes_write on public.nav_nodes for all
  using (public.has_capability('mapping')) with check (public.has_capability('mapping'));
create policy nav_edges_read on public.nav_edges for select using (true);
create policy nav_edges_write on public.nav_edges for all
  using (public.has_capability('mapping')) with check (public.has_capability('mapping'));

-- Mismo trigger de updated_at que buildings y areas (búscalo en el baseline y reúsalo).
```

Antes de escribirla, revisa en el baseline cómo están hechas exactamente las
políticas de `areas` y su trigger `updated_at`, y cópialas con el mismo estilo.
Comprueba también si hay un trigger que valide que `faculty_id` coincide con el
del edificio; si `areas` lo tiene, `nav_nodes` también debe tenerlo.

### 4.2 Por qué así

- **Nodos con `lng/lat` y no en metros locales:** la base no sabe de planos
  locales. El cliente proyecta al cargar (6.1).
- **`faculty_id` en las dos tablas:** el grafo se carga por facultad, que es la
  unidad de la app. Además, una facultad como la FIC tiene dos edificios
  (E441 y V432) unidos por un patio, y la ruta entre ellos pasa por nodos
  `outdoor`.
- **Las puertas son nodos, no una tabla aparte:** el PoC usaba puertas solo para
  dos cosas, el ruteo y cortar muros, y un nodo `door` con `width_m` cubre las
  dos.
- **Sin aristas verticales dibujadas a mano:** el editor las genera uniendo, en
  plantas consecutivas, los nodos que comparten `shaft` (5.4).

### 4.3 Tipos (`src/shared/types/database.ts`, a mano)

```ts
export type NavNodeKind = 'walk' | 'door' | 'room' | 'stairs' | 'elevator' | 'entrance' | 'outdoor'
export type NavEdgeKind = 'walk' | 'stairs' | 'elevator'

export interface NavNodeRow {
  id: string
  faculty_id: string
  building_id: string | null
  floor: number | null
  kind: NavNodeKind
  lng: number
  lat: number
  landmark: string | null
  via: string | null
  area_id: string | null
  room_code: string | null
  shaft: string | null
  width_m: number | null
}

export interface NavEdgeRow {
  id: string
  faculty_id: string
  a: string
  b: string
  kind: NavEdgeKind
  step_free: boolean
}
```

---

## 5. Arquitectura de código

### 5.1 Dónde vive cada cosa

```
src/shared/utils/indoor/          ← lógica pura: sin React, sin MapLibre, con tests
  types.ts                        Vec2, NavNode (en metros), NavEdge, Room, Route, Step
  projection.ts                   lng/lat ↔ metros locales; bearingOf; turnAngle
  graph.ts                        NavGraph: Dijkstra con costo en segundos
  instructions.ts                 ruta → pasos legibles
  microaddress.ts                 microdirección derivada
  track.ts                        ruta → línea de tiempo (pose en cada segundo)
  corridor.ts                     genera nodos/aristas de pasillo desde eje + puertas
  validate.ts                     conexidad, salas inalcanzables, núcleos cojos
  *.test.ts

src/features/wayfinding/          ← dominio nuevo, para no engordar map ↔ pins ↔ mapping
  api.ts                          fetchNavGraph(facultyId) — Supabase o demoStore
  demoStore.ts                    grafo de demostración (V432, ver anexo A)
  useNavGraph.ts                  react-query, clave ['navGraph', facultyId]
  resolveTarget.ts                pin → nodo destino (5.3)
  usePlayback.ts                  reloj de la animación: t, playing, speed, seek
  IndoorRouteSheet.tsx            la hoja de navegación (reemplaza al Wayfinder con grafo)
  indoorLayers.ts                 capas MapLibre: cinta de ruta, figura, postes verticales
  LabelOverlay.ts                 etiquetas HTML en altura (6.9)
  explodedView.ts                 losas y salas por planta con gap (fase 4)

src/features/mapping/             ← el editor (fase 5)
  NavEditorPanel.tsx              herramienta "Navegación" en /admin/mapeo
```

**Sobre las dependencias cruzadas:** `wayfinding` puede importar de `shared/` y
leer `useMapping` (como ya hace `WayfinderSheet`). No hagas que `mapping` importe
de `wayfinding`: la generación de pasillo y la validación viven en
`shared/utils/indoor/`, así el editor las usa sin crear otro ciclo.

### 5.2 Flujo de una ruta

```
pin destino ─► resolveTarget ─► nodo destino (room)
origen:  GPS/calle ─► getWalkingRoute(origen, entrada elegida) ─► tramo de calle
         o "estoy en…" ─► nodo de origen
NavGraph.route(origen, destino, { stepFree }) ─► Route
buildInstructions(route) ─► Step[]
buildTrack(route) ─► Track (t → pose)
usePlayback ─► t ─► pose ─► capas + cámara + selector de piso + paso actual
```

### 5.3 De un pin al nodo destino (`resolveTarget`)

En orden, y se queda con la primera que funcione:

1. `pin.room_code` normalizado (`trim`, mayúsculas, espacios colapsados) ==
   `nav_nodes.room_code` de un nodo `room`.
2. `pin.area_id` == `nav_nodes.area_id` de un nodo `room`.
3. **Ajuste al nodo más cercano:** entre los nodos `walk`/`room` de
   `pin.building_id` en `pin.floor`, el más cercano a `pin.lat/lng`. Así cualquier
   pin interior (un baño, una impresora) se vuelve ruteable sin mapearlo como sala.
4. Nada → no hay ruta interior: se muestra el `WayfinderSheet` de siempre.

### 5.4 Entrada y empalme con la calle

- Las candidatas son los nodos `entrance` de la facultad. Con `stepFree`, solo las
  que tengan al menos una arista `step_free` hacia dentro.
- MVP: la entrada que minimiza `distancia en línea recta desde el usuario / 1,3 +
  segundos de la ruta interior desde esa entrada`. Luego se llama a
  `getWalkingRoute(usuario, entrada, accessible)` **solo para la elegida**: ORS
  tiene cupo diario.
- La ruta de calle se pinta como hoy. La interior arranca en la entrada. En las
  instrucciones, el paso de calle se resume en uno solo ("Camina 240 m hasta la
  entrada de Vergara 432") y desde ahí empiezan los giros interiores.
- Sin ubicación: el selector "Desde" ofrece las entradas y algunos puntos útiles
  (lobby, patio). El PoC lo hacía así.

---

## 6. Algoritmos (con el código validado en el PoC)

### 6.1 Plano local y convención de signos

Por edificio, el origen es el centroide de la huella. Para la FIC, que tiene dos
edificios y patio, usa **un plano por facultad** (centroide de todos los nodos):
con distancias de cientos de metros el error equirectangular es despreciable.

```ts
const M_PER_DEG_LAT = 111_320
export function makeProjection(origin: { lng: number; lat: number }) {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180)
  return {
    // x = este, y = SUR (y hacia abajo, como la pantalla). Ver turnAngle.
    toLocal: (lng: number, lat: number) => ({
      x: (lng - origin.lng) * mPerDegLng,
      y: -(lat - origin.lat) * M_PER_DEG_LAT,
    }),
    toLngLat: (p: { x: number; y: number }): [number, number] => [
      origin.lng + p.x / mPerDegLng,
      origin.lat - p.y / M_PER_DEG_LAT,
    ],
  }
}

/** Rumbo geográfico (0 = norte, horario) de un vector local. Lo usa la cámara. */
export const bearingOf = (v: Vec2) => ((Math.atan2(v.x, -v.y) * 180) / Math.PI + 360) % 360

/**
 * Giro firmado de h1 a h2, en grados. POSITIVO = A LA DERECHA.
 * Con y hacia abajo, el producto cruz positivo es sentido horario, que para
 * quien camina es la derecha. Si cambias la convención de ejes, cambia el signo:
 * es el error más fácil de cometer aquí y da instrucciones al revés.
 */
export function turnAngle(h1: Vec2, h2: Vec2): number {
  const cross = h1.x * h2.y - h1.y * h2.x
  const dot = h1.x * h2.x + h1.y * h2.y
  return (Math.atan2(cross, dot) * 180) / Math.PI
}
```

Test de cordura obligatorio: si caminas hacia el este (1,0) y giras hacia el sur
(0,1), el resultado es **+90 (derecha)**.

> En el PoC el plano estaba girado para alinearse con la fachada (eje x a rumbo
> 76°). En producción no hace falta: los nodos vienen en lng/lat reales y basta
> el plano este/sur.

### 6.2 Dijkstra con estado de ascensor

```ts
export const WALK_SPEED = 1.3
export const STAIRS_UP_S = 16
export const STAIRS_DOWN_S = 11
export const ELEVATOR_WAIT_S = 40
export const ELEVATOR_PER_FLOOR_S = 4

route(fromId, toId, { stepFree }) {
  // Estado = `${nodeId}|${dentroDelAscensor ? 1 : 0}`
  // Cola de prioridad ingenua (ordenar el array): <500 nodos por facultad, no vale un heap.
  // Por cada arista (saltando las !step_free si stepFree):
  //   walk:     dist(a, b) / WALK_SPEED
  //   stairs:   |Δpiso| * (sube ? STAIRS_UP_S : STAIRS_DOWN_S)
  //   elevator: |Δpiso| * ELEVATOR_PER_FLOOR_S  + (no estaba dentro ? ELEVATOR_WAIT_S : 0)
  //   nuevo estado: dentroDelAscensor = (arista.kind === 'elevator')
  // Reconstruye nodos y el tipo de cada arista (kinds[i] entre nodes[i] y nodes[i+1]).
  // Devuelve { nodes, kinds, seconds, meters (solo tramos walk) } o null.
}
```

Las aristas son no dirigidas: al cargar, mételas en la adyacencia en los dos
sentidos.

### 6.3 Instrucciones

Entrada: `Route`, el grafo y las salas. Salida: `Step[]`, donde cada paso es
`{ icon, text, detail?, meters, level, from, to }` y `from`/`to` son índices en
`route.nodes` (sincronizan la animación).

**Preparación:** el mapa `doorsAt`. Para cada nodo de pasillo (`walk`), lista las
puertas (`door`) unidas a él por una arista y la sala de cada puerta (el nodo
`room` unido a esa puerta).

**Tramos:** parte `kinds` en tramos consecutivos del mismo tipo (`walk`,
`stairs`, `elevator`).

**Tramo vertical → un paso:**
- Escalera: "Sube por la escalera hasta el piso {N}" / "Baja…". Detalle:
  "{n} pisos · {2n} tramos con descanso".
- Ascensor: "Toma el ascensor y marca el {N}". Detalle: "Subes {n} pisos".
- Si el núcleo tiene `landmark` ("la escalera principal"), úsalo en el texto.

**Tramo a pie, nodo a nodo:**
1. Paso inicial `depart`:
   - Primer tramo de la ruta, en exterior: "Desde {landmark}, camina hacia el
     {cardinal}{ por {via}}". Cardinal = el más cercano de los 8 según `bearingOf`.
   - Primer tramo, en interior: "Sal desde {landmark}".
   - Después de un tramo vertical: "Sal de la escalera / del ascensor en el piso {N}".
2. Recorre `k = 1..n`. Suma la distancia al paso actual. En el nodo `here`, con
   `hIn = here − anterior`:
   - Por cada `{door, room}` de `doorsAt[here]` que **no** sea el próximo nodo de
     la ruta: `rel = turnAngle(hIn, door − here)`. Si `|rel| < 45` o `> 135`, la
     puerta está de frente o detrás y no se "pasa". Si no, el lado es
     `rel > 0 ? 'derecha' : 'izquierda'`. Se guarda en `sideDoors` (para contar
     puertas) y, salvo baños y núcleos, en `passes` ("la Sala 412 (a tu derecha)").
   - Si `here` es una puerta que la ruta cruza (no es la próxima ni un núcleo):
     `crosses.push(landmark)` ("la puerta principal", "los torniquetes").
   - Ángulo de salida `angle = turnAngle(hIn, siguiente − here)`. Con
     `|angle| < 30` se sigue derecho: no hay paso nuevo.
   - **Llegada:** si es el último tramo, el destino es una sala y lo que queda
     es `[puerta, sala]`, cierra el paso actual y emite `arrive`:
     "{Sala} está a tu {lado}". Detalle: "Es la {n}.ª puerta a tu {lado} desde
     el último giro · {código}", con `n` = puertas de `sideDoors` de ese lado + 1.
     Termina.
   - Si no, cierra el paso actual y abre uno de giro. Si lo que queda son ≤ 2
     nodos y el siguiente es una puerta (de núcleo): "{verbo} hacia {landmark}".
     Si no, y `here` tiene landmark: "{verbo} en {landmark}". Vacía `passes`,
     `crosses` y `sideDoors`.
3. **Cerrar un paso:** si mide > 0,4 m, el detalle es "Avanza {m} m{, cruzando
   X y Y}{, y pasando A y B}".
4. Al final del último tramo, si no hubo `arrive`: "Llegaste a {nombre}".
5. **Post-proceso:** dos giros seguidos con menos de 3 m entre ellos se dicen
   juntos: "Gira a la izquierda y enseguida a la derecha hacia la escalera".

**Verbos por ángulo:**

| `|angle|` | icono | texto |
|---|---|---|
| < 30 | straight | Sigue derecho |
| 30–60 | slight-left/right | Gira levemente a la {lado} |
| 60–150 | left/right | Gira a la {lado} |
| ≥ 150 | uturn | Da media vuelta |

**i18n:** todos los textos son plantillas con interpolación (`wayfinder.turn`,
`wayfinder.passing`, `wayfinder.arrive`…). Los nombres de sala y los landmarks
vienen de la base y no se traducen. Cuidado con el género: "la Sala", "el
Auditorio". En el PoC se resolvió poniendo el artículo en el landmark ("la
escalera principal"); para nombres de sala, guarda el artículo junto al nombre
o usa "{nombre}" sin artículo ("Sala 413 está a tu izquierda").

**Ejemplo real del PoC** (Paradero Vergara/Gorbea → V432.4.S413, por escalera):

```
[depart] Desde el paradero Vergara / esq. Gorbea, camina hacia el sur por la vereda de Vergara — Avanza 38 m
[left]   Gira a la izquierda en el número 432 de Vergara — Avanza 16 m, cruzando la puerta principal de Vergara 432 y los torniquetes
[left]   Gira a la izquierda en el lobby — Avanza 6 m
[right]  Gira a la derecha en el hall de ascensores — Avanza 7 m, pasando la Secretaría de Estudios (a tu izquierda)
[left]   Gira a la izquierda hacia la escalera principal — Avanza 2 m
[stairs] Sube por la escalera principal hasta el piso 4 — 3 pisos · 6 tramos con descanso
[depart] Sal de la escalera en el piso 4 — Avanza 2 m
[right]  Gira a la derecha en el pasillo, frente a la escalera — Avanza 9 m, pasando la Sala 412 (a tu derecha)
[arrive] Sala 413 está a tu izquierda — Es la 1.ª puerta a tu izquierda desde el último giro · V432.4.S413
```

### 6.4 Microdirección

```
línea 1: "{Edificio} · Piso {N} · {área de circulación}, {lado del pasillo}"
línea 2: ruta desde el nodo puerta-de-escalera del piso hasta la sala, SOLO si
         es toda a pie; toma el primer giro (izq/der) y el ordinal del `arrive`:
         "Saliendo de la escalera, a la derecha: 1.ª puerta a tu izquierda"
```

El lado del pasillo sale de qué lado del eje queda la puerta. Si el piso no tiene
escalera mapeada, solo se muestra la línea 1.

### 6.5 Generación de pasillo (`corridor.ts`, lo usa el editor)

Entrada: el eje del pasillo (polilínea) y las puertas de las salas que dan a él.
1. Proyecta cada puerta sobre el eje (punto más cercano de la polilínea).
2. Crea un nodo `walk` en cada proyección, más uno en cada vértice y en cada
   extremo del eje.
3. Ordena todos los nodos por distancia acumulada a lo largo del eje y únelos en
   cadena con aristas `walk`.
4. Une cada puerta con su nodo proyectado, y la puerta con el nodo `room` de su
   sala. El nodo `room` va **2,5 m hacia dentro desde la puerta**, no en el
   centroide: en un auditorio de 16 m, el centroide hace que la ruta parezca
   cruzarlo entero.
5. Los nodos del eje con proyecciones a < 0,3 m se fusionan.

### 6.6 Línea de tiempo (`track.ts`)

Keyframes `{ t, p, z, edge, still? }`, donde `z` es el **piso como número
continuo** (3,5 = a mitad entre el 3 y el 4).

- **Tramo a pie:** `t += dist / WALK_SPEED`, keyframe en el nodo final.
- **Escalera (por piso):** un recorrido en U dentro del hueco, repartiendo
  `STAIRS_UP_S` (o `DOWN`) entre sus puntos y subiendo `z` 0,5 por tramo:
  descanso → pie del tramo 1 → tope del tramo 1 (z + 0,5) → descanso intermedio
  → pie del tramo 2 → tope del tramo 2 (z + 1) → descanso del piso siguiente.
  Para bajar, el mismo recorrido al revés. En producción la geometría de la U
  sale del rectángulo del área `stairs` (los dos tramos son las dos mitades
  largas). Si no hay área, un segmento recto basta.
- **Ascensor:** 2,5 s de puertas, viaje (`|Δpiso| · 4 s`) con `z` suavizado
  (`f·f·(3−2f)`), 2,5 s de puertas, todo con `still: true`. **No animes la
  espera real** de 40 s: sería ver a la figura quieta.
- `nodeTimes[i]` = segundo en que se llega al nodo `i`. El paso activo es el
  último paso cuyo `nodeTimes[step.from] ≤ t`.
- `sample(t)` interpola entre keyframes y devuelve `{ p, z, heading, edge, still }`.
  El rumbo se conserva cuando el tramo mide ~0 m.

### 6.7 Animación y cámara

- **Bucle `requestAnimationFrame`:** `t += dt · velocidad`, con velocidades
  1×, 3× (por defecto) y 6×.
- **Piso activo = `Math.round(pose.z)`.** A mitad de escalera cambia al de
  destino, y el `FloorSelector` se mueve solo. Hazlo a través de
  `uiStore.setActiveFloor` para respetar la regla de planta de facultad.
- **Cámara que sigue** (`map.jumpTo` en cada frame):
  - `center`: la pose.
  - `elevation`: altura del piso + 0,8 m. Requiere `centerClampedToGround: false`
    (ver 6.10).
  - `bearing`: se suaviza hacia `bearingOf(heading)` con
    `b += Δ · min(1, dt·2,6)`, tomando Δ por el camino corto (±180).
  - **En escalera y ascensor la cámara no gira:** la U da dos medias vueltas por
    piso y la cámara giraría 360° en cuatro segundos. Ahí se aleja (zoom
    20 → 19,2, pitch 62 → 55) para que se vea el núcleo.
  - `padding` en cada llamada (6.10).
- **Si la persona arrastra el mapa, se deja de seguir** (`dragstart`). Un botón
  vuelve a activar el seguimiento.
- **Controles:** reproducir/pausar, paso anterior/siguiente, barra de avance,
  velocidad, seguir cámara y voz opcional (`speechSynthesis`, `lang 'es-CL'`).
  La voz lee el paso al entrar en él.
- **Al cambiar de paso,** la tarjeta del paso actual hace una animación breve
  (escala + color de acento).
- Un globo HTML sobre la figura muestra el texto del paso actual.
- Respeta `prefers-reduced-motion`: sin destello, cámara con `jumpTo` sin
  suavizado y velocidad 6× por defecto.

### 6.8 Capas 3D (fase 3 = mínimo; fase 4 = vista explotada completa)

`zMeters(z, gap) = (z − 1) · (3,6 + gap)`. Todas las capas son `fill-extrusion`
con `['get','base']`, `['get','height']` y `['get','color']`.

- **Cinta de ruta:** por cada arista `walk`, un rectángulo de 0,55 m de ancho
  (extendido 0,27 m en los extremos para que las esquinas no queden abiertas).
  `base = piso + 0,14`, `height = piso + 0,2`, rojo UDP.
- **Tramo vertical:** un **poste delgado** (círculo de 0,18 m) en el eje del
  núcleo, del piso de salida al de llegada. Una caja del tamaño del hueco
  tapaba la escalera justo cuando la cámara se acercaba.
- **Destino:** un cilindro de 0,5 m de radio y 2,4 m de alto, con un disco
  encima.
- **Figura:** halo plano (r 0,85), "nariz" triangular hacia el rumbo, cuerpo
  (r 0,3, 1,1 m) y cabeza (r 0,22). Se actualiza con `setData` en cada frame; es
  barato porque son cuatro polígonos.
- **Cabina del ascensor:** una losa amarilla que sube con la pose mientras dura
  el tramo de ascensor.
- **Vista explotada (fase 4):** una capa por planta (`indoor-floor-{L}`), para
  poder dar a cada una su `fill-extrusion-opacity` (no admite expresiones por
  objeto):
  - Losa de la huella de `-0,35` a `0`. **Desde el piso 2, con agujeros** en el
    hueco de escalera y de ascensor; si no, la losa de arriba tapa los peldaños
    y no se ve a la figura subir.
  - Suelo de cada área con su color (`areaColor` de `areaStyles.ts`), a +0,05 m.
  - Muros de las áreas cerradas (no los pasillos ni los halls): los bordes del
    polígono como rectángulos de 0,18 m y 1,3 m de alto, **cortados en los
    vanos de puerta** (los nodos `door` con `width_m`).
  - Peldaños: 10 por tramo, que suben hasta `piso + (3,6 + gap)` para cubrir el
    hueco cuando los pisos están separados.
  - Opacidad: piso activo 1. Los de abajo, 0,4 (0,22 navegando). Los de arriba,
    0,28 con separación y 0,05 navegando, para que no tapen.
  - `gap` animado 0 ↔ 7 m en 650 ms, con `setData` por frame (pocos cientos de
    objetos: va fluido en móvil).
  - Quita las extrusiones del mapa base **solo de los edificios mapeados** (o
    baja su opacidad). OSM también tiene una caja para V432 y tapa la nuestra.
    El PoC quitaba todas las `fill-extrusion` del estilo; en la app eso rompe el
    3D del resto del campus.
- **Mobiliario** (opcional, fase 7): pizarra y filas de mesas en las salas de
  clase, graderías en los auditorios, cubículos en los baños, torniquetes. Ayuda
  mucho a "leer" el plano, pero es decorativo: hazlo al final y que se derive del
  `kind` del área.

### 6.9 Etiquetas en altura (`LabelOverlay.ts`)

Una **capa custom de MapLibre que no pinta nada**: aprovecha la matriz que
recibe en cada frame para mover `<div>` sobre el canvas.

```ts
export class LabelOverlay implements CustomLayerInterface {
  id = 'indoor-labels'
  type = 'custom' as const
  renderingMode = '3d' as const
  // items: Map<id, { label, el: HTMLDivElement, m: MercatorCoordinate }>
  // m = maplibregl.MercatorCoordinate.fromLngLat(lngLat, alturaEnMetros)

  render(_gl, args: { defaultProjectionData: { mainMatrix: ArrayLike<number> } }) {
    const M = args.defaultProjectionData.mainMatrix // orden columna
    const w = canvas.clientWidth, h = canvas.clientHeight
    for (const { el, m, label } of items) {
      const cx = M[0]*m.x + M[4]*m.y + M[8]*m.z  + M[12]
      const cy = M[1]*m.x + M[5]*m.y + M[9]*m.z  + M[13]
      const cw = M[3]*m.x + M[7]*m.y + M[11]*m.z + M[15]
      if (cw <= 0) { el.style.display = 'none'; continue }   // detrás de la cámara
      const sx = ((cx / cw + 1) / 2) * w
      const sy = ((1 - cy / cw) / 2) * h
      const ay = label.anchor === 'bottom' ? 'calc(-100% - 6px)' : '-50%'
      el.style.display = ''
      el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, ${ay})`
    }
  }
}
```

- Contenedor `position:absolute; inset:0; pointer-events:none`. Solo las
  etiquetas clicables llevan `pointer-events:auto`.
- **No rehagas el `innerHTML` si el contenido no cambió.** Parpadea, como pasa
  con los marcadores (regla de `CLAUDE.md`).
- Qué se muestra: nombres de sala del piso activo, una pastilla "P1…P5" por
  planta (clicable, cambia de piso), "Destino" y "Partida", y el globo con el
  paso actual.
- Este método solo vale para la **proyección mercator**. Si algún día se activa
  el globo, hay que revisarlo.

### 6.10 Trampas de MapLibre (todas encontradas en el PoC, MapLibre 5.x)

1. **`centerClampedToGround: false`** en las opciones del mapa. Si no, la cámara
   se clava al suelo y no puede centrarse en un piso 5 separado a ~40 m.
   Comprueba que no rompe la vista normal de la app (no debería: sin `elevation`
   el centro queda a 0).
2. **`easeTo` ignora `elevation`; solo `jumpTo` la respeta.** Para un vuelo
   suave a una planta alta, anima la altura aparte:
   ```ts
   function easeCamera(opts, elevation, duration = 750) {
     const e0 = map.getCenterElevation()
     map.easeTo({ padding: camPadding(), ...opts, duration })
     const t0 = performance.now()
     const step = (now) => {
       const f = Math.min(1, (now - t0) / duration)
       map.setCenterElevation(e0 + (elevation - e0) * (f * f * (3 - 2 * f)))
       if (f < 1) requestAnimationFrame(step)
     }
     requestAnimationFrame(step)
   }
   ```
3. **No uses `map.setPadding()` para la hoja inferior.** Corta el `easeTo` en
   curso cada vez que la hoja cambia de alto. Pasa `padding` en cada
   `jumpTo`/`easeTo` (móvil: `bottom` = alto de la hoja; escritorio: `left` =
   ancho del panel).
4. **`fill-extrusion-opacity` es por capa, no por objeto.** Por eso hay una capa
   por planta.
5. **Las capas `symbol` no tienen altura.** Ver 6.9.
6. **`global-state` existe en MapLibre 5, pero cambiarlo en una propiedad
   data-driven obliga a rehacer el layout de la fuente.** Para animar el `gap`,
   `setData` con alturas ya calculadas fue más simple y fluido.
7. **La protección de redimensionamiento de `MapView` se conserva.** No añadas
   otro `ResizeObserver` que llame a `map.resize()`.

---

## 7. Interfaz

### 7.1 Ficha de sala (antes de navegar)

- Nombre, código (`V432.4.S413`) y microdirección en un recuadro destacado.
- "Desde" (selector: tu ubicación, entradas, lobby…) y un interruptor
  "♿ Sin escaleras" que sincroniza con `uiStore.accessibleRoute`.
- Botón principal "Cómo llegar".
- Si la sala es supuesta o el piso no tiene escalera mapeada, avísalo en una
  línea.

### 7.2 Hoja de navegación (`IndoorRouteSheet`)

- Cabecera: "Cómo llegar · {código}", resumen "2 min · 84 m caminando · por
  escalera" y botón cerrar.
- **Tarjeta del paso actual** (fondo oscuro): icono, texto grande, detalle y
  "Paso 3 de 9 · piso 1". Destella al cambiar de paso.
- Barra de avance (`<input type="range">` sobre `t`). Arrastrarla pausa la
  animación.
- Fila de controles: ⏮ ⏯ ⏭, velocidad, seguir cámara, voz.
- "Ver los N pasos": lista **plegada por defecto**, agrupada con separadores
  "PISO 1 · CALLE", "PISO 4". Tocar un paso salta a él. Si va desplegada, el
  paso actual se resalta y se hace scroll hasta él.
- Escritorio: panel a la izquierda (≈ 400 px). Móvil: hoja inferior de hasta
  ≈ 52 vh.
- Estilo: usa el del `WayfinderSheet` actual (bordes, colores, modo oscuro), no
  el del PoC.

### 7.3 Enlace directo

El PoC usaba `#V432.4.S413` para abrir la sala y `&ir` para empezar a navegar.
En la app, usa el sistema de rutas (`react-router-dom`), p. ej.
`/sala/V432.4.S413?ir=1`, y documéntalo en `docs/referencia/repositorio.md`.

---

## 8. Fases y criterios de aceptación

Cada fase es un PR que deja la app funcionando. Ninguna fase rompe el
`WayfinderSheet` actual.

### Fase 1 — Núcleo puro (`shared/utils/indoor/`)

Implementa 6.1–6.6 con sus tests. Usa como fixture el edificio del **anexo A**,
construido en metros directamente (sin base).

Tests que deben pasar (los 12 primeros existían en el PoC; los dos últimos son nuevos):
- Toda sala con código es alcanzable desde la calle.
- Con `stepFree`, la ruta nunca usa `stairs` y sí `elevator` para el piso 5.
- `route(1:ascensor → 5:ascensor) − route(1:ascensor → 2:ascensor) < 20 s`
  (la espera se paga una vez).
- Para subir dos pisos (patio → `V432.3.AU`) se prefiere la escalera.
- Paradero → S413: el primer paso contiene "paradero … hacia el sur por la
  vereda de Vergara", hay un `stairs-up` con "piso 4" y el último es
  `arrive` "Sala 413 está a tu izquierda".
- Paradero → S413 sin escaleras: el detalle final contiene "2.ª puerta a tu
  izquierda".
- Sin escaleras, aparece "pasando la Sala 414 (a tu izquierda) y la Sala 412
  (a tu derecha)".
- Patio → AU: hay un paso con "y enseguida a la derecha".
- Los `from` de los pasos son no decrecientes y `to < nodes.length`.
- Microdirección de S413: "Vergara 432 · Piso 4 · Pasillo central, lado sur" /
  "Saliendo de la escalera, a la derecha: 1.ª puerta a tu izquierda".
- La línea de tiempo de patio → AU tiene `z` monótono no decreciente, de 1 a 3.
- `nodeTimes.length === route.nodes.length`.
- `turnAngle((1,0),(0,1)) === 90`.
- `corridor.ts`: tres puertas a un lado del eje generan una cadena ordenada, y
  una puerta en cada lado se ve a lados opuestos desde el recorrido.

### Fase 2 — Datos

- Migración (4.1) + `.down.sql` + baseline + `docs/referencia/base-de-datos.md`.
- Tipos en `database.ts`.
- `features/wayfinding/api.ts`: `fetchNavGraph(facultyId)` →
  `{ nodes, edges }`, con dos `select` filtrados por `faculty_id`. Con
  `supabase === null`, sale del `demoStore`.
- `demoStore.ts`: el grafo del anexo A **convertido a lng/lat**, colgado de la
  facultad `ingenieria` y del edificio `V432` del demo de mapeo. Si ese demo no
  tiene `V432` con sus plantas 1–5, añádelos ahí.
- `useNavGraph(facultyId)`.
- **Aceptación:** en modo demo, la consola de pruebas puede rutear paradero →
  S413. Avisar de que la migración hay que aplicarla a mano.

### Fase 3 — Navegación en el mapa (MVP visible)

- `resolveTarget` (5.3) y la elección de entrada (5.4).
- `IndoorRouteSheet` (7.2) cuando hay grafo; `WayfinderSheet` cuando no.
- Capas mínimas: cinta, poste vertical, destino, figura y cabina (6.8, sin vista
  explotada). Las cintas de los pisos que no son el activo, al 30 %.
- `usePlayback`, cámara (6.7) y selector de piso automático.
- `LabelOverlay` con "Destino", "Partida" y el globo del paso.
- **Aceptación:** en el demo, desde un pin de V432.4.S413, "Cómo llegar"
  reproduce la ruta; la figura sube por la escalera y el selector pasa de 1 a
  4; al final dice "Sala 413 está a tu izquierda"; con "Sin escaleras" usa el
  ascensor. Funciona a 390 px de ancho y en escritorio, en claro y en oscuro.

### Fase 4 — Vista explotada

- `explodedView.ts` (6.8, vista explotada) a partir de `areas`, `buildings` y
  los nodos `door`/`stairs`/`elevator`.
- Botón "Separar pisos" junto al `FloorSelector`, visible solo en edificios con
  interior mapeado.
- Etiquetas de sala por piso y pastillas P1…Pn en el `LabelOverlay`.
- **Aceptación:** separar/juntar se anima sin tirones en móvil. El 3D del resto
  del campus no se ve afectado. Las etiquetas quedan sobre su piso.

### Fase 5 — Editor en `/admin/mapeo`

Herramienta "Navegación" por planta:
- Marcar **puertas** sobre el borde de un área (se ajustan al borde), con su
  ancho. La puerta se une sola al área.
- Dibujar el **eje del pasillo** → `corridor.ts` genera los nodos y las aristas.
- Marcar **nodos de núcleo** (`stairs`/`elevator`) con su `shaft`. Un botón
  "Unir plantas" crea las aristas verticales entre plantas consecutivas del
  mismo `shaft` (escalera con `step_free = false`).
- Marcar **entradas** (`entrance`) y la arista exterior hacia el patio o la
  vereda; también si la entrada tiene escalones.
- Editar `landmark` y `room_code` de cualquier nodo.
- **Validación** (`validate.ts`), que se muestra en el editor:
  - nodos sin aristas;
  - salas con código sin nodo `room`;
  - nodos `room` inalcanzables desde alguna entrada;
  - inalcanzables en modo sin escaleras (aviso, no error);
  - `shaft` con plantas saltadas;
  - puertas a > 0,3 m del borde de su área.
- Escritura con permiso `mapping`. El cliente decide qué se dibuja; la RLS
  decide qué se guarda.
- **Aceptación:** mapear un piso de cero lleva minutos, no horas, y la
  validación lo deja en verde.

### Fase 6 — Cargar Vergara 432 de verdad

- Con el plano real (sección 10), mapear las plantas, áreas, puertas, núcleos y
  entradas. Cruzar códigos con `docs/referencia/salas.md`.
- **Aceptación:** de las salas de V432 en el catálogo, todas tienen ruta, y una
  persona que la recorra físicamente confirma las instrucciones de al menos 5
  rutas.

### Fase 7 — Pulido

- Mobiliario decorativo, voz, `prefers-reduced-motion` y textos EN.
- Entrada del `CHANGELOG`; cerrar o crear el pendiente en `ROADMAP`.
- Medir: tiempo de cálculo de ruta (< 5 ms) y FPS de la animación en un
  teléfono de gama media.

---

## 9. Riesgos y cómo se mitigan

| Riesgo | Mitigación |
|---|---|
| Instrucciones con izquierda/derecha al revés | Test de `turnAngle` y del ejemplo S413. No cambies la convención y = sur |
| Elegir mal entre ascensor y escalera | Constantes en un solo sitio, con test del caso límite del piso 5 |
| Datos interiores incompletos | `resolveTarget` cae al ajuste por cercanía y, si no, al `WayfinderSheet` |
| Rendimiento en móvil | Un `setData` por frame solo para la figura; la vista explotada solo se recalcula al cambiar `gap` |
| Choque con el 3D de OSM | Filtrar o atenuar solo los edificios mapeados |
| Ciclos entre features | La lógica en `shared/utils/indoor`; `mapping` no importa de `wayfinding` |
| Cupo de ORS | Una llamada por ruta, solo a la entrada elegida |
| Dato supuesto presentado como real | Aviso en la ficha cuando la sala no viene del catálogo |

---

## 10. Preguntas abiertas para quien pidió el trabajo

1. **Plano real de V432** (aunque sea foto del plano de evacuación): dónde está
   la escalera, dónde el ascensor y de qué lado del pasillo queda cada sala.
2. **Subterráneo −1:** el horario de la EIT tiene `V432.-1.SIM`, `FIS`, `ERP` y
   `LOC`. ¿Existe? ¿Se baja por la misma escalera?
3. **Accesos:** ¿la puerta de Vergara tiene rampa o escalones? ¿Hay
   torniquetes, y alguno ancho? ¿El paso al patio hacia Ejército 441 está en el
   piso 1?
4. **Cuántas escaleras hay:** ¿una sola o también una de emergencia que se pueda
   usar?
5. **Origen por defecto:** ¿GPS + ruta de calle, o elegir la entrada a mano?
6. ¿Se quiere **voz** por defecto o solo opcional?

---

## Anexo A — Edificio de prueba (el del PoC)

Sirve de fixture para los tests (fase 1) y de demo (fase 2). Es un **edificio
inventado con criterio**. Las salas S312–S315, AU, S412–S415 y S512–S515 **existen**
en el horario de la EIT, pero su posición dentro del piso es supuesta. El piso 2
(S212–S215) y el piso 1 entero son de relleno.

**Plano local** (metros; x a lo largo de la fachada norte, y hacia el sur por
Vergara; y hacia abajo). Coordenadas con punto decimal. Huella `[0,0]–[30,26]`.
Altura de planta 3,6 m. Pisos 1 a 5.

**Georreferencia aproximada del PoC:** esquina noroeste en
`lat −33.4525797, lng −70.6615718`, con el eje x girado a **rumbo 76°** (el lado
norte del perímetro de la FIC en `engineering_polygon.json`). Para pasar a
lng/lat:

```
este  = x·sin(76°) + y·sin(166°)
norte = x·cos(76°) + y·cos(166°)
lng = −70.6615718 + este / (111320·cos(−33.4525797°))
lat = −33.4525797 + norte / 111320
```

**Planta tipo (pisos 2, 4 y 5):**

```
y=0  ┌──────────────┬─────┬────┬──────┬──────┐
     │ S_12         │ESC. │ASC.│B.DAM.│B.VAR.│   x: 0–14 | 14–18 | 18–21 | 21–25.5 | 25.5–30
y=7  ├────────[11]──┴─[16]┴[19.5]┴[23.25]┴[27.75]┤   puertas norte en y=7 (x entre corchetes)
     │              pasillo central  (eje y=8.5)    │
y=10 ├──────[7]────┬──────[17]──┬───────[27]──────┤   puertas sur en y=10
     │ S_13 (0–10) │ S_14 (10–20)│ S_15 (20–30)     │
y=26 └─────────────┴─────────────┴──────────────────┘
```

Códigos: `V432.{piso}.S{piso}12` … `S{piso}15`.

**Piso 3:** norte S312 `[0,0,7,7]` (puerta x=4) y S315 `[7,0,14,7]` (x=11). Sur:
AU `[0,10,16,26]` (x=13, landmark "la puerta del auditorio"), S313
`[16,10,23,26]` (x=20) y S314 `[23,10,30,26]` (x=27).

**Piso 1:**

| Área | Rect `[x0,y0,x1,y1]` | Puerta |
|---|---|---|
| Conserjería | `[0,0,6,7]` | (3,7) |
| Secretaría de Estudios | `[6,0,14,7]` | (10,7) |
| Acceso Vergara | `[0,10,4,18]` | fachada (0,14) "la puerta principal" · (4,14) "los torniquetes" |
| Bodega | `[0,18,4,26]` | (4,22) al lobby |
| Lobby (abierto) | `[4,10,22,26]` | — |
| Cafetería | `[22,10,30,18]` | (22,14) al lobby |
| Hall al patio (abierto) | `[22,18,30,26]` | fachada (30,22) "la salida al patio" |
| Hall de ascensores (pasillo, abierto) | `[0,7,30,10]` | — |

Nodos especiales del piso 1:

- `out:paradero` (−7,−24): "el paradero Vergara / esq. Gorbea".
- `out:vergara432` (−7,14): "el número 432 de Vergara", vía "la vereda de Vergara".
- Puerta principal (0,14) → acceso (2,14) → torniquetes (4,14) → `lobby:a`
  (9,14) "el lobby" → `lobby:b` (18,14) "el lobby, frente a la cafetería" →
  `lobby:c` (18,22) "el hall al patio" → puerta patio (30,22) → `out:patio`
  (40,22) "el patio de la FIC (lado Ejército 441)".
- `lobby:a` sube al pasillo en x=9 y `lobby:b` en x=18. La bodega cuelga de
  `lobby:d` (9,22), que une `lobby:a` con `lobby:c`.

**Todas las plantas:**

- Pasillo en y=8.5 con nodos en x = 0.8, x = 29.2 y la x de cada puerta (más 9 y 18
  en el piso 1), encadenados por x.
- Escalera: puerta (16,7), landmark "la escalera principal", nodo `stairs`
  (16, 6.3). Hueco `[14,0,18,7]`; tramo 1 en x 14–16 subiendo hacia el norte de
  y=6 a y=1.5; descanso intermedio en y 0–1.5; tramo 2 en x 16–18 subiendo hacia
  el sur de 1.5 a 6.
- Ascensor: puerta (19.5, 7) "el ascensor", nodo `elevator` (19.5, 4). Hueco
  `[18,0,21,7]`.
- Baños: puertas (23.25, 7) y (27.75, 7).
- Landmarks de pasillo: x=16 "el pasillo, frente a la escalera"; x=19.5 "el
  pasillo, frente al ascensor"; x=23.25 y x=27.75 "el pasillo, frente a los
  baños"; en el piso 1, x=9 "el hall de ascensores".
- Nodo `room` a 2,5 m hacia dentro desde su puerta.
- Aristas verticales entre plantas consecutivas: escalera
  (`step_free = false`) y ascensor.

**Orígenes ofrecidos:** paradero, frente al 432, patio FIC y lobby.
