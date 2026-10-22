# Mapa del repositorio — UDP Map

Referencia para orientarse en el código: qué hay en cada carpeta, qué hace cada
archivo y dónde tocar para cada tipo de cambio. Lo escribieron agentes que
leyeron el repositorio completo el **2026-10-21** (versión 0.8.0) y se comprobó
contra el código ese mismo día. El 2026-10-22 se puso al día con el trabajo de
Push 3–6 (migraciones `000100` y `000200`, cliente y panel). El 2026-10-23,
con el recorte del sistema de avisos (fuera `pushPayload`, dentro `_shared/auth.ts`
y `shared/ui/Switch.tsx`).

> **Este mapa no reemplaza a nadie.** Las reglas están en [`CLAUDE.md`](../CLAUDE.md),
> el plan en [ROADMAP.md](ROADMAP.md), el esquema en [DATABASE.md](DATABASE.md) y el
> porqué de la arquitectura en [CONTRIBUTING.md](CONTRIBUTING.md). Aquí está **dónde
> vive cada cosa**. Si un dato de este mapa choca con el código, gana el código:
> corrige el mapa en el mismo commit.

Las cifras de líneas sirven para ver el tamaño, no para citarlas. Compruébalas
con `wc -l` antes de usarlas en otro documento.

---

## Índice

