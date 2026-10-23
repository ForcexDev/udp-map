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

| Ruta | Responsable y acceso de interfaz |
|---|---|
| `/`, desconocidas | Redirigen a `/mapa` |
| `/mapa` | `MapPage` y `MapView` |
| `/eventos` | `EventsPage`, agenda y RSVP |
| `/foro` | `ForumPage` e hilos |
| `/perfil` | `profile/pages/ProfilePage` |
| `/moderacion` | `LegacyModerationRedirect` conserva `?report=` al reenviar |
| `/admin` | `AdminLayout` y `DashboardPanel` |
| `/admin/moderacion` | `ReportsPanel` y avisos del equipo |
| `/admin/usuarios` | `UsersPanel` y capacidades |
| `/admin/contenido` | `ContentPanel` |
| `/admin/facultades` | `FacultiesPanel` |
| `/admin/difusion` | `BroadcastPanel` |
| `/admin/actividad` | `ActivityLogPanel` |
| `/admin/mapeo` | `MappingPage` |
| `/admin/ajustes` | `SettingsPanel` |

`AdminLayout` espera `authStore.loading` antes de comprobar rol; de otro modo
puede redirigir antes de conocerlo. Solo admite `admin`. Dar `mapping` o
`reports` a un moderador en SQL no le abre este panel. La separación entre
interfaz, RLS y RPC está en [roles](base-de-datos.md#roles-y-capacidades).
`ADMIN_SECTIONS` declara la navegación del panel; una ruta nueva también necesita
su entrada en `App`. Mapeo se presenta como herramienta de escritorio.

## Fuentes y estado compartido

| Pieza | Responsabilidad |
|---|---|
| `shared/lib/supabase.ts` | Cliente o `null` según URL y clave pública |
| `shared/lib/queryClient.ts` | Caché remota compartida |
| `shared/lib/i18n.ts` y `shared/utils/localized.ts` | Catálogos ES/EN y elección de textos |
| `shared/stores/uiStore.ts` | Selección, modales, planta, orientación y rutas |
| `filterStore` | Filtros de contenido; no es autorización |
| `sidebarStore` | Apertura y sección de la barra lateral |
| `shared/data/campusData.ts` | Semilla del catálogo activo |
| `facultyStore` y `useFaculties` | Catálogo vivo, suscripción y geometría de facultades |
| `mappingCache` | Instantánea síncrona del interior para consumidores no React |
| `shared/types/database.ts` | Tipos manuales de lo consultado por el cliente |

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

## Editor de mapeo

`MappingPage` orquesta árbol, propiedades, herramientas y mutaciones;
`MappingCanvas` dibuja otra instancia MapLibre; `editorStore` conserva selección
y borrador; `api.ts` y `demoStore.ts` comparten el contrato de operaciones.

La jerarquía es facultad → edificio → planta → área, con áreas exteriores sin
edificio ni planta. La chincheta de una facultad nueva sale de su perímetro.
Altura explícita o inferida permite volumen; altura nula o cero no equivale a
una medición de terreno. El calco de OSM no acredita precisión catastral.

El editor permite selección, rectángulos, polígonos y calco, edición de vértices,
ajuste a referencias y modo ortogonal, división y copia entre plantas. Consulta
los handlers de teclado de `MappingPage` y los modos de `editorStore` antes de
documentar un atajo. La herramienta de sala/importador coloca un pin: no propone
automáticamente un contorno de habitación.

`PinFloorPanel` asigna planta a pines en lote; no es movimiento geométrico masivo.
`RoomImportPanel` usa el catálogo EIT como apoyo a colocación manual. El modo demo
arranca sin edificios/plantas/áreas y reproduce sus cascadas en memoria.

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
`usePins` gestiona consultas paginadas por límites del mapa, filtros y realtime. `CreatePinModal` e
`IndoorFields` preparan la publicación; `PinDetail` y `usePinActions` la ficha
y acciones. El ciclo de vida, campos protegidos y cupos están en
[base de datos](base-de-datos.md#ciclo-de-vida-de-un-pin).

La creación del pin y la carga de fotos/programa no forman una sola transacción
cliente. `uploadPinPhotos` compensa fallos de subida quitando archivos sin fila;
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

| Fuente | Consumidor o propósito |
|---|---|
| `vite.config.ts` | Versiones, PWA, `update-info.json`, alias y Vitest |
| `docs/CHANGELOG.md` | Entrada literal de `updateInfoJson`; todas las líneas con guion llegan al aviso |
| `CLAUDE.md` | Origen de instrucciones; `scripts/gen_agents.mjs` produce los derivados |
| `docs/referencia/base-de-datos.md` | Ruta que comprueba el hook de esquema |
| `scripts/gen_seed_full.ts` | Seed público; no provisiona admins, perímetros ni interior |
| `supabase/schema/baseline.sql` | Reconstrucción del esquema; cron y configuración externa requieren pasos adicionales |
| `supabase/config.toml` | JWT de gateway desactivado para las funciones con autorización propia |
| `vercel.json` | Reescritura SPA |
| `wrangler.toml` | Configuración de assets SPA alternativa; su presencia no acredita un despliegue |
| `.github/workflows/ci.yml` | Calidad y build; sin migraciones o despliegue automático |
| `.claude/settings.json` | Aviso de documentación DB y generación de instrucciones |

`public/push-sw.js` se mantiene como fuente; `sw.js` se genera.
Los scripts de iconos pueden sobrescribir assets. `bundle.mjs`, `geocode.js` y
`engineering_polygon.json` son restos o herramientas fuera del arranque normal;
no son fuentes del catálogo vivo ni una razón para restaurar perímetros estáticos.

## Dónde intervenir

| Cambio | Leer y tocar primero |
|---|---|
| Marcador, planta, selección | `MapView`, `floorVisibility` y `mappingLayers` |
| Código o importación de sala | [Salas](salas.md), `roomCode`, `roomCatalog`, `RoomImportPanel` |
| Crear/editar/mover pin | `pins/api`, formulario y contrato SQL; también demo |
| Geometría de facultades | `facultyStore`, `facultiesApi`, editor; no duplicar perímetros |
| Modelo o autorización | Migración + baseline + [base de datos](base-de-datos.md) y tipos cliente si aplican |
| Push/sesión/bandeja | [Notificaciones](notificaciones.md), store, API, worker, cola Edge y SQL |
| Actualización de aplicación | [PWA](pwa.md), `UpdatePrompt`, `swUpdate` y Vite |
| Ruta o sección admin | `App`, `ADMIN_SECTIONS`, guard y autorización servidor |
| Pendiente o decisión | [Plan](../ROADMAP.md) y decisión correspondiente |
| Reglas para agentes | `CLAUDE.md` y generación de derivados |

Actualiza este mapa cuando cambie la responsabilidad o estructura, no por variar
el tamaño de un archivo. El [índice](../README.md) orienta la documentación y
el [histórico](../historico/2026-10/documentacion-anterior.md) conserva el mapa
anterior completo.
