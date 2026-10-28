# Repositorio y funcionamiento de la aplicación

Referencia para ubicar responsabilidades, rutas y fuentes de datos. Las
convenciones de trabajo están en [desarrollo](../guias/desarrollo.md), el
contrato SQL en [base de datos](base-de-datos.md) y los motivos en
[arquitectura](../decisiones/arquitectura.md). No es un censo de cada archivo.

## Arranque y rutas

[`src/app/main.tsx`](../../src/app/main.tsx) prepara React, router, QueryClient,
Google y autenticación. `App` monta sincronización del catálogo y del dispositivo
push por encima de las rutas; `Layout` organiza navegación pública y modales.
`UpdatePrompt` vive fuera de las pantallas.

| Ruta                | Responsable y acceso de interfaz                           |
| ------------------- | ---------------------------------------------------------- |
| `/`, desconocidas   | Redirigen a `/mapa`                                        |
| `/mapa`             | `MapPage` y `MapView`                                      |
| `/eventos`          | `EventsPage`, agenda y RSVP                                |
| `/foro`             | `ForumPage` e hilos                                        |
| `/perfil`           | `profile/pages/ProfilePage`                                |
| `/moderacion`       | `LegacyModerationRedirect` conserva `?report=` al reenviar |
| `/admin`            | `AdminLayout` y `DashboardPanel`                           |
| `/admin/moderacion` | `ReportsPanel` y avisos del equipo                         |
| `/admin/usuarios`   | `UsersPanel` y capacidades                                 |
| `/admin/contenido`  | `ContentPanel`                                             |
| `/admin/facultades` | `FacultiesPanel`                                           |
| `/admin/difusion`   | `BroadcastPanel`                                           |
| `/admin/actividad`  | `ActivityLogPanel`                                         |
| `/admin/mapeo`      | `MappingPage`                                              |
| `/admin/ajustes`    | `SettingsPanel`                                            |