1. [Vista de pájaro](#1-vista-de-pájaro)
2. [La raíz del repositorio](#2-la-raíz-del-repositorio)
3. [Rutas de la aplicación](#3-rutas-de-la-aplicación)
4. [`src/app` — arranque](#4-srcapp--arranque)
5. [`src/shared` — lo que no es de ningún dominio](#5-srcshared--lo-que-no-es-de-ningún-dominio)
6. [`src/features` — un apartado por dominio](#6-srcfeatures--un-apartado-por-dominio)
7. [Dependencias entre features](#7-dependencias-entre-features)
8. [`supabase/` — base, migraciones y Edge Functions](#8-supabase--base-migraciones-y-edge-functions)
9. [`public/`, `scripts/`, CI y herramientas de agentes](#9-public-scripts-ci-y-herramientas-de-agentes)
10. [La documentación: qué leer para qué](#10-la-documentación-qué-leer-para-qué)
11. [Dónde tocar para…](#11-dónde-tocar-para)
12. [Trampas transversales](#12-trampas-transversales)
13. [Restos y deuda localizada](#13-restos-y-deuda-localizada)

---

## 1. Vista de pájaro

PWA de React 19 + TypeScript 5.7 + Vite 6. El mapa es MapLibre GL sobre teselas
de OpenFreeMap; los datos y la sesión son Supabase (PostgREST + RLS + RPC en SQL,
sin API propia); los estilos, Tailwind 4 con Radix sin estilos. Bilingüe por
i18next, con todos los textos en `src/shared/lib/i18n.ts`.

```
navegador ──► src/app/main.tsx ── providers (Google OAuth, react-query, router)
                 │
                 ▼
             App.tsx ── rutas ──► Layout (barra inferior) ──► features/<dominio>/
                 │                                              │
                 │      estado efímero: zustand (shared/stores, stores de feature)
                 │      estado del servidor: react-query (use*.ts de cada feature)
                 ▼                                              ▼
       shared/data/facultyStore ◄── tabla faculties     api.ts ──► supabase  (o demoStore si es null)
                                                                       │
                                     Postgres: RLS, triggers, RPC ◄────┘
                                          │
                     notifications ──► notification_push_deliveries ──► Edge Function send-push
                                                                            │
                                                     public/push-sw.js ◄────┘ (Web Push)
```

**Tres ideas que lo explican casi todo:**

- **Toda la seguridad está en la base.** El cliente decide qué dibujar
  (`features/auth/permissions.ts`); las políticas RLS y las RPC deciden qué se
  puede hacer. Crear un pin, votar o verificar solo se puede por RPC.
- **Modo demo.** Si faltan `VITE_SUPABASE_URL` o la clave, `supabase` vale `null`
  y cada `api.ts` cae a un almacén en memoria (`demoStore.ts`). Toda función de
  datos nueva tiene que cubrir los dos caminos.
- **El catálogo de facultades está vivo.** `FACULTIES` es un array mutable que se
  siembra desde `campusData.ts` y se reemplaza en el sitio con lo que hay en la
  tabla `faculties`. Los perímetros solo existen en la base.

---

## 2. La raíz del repositorio

| Archivo | Qué es |
|---|---|
| `package.json` | Versión **0.8.0**, scripts y dependencias. `vite.config.ts` lee de aquí el MAJOR.MINOR |
| `vite.config.ts` | Versión de build (MAJOR.MINOR + nº de commits), `__BUILD_ID__` desde `VERCEL_GIT_COMMIT_SHA`, plugin que emite `update-info.json` leyendo `docs/CHANGELOG.md`, PWA (`registerType: 'prompt'`, importa `push-sw.js`, caché de teselas), alias `@`, `manualChunks` y config de Vitest |
| `tsconfig.json` | TS estricto, `verbatimModuleSyntax`, alias `@/*`. **Solo incluye `src` y `vite.config.ts`**: `scripts/` y `supabase/functions` no se tipan |
| `eslint.config.js` | ESLint plano con typescript-eslint, react-hooks y react-refresh. Ignora `dist`, `dev-dist`, `supabase/functions` y `scripts` |
| `index.html` | Metas PWA/iOS, fuentes de Google por `<link>`, script que fija `--app-height` |
| `.env.example` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ORS_API_KEY`, `VITE_GOOGLE_CLIENT_ID`, `VITE_VAPID_PUBLIC_KEY`. El cliente acepta también `VITE_SUPABASE_PUBLISHABLE_KEY` en lugar de la anon key |
| `vercel.json` | Reescritura SPA a `/index.html` (el despliegue real es Vercel) |
| `wrangler.toml` | Config de Cloudflare con fallback SPA. Ningún documento ni script la usa |
| `CLAUDE.md` | **Origen** de las reglas para agentes |
| `AGENTS.md`, `GEMINI.md`, `.cursorrules`, `.github/copilot-instructions.md` | Copias **generadas** de `CLAUDE.md` (`npm run gen:agents`). No se editan a mano |
| `README.md`, `LICENSE` | Portada y licencia |
| `bundle.mjs`, `geocode.js`, `engineering_polygon.json` | Restos sin uso: ver [§13](#13-restos-y-deuda-localizada) |

**Scripts de npm**

| Script | Qué hace |
|---|---|
| `dev` | Vite en el **5173** (o `PORT`). El 5173 es contractual: es el origen registrado en Google OAuth y en el CORS de `send-push` |
| `build` | `tsc --noEmit && vite build` |
| `preview` | Sirve `dist` en el 4173 |
| `typecheck` | `tsc --noEmit` |
| `test` / `test:watch` | Vitest (jsdom). 50 archivos de test, unos 460 casos, contando los de `supabase/functions/_shared` |
| `lint` | `eslint .` (CI usa este; `CLAUDE.md` pide `npx eslint src`, que es un subconjunto) |
| `check:i18n` | Compara claves y variables ES/EN de `i18n.ts`. **No corre en CI** |
| `gen:agents` | Regenera los derivados de `CLAUDE.md`; `-- --check` comprueba sin escribir. **No corre en CI** |
| `deploy:push` | `supabase functions deploy send-push` |
| `supabase:login` | `supabase login` |

---

## 3. Rutas de la aplicación

Declaradas en `src/app/App.tsx`.

| Ruta | Componente | Feature | Quién la ve |
|---|---|---|---|
| `/` | redirige a `/mapa` | — | todos |
| `/mapa` | `MapPage` | map | todos (escribir pide sesión) |
| `/eventos` | `EventsPage` | events | todos |
| `/foro` | `ForumPage` | forum | todos |
| `/perfil` | `ProfilePage` | profile | todos; el invitado ve `GuestGate` |
| `/moderacion` | `LegacyModerationRedirect` → `/admin/moderacion` | admin | redirige conservando `?report=` |
| `/admin` | `AdminLayout` + `DashboardPanel` | admin | **solo `admin`** (`AdminLayout` manda al resto a `/mapa`) |
| `/admin/moderacion` | `ReportsPanel` | admin + moderation | admin |
| `/admin/usuarios` | `UsersPanel` | admin | admin |
| `/admin/contenido` | `ContentPanel` | admin | admin |
| `/admin/facultades` | `FacultiesPanel` | admin | admin |
| `/admin/difusion` | `BroadcastPanel` | admin | admin |
| `/admin/actividad` | `ActivityLogPanel` | admin | admin |
| `/admin/mapeo` | `MappingPage` | mapping | admin, solo escritorio |
| `/admin/ajustes` | `SettingsPanel` | admin | admin |
| `*` | redirige a `/mapa` | — | — |

Las rutas públicas cuelgan de `Layout` (barra inferior de cinco columnas). Las de
`/admin` cuelgan de `AdminLayout`, que es el **único** guard del panel: no hay
uno por sección. Un moderador con capacidades no entra a ninguna, aunque la base
le permitiría escribir en el mapeo (`has_capability('mapping')`).

Parámetros de URL que la app entiende: `?notification=<id>` (lo pone `push-sw.js`;
lo consume `NotificationUrlHandler`), `?report=<id>` (en la cola de denuncias),
`?thread=<id>` (en el foro), `?event=<id>` (en eventos), `?pin=<id>` y
`?faculty=<id>` (en el mapa) y `?tab=` (en el perfil).

---

## 4. `src/app` — arranque

| Archivo | Líneas | Qué hace |
|---|---|---|
| `main.tsx` | 32 | Guarda `beforeinstallprompt` en `window.__deferredPwaPrompt`, inicializa `authStore` y monta `StrictMode > GoogleOAuthProvider > QueryClientProvider > BrowserRouter > App`. Importa `i18n` y `styles/index.css` por efecto lateral |
| `App.tsx` | 73 | El router. Además monta `useFacultiesSync` y `usePushForegroundSync` aquí, a propósito, porque el `Sidebar` se desmonta, y `UpdatePrompt` |
| `Layout.tsx` | 132 | Armazón de las rutas públicas: `Outlet`, barra inferior (mapa, eventos, **+**, foro, perfil) y los modales globales: `Sidebar`, `NotificationUrlHandler`, `NotificationBanner`, `LoginModal`, `ProfileSetupModal`, `AboutModal`, `Toast`. Fija el scroll de `window` en (0,0) por el WebView de Android |

Fuera de `src/app`: `src/vite-env.d.ts` declara los globales `__APP_VERSION__` y
`__BUILD_ID__` y parte de `import.meta.env` (le faltan `VITE_GOOGLE_CLIENT_ID` y
`VITE_VAPID_PUBLIC_KEY`, que compilan igual). `src/test/setup.ts` trae los dobles
que jsdom no tiene: `matchMedia`, `ResizeObserver` y un `localStorage` en memoria,
este último porque `uiStore` lee el tema al crearse.

---

## 5. `src/shared` — lo que no es de ningún dominio

### `shared/lib` — clientes externos

| Archivo | Qué hace |
|---|---|
| `supabase.ts` | El cliente, o `null` en modo demo. Exporta `supabase`, `isSupabaseConfigured`, `PHOTOS_BUCKET` |
| `queryClient.ts` | `QueryClient` global: `staleTime` 30 s, `retry` 1, sin recarga al enfocar |
| `i18n.ts` | **1102 líneas**: la configuración de i18next con todos los textos ES/EN en línea. Se usa como `t('clave', 'respaldo')` |
| `publicProfiles.ts` | Resuelve nombre y avatar de autores ajenos por la vista `profiles_public` (la RLS de `profiles` solo deja ver el propio) |
| `useNowTick.ts` | Reloj compartido (30 s) que se pausa con la pestaña oculta; recalcula eventos en curso y pines por vencer |

### `shared/stores` — zustand

| Archivo | Qué guarda |
|---|---|
| `uiStore.ts` (243) | El cajón de sastre de la interfaz: tema, campus, modales (login, tutorial, about, crear/editar pin), elegir ubicación, pin que se mueve, pin y facultad seleccionados, ruta (`routeTargetPinId`, `accessibleRoute`), contexto interior (`activeFacultyId`, `activeFloor`), `placeFocus`, toast, `viewMode` 2D/3D, `devUnlockMap` |
| `filterStore.ts` | Filtros de pines: tipos, categoría, facultad, solo favoritos |
| `sidebarStore.ts` | Panel lateral abierto o cerrado y pestaña activa |

### `shared/data` — el catálogo

| Archivo | Qué hace |
|---|---|
| `campusData.ts` (252) | La semilla: `CAMPUSES`, **`FACULTIES` (mutable, sin polígonos)**, `CAREERS`, `CATEGORIES`, `categoryById`, `isFixedInfraCategory`, `academicFaculties`, colores. Es también la fuente de `scripts/gen_seed_full.ts` |
| `facultyStore.ts` (150) | El catálogo vivo: `publishFaculties` (reemplaza `FACULTIES` con `splice`), `useFaculties()`, `subscribeFaculties` (para fuera de React) y todo lo derivado de perímetros: `facultyIdAt`, `facultyPerimeter`, `facultyPerimeterEntries`, `facultyPerimetersGeoJSON` |
| `facultiesApi.ts` | CRUD de la tabla `faculties` con almacén demo |
| `useFaculties.ts` | **Ojo con el nombre:** exporta `useFacultiesSync` (la query que rehidrata el catálogo al arrancar), no `useFaculties`, que está en `facultyStore.ts` |

El ciclo: `campusData` siembra → `useFacultiesSync` (montado una vez en `App`)
pide la tabla → `publishFaculties` reemplaza en el sitio, ignora listas vacías y
sube un contador → `useFaculties()` vuelve a pintar. Devuelve siempre la misma
referencia: lo que provoca el re-render es el contador, no la identidad del array.

### `shared/types/database.ts`

Tipos de las tablas **escritos a mano**, no generados. Cubren lo que consulta el
cliente; omiten a propósito las tablas internas (`pin_creation_events`,
`notification_push_deliveries`, `storage_cleanup_queue`) y no tienen todavía
`activity_log`, `admin_emails`, `careers`, `floor_plans`, `forum_votes`,
`moderator_capabilities`, `pin_votes` ni `push_subscriptions`. Si cambias el
esquema, cámbialos a la par.

### `shared/utils` — lógica pura, cada módulo con su `.test.ts` al lado

| Grupo | Módulo | Qué resuelve | Lo usan |
|---|---|---|---|
| Planta y sala | `floorVisibility.ts` | **La única fuente de la regla de planta** (contexto de facultad): `pinVisibleOnFloor`, `areaVisibleOnFloor` | MapView, mappingLayers, FacultyDetail |
| | `floorValidation.ts` | Espejo en cliente del trigger `validate_pin_floor`, para que el modo demo rechace plantas inexistentes | MapPage, pins |
| | `pinLocation.ts` | `isPinLocationOccupied`: espejo de la regla de unicidad punto + planta | MapPage, pins/api |
| | `roomCode.ts` | Lee `E441.1.S101` y `A-302` **solo para sugerir la planta** | IndoorFields, roomCatalog |
| | `roomCatalog.ts` | Catálogo de salas a partir del horario de la FIC (puro, sin red) | mapping |
| | `roomSearch.ts` | Buscador de salas del mapa | MapPage |
| Geografía | `geo.ts` | Haversine, bounds, punto en polígono, distancias y tiempo caminando (en grados) | map, pins, facultyStore |
| | `geometry.ts` (518) | Geometría del editor **en metros** con proyección local: áreas, perímetros, imanes, ángulos rectos | casi todo `mapping`, MapPage, MapView |
| Tiempo | `expiry.ts` | Ventana de desvanecido (últimas 2 h) y `expires_at` desde el TTL | MapView, pins, FacultyDetail |
| | `eventState.ts` | Fase de un evento (`upcoming`, `live`, `ended`…) | events, map, pins, profile |
| | `datetime.ts` | Fechas relativas como clave i18n + valor | 8 componentes |
| Datos | `dbError.ts` | Separa los errores de base escritos para el usuario (SQLSTATE `P0001`) de los técnicos | events, map, mapping, pins |
| | `rpcErrors.ts` | `isMissingFunction`: ¿la RPC falló porque falta aplicar una migración? Mira `42883`, `PGRST202` y el texto de una **función** que no existe; una columna o tabla que falta no cuenta | admin, notifications |
| | `localized.ts` | `localizedName` según idioma | por todas partes |
| | `vote.ts` | Transición de voto idempotente | forum, pins |
| | `rateLimit.ts` | Reflejo en cliente del límite de 10 pines por día UTC | pins |
| | `facultyShortName.ts` | Sigla de una facultad | FloorSelector |
| | `pinScale.ts` | Escala del marcador según el zoom | MapView |
| PWA | `pwa.ts` | Decide si mostrar el aviso de versión nueva; detecta iOS y modo instalado | UpdatePrompt, TutorialModal, pushStore |
| | `swUpdate.ts` | Aplica la actualización del service worker (espera 30 s al worker, 10 s al `controllerchange`) | UpdatePrompt |

### `shared/ui` — componentes

Primitivas: `Badge`, `Button`, `Spinner`, `Switch`, `Toast`, `UserAvatar`, `FilterPills`,
`ThemeSwitcher`. Diálogos: `Dialog` (envoltorio de Radix; base de casi todos los
modales) y `ConfirmDialog`. Selectores propios: `CustomSelect`, `CustomTimePicker`,
`CustomDateTimePicker` (309). Contenedores: `DraggableBottomSheet` (hoja arrastrable
en móvil, panel fijo en escritorio, con `sheetState.ts`) y `PhotoCarousel`.
`LinkedText` + `shortenUrl.ts` convierten URLs en enlaces cortos. `UpdatePrompt`
es el aviso de versión nueva de la PWA ([PWA_UPDATE.md](PWA_UPDATE.md)).

`Sidebar.tsx` (345) **no es "sin dominio"**: importa de `features/auth` y de
`features/notifications` (monta el `NotificationCenter`). Es otra frontera cruzada;
no añadas más.

### `src/styles/index.css` (883)

Tailwind 4 (`@import 'tailwindcss'`, modo oscuro por **clase** `.dark`, no por
media query). Tokens en `:root` y `.dark`: `--udp-red`, `--surface-*`,
`--border-warm`, `--sidebar-width`. Después, las clases propias: `.pin-marker`
(base `--pin-base: 26px`, variante fija de 22 px para infraestructura y
`.pin-marker--room`), `glass-hud`, `bottom-nav`, los controles de MapLibre y
muchos `@keyframes` con su bloque `prefers-reduced-motion`.

---

## 6. `src/features` — un apartado por dominio

Doce carpetas: `about`, `admin`, `auth`, `events`, `forum`, `map`, `mapping`,
`moderation`, `notifications`, `pins`, `places`, `profile`. **No hay
`onboarding`**: el tutorial vive en `map/TutorialModal.tsx` y el alta de perfil en
`auth/ProfileSetupModal.tsx` (ver ROADMAP §11).

Convención dentro de un feature: `api.ts` para datos, `use*.ts` para hooks de
react-query, `demoStore.ts` para el modo sin Supabase, componentes en PascalCase.

### 6.1 `map` — la pantalla principal (15 archivos)

| Archivo | Líneas | Qué hace |
|---|---|---|
| `MapView.tsx` | 1023 | **Único dueño de la instancia MapLibre.** Crea el mapa, los marcadores DOM, la brújula, el botón de ubicación, las capas y los clics (prioridad área > edificio > perímetro). Exporta `MapView` y `getMapCenter` |
| `MapPage.tsx` | 892 | Orquesta la pantalla: monta `MapView` y los paneles, buscador de salas, crear y mover pin, ruta a pie, geolocalización y giroscopio |
| `mapConfig.ts` | 244 | Estilo OpenFreeMap (claro y oscuro apuntan a la misma URL) y `applyMapThemePalette`, que recolorea capas al estilo Mapbox Standard |
| `facultyLayers.ts` | 231 | Perímetros de facultad (relleno y línea) y edificios 3D de OSM recortados por el perímetro |
| `mappingLayers.ts` | 300 | Capas del mapeo interior: `mapping-buildings-{fill,line,3d,label}` y `mapping-areas-{fill,line,label}`, filtradas por planta. Constantes de zoom: `MAPPING_MIN_ZOOM` (16), `INDOOR_MIN_ZOOM` (17.5), `INDOOR_EXIT_ZOOM` |
| `campusBoundary.ts` | 160 | Máscara fuera del campus, `maxBounds` y `isLocationOutOfBounds`. Solo admin puede desbloquearlo (`devUnlockMap`) |
| `routing.ts` | 89 | Ruta peatonal con OpenRouteService (`foot-walking` o `wheelchair`), con respaldo a OSRM y a línea recta |
| `roomSubtitle.ts` | 19 | Subtítulo de una sala en el buscador |
| `ContextLens.tsx` | 199 | Barra bajo el buscador que une el edificio enfocado y la planta activa (§16 del ROADMAP) |
| `FloorSelector.tsx` | 165 | Selector de planta; pasa a carrusel cuando no hay espacio. Lista las plantas **de la facultad** |
| `WayfinderSheet.tsx` | 246 | Guía de ruta en tres pasos, con el conmutador "Sin escaleras" |
| `FacultyDetail.tsx` | 582 | Ficha de facultad o lugar: pines, plantas y galería |
| `FiltersPanel.tsx` | 216 | Filtros de categorías |
| `TutorialModal.tsx` | 158 | Tutorial del primer arranque (flag `udpmap.tutorial`) |
| `MapView.test.tsx` | 289 | Brújula, desbloqueo solo para admin y prioridad de clic, con MapLibre simulado |

Los paneles hablan con `MapView` solo a través de `uiStore`. `MapView` no usa
`useTranslation`: llama a `i18n.t` directamente porque lo necesita en callbacks
de dependencias vacías.

### 6.2 `mapping` — el editor `/admin/mapeo` (18 archivos)

| Archivo | Líneas | Qué hace |
|---|---|---|
| `MappingPage.tsx` | 1127 | **El archivo de código más grande de `src/`.** Orquesta árbol, lienzo y propiedades; atajos de teclado; todas las mutaciones (guardar, dividir, copiar planta, borrar, colocar sala) y la barra de cobertura |
| `MappingCanvas.tsx` | 873 | Lienzo MapLibre: perímetro, edificios, áreas, pines, fantasma de la planta inferior; dibujo, tiradores e imanes |
| `MappingProperties.tsx` | 693 | Panel derecho: formularios de área, edificio y facultad y los avisos de validación junto al campo |
| `MappingTree.tsx` | 294 | Árbol facultad > edificio > planta, con vista "por edificio" o "por planta" |
| `editorStore.ts` | 334 | zustand del editor: herramienta (`select`, `rect`, `polygon`, `trace`, `room`), borrador, selección, historial de 50 pasos, imanes. `activeFloorOf` es la única fuente de la planta activa |
| `validation.ts` | 197 | Errores (bloquean) y avisos (solapes, dejan seguir) |
| `api.ts` | 203 | Datos del mapeo; con `supabase` null delega en `demoStore.ts` |
| `demoStore.ts` | 86 | Almacén demo; arranca vacío y replica las cascadas a mano |
| `useMapping.ts` | 144 | Query `['mapping','all']` para el mapa público; publica en la caché. `buildingAt`, `areaAt`, `facultyLevels` |
| `mappingCache.ts` | 61 | Caché del mapeo **sin React** e `indoorLocationAt()`; la lee `pins/api.ts` al crear y mover pines |
| `areaStyles.ts` | 85 | Color y etiqueta por tipo de área, `floorName`, `buildingHeightM` (compartido con el mapa) |
| `PinFloorPanel.tsx` | 222 | Pestaña "Pines": reubicar plantas en lote con `adminSetPinFloors` |
| `RoomImportPanel.tsx` | 231 | Importador de salas de la FIC: arma un pin pendiente por sala (no hay alta masiva, a propósito) |
| `salasEit.ts` | 76 | Descarga `salas.docencia-eit.cl/data.json`; nunca lanza, devuelve `[]` si falla. Fuente de terceros sin contrato |
| `export.ts` | 65 | Exporta el mapeo como `buildings.ts` y `areas.ts` |

Atajos reales del editor: `V` seleccionar, `R` rectángulo, `P` polígono, `T`
calcar de OSM, `Enter` cierra el polígono, `Esc`, `Ctrl+Z`/`Ctrl+Y` (y
`Ctrl+Shift+Z`), `Shift` ortogonal, `Alt` sin imán. Dividir en N y Copiar planta
son botones, sin atajo. En móvil el editor solo muestra un aviso.

### 6.3 `pins` y `places` — el ciclo de vida de un post (21 archivos)

Un post es un pin de tipo `report` (caduca según la categoría), `event` (caduca
con `ends_at`) o `place` (permanente).

| Archivo | Líneas | Qué hace |
|---|---|---|
| `pins/api.ts` | 728 | Toda la red de pines: lectura, creación por la RPC `create_pin_with_daily_limit`, edición, programa de evento, fotos, votos (`vote_pin`), verificación (`verify_and_make_permanent`, `unverify_pin`, `extend_pin_ttl`), reubicación, favoritos y comentarios. Cada función con rama demo |
| `pins/demoStore.ts` | 418 | Base demo; reproduce a mano el límite diario, el pin ocupado y la validación de planta |
| `pins/CreatePinModal.tsx` | 847 | Formulario de crear y editar (react-hook-form + zod, el único sitio que los usa). `MAX_DESCRIPTION = 1500` debe coincidir con `pins_description_check` |
| `pins/PinDetail.tsx` | 417 | Ficha del pin |
| `pins/IndoorFields.tsx` | 261 | Planta, código de sala y migas edificio/área dentro del formulario |
| `pins/PinBadges.tsx` | 121 | Insignias de tipo, verificado y expiración |
| `pins/EventSchedule.tsx`, `EventScheduleEditor.tsx`, `eventScheduleRows.ts` | — | Programa horario de un evento (tope de 20 filas) |
| `pins/CommentSection.tsx`, `useComments.ts` | — | Comentarios del pin |
| `pins/usePins.ts` | 81 | Query principal con canal realtime sobre `pins`; publica los límites del mapa (`publishBounds`). Hoy no filtra por viewport |
| `pins/usePinActions.ts` | 101 | Mutaciones; `promote` llama a `verifyPin` |
| `pins/photos.ts` | 72 | Compresión en canvas (1200 px, JPEG 0.75), 5 fotos y 20 MB por pin |
| `places/placePhotos.ts` | 210 | Galería `place_photos` de una facultad, edificio o área (tope de 10) |
| `places/PlaceGallery.tsx` | 240 | Carrusel de la galería; solo lo usa `FacultyDetail` |

`createPin` **no es atómico**: el pin se crea primero y el programa y las fotos
después. Un fallo parcial vuelve como `photosFailed` o `scheduleFailed` y no hay
que tratarlo como fallo total, o el usuario reintenta y choca con
`PIN_LOCATION_OCCUPIED`. Los errores de la RPC se relanzan sin envolver para no
perder el SQLSTATE.

### 6.4 `events` y `forum` (15 archivos)

**events**: un evento es un pin; este feature añade la asistencia.
`api.ts` (RSVP propios, conteo por la RPC `event_rsvp_counts`, asistentes por
`event_attendees`, que solo puede llamar el autor o un admin), `useEvents.ts`
(incluido `useMyEvents`, que usa el perfil), `EventsPage.tsx` (agenda por fase),
`EventCard.tsx` (el conteo público aparece desde `RSVP_PUBLIC_THRESHOLD = 5`, una
decisión de interfaz, no de seguridad), `EventAttendeesDialog.tsx` y
`EventCalendarDialog.tsx` (salto a fecha, no es la vista principal).

**forum**: hilos por facultad o del tablón general (`faculty_id` null).
`api.ts` (votos por la RPC `vote_thread`), `useForum.ts` (realtime sobre
`forum_threads`), `demoStore.ts`, `utils.ts` (`buildCommentTree` **aplana** las
respuestas a un nivel y antepone `@autor`), `ForumPage.tsx` (502),
`ThreadDetailModal.tsx` (552) y `CreateThreadModal.tsx`.

### 6.5 `auth`, `profile` y `about` (24 archivos)

| Archivo | Qué hace |
|---|---|
| `auth/authStore.ts` | Sesión: Google por ID token (`@react-oauth/google`) o por OAuth, más la sesión demo en `localStorage`. Cierra la sesión a correos que no sean `@mail.udp.cl`. `loading` sigue en `true` hasta conocer el rol, para que `AdminLayout` no rebote antes de tiempo. `signOut` da de baja el push del dispositivo con `disablePushOnThisDevice` y cierra sesión aunque eso falle |
| `auth/permissions.ts` | `can(action)`: matriz de rol mínimo (`guest < student < moderator < admin`) e `isUdpEmail`. Solo decide qué dibujar; no conoce las capacidades por persona |
| `auth/useGuard.ts` | `guard(action)`: si no hay permiso, abre el `LoginModal` |
| `auth/LoginModal.tsx` | Botón de Google; en demo ofrece entrar como estudiante o admin |
| `auth/ProfileSetupModal.tsx` | Modal obligatorio para elegir facultad y carrera si `faculty_id === null`. Se monta en `Layout` |
| `profile/pages/ProfilePage.tsx` | `/perfil` con pestañas (reportes, insignias, eventos, ranking) |
| `profile/publicProfileApi.ts` | Perfil público, pines del usuario, insignias y ranking, todo por `profiles_public` (sin correo) |
| `profile/PublicProfileModal.tsx`, `EditProfileModal.tsx` | Perfil ajeno y edición del propio |
| `profile/components/*` | 12 piezas de la vista de perfil (`ProfileView`, `BadgesGrid`, `LeaderboardTable`, `MyEventsList`, `ReportCard`…) |
| `about/AboutModal.tsx` | El modal "Sobre nosotros" con el equipo |

### 6.6 `notifications` y `moderation` (23 archivos)

| Archivo | Qué hace |
|---|---|
| `notifications/api.ts` | Leer, marcar, borrar avisos; registrar o borrar la suscripción push (RPC `register_push_subscription`, con `p_old_endpoint` y respaldo sin él si la base aún no tiene la migración); `getPushSessionUserId`; `markNotificationFromUrl` |
| `notifications/pushStore.ts` | El estado del push fuera de React, una sola instancia. `unknown` pinta un esqueleto, **nunca** "Activar". «Activadas» sale del navegador; lo que sabe el servidor es un campo aparte, `serverSync`. Tiene la **única baja** (`disablePushOnThisDevice`: navegador primero, servidor después) y guarda en `localStorage` (`udpmap.push.endpoint`) el último endpoint que el servidor confirmó |
| `notifications/usePushSubscription.ts` | Hook fino sobre el store y `usePushForegroundSync(userId)`, que `App` monta con el id de usuario: resincroniza al volver a primer plano y, si la sesión termina sin `signOut`, da de baja el dispositivo en local |
| `notifications/useNotifications.ts` | react-query + realtime sobre `notifications` |
| `notifications/notificationMeta.ts` | Iconos por categoría y agrupación por fecha. Una categoría nueva se toca aquí y en el `CHECK` de la tabla |
| `notifications/preferencesApi.ts` | Preferencias por categoría × canal. `moderation` no se puede silenciar |
| `notifications/NotificationCenter.tsx` | La pestaña de avisos del `Sidebar`. No enseña los avisos de audiencia `admin` |
| `notifications/NotificationBanner.tsx`, `NotificationPreferences.tsx`, `PushCard.tsx`, `NotificationUrlHandler.tsx` | Banner en primer plano, interruptores, tarjeta de activar push y el cierre del circuito del toque. `PushCard` no se pinta en modo demo, y con el servidor sin enterarse enseña un aviso con «Reintentar» |
| `notifications/pushLifecycle.test.ts`, `signOut.test.ts`, `registerPushApi.test.ts`, `pushServiceWorker.test.ts` | Ciclo de vida del push (activar, desactivar, sincronizar, sesión, pista de iOS); `signOut` con el `authStore` real; `p_old_endpoint` y su respaldo; y `public/push-sw.js` cargado con un `self` falso. `pushLifecycle` prueba además con qué estado **nace** el store (el parpadeo) |
| `moderation/api.ts`, `useModeration.ts`, `demoStore.ts`, `labels.ts` | Denunciar (`create_content_report`), listar, tomar y resolver. La **cola** se pinta en `admin/ReportsPanel` |
| `moderation/ReportContentDialog.tsx` | Diálogo de denuncia; lo importan pins y forum |

### 6.7 `admin` — el panel (23 archivos)

`AdminLayout.tsx` (el guard y la navegación), `AdminScreen.tsx` (anatomía común
de cada pantalla y estados vacío/cargando/error; el scroll lo tiene la página y
no el layout, porque el editor de mapeo necesita pantalla completa),
`sections.ts` (las nueve secciones; si añades una, toca también `App.tsx`) y
`api.ts` (746: estadísticas, usuarios, pines, suscriptores push, capacidades,
registro de actividad, difusión, prueba push y entregas por servicio).

| Panel | Ruta | Usa |
|---|---|---|
| `DashboardPanel` | `/admin` | `profiles`, `pins`, `content_reports`, `admin_count_push_subscribers` |
| `ReportsPanel` | `/admin/moderacion` | `features/moderation` y la bandeja del equipo |
| `UsersPanel` + `CapabilitiesEditor` | `/admin/usuarios` | `admin_set_user_role`, `admin_user_capabilities`, `admin_set_capability` |
| `ContentPanel` | `/admin/contenido` | `pins` con `pin_photos` |
| `FacultiesPanel` | `/admin/facultades` | `shared/data/facultiesApi`. Reenvía `polygon`, `lat` y `lng` intactos: mandar `polygon` null borra un perímetro |
| `BroadcastPanel` | `/admin/difusion` | `admin_broadcast_push_notification(título, cuerpo, url)`. **Manda push reales a toda la universidad** |
| `ActivityLogPanel` | `/admin/actividad` | `admin_activity_log` |
| `SettingsPanel` | `/admin/ajustes` | `PushCard`; `admin_send_test_push_to_self` (devuelve el id del aviso, que se pasa a `send-push` como `{ notificationId }` para contar sus entregas); `admin_push_delivery_stats` (tarjeta de entregas de los últimos 7 días por servicio) |

Cada función de `api.ts` degrada con un mensaje que nombra la migración que falta
(`isMissingFunction`, de `shared/utils/rpcErrors.ts`, mira `42883`, `PGRST202` y el
texto de una función que no existe). Mantén ese patrón.

Tests del push en este feature: `selfPushTest.test.ts` (la migración que falta se
dice con esas palabras al pulsar «Enviar prueba»), `pushAdmin.test.ts` (qué
mensaje sale de cada resultado de la prueba, cómo se agrupan las entregas por
servicio y el respaldo por función inexistente) y `SettingsPanel.test.tsx` (la
pantalla montada, con cada estado de la tarjeta de entregas).

---

## 7. Dependencias entre features

Las fronteras no se respetan. Antes de añadir una importación cruzada, mira si lo
que necesitas cabe en `shared/`. Lo que hay hoy (sacado con `grep` de los
`import '@/features/…'`; `auth` lo importan casi todos y se omite):

```
map ──────► mapping        (useMapping, facultyLevels, areaStyles)
map ──────► pins           (usePins, PinDetail, CreatePinModal, api.updatePinLocation)
map ──────► places         (PlaceGallery, placePhotos)          ← desde FacultyDetail
map ──────► notifications
pins ─────► mapping        (mappingCache.indoorLocationAt, useMapping, areaStyles)
pins ─────► map            (campusBoundary.BOUNDARY_RECT, en PinDetail)
pins ─────► moderation     (ReportContentDialog)
pins ─────► profile        (PublicProfileModal)
mapping ──► pins, admin, map   (pins/api, admin/api, map/mapConfig)
places ───► pins
events ───► pins           (api, demoStore), profile (PublicProfileModal)
forum ────► moderation, profile
profile ──► pins, events
admin ────► pins (demoStore), moderation, notifications
auth ─────► notifications  (signOut borra la suscripción)
shared/ui/Sidebar ──► auth, notifications                      ← shared → features
```

Los ciclos reales son `map ↔ pins`, `map ↔ mapping` y `pins ↔ mapping`. El panel
monta `MappingPage` en `/admin/mapeo` desde `App.tsx`, no desde `admin`.

---

## 8. `supabase/` — base, migraciones y Edge Functions

| Ruta | Qué es |
|---|---|
| `schema/baseline.sql` (4284) | **La fuente de verdad del esquema.** Reconstruye la base desde cero: 32 tablas, todas con RLS, la vista `profiles_public`, 72 funciones (todas con `search_path` fijo), los triggers, las políticas, Storage y la publicación realtime. Los cron y los secretos de Vault **no** están aquí |
| `migrations/` | 33 migraciones incrementales desde el 2026-08-03. Desde la `20260827000000` cada una trae su `.down.sql` (hay 11). Se aplican **a mano** en el SQL Editor |
| `migrations/README.md` | La regla de los tres archivos |
| `_archive/migrations/` | Las 33 migraciones de julio, ya integradas en el baseline. No se ejecutan |
| `seed/badges.sql` | Las seis insignias, a mano. Sin ellas el quinto pin falla por clave foránea |
| `seed/seed.sql` | **Generado** por `scripts/gen_seed_full.ts` desde `campusData.ts`: campus, facultades (sin perímetros), 39 carreras, categorías, admins |
| `seed/fic_dummy_50_pins.sql` | 56 pines de prueba en la FIC, con un UUID de admin fijo. Solo desarrollo |
| `config.toml` | `verify_jwt = false` para `send-push` y `storage-gc`: el cron manda `x-cron-secret`, no `Authorization` |
| `functions/send-push/index.ts` | Cada minuto drena `notification_push_deliveries` reclamando por RPC con *lease* (`claim_push_deliveries`): lotes de 50, 10 envíos a la vez, cierre en bloque con *fencing* (`finish_push_deliveries`), hasta 6 lotes o unos 40 s. **Ya no encola recordatorios de eventos**: los encola el cron `udp-map-event-reminders`. Al cron le contesta 202 y sigue en segundo plano; el panel espera el resultado. Se autoriza con `x-cron-secret` o sesión de admin. Cuerpo opcional `{ notificationId }`, que solo cuenta si llama un admin: acota la pasada a ese aviso y la respuesta añade el conteo de sus entregas por estado. Cliente de servicio y autorización en `_shared/auth.ts` |
| `functions/send-push/golden.test.ts` | El cerrojo de la regla de oro del push: lee `index.ts` como texto y lo compara, normalizado, con copias literales tomadas de `4eae308` (`sendWebPushNotification`, `navigateUrl`, el objeto del payload híbrido, el bloque de `VAPID_SUBJECT`, el tope de tamaño y la llamada que cifra) y con el hash de `_shared/webpush.ts`. Si falla, cambió algo que viaja al servicio push: se prueba en un iPhone y, si es a propósito, se actualiza la copia en el mismo commit. Lo corre vitest |
| `functions/_shared/webpush.ts` | Cifrado RFC 8291 y VAPID compartidos, sin APIs de Deno. Su `webpush.test.ts` lo corre vitest (vector del RFC, ida y vuelta, firma, clasificación) |
| `functions/_shared/pushQueue.ts` | Lógica pura de la cola: cómo se cierra cada entrega (reintentos y tope `MAX_ATTEMPTS` con el intento ya contado al reclamar), limpieza de `last_error`, el pool de envíos en paralelo y la lectura del `notificationId` del cuerpo (`parseNotificationId`). Su `pushQueue.test.ts` lo corre vitest |
| `functions/_shared/auth.ts` | `requireEnv`, el cliente con la clave de servicio (`supabase-js` con versión fija) e `isAuthorized` (`'cron'`, `'admin'` o `null`), compartidos por `send-push` y `storage-gc` |
| Cron (`pg_cron`) | Cinco trabajos, que **no** están en el baseline: `expire-pins`, `udp-map-storage-gc`, `udp-map-send-push-every-minute`, `udp-map-event-reminders` y `udp-map-prune-push-history`. Los tres de push los versiona la migración `20261021000200`, que reemplaza el de `send-push` del runbook (mismo nombre) con timeout de 10 s; el de `storage-gc`, la `20260803120500`. Tabla en [DATABASE.md §8](DATABASE.md) |
| `functions/storage-gc/index.ts` | Cada 10 min: vacía `storage_cleanup_queue` borrando los binarios de Storage. Se despliega a mano: `npx supabase functions deploy storage-gc` |

Orden para reconstruir: `baseline.sql` → `badges.sql` → `seed.sql`, y después a
mano OAuth, Vault, Edge Functions, cron, `admin_emails` y `.env`
([DATABASE.md §10](DATABASE.md)).

Migraciones vigentes, por tema:

| Tema | Migraciones |
|---|---|
| Storage y fotos | `20260803120000` cola de limpieza · `120100` tope de 5 fotos · `120500` cron de `storage-gc` · `20260805110000` `place_photos` · `20260806000000` Storage de lugares · `20260808000003` galería de áreas |
| Reglas del pin | `20260803120200` campos que edita el autor · `120300` TTL en servidor · `120400` verificar / extender / deshacer · `20260808000002` descripción a 1500 · `20260826000100` mover se autoriza en servidor |
| Eventos | `20260803120600` `pin_schedule_items` · `20260826000200` `event_rsvps` privada (conteos y asistentes por RPC) |
| Mapeo interior y plantas | `20260804100000` `buildings`, `building_floors`, `areas` · `140000` ajustes · `160000` el pin guarda edificio y área · `180000` planta y `room_code` al crear · `200000` editar planta · `20260810000000` el servidor valida la planta |
| Catálogo | `20260805100000` renombre "Competencia" · `20260808000001` `faculties` como fuente de verdad · `20260826000000` categoría `escalera` |
| Avisos y push | `20260827000000` difusión y prueba propia · `20260829000000` avisos de pin verificado y comentario, difusión con enlace · `20260829000100` lista de suscriptores · `20260830000000` dar de baja un dispositivo · `20260831000000` preferencias · `20260831000100` evento oficial avisa a su facultad · `20261021000000` cola de push con *lease*, estado `expired` y rastro que sobrevive a la baja · `20261021000100` `register_push_subscription` con `p_old_endpoint`, `event_rsvps.reminded_at`, difusión que cuenta bien, `wants_notification` solo para el servicio y `admin_push_delivery_stats` · `20261021000200` `prune_push_history` y los trabajos de cron de recordatorios, purga y `send-push` |
| Administración | `20260828000000` `activity_log` · `20260831000200` `moderator_capabilities` y `has_capability` |

---

## 9. `public/`, `scripts/`, CI y herramientas de agentes

**`public/`**: iconos PWA (`pwa-*`, `maskable-icon-512x512.png`,
`apple-touch-icon-180x180.png`, `favicon.*`), logos (`udp-*.png`),
`notification-badge.png` (silueta alfa: Android pinta de blanco los iconos
opacos), `fic.png` (5,4 MB, fuera del precache a propósito) y **`push-sw.js`**,
el service worker de push que el worker generado importa por `importScripts`.
Lleva la clave VAPID pública clavada, ya solo como respaldo de
`pushsubscriptionchange` (que Safari de iOS no dispara): si rotas el par, cámbiala
aquí y en `VITE_VAPID_PUBLIC_KEY`.

**`scripts/`**

| Script | Cómo se corre | Qué hace |
|---|---|---|
| `gen_agents.mjs` | `npm run gen:agents` | Copia `CLAUDE.md` a los cuatro derivados |
| `check_i18n.mjs` | `npm run check:i18n` | Claves y variables ES/EN |
| `gen_seed_full.ts` | A mano, con un ejecutor de TypeScript como `tsx` (no hay script de npm) | Regenera `seed.sql` desde `campusData.ts` |
| `generate-icons.mjs` | `node` | Genera iconos de relleno. **Sobrescribe** los de `public/` |

**`.github/workflows/ci.yml`**: en cada push a `main` y en cada PR, con Node 24:
`npm ci`, `lint`, `typecheck`, `test`, `build`. No corre `check:i18n` ni
`gen:agents -- --check`.

**`.claude/`**: `settings.json` engancha dos acciones a cada edición: el hook
`hooks/check-database-docs.mjs` (avisa si tocaste el esquema y `DATABASE.md`
sigue igual) y la regeneración de los derivados cuando editas `CLAUDE.md`.
`launch.json` define los servidores de vista previa (dev en 5173, preview en
4173 y una instancia "demo"; ver [§13](#13-restos-y-deuda-localizada)).

---

## 10. La documentación: qué leer para qué

| Si vas a… | Lee |
|---|---|
| Hacer cualquier cosa | [`CLAUDE.md`](../CLAUDE.md) — las reglas cortas |
| Saber qué está hecho y qué falta | [ROADMAP.md](ROADMAP.md) — el §1 es diagnóstico histórico; el estado vivo está del §12 en adelante |
| Tocar el esquema, una RPC o una política | [DATABASE.md](DATABASE.md) |
| Entender por qué el código es así | [CONTRIBUTING.md](CONTRIBUTING.md), "Por qué el proyecto es así, y dónde duele" |
| Tocar `room_code`, el importador de salas o la facultad por dirección | [SALAS.md](SALAS.md) |
| Tocar avisos o moderación | [NOTIFICATIONS_AND_MODERATION.md](NOTIFICATIONS_AND_MODERATION.md) y DATABASE.md §4 |
| Tocar el aviso de versión nueva | [PWA_UPDATE.md](PWA_UPDATE.md) |
| Publicar una versión | [CHANGELOG.md](CHANGELOG.md) — lo lee el build: cada línea que empieza por `-` sale en el aviso de actualización |
| Orientarte en el código | Este mapa |

---

## 11. Dónde tocar para…

| Cambio | Archivos |
|---|---|
| Una tabla, columna, RPC o política | Migración nueva + `supabase/schema/baseline.sql` + `docs/DATABASE.md`, y `shared/types/database.ts` si el cliente la lee. Avisa de que hay que aplicarla a mano |
| Una categoría de pin | `shared/data/campusData.ts` → `scripts/gen_seed_full.ts` → `seed.sql`, y una migración con el `INSERT`/`UPDATE` para la base viva |
| Cómo se ve un marcador | `map/MapView.tsx` (y su `renderKey` si añades un dato visible) + `.pin-marker` en `styles/index.css` |
| Qué pines o áreas se ven en una planta | `shared/utils/floorVisibility.ts`, y solo ahí |
| Una capa del mapa | `map/facultyLayers.ts` (perímetros, 3D de OSM) o `map/mappingLayers.ts` (edificios y áreas) |
| El editor de mapeo | `mapping/MappingPage.tsx` (mutaciones y atajos), `MappingCanvas.tsx` (dibujo), `editorStore.ts` (estado), `validation.ts` |
| El formulario de pin | `pins/CreatePinModal.tsx`, `pins/IndoorFields.tsx`, y `pins/api.ts` + `pins/demoStore.ts` para los datos |
| Un tipo de aviso nuevo | Migración (CHECK de `notifications.type`, función `notify_*`) + `notifications/notificationMeta.ts` + `preferencesApi.ts` si es silenciable + `NOTIFICATIONS_AND_MODERATION.md` |
| El envío push | `supabase/functions/send-push/index.ts` + `supabase/functions/_shared/webpush.ts`, `pushQueue.ts` y `auth.ts` (y sus tests) + `public/push-sw.js` (y `pushServiceWorker.test.ts`) + `notifications/pushStore.ts`. Despliega con `npm run deploy:push`, siempre después de aplicar las migraciones de las que depende (ROADMAP §17 tiene el orden). Cifrado, cabeceras y la forma del payload híbrido son lo que hoy entrega en iPhone: no se tocan sin probar en un iPhone |
| Una sección del panel | `admin/sections.ts` + una `<Route>` en `app/App.tsx` + el panel envuelto en `AdminScreen` |
| Un permiso de la interfaz | `auth/permissions.ts` (y su test). El permiso real, en la política RLS |
| Un texto de interfaz | `shared/lib/i18n.ts` en ES y EN, y luego `npm run check:i18n` |
| Las facultades | Nombres e imagen desde `/admin/facultades`; perímetros desde `/admin/mapeo`. Nunca en el repositorio |
| El aviso de versión nueva | `shared/ui/UpdatePrompt.tsx`, `shared/utils/pwa.ts`, `shared/utils/swUpdate.ts`, `vite.config.ts` |
| Las reglas para agentes | `CLAUDE.md` y `npm run gen:agents` |

---

## 12. Trampas transversales

Las que ya están en `CLAUDE.md` (desvanecido, `opacity` de MapLibre, `innerHTML`
del marcador, `map.resize()`, planta como contexto de facultad, `FACULTIES`
mutable, perímetros solo en la base) no se repiten aquí. Estas otras salieron
del escaneo:

- **Nunca reasignes `el.className` de un marcador.** MapLibre le añade
  `maplibregl-marker`; pisarlo deja los pines fuera de sitio. Usa `classList`.
- **Espejos cliente ↔ base.** `floorValidation.ts` (trigger `validate_pin_floor`),
  `pinLocation.ts` (unicidad), `rateLimit.ts` (límite diario),
  `MAX_DESCRIPTION` (`pins_description_check`), los topes de `photos.ts` y el
  modo demo de cada `api.ts` repiten reglas que impone la base. Si cambias el SQL,
  cambia el espejo.
- **`geometry.ts` trabaja en metros; `geo.ts`, en grados.** No los mezcles.
- **El código de sala se guarda tal cual.** Toda comparación pasa por
  `normalizeRoomCode`; `parseRoomCode` solo sugiere la planta.
- **`mappingCache` empieza vacío.** Un pin creado antes de que cargue el mapeo
  queda sin edificio ni área.
- **El orden alfabético de los triggers `BEFORE` sobre `pins` es un contrato**:
  `authorize` < `prevent` < `protect` < `validate`. No los renombres.
- **`event_rsvps` solo se lee por filas propias.** Conteos por `event_rsvp_counts`,
  nombres por `event_attendees`. No vuelvas a hacer `select` a la tabla.
- **`/moderacion` no se puede quitar**: `notify_content_report` sigue guardando esa
  URL en cada aviso.
- **`docs/CHANGELOG.md` es insumo del build.** Moverlo o cambiar su formato rompe
  el aviso de actualización.
- **`gen:agents -- --check` falla en Windows con `core.autocrlf=true`** aunque el
  contenido coincida: compara byte a byte y los archivos tienen CRLF. Antes de
  creer que hay deriva, compara sin finales de línea.
- **Las citas `archivo:línea` de ROADMAP y SALAS envejecen.** Los archivos crecen;
  busca por el nombre del símbolo antes de fiarte del número.

---

## 13. Restos y deuda localizada

**Archivos sin uso en la raíz** (nadie los referencia):

- `bundle.mjs` — bundle viejo de `gen_seed_full.ts` que arrastra perímetros de
  `facultyPerimeters.ts`, un archivo ya borrado. Contradice la regla de que los
  perímetros solo viven en la base.
- `geocode.js` — geocodificaba direcciones UDP con Nominatim.
- `engineering_polygon.json` — un perímetro de Ingeniería suelto.

**Desajustes conocidos que no son de documentación:**

- `.claude/launch.json`, configuración `udp-map-demo`: pasa `--mode demo`, pero
  ningún código lee ese modo. El modo demo depende solo de que falten las
  variables de Supabase, y con un `.env` presente la instancia arranca contra la
  base real.
- `index.html` declara `theme-color` `#D41F2D`; el manifiesto PWA, `#9d2235`.
- `vite-env.d.ts` no declara `VITE_GOOGLE_CLIENT_ID` ni `VITE_VAPID_PUBLIC_KEY`.
- El modo demo usa `faculty_id` `'ingenieria'` en `authStore` y `'fic'` en
  `publicProfileApi`.
- La cadena "Centro de Alumnos FIC" está clavada en el cliente
  (`CreateThreadModal`, `CreatePinModal`, `PinDetail`, `pins/api.ts`,
  `pins/demoStore.ts`) y en `verify_and_make_permanent` (ROADMAP §13.4).

**Archivos que ya pasaron de tamaño** (la tabla con el porqué está en
CONTRIBUTING.md, "Deuda estructural conocida"): `mapping/MappingPage.tsx` (1127),
`map/MapView.tsx` (1023), `map/MapPage.tsx` (892), `mapping/MappingCanvas.tsx`
(873), `pins/CreatePinModal.tsx` (847), `pins/api.ts` (728),
`mapping/MappingProperties.tsx` (693).

---

## Cómo mantener este mapa

- Si creas, borras o mueves un archivo, o una carpeta cambia de propósito, toca la
  fila correspondiente en el mismo commit.
- Si añades una ruta, una sección del panel, una Edge Function o una migración,
  añádela a su tabla.
- No copies aquí reglas que ya están en `CLAUDE.md` ni el esquema que explica
  `DATABASE.md`: enlázalos.