`AdminLayout` espera `authStore.loading` antes de comprobar rol; de otro modo
puede redirigir antes de conocerlo. Solo admite `admin`. Dar `mapping` o
`reports` a un moderador en SQL no le abre este panel. La separación entre
interfaz, RLS y RPC está en [roles](base-de-datos.md#roles-y-capacidades).
`ADMIN_SECTIONS` declara la navegación del panel; una ruta nueva también necesita
su entrada en `App`. Mapeo se presenta como herramienta de escritorio.

## Fuentes y estado compartido

| Pieza                                              | Responsabilidad                                              |
| -------------------------------------------------- | ------------------------------------------------------------ |
| `shared/lib/supabase.ts`                           | Cliente o `null` según URL y clave pública                   |
| `shared/lib/queryClient.ts`                        | Caché remota compartida                                      |
| `shared/lib/i18n.ts` y `shared/utils/localized.ts` | Catálogos ES/EN y elección de textos                         |
| `shared/stores/uiStore.ts`                         | Selección, modales, planta, orientación y rutas              |
| `filterStore`                                      | Filtros de contenido; no es autorización                     |
| `sidebarStore`                                     | Apertura y sección de la barra lateral                       |
| `shared/data/campusData.ts`                        | Semilla del catálogo activo                                  |
| `facultyStore` y `useFaculties`                    | Catálogo vivo, suscripción y geometría de facultades         |
| `mappingCache`                                     | Instantánea síncrona del interior para consumidores no React |
| `shared/types/database.ts`                         | Tipos manuales de lo consultado por el cliente               |

`publishFaculties` ignora listas vacías y reemplaza el contenido de `FACULTIES`
con `splice`: quienes conservan esa referencia ven el catálogo nuevo. Las listas
React usan `useFaculties()` para reaccionar a la versión. `facultyIdAt` usa
perímetros y desempata solapes por cercanía a la chincheta; no deduce una facultad
por texto de sala o dirección.

Los perímetros operativos vienen de `faculties.polygon`. `null` significa sin
trazar: no contorno, no asignación geométrica ni editor interior habilitado.
El catálogo y el seed no fabrican geometrías. Restos históricos no son una
segunda fuente activa.

## Mapa, selección y plantas

`MapPage` orquesta búsqueda, ubicación, orientación, colocación y ficha.
`MapView` mantiene MapLibre, marcadores DOM, ruta y capas. `mapConfig` define
la apariencia; `campusBoundary` limita el área y publica límites. Desbloquearla
es una herramienta de administrador, no un permiso de escritura sobre datos.

El selector activo es `ContextLens`. Ofrece edificios y la unión de plantas
de la facultad; ordena horizontalmente y añade controles al desbordarse el
ancho. `FloorSelector.tsx` conserva una implementación anterior sin consumidor
actual. No lo uses como evidencia de lo que muestra `MapPage`.

La regla compartida vive en `floorVisibility.ts`:

- Sin planta o facultad activa, los pines no se recortan por planta.
- Una planta activa afecta solo a su facultad. Los pines de otras facultades
  conservan su visibilidad.
- Un pin con `floor: null` es exterior: cuenta como suelo y se ve con planta 1,
  no en plantas superiores de esa facultad.
- Las áreas exteriores se ven en todas las plantas. Sin planta activa, el
  interior muestra la planta por defecto de cada edificio; no apila todas.

`mappingLayers` representa edificios, áreas y etiquetas con las reglas
compartidas. El clic abre la ficha común `FacultyDetail` con `placeFocus`,
no un panel `PlaceLabel` separado. Los marcadores de sala con código son
píldoras generadas con `shortRoomCode`. La infraestructura fija tiene tratamiento
de tamaño; no se desvanece por ser permanente.

`pinScaleForZoom` limita el tamaño mínimo y crece con el zoom. No hay clustering,
niveles de detalle completos ni abanico resueltos. El renderKey evita recrear
SVG por cada revalidación; las reglas de `opacity`, clases y resize están en
[CLAUDE.md](../../CLAUDE.md#reglas-del-mapa-que-no-hay-que-perder).

### Cambios de estilo y prioridad de interacción

Cambiar estilo con `setStyle` elimina capas y fuentes personalizadas.
`MapView` las reconstruye al cargar el estilo y aumenta `styleEpoch` después
de crearlas: los efectos de ruta e interior dependen de esa época para reponer
sus datos aunque las propiedades React no hayan cambiado.
Los marcadores separados del DOM también se vuelven a adjuntar.

El catálogo puede llegar antes de que el estilo esté listo.
`refreshFacultyPerimeters` se ejecuta si ya lo está; si no, se encola en `idle`
y comprueba que la instancia siga viva. Descartar aquel aviso dejaba el mapa
con perímetros diferentes según cómo se había abierto.

`faculty-perimeter-fill` conserva opacidad cero como blanco de clic: no elimines
esa capa por no verla. `syncBuildingLayers` retira las capas de edificios de
facultades que ya no tienen perímetro y actualiza los filtros del catálogo
vigente; solo añadir capas dejaría trazos antiguos visibles.

El contexto interior usa histéresis: entra desde zoom 17.5, sale por debajo
de 17.2 y tolera hasta 5 m fuera del perímetro antes de abandonar la facultad.
Así evita cambiar de planta repetidamente al rozar el borde o el umbral.
No cambia contexto durante colocación o traslado de pin y no activa una facultad
sin plantas disponibles.

El clic se resuelve en un único manejador: pin DOM, área, edificio, perímetro
y finalmente deselección. El pin detiene propagación; dividir el resto en
handlers independientes ya abrió dos fichas con el mismo toque.

`MapPage` admite `/mapa?faculty=<id>` si el ID existe en el catálogo: selecciona
su ficha y, al resolver un destino, limpia la query con `replaceState`.
Con `?pin=` y una lista no vacía de pines, la rama del pin tiene prioridad;
no hay un fallback general a facultad si ese pin no se encuentra.

## Rutas y orientación

`routing.ts::getWalkingRoute` pide ORS con perfil `foot-walking` o `wheelchair`.
Sin clave o ante fallo intenta el servidor OSRM con ruta `foot`; si tampoco
responde, devuelve línea recta y una duración geométrica aproximada. Los
respaldos no acreditan accesibilidad ni un recorrido interior.

`MapPage` usa ubicación disponible o el origen de campus y evita recalcular por
cada actualización GPS. La ruta apunta a las coordenadas finales del pin.
`WayfinderSheet` aporta pasos y cambios de planta: elige el primer acceso/rampa
y conector que encuentra con sus filtros. No busca el más cercano, no comprueba
todas las paradas de un ascensor y no redirige la polilínea hasta el acceso.
Es guía contextual, no grafo indoor ni verificación física de un itinerario.
Brújula, permisos de orientación e instalación dependen del dispositivo.

## Navegación interior

Cuando el destino tiene grafo (`nav_nodes`/`nav_edges`, ver
[base de datos](base-de-datos.md#navegacion-interior)), «Cómo llegar» muestra
`wayfinding/IndoorRouteSheet` giro a giro hasta la puerta; sin grafo, o si la
consulta falla porque la migración no está aplicada, sigue `WayfinderSheet`.
Nunca las dos. `MapPage` no pide ubicación ni ruta de calle hasta saber cuál
corresponde: hacerlo y descartarlo gastaría cupo de ORS.

| Pieza                         | Responsabilidad                                                                                                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/utils/indoor/`        | Lógica pura en metros (x = este, y = sur): proyección, grafo con costo en segundos, instrucciones, microdirección, línea de tiempo, pasillo generado, validación y el edificio de prueba |
| `wayfinding/useNavGraph`      | Grafo de una facultad (`['navGraph', facultyId]`), proyectado y con nombres de sala del área o del código                                                                                |
| `wayfinding/resolveTarget`    | Pin → nodo: código normalizado, área, o nodo de paso más cercano de su planta (30 m). Elige entrada por cercanía + tiempo interior y ofrece orígenes sin GPS                             |
| `wayfinding/IndoorRouteSheet` | Origen, sin escaleras, pasos, reproducción, cámara, voz y planta automática                                                                                                              |
| `wayfinding/IndoorScene`      | Losas, suelos, muros y peldaños por planta; vista separada animada                                                                                                                       |
| `wayfinding/LabelOverlay`     | Etiquetas HTML a la altura de su planta con la matriz de MapLibre                                                                                                                        |
| `shared/lib/mapInstance`      | Instancia del mapa y época de estilo publicadas por `MapView`                                                                                                                            |

`wayfinding` lee de `mapping` y `shared`; no importa de `map`. La ruta de calle
(`routing.ts`) se le inyecta desde `MapPage`. Por eso el mapa se publica en
`shared/lib/mapInstance`: pasar la pose por props re-renderizaría la pantalla
en cada frame.

`uiStore.indoorNavFacultyId` marca la navegación: `MapView` deja de entrar o
salir de facultades por zoom y no apaga las capas `indoor-*` en 2D.
`indoor3dFacultyId` (navegación o pisos separados desde `ContextLens`) hace que
`MapView` aparte las áreas 2D de esos edificios y filtre, solo sobre sus
huellas, las cajas 3D de OSM y las rojas de la facultad; el resto del campus
conserva su 3D. Mientras se navega se apaga `centerClampedToGround` para que la
cámara pueda centrarse en una planta alta, y se fuerza el modo 3D; al cerrar se
restauran.

El enlace directo `/sala/<código>?ir=1` que proponía el plan no existe: las
salas se abren con `/mapa?pin=<id>`.

## Editor de mapeo

`MappingPage` orquesta árbol, propiedades, herramientas y mutaciones;
`MappingCanvas` dibuja otra instancia MapLibre; `editorStore` conserva selección
y borrador; `api.ts` y `demoStore.ts` comparten el contrato de operaciones.

La jerarquía es facultad → edificio → planta → área, con áreas exteriores sin
edificio ni planta. La chincheta de una facultad nueva sale de su perímetro.
El volumen propio usa exclusivamente `height_m` positivo; `buildingHeightM`
no infiere altura de plantas ni de otro dato. Sin altura declarada devuelve cero;
guardar cero lo convierte a NULL. El estilo base puede representar edificios
de OSM por separado. El calco de OSM no acredita precisión catastral.

Se retiró deducir altura de las plantas para evitar superponer un volumen
propio a edificios que el estilo OSM ya representa. La altura manual cubre
los casos que necesitan esa representación propia, no una segunda copia general.

El editor permite selección, rectángulos, polígonos y calco, edición de vértices,
ajuste a referencias y modo ortogonal, división y copia entre plantas. Consulta
los handlers de teclado de `MappingPage` y los modos de `editorStore` antes de
documentar un atajo. La herramienta de sala/importador coloca un pin: no propone
automáticamente un contorno de habitación.

La herramienta «Navegación» (N) edita el grafo planta a planta con
`NavEditorPanel`: puertas ajustadas al borde de un área (la de la sala gana a
la del pasillo), eje de pasillo que genera nodos, cadena y salas detrás de cada
puerta (`shared/utils/indoor/corridor.ts`), escaleras y ascensores con su
`shaft`, entradas, puntos exteriores y uniones a mano. «Unir plantas» crea las
aristas verticales entre plantas consecutivas del mismo núcleo. La validación
(`validate.ts`) se recalcula con cada cambio y lleva al nodo afectado. El lienzo
solo pinta `navEditorStore.overlay` y entrega los clics; cambiar de planta no
saca de la herramienta. Las salas generadas toman el código de un pin de su
área si lo hay.

`PinFloorPanel` asigna planta a pines en lote; no es movimiento geométrico masivo.
`RoomImportPanel` usa el catálogo EIT como apoyo a colocación manual. El modo demo
reproduce sus cascadas en memoria y arranca con un solo edificio: Vergara 432
del prototipo de navegación (`shared/utils/indoor/sampleBuilding.ts`), con
plantas 1–5, áreas y grafo. Es un edificio supuesto en la georreferencia del
prototipo, con ids `demo-v432-*`; sin él «Cómo llegar» no se puede probar sin
base. Nada más del mapeo demo se inventa.

`mapping/api.ts` también lee y escribe `nav_nodes` y `nav_edges`. Vive aquí y
no en `wayfinding` porque lo escribe el editor de este dominio y el demo tiene
que borrar nodos al borrar plantas o edificios; `wayfinding` solo lee. Una
arista repetida en cualquier sentido choca con un índice sobre expresiones que
no admite `on conflict`: quien crea aristas filtra las existentes.

### Validación geométrica y recuperación

`validateArea` impide nombre vacío, forma insuficiente, área menor de
`MIN_AREA_M2` (2 m²) y salida del contenedor con tolerancia de 1 m. El solape
con áreas vecinas de la misma planta avisa, no bloquea, si supera el mayor de
2 m² y el 1 % del área: puede ser deliberado, por ejemplo un quiosco dentro
de un casino. `validateBuilding` avisa si sale de la facultad; no comprueba
solapes entre edificios. `validateFaculty` exige perímetro al crear y un mínimo
de 100 m²; al editar permite corregir metadatos sin aportar otro perímetro.

Son aproximaciones: contención por vértices/anillo exterior, proyección local y
muestreo de intersección en casos cóncavos. `geo.ts` también devuelve metros
mediante Haversine; no dividas las APIs en «grados frente a metros» por nombre
de archivo.

La cobertura actual suma huellas y áreas exteriores, puede contar solapes dos
veces y se limita al 100 %. No calcula huecos por planta. La confirmación de
borrar una planta enumera áreas, no todos sus pines. Los errores de guardado
pueden salir por toast; el borrador sobrevive en memoria, no como persistencia
local garantizada.

`downloadExport` descarga archivos TypeScript; no escribe en el repositorio ni
alimenta el demo. Las referencias históricas a ese enlace describían un objetivo
no implementado. Al borrar facultades, los controles UI no reemplazan las demás
FK que pueden impedir el borrado en la base.

## Pines, lugares y eventos

`pins/api.ts` concentra creación, edición, ubicación, fotos e interacción;
`usePins` gestiona filtros y realtime. La API admite límites geográficos, pero
el hook actual llama a `fetchPins(null, filters)`: panear no cambia su query.
El límite remoto es 300 pines vivos ordenados por creación, sin cursor o paginación
real. `boundsSnapshot` conserva una instantánea síncrona para otros consumidores,
no una suscripción que dispare el fetch en cada movimiento. `CreatePinModal` e
`IndoorFields` preparan la publicación; `PinDetail` y `usePinActions` la ficha
y acciones. El ciclo de vida, campos protegidos y cupos están en
[base de datos](base-de-datos.md#ciclo-de-vida-de-un-pin).

La creación del pin y la carga de fotos/programa no forman una sola transacción
cliente. `CreatedPin` puede devolver `photosFailed` o `scheduleFailed`:
el pin ya existe aunque esa parte accesoria falle. Recupera esa parte sobre el
pin existente; repetir toda la creación puede duplicarlo o chocar con
`PIN_LOCATION_OCCUPIED`.

Los errores RPC se propagan sin envolver para conservar SQLSTATE.
`dbErrorMessage` y `isUserFacingDbError` distinguen objetos planos y mensajes
P0001; convertirlos sin más en `Error` o `String(error)` puede perder la
explicación y mostrar `[object Object]`. `uploadPinPhotos` compensa fallos
de subida quitando archivos sin fila;
el GC limpia archivos asociados a filas eliminadas. No confundas ambos dueños.
`place_photos` representa galerías de facultad, edificio o área; no se heredan
automáticamente las fotos entre recintos.

`events/api` gestiona RSVP. `event_rsvp_counts` ofrece agregados públicos y
`event_attendees` restringe nombres a autor o admin. `EventCard` usa
`RSVP_PUBLIC_THRESHOLD` como decisión de interfaz; ni el umbral ni ocultar cero
son la barrera de privacidad. `useMyEvents` lleva los eventos marcados al perfil.
`EventCalendarDialog` permite salto de fecha; `EventsPage` es la agenda.

## Foro, perfiles y administración

`forum/utils.ts::buildCommentTree` agrupa las respuestas bajo la raíz a un
nivel visible; las menciones conservan el contexto de respuesta. No es un árbol
visual de profundidad arbitraria. Votos usan RPC y publicaciones oficiales
dependen de autorización servidor.

`authStore` contiene Google ID token, método OAuth alternativo y sesiones demo.
`fetchProfile` resuelve rol y metadatos; `loading` protege el guard de admin
mientras se conoce el rol. Los perfiles públicos usan `profiles_public` sin
correo. Eso no prueba privacidad de la tabla `profiles`: revisa
[las observaciones SQL](base-de-datos.md#discrepancias-y-observaciones-abiertas).

`ReportsPanel` reúne cola y avisos del equipo. `NotificationCenter` muestra
avisos personales. `SettingsPanel` concentra autotest y entregas por servicio;
`BroadcastPanel` difunde. `CapabilitiesEditor` configura capacidades, aunque
parte de su alcance aún no se aplica a todas las RPC/interfaz.
El contrato de sesiones y avisos está en [notificaciones](notificaciones.md).

## Límites entre dominios

Hay ciclos entre `map`, `pins` y `mapping`. El mapa consume pines y mapeo;
pines consulta caché interior al crear/mover; mapeo edita pines y utiliza
presentación compartida. `Sidebar` también importa autenticación y avisos desde
`shared/ui`. La convención de fronteras es una norma de contribución, no una
propiedad ya cumplida por todo el árbol.

Extrae una regla pura a `shared/utils` si la necesitan capas que no se conocen.
No crees catálogos paralelos para evitar un import: geometría y facultades ya
mostraron el coste de sincronizar dos fuentes. La deuda está en
[arquitectura](../decisiones/arquitectura.md#deuda-y-consecuencias).

## Configuración y documentación como entradas

| Fuente                             | Consumidor o propósito                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `vite.config.ts`                   | Versiones, PWA, `update-info.json`, alias y Vitest                                   |
| `docs/CHANGELOG.md`                | Entrada literal de `updateInfoJson`; todas las líneas con guion llegan al aviso      |
| `CLAUDE.md`                        | Origen de instrucciones; `scripts/gen_agents.mjs` produce los derivados              |
| `docs/referencia/base-de-datos.md` | Ruta que comprueba el hook de esquema                                                |
| `scripts/gen_seed_full.ts`         | Seed público; no provisiona admins, perímetros ni interior                           |
| `supabase/schema/baseline.sql`     | Reconstrucción del esquema; cron y configuración externa requieren pasos adicionales |
| `supabase/config.toml`             | JWT de gateway desactivado para las funciones con autorización propia                |
| `vercel.json`                      | Reescritura SPA                                                                      |
| `wrangler.toml`                    | Configuración de assets SPA alternativa; su presencia no acredita un despliegue      |
| `.github/workflows/ci.yml`         | Calidad y build; sin migraciones o despliegue automático                             |
| `.claude/settings.json`            | Aviso de documentación DB y generación de instrucciones                              |

`public/push-sw.js` se mantiene como fuente; `sw.js` se genera.
Los scripts de iconos pueden sobrescribir assets. `bundle.mjs`, `geocode.js` y
`engineering_polygon.json` son restos o herramientas fuera del arranque normal;
no son fuentes del catálogo vivo ni una razón para restaurar perímetros estáticos.

## Desajustes locales conservados

La reorganización no corrigió estos desajustes de aplicación/configuración:

- `index.html` y el manifiesto de Vite usan `theme-color` distintos.
- `vite-env.d.ts` no enumera `VITE_GOOGLE_CLIENT_ID` ni
  `VITE_VAPID_PUBLIC_KEY`, aunque el código las consume.
- Auth demo usa `faculty_id: ingenieria` y `publicProfileApi` conserva `fic`;
  la coherencia de los datos demo requiere trabajo propio.
- `udp-map-demo` pasa `--mode demo` pero eso no desactiva credenciales.
- Los nombres oficiales fijos siguen dependiendo de revisar alcance de
  moderadores y atribución, no solo de traducir un texto.

Estos casos tienen origen en el mapa anterior y siguen localizables en los
archivos indicados; no se presentan como discrepancias corregidas por mover docs.

## Dónde intervenir

| Cambio                       | Leer y tocar primero                                                                |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Marcador, planta, selección  | `MapView`, `floorVisibility` y `mappingLayers`                                      |
| Código o importación de sala | [Salas](salas.md), `roomCode`, `roomCatalog`, `RoomImportPanel`                     |
| Crear/editar/mover pin       | `pins/api`, formulario y contrato SQL; también demo                                 |
| Geometría de facultades      | `facultyStore`, `facultiesApi`, editor; no duplicar perímetros                      |
| Modelo o autorización        | Migración + baseline + [base de datos](base-de-datos.md) y tipos cliente si aplican |
| Push/sesión/bandeja          | [Notificaciones](notificaciones.md), store, API, worker, cola Edge y SQL            |
| Actualización de aplicación  | [PWA](pwa.md), `UpdatePrompt`, `swUpdate` y Vite                                    |
| Ruta o sección admin         | `App`, `ADMIN_SECTIONS`, guard y autorización servidor                              |
| Pendiente o decisión         | [Plan](../ROADMAP.md) y decisión correspondiente                                    |
| Reglas para agentes          | `CLAUDE.md` y generación de derivados                                               |

Actualiza este mapa cuando cambie la responsabilidad o estructura, no por variar
el tamaño de un archivo. El [índice](../README.md) orienta la documentación y
el [histórico](../historico/2026-10/documentacion-anterior.md) conserva el mapa
anterior completo.
