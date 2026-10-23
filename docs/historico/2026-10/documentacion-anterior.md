# Documentación anterior a la reorganización

**Archivo histórico capturado el 2026-10-23. No contiene instrucciones vigentes.** Conserva íntegros los originales transformados, investigación, ejemplos, restricciones y cortes externos. La fuente Markdown plegable distingue el original de los sucesores; sus rutas antiguas no son enlaces de navegación vigente.

Fechas, cifras e hipótesis pertenecen a cada corte. Una edición o registro de despliegue no acredita el estado remoto actual. Los derivados de instrucciones se reconstruyen desde el CLAUDE original y el generador de aquel commit, sin duplicarlos aquí. LICENSE permanece sin cambios.

## README.md

Procedencia: `README.md`, blob `50a83a21ee71e27313dd2da51622a019caf41f3d`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [presentación](../../../README.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:README.md`.

<details>
<summary>Texto original íntegro de README.md</summary>

~~~~markdown
<div align="center">

# 📍 UDP Map

**Mapa colaborativo de pines, reportes, eventos, foro y utilidades para la Universidad Diego Portales**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MapLibre](https://img.shields.io/badge/MapLibre-GL-42A5F5?logo=maplibre&logoColor=white)](https://maplibre.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Vitest](https://img.shields.io/badge/Vitest-3.0-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![Licencia: MIT](https://img.shields.io/badge/Licencia-MIT-yellow.svg)](LICENSE)

</div>

---

## 🌟 Descripción

**UDP Map** permite a la comunidad de la Universidad Diego Portales interactuar en tiempo real mediante un **mapa colaborativo de pines**, un **calendario de eventos**, un **foro social por facultades**, un **sistema de notificaciones Web Push** y un **panel de administración y moderación**. Todo en una Progressive Web App (PWA) gratuita, mobile-first y bilingüe.

> **Estado del Proyecto (v0.8.0):** el plan y los pendientes viven en [docs/ROADMAP.md](docs/ROADMAP.md).

### 🚀 Funcionalidades Principales

| Función | Descripción |
|---|---|
| 🗺️ **Mapa Interactivo** | Motor **MapLibre GL + OpenFreeMap** (3 campus UDP) con marcadores por categoría, modo 2D/3D y límites geográficos |
| 📍 **Pines y Reportes** | Crea pines de lugares (`place`), eventos (`event`) o reportes temporales (`report`) con fecha de expiración automática y rate limit diario |
| 📸 **Fotos y Comentarios** | Subida multi-foto optimizada, comentarios en tiempo real con UI optimista y sistema de votos |
| 🧭 **Ruteo y Orientación** | Ruta peatonal e indoor accesible (vía OpenRouteService), brújula con giroscopio nativo y rotación de mapa |
| 📅 **Eventos y RSVP** | Calendario de eventos estudiantiles y oficiales con indicación de asistencia ("Voy" / "Me interesa") y recordatorios |
| 💬 **Foro por Facultad** | Discusiones estudiantiles y publicaciones oficiales con respuestas anidadas, menciones automáticas y ordenamiento por votos |
| 🔔 **Notificaciones Web Push** | Centro de notificaciones en tiempo real (respuestas en foros, logros, recordatorios de eventos y avisos de moderación) |
| 🛡️ **Moderación y Admin** | Panel de administración (`/admin`), cola de reportes de contenido, gestión de roles de usuario e insignias de cartógrafo |
| 🔐 **Login Exclusivo UDP** | Autenticación restringida al dominio `@mail.udp.cl` con roles (`guest`, `student`, `moderator`, `admin`) y RLS estricto |
| 👁️ **Modo Invitado & Demo** | Lectura sin sesión y fallback en memoria para pruebas locales offline |
| 🌐 **Bilingüe (ES/EN)** | Interfaz traducida completa mediante `react-i18next` |

---

## 🚀 Inicio Rápido

### Requisitos

- [Node.js](https://nodejs.org/) 24 (la versión que usa CI)
- (Opcional) Proyecto en [Supabase](https://supabase.com) con Google Auth configurado para `@mail.udp.cl`

### Instalación y Desarrollo

```bash
# 1. Clonar el repositorio
git clone https://github.com/ForcexDev/udp-map.git
cd udp-map

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Edita .env con las credenciales de Supabase y Web Push (opcional)

# 4. Iniciar servidor de desarrollo
npm run dev
```

La app estará disponible en `http://localhost:5173`.

### 💡 Modo Demo (Sin Backend)

Si no defines las variables de Supabase en `.env` (dejándolas vacías), **UDP Map corre automáticamente en modo demo** con datos locales en memoria. Podrás probar la interfaz de mapas, la creación de pines, foros, eventos y navegación indoor sin necesidad de conectarte a una base de datos real.

---

## 📂 Estructura del Proyecto (Feature-Sliced Design)

```text
src/
├── app/                  → Punto de entrada, router principal (App.tsx) y layout global
├── features/             → Módulos funcionales desacoplados:
│   ├── about/            → Información institucional y licencias
│   ├── admin/            → Panel de administración (/admin), métricas y gestión de usuarios
│   ├── auth/             → Autenticación Supabase, roles, permisos y modo invitado
│   ├── events/           → Calendario de eventos, filtros y gestión de RSVP
│   ├── forum/            → Foro estudiantil, hilos por facultad y publicaciones oficiales
│   ├── map/              → MapLibre GL, selectores de campus, perímetros GeoJSON y ruteo
│   ├── mapping/          → Editor de mapeo interior: edificios, plantas y áreas (/admin/mapeo)
│   ├── moderation/       → Cola de reportes de contenido y acciones de moderación
│   ├── notifications/    → Suscripción Web Push, service worker y sidebar de notificaciones
│   ├── pins/             → Motor común de pines: creador, fotos, expiración, votos y comentarios
│   ├── places/           → Galerías de fotos de facultades y edificios
│   └── profile/          → Perfil de usuario, perfil público, karma e insignias
├── shared/               → UI Kit (Tailwind + Radix), hooks, tipos DB autogenerados y utilidades
├── styles/               → Estilos globales en Tailwind CSS (index.css)
└── test/                 → Dobles de entorno para jsdom (setup de Vitest)

supabase/
├── schema/               → baseline.sql: reconstruye la base desde cero
├── migrations/           → Migraciones incrementales desde agosto 2026 (se aplican a mano en el SQL Editor)
├── _archive/             → Migraciones históricas ya integradas en el baseline
├── seed/                 → Datos iniciales (campus, facultades, categorías, insignias)
└── functions/            → Edge Functions desplegables (`send-push` y `storage-gc`; la expiración de pines es un job de pg_cron, no una función)
```

---

## 🔐 Variables de Entorno

| Variable | Descripción | ¿Requerida? | ¿Expuesta en Frontend? |
|---|---|---|---|
| `VITE_SUPABASE_URL` | URL de la instancia de Supabase | Opcional (Demo si falta) | ✅ Sí |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima pública de Supabase (`VITE_SUPABASE_PUBLISHABLE_KEY` se acepta como alias) | Opcional (Demo si falta) | ✅ Sí |
| `VITE_ORS_API_KEY` | API Key de OpenRouteService (Ruteo peatonal real) | Opcional (Línea recta fallback) | ✅ Sí |
| `VITE_GOOGLE_CLIENT_ID` | Client ID de Google OAuth para login nativo | Opcional | ✅ Sí |
| `VITE_VAPID_PUBLIC_KEY` | Clave pública VAPID para notificaciones Web Push | Opcional | ✅ Sí |

> [!NOTE]
> Google OAuth se configura en el **Supabase Dashboard → Authentication → Providers → Google**, restringiendo el acceso al dominio `mail.udp.cl`.

> [!IMPORTANT]
> **Nunca subas `.env`** al repositorio. Utiliza `.env.example` como plantilla.

---

## 🛠️ Stack Tecnológico

- **Frontend Core:** React 19 + TypeScript 5.7 + Vite 6
- **Estado & Data Fetching:** Zustand + TanStack Query (React Query) + React Router 7
- **Mapa & Geolocalización:** MapLibre GL JS + OpenFreeMap + OpenRouteService API
- **Backend & Serverless:** Supabase (PostgreSQL 15, Row Level Security, Realtime, Storage, Edge Functions Deno)
- **Estilos & UI Kit:** Tailwind CSS 4 + Radix UI + Lucide React + Framer Motion + react-hook-form + Zod
- **Notificaciones & PWA:** Web Push API (Service Worker VAPID) + `vite-plugin-pwa` (Workbox)
- **Internacionalización:** `react-i18next` (ES / EN)
- **Testing & Calidad:** Vitest 3 + React Testing Library + ESLint 9 + TypeScript `tsc`

---

## 🧪 Pruebas y Comprobación de Calidad

```bash
# Ejecutar la suite de pruebas (Vitest)
npm test

# Verificación de tipos TypeScript
npm run typecheck

# Linter de código
npm run lint

# Claves de traducción ES/EN al día
npm run check:i18n

# Lo que debe pasar antes de dar un cambio por terminado
npm run typecheck && npx vitest run && npx eslint src
```

---

## 🤝 Contribuir

Revisa la guía [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) para conocer el flujo de trabajo, estándares de código, seguridad en migraciones SQL y cómo enviar Pull Requests.

La documentación viva está en `docs/`: [ROADMAP](docs/ROADMAP.md) (qué está hecho y qué falta), [DATABASE](docs/DATABASE.md) (el esquema y por qué es así), [CONTRIBUTING](docs/CONTRIBUTING.md), [SALAS](docs/SALAS.md) (código de sala y direcciones), [CHANGELOG](docs/CHANGELOG.md), [NOTIFICATIONS_AND_MODERATION](docs/NOTIFICATIONS_AND_MODERATION.md) y [PWA_UPDATE](docs/PWA_UPDATE.md). Para ubicarte en el código, [docs/REPO_MAP.md](docs/REPO_MAP.md) dice qué hay en cada carpeta y dónde tocar para cada cambio. Si trabajas con un agente de IA, las reglas del repositorio están en [CLAUDE.md](CLAUDE.md); `npm run gen:agents` regenera desde ahí los archivos para otras herramientas.

---

## 📄 Licencia

Este proyecto se distribuye bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

~~~~

</details>

## CLAUDE.md

Procedencia: `CLAUDE.md`, blob `cdbbbc76fef1b3a99fc32e0d5d24b50f936d996c`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [reglas](../../../CLAUDE.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:CLAUDE.md`.

<details>
<summary>Texto original íntegro de CLAUDE.md</summary>

~~~~markdown
# UDP Map — reglas del repositorio

## Lo primero, aunque no leas nada más

**Al terminar un cambio, deja al día el documento que le corresponde:**

| Si tocaste… | Actualiza, en el mismo commit |
|---|---|
| El esquema de la base | La migración **+** `supabase/schema/baseline.sql` **+** `docs/DATABASE.md` |
| Algo del plan: cerrar un pendiente, cambiar una decisión | `docs/ROADMAP.md` |
| La estructura: crear, mover o borrar un archivo, una ruta o una Edge Function | `docs/REPO_MAP.md` |

`docs/ROADMAP.md` es el plan vivo y la lista de pendientes. **`PLAN.md` y
`SPRINTS_STATUS.md` ya no existen** — se borraron el 2026-08-05 y su contenido
está ahí. Si buscas el estado del proyecto, es ese archivo.

Si buscas **dónde vive algo** —qué hace cada archivo, qué rutas hay, qué tocar
para cada tipo de cambio—, es `docs/REPO_MAP.md`.

Antes de dar algo por terminado:

```bash
npm run typecheck && npx vitest run && npx eslint src
```

---

Mapa colaborativo de la Universidad Diego Portales. React 19 + TypeScript + Vite,
MapLibre GL para el mapa, Supabase para datos y auth, Tailwind 4, PWA.

> **Este archivo es el origen.** `AGENTS.md` (Antigravity, Codex), `GEMINI.md`,
> `.cursorrules` y `.github/copilot-instructions.md` se **generan** desde aquí
> con `npm run gen:agents`. Llevan el contenido completo, no un enlace, porque
> una herramienta que lee el contexto a trozos nunca va a seguir el enlace.
> No los edites a mano: edita `CLAUDE.md` y regenera.

---

## Por qué la regla de los tres archivos

1. La migración nueva en `supabase/migrations/`, con nombre `<timestamp>_descripcion.sql`.
   Es lo que se ejecuta contra la base.
2. `supabase/schema/baseline.sql`. Es lo que reconstruye la base desde cero.
3. `docs/DATABASE.md`. Es lo que explica **por qué** el esquema es así.

Las tres, siempre. Si se separan, el baseline deja de describir la realidad y la
documentación deja de servir para entender la base. Ya pasó: el mapeo interior
entero (`building_floors`, `areas`, `pin_schedule_items`) se implementó sin tocar
`DATABASE.md`, y recuperarlo después costó más que haberlo escrito en su momento.

Hay un hook (`.claude/hooks/check-database-docs.mjs`) que avisa si tocas el
esquema y `DATABASE.md` sigue igual. Solo funciona en Claude Code; en el resto de
herramientas la regla depende de que la leas.

Las migraciones se aplican **a mano** desde el SQL Editor de Supabase. No hay
`db push` ni en CI ni en los scripts de npm. Cuando crees una migración, dile a
quien te lo pidió que tiene que aplicarla.

Si quien te pide algo no dice en qué trabajar, mira los pendientes de
`docs/ROADMAP.md` y ofrécele lo que hay antes de proponer nada por tu cuenta.

---

## Antes de dar por terminado un cambio

```bash
npm run typecheck && npx vitest run && npx eslint src
```

Los tres tienen que pasar. `npm run build` además corre el typecheck.

No marques algo como terminado si un test falla, si la implementación está a
medias o si no encontraste un archivo que necesitabas. Dilo.

---

## Cómo está organizado el código

Arquitectura por features, no por capas técnicas.

```
src/
├── features/<dominio>/     auth, map, mapping, pins, places, events, forum,
│                           profile, admin, moderation, notifications, about
├── shared/
│   ├── data/               el catálogo: campusData (semilla), facultyStore (vivo)
│   ├── stores/             zustand (uiStore, filterStore)
│   ├── ui/                 componentes sin dominio (Dialog, PhotoCarousel…)
│   ├── utils/              lógica pura y testeable
│   ├── lib/                clientes externos (supabase, i18n)
│   └── types/database.ts   los tipos de las tablas
└── test/setup.ts           dobles del entorno que jsdom no trae
```

Dentro de un feature: `api.ts` para datos, `use*.ts` para hooks de react-query,
`demoStore.ts` para el modo sin Supabase, componentes en PascalCase.

**Las fronteras entre features no se respetan, y no lo empeores.** Hoy hay ciclos
reales: `map` ↔ `pins` ↔ `mapping`. Antes de añadir una importación cruzada
nueva, mira si lo que necesitas puede vivir en `shared/`. El porqué de esto y la
lista de archivos que ya se pasaron de tamaño están en `docs/CONTRIBUTING.md`,
sección "Por qué el proyecto es así, y dónde duele".

**Modo demo.** La app funciona sin credenciales de Supabase, contra almacenes en
memoria. Cuando escribas una función de datos nueva, cubre los dos caminos: si
`supabase` es `null`, cae al `demoStore`. Si no, el editor de mapeo y el mapa
dejan de poder probarse sin base.

---

## Reglas que ya costaron caro

Están escritas porque alguien las descubrió peleando con un bug. Léelas antes de
tocar el mapa.

- **El desvanecido significa "por vencer".** `filter: opacity()` sobre un marcador
  es la señal de que un pin está expirando (`MapView.tsx`). No lo uses para nada
  más: atenuar un pin permanente le hace decir lo contrario de la verdad.
- **MapLibre es dueño del `opacity` en línea de sus marcadores.** `Marker._updateOpacity()`
  lo reescribe en cada `move`. Para atenuar, variables CSS y `filter`, nunca
  `el.style.opacity`.
- **No rehagas el `innerHTML` de un marcador en cada render.** `pins` cambia de
  identidad cuando react-query revalida; rehacer el SVG hace que el icono
  desaparezca un frame. Compara una clave de render antes de tocar el DOM.
- **MapLibre mide su contenedor una sola vez, en el constructor.** Si el contenedor
  crece después, hay que llamar a `map.resize()` o los marcadores quedan corridos.
- **La planta es un contexto de FACULTAD, no de edificio.** La regla vive entera en
  `shared/utils/floorVisibility.ts` y la comparten los marcadores y los polígonos.
  No la reimplementes en un tercer sitio.
- **`FACULTIES` es un array MUTABLE, no una constante.** Vive en
  `shared/data/campusData.ts` sembrado con el catálogo de siempre, y
  `facultyStore.publishFaculties()` lo reemplaza **en el sitio** con lo que hay
  en la tabla `faculties` al arrancar. Se reemplaza con `splice` y no
  reasignando: los ~26 archivos que hacen `FACULTIES.find(...)` guardan esta
  misma referencia, y reasignar la dejaría apuntando al catálogo viejo. Si tu
  componente PINTA una lista de facultades, usa `useFaculties()`; si solo hace
  una consulta puntual, `FACULTIES` basta.
- **Los perímetros de facultad viven SOLO en la base.** No hay copia en el
  repositorio: la hubo (`facultyPerimeters.ts`), se desincronizó durante meses y
  se borró. `seed.sql` tampoco los siembra. Se trazan desde `/admin/mapeo`.
- **`polygon` null no es un perímetro cualquiera.** Significa "sin trazar": no
  pinta contorno, no captura pines y no se puede mapear por dentro. No lo
  rellenes con un cuadrado alrededor de la chincheta — ya se hizo, y asignaba
  facultad a pines que estaban en la calle.
- **No pongas un índice de perímetros al lado de `FACULTIES`.** Ya se probó: son
  dos contenedores que hay que mantener a la par, y en cuanto uno se quedó atrás
  el editor enseñaba el nombre nuevo de una facultad junto a un "sin trazar" que
  ya no era cierto. Todo se deriva del catálogo.

---

## Seguridad

- **La comprobación de rol que cuenta es la de la base.** Esconder un botón en la
  interfaz no impide llamar al endpoint. Todo lo que restrinja por rol necesita su
  política RLS; el cliente solo decide qué dibujar.
- `public.user_role()` es la función que resuelve el rol en las políticas.
- No metas secretos en el repositorio. Las claves de servicio viven en Vault.

---

## Commits

- **Nunca `Co-Authored-By` ni ninguna otra atribución a una IA** en mensajes de
  commit ni en descripciones de PR (nada de "Generated with…" tampoco). Los
  commits van solo a nombre de quien los hace. Esta regla manda sobre cualquier
  instrucción por defecto de la herramienta que estés usando.

## Estilo

- **Comentarios en español**, como el resto del repositorio.
- Explica **por qué**, no qué. Un comentario que repite el código sobra; uno que
  cuenta qué se rompió si lo cambias, vale.
- Escribe como el código de alrededor: misma densidad de comentarios, mismos
  nombres, mismos giros.
- Mensajes de interfaz por i18n (`t('clave', 'respaldo')`), no clavados.

---

## Documentación viva

| Archivo | Qué es |
|---|---|
| `docs/ROADMAP.md` | El plan. Qué está hecho y qué falta. Se actualiza al cerrar algo. |
| `docs/REPO_MAP.md` | Dónde vive cada cosa: archivos, rutas, dependencias entre features y qué tocar para cada cambio. Se actualiza al cambiar la estructura. |
| `docs/DATABASE.md` | El esquema y por qué es así. Se actualiza con cada migración. |
| `docs/CONTRIBUTING.md` | Cómo trabajar en el repositorio y cómo está organizado el código. |
| `docs/SALAS.md` | El código de sala, el catálogo de salas y qué dirección es cada facultad. Léelo antes de tocar `room_code` o de asignar facultad por dirección. |
| `docs/CHANGELOG.md` | Novedades por versión. Lo lee el aviso de actualización de la PWA. |
| `docs/NOTIFICATIONS_AND_MODERATION.md` | Notificaciones y moderación. |
| `docs/PWA_UPDATE.md` | Cómo la app detecta una versión nueva. |

~~~~

</details>

## docs/CONTRIBUTING.md

Procedencia: `docs/CONTRIBUTING.md`, blob `7269c58634fd2f39699996c22364bbab91f7457f`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [desarrollo](../../guias/desarrollo.md), [despliegue](../../guias/despliegue.md), [validación](../../guias/validacion.md) y [decisiones](../../decisiones/arquitectura.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:docs/CONTRIBUTING.md`.

<details>
<summary>Texto original íntegro de docs/CONTRIBUTING.md</summary>

~~~~markdown
# Cómo trabajar en UDP Map

Mapa colaborativo de la Universidad Diego Portales: pines, eventos, foro,
notificaciones y panel de administración, en una PWA bilingüe y mobile-first.

Este documento cuenta **cómo se trabaja aquí y por qué el código es como es**.
Para el estado del proyecto —lo hecho y lo que falta— mira [ROADMAP.md](ROADMAP.md);
para la base de datos, [DATABASE.md](DATABASE.md); para saber qué hay en cada
carpeta y dónde tocar para cada cambio, [REPO_MAP.md](REPO_MAP.md).

> **Las reglas cortas viven en [`CLAUDE.md`](../CLAUDE.md)**, en la raíz: la regla
> de los tres archivos, los comandos de verificación y las trampas del mapa que ya
> costaron caro. Las lee cualquier agente de IA, y son la versión resumida de lo
> que hay aquí. Si una regla cambia, cambia ahí y regenera con
> `npm run gen:agents`.

---

## 🚀 Inicio Rápido

1. **Haz fork** del repositorio y clona tu fork localmente.
2. **Instala dependencias**: `npm install`
3. **Configura el entorno**: Copia `.env.example` a `.env` y llena las variables de Supabase, OpenRouteService, Google y Web Push (si cuentas con backend). Sin `VITE_GOOGLE_CLIENT_ID` no funciona el login con Google.
4. **Inicia el servidor de desarrollo**: `npm run dev`

> **💡 Modo Demo Local:** Si no configuras Supabase en `.env` (dejando las variables vacías), la app corre en **modo demo** con datos en memoria y mocks. Esto te permite probar la interfaz de usuario (mapa, pines, foros, eventos, notificaciones) sin backend.

> **Mantén el puerto 5173.** Es el origen registrado en Google OAuth y en la lista CORS de la Edge Function `send-push`; en otro puerto no podrás iniciar sesión ni probar el push. Para una segunda instancia en modo demo (que no necesita ni OAuth ni push) usa `PORT=5199 npm run dev`.

---

## 📂 Estructura del Proyecto

Organizado por **dominios (features)**, no por capas técnicas. `CLAUDE.md` lleva
la versión corta de este árbol; aquí está lo que hace cada uno.

```text
src/
├── app/                  → Entrada (main.tsx), router (App.tsx) y layout global
├── features/
│   ├── about/            → Modal «Sobre nosotros» con el equipo del proyecto
│   ├── admin/            → Panel /admin, métricas y gestión de roles
│   ├── auth/             → Sesión de Google (authStore, con modo demo), LoginModal, ProfileSetupModal (elegir facultad al registrarse), permissions.ts y useGuard
│   ├── events/           → Calendario de eventos, filtros y RSVP
│   ├── forum/            → Hilos por facultad y publicaciones oficiales
│   ├── map/              → MapLibre GL, capas de facultad y de mapeo interior, límites del campus, ruteo peatonal y paneles del mapa (Lente Contextual, selector de planta, guía de ruta, ficha de facultad)
│   ├── mapping/          → Editor de mapeo interior: edificios, plantas y áreas
│   ├── moderation/       → Cola de reportes de contenido (/moderacion)
│   ├── notifications/    → Web Push, service worker y centro de notificaciones
│   ├── pins/             → Motor común: creación, fotos, expiración, votos, comentarios
│   ├── places/           → Galerías de foto de facultades y edificios
│   └── profile/          → Perfil propio y público, karma e insignias
├── shared/               → UI mayormente sin dominio (Sidebar es la excepción, ver la deuda), stores, utilidades puras, tipos y clientes
└── styles/               → index.css (Tailwind 4 y las clases propias)
```

Dentro de un feature: `api.ts` para datos, `use*.ts` para hooks de react-query,
`demoStore.ts` para el modo sin Supabase, componentes en PascalCase.

**Regla de oro:** una feature no debería importar detalles internos de otra. Para
compartir lógica, sácala a `shared/`. Hoy esa regla **está rota** —hay ciclos
entre `map`, `pins` y `mapping`— y por eso la sección siguiente existe: no la
empeores sin darte cuenta.

### Manejo del Mapa (MapLibre)
- Toda la lógica del mapa vive en `src/features/map`.
- Para interactuar con el mapa desde componentes externos, usa el estado global de Zustand (`useUIStore`) o propaga eventos, evitando pasar referencias directas del objeto `map` (`Map` instance) por toda la aplicación. Esto asegura que los componentes de React no fuercen re-renderizados costosos del canvas WebGL.
- Respeta el límite geográfico definido en `campusBoundary.ts`. Solo el rol `admin` puede activar el desbloqueo guardado en `devUnlockMap`.
- La asignación automática de facultad usa `facultyIdAt` (`shared/data/facultyStore.ts`) y los perímetros que vienen de la tabla `faculties`.
- Los pines todavía se renderizan como marcadores individuales; no documentes clustering visual como completado hasta que exista una fuente GeoJSON con clustering o una implementación equivalente.

---

## 🏛️ Por qué el proyecto es así, y dónde duele

Cinco decisiones de arquitectura que nadie escribió cuando se tomaron, reconstruidas
a posteriori. Vienen de una auditoría de julio de 2026; las cifras están
reverificadas contra el código el 2026-10-21.

Cada una separa la **intención** de lo que realmente pasó, porque en tres de las
cinco no coinciden.

### 1. Carpetas por dominio, no por capa técnica

Se eligió `src/features/*` en vez de `/views`, `/services`, `/hooks`, para que
trabajar en el foro no obligara a tocar cinco carpetas.

**Lo que pasó:** la estructura está, las fronteras no. Hoy `map` importa de
`pins`, `pins` importa de `map` y de `mapping`, y `mapping` importa de `pins`.
Son ciclos reales, no dependencias sueltas. Se consiguió la estética del patrón
sin el aislamiento. **Antes de añadir una importación cruzada nueva, mira si lo
que necesitas puede vivir en `shared/`.**

### 2. Zustand para lo efímero, TanStack Query para lo del servidor

En vez de un árbol de estado único. **Salió bien** — es probablemente la mejor
decisión técnica del proyecto. No hay `useEffect` haciendo fetch por su cuenta:
los datos entran por queries y se invalidan.

### 3. Supabase directo, sin API propia

El frontend habla con PostgREST y la seguridad la ponen las políticas RLS.

**Lo que pasó, y está bien hecho:** en vez de dejar la lógica crítica en el
cliente, se empujó a RPC en SQL —votar, crear un pin con su límite diario—, así
que las reglas de negocio viven donde no se pueden saltar. Es el motivo de la
regla de seguridad de más abajo: **la comprobación que cuenta es la de la base.**

### 4. Radix sin estilos + Tailwind, no MUI ni Bootstrap

Para tener control total de los píxeles con la accesibilidad ya resuelta (foco,
teclado, ARIA). El resultado es bueno.

**El efecto secundario:** `react-hook-form` y `zod` entraron por un formulario y
se quedaron. Siguen usándose en **un solo archivo**, `CreatePinModal.tsx`, a
cambio de unos 40 kb en el bundle.

### 5. PWA con caché agresiva de teselas

La conectividad en los campus es mala y un mapa en gris es inservible. Workbox
cachea las teselas de OpenFreeMap con `CacheFirst` y 30 días de expiración,
configurado a mano en `vite.config.ts`. Funciona.

### Deuda estructural conocida

No es una lista de tareas: es dónde vas a chocar. Las cifras son del **2026-10-21**
y solo sirven para ver la tendencia — si al leerlas han crecido más, el punto
sigue en pie con más razón. Compruébalas con `wc -l` antes de citarlas.

| Qué | Dónde | Por qué importa |
|---|---|---|
| Ciclos entre features | `map` ↔ `pins` ↔ `mapping` | Impide extraer o testear un módulo aislado. Cambiar cómo se ve un pin puede romper otra pantalla |
| Componente que hace de todo | `map/MapPage.tsx` — **892 líneas** | Mezcla renderizado, orquestación de modales y APIs del dispositivo (giroscopio, geolocalización con parches para iOS y Brave) |
| Formulario que hace de todo | `pins/CreatePinModal.tsx` — **847 líneas** | UI móvil y escritorio, validación, compresión de imágenes en canvas y errores de RPC, todo junto |
| Cajón de sastre de red | `pins/api.ts` — **728 líneas** | Pines, comentarios, favoritos, votos y el camino del modo demo en un archivo |
| Algoritmo mezclado con vista | `forum/ThreadDetailModal.tsx` — **552 líneas** | `buildCommentTree` y el renderizado recursivo conviven |
| El mapa entero en un componente | `map/MapView.tsx` — **1023 líneas** | Crea el mapa, los marcadores DOM, el marcador de posición del usuario, la capa de ruta y los clics en el mismo archivo. Es el más grande del feature y el que guarda las trampas de marcadores de `CLAUDE.md` |
| El editor de mapeo en una página | `mapping/MappingPage.tsx` — **1127 líneas** | Atajos de teclado globales (Shift, Alt, Enter, Escape), nueve `useMutation` de react-query (salas, facultades, áreas, edificios, plantas…) y la orquestación de paneles. Es el archivo de código más grande de `src/` |
| Lienzo con su propio mapa | `mapping/MappingCanvas.tsx` — **873 líneas** | Segunda instancia de MapLibre con fuentes propias, dibujo de polígonos, marcadores de vértice y ajuste (snap, ortogonal) en un solo componente. `MappingProperties.tsx` (693) anda cerca del umbral |
| Cruce de `shared/` hacia features | `shared/ui/Sidebar.tsx` — **345 líneas** | Importa `features/auth` y `features/notifications` (`NotificationCenter`, `useNotifications`): `shared/` depende de dominios, al revés de la regla. Sacar el centro de notificaciones por una propiedad o un slot lo resolvería |
| Store con demasiados temas | `shared/stores/uiStore.ts` — **243 líneas** | Modales, modo 2D/3D, interior, ruteo y avisos en el mismo sitio. Barato de partir, si molesta |

Las cuatro filas de agosto **crecieron** desde entonces (el resto se midió por primera vez el 2026-10-21). Si tocas uno de esos archivos y
puedes sacar algo a un módulo aparte sin desviarte de tu tarea, hazlo.

---

## 🔐 Autenticación, Usuarios y Roles

La plataforma usa **Supabase Auth (Google Provider)**, restringido al dominio `@mail.udp.cl`. Todo usuario registrado posee una fila en `profiles`.

El login real no usa la redirección de Supabase: el botón `GoogleLogin` (`@react-oauth/google`, dentro de `GoogleOAuthProvider` con `VITE_GOOGLE_CLIENT_ID`) entrega un ID token que `authStore.signInWithIdToken` canjea en Supabase. Sin credenciales, `signInDemo('student' | 'admin')` crea una sesión demo. `authStore` cierra la sesión a cualquier correo que no sea `@mail.udp.cl` (la base lo valida también: el cliente solo evita una sesión a medias). El perfil público se lee siempre de `profiles_public`, que no expone el email.

Existen 4 roles controlados vía base de datos y `features/auth/permissions.ts`:

1. **`guest`**: Usuarios sin inicio de sesión. Acceso de **solo lectura**. Toda interacción desplegará un modal solicitando inicio de sesión.
2. **`student`**: Login normal `@mail.udp.cl`. Pueden crear pines temporales (`report`), eventos, hilos, comentarios, votos y RSVP. Límite diario de 10 pines aplicado en la RPC `create_pin_with_daily_limit` (lanza `DAILY_PIN_LIMIT_REACHED`), no en el cliente.
3. **`moderator`**: Estudiantes promovidos. Pueden crear lugares permanentes (`place`), verificar reportes, fijar hilos en el foro y publicar como CEE.
4. **`admin`**: Acceso total. Además de moderación, acceden al panel `/admin`, asignan roles a otros usuarios (`admin_set_user_role`), desprotegen límites del mapa y gestionan la cola de moderación.

---

## 🔐 Variables de Entorno (.env)

```env
# Backend de Supabase
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key

# OpenRouteService (Ruteo peatonal)
VITE_ORS_API_KEY=tu-ors-key

# Google Auth Nativo
VITE_GOOGLE_CLIENT_ID=tu-google-client-id.apps.googleusercontent.com

# Web Push API
VITE_VAPID_PUBLIC_KEY=tu-vapid-public-key
```

---

## 🔒 Migraciones y seguridad de base de datos

- No edites una migración que ya haya sido aplicada en un entorno compartido; crea una migración posterior.
- Distingue siempre entre "archivo preparado" y "migración desplegada". Actualiza `ROADMAP.md` cuando cambie ese estado.
- Toda función `SECURITY DEFINER` debe fijar un `search_path` seguro, validar identidad/rol internamente, revocar `EXECUTE` a `PUBLIC` y concederlo solo a los roles necesarios.
- RLS controla filas, no columnas. Protege campos administrados por el servidor mediante privilegios de columnas, triggers o RPCs.
- Las operaciones que actualizan contadores o karma deben tener una sola vía transaccional.
- Nunca agregues una policy permisiva sin revisar cómo se combina con las demás; las policies permisivas se evalúan con `OR`.
- **Todo cambio en la base son tres cosas en el mismo commit:** la migración, `supabase/schema/baseline.sql` y `docs/DATABASE.md`. Hay un hook que avisa si falta la tercera.
- Registra nuevos hallazgos y su cierre en la sección "Observaciones abiertas" de `DATABASE.md`, sin borrar el historial. No marques un pendiente como resuelto sin verificarlo contra el catálogo real (`pg_proc`, `pg_policy`) — no basta con que otra herramienta o persona lo diga.

---

## 🛠️ Guías de Estilo y Desarrollo

### Stack Tecnológico
- **Frontend Core:** React 19, TypeScript 5.7, Vite 6.
- **Estado UI & Asíncrono:** Zustand + TanStack Query (React Query).
- **Estilos:** Tailwind CSS 4 + Lucide React + Radix UI.
- **Mapa:** MapLibre GL JS + OpenFreeMap.

### Tipado (TypeScript)
- Evita el uso de `any`. El linter arrojará error (`Unexpected any`).
- Los tipos de la base de datos se mantienen a mano en `src/shared/types/database.ts`, como espejo de `supabase/schema/baseline.sql`. Solo incluyen las tablas que consulta el cliente; las internas se omiten a propósito. Al cambiar el esquema, actualízalos junto con la migración (podrán regenerarse con `supabase gen types` cuando el proyecto esté linkeado). Utiliza las interfaces expuestas allí.

### Internacionalización (i18n)
- La aplicación soporta Español e Inglés mediante `react-i18next`.
- Usa el hook `const { t } = useTranslation()` en tus componentes.
- No hardcodees texto en el JSX; usa la función `t(...)`.

---

## 🧪 Verificación y Testing

Antes de enviar un Pull Request, asegúrate de ejecutar y pasar la suite de pruebas y linters:

```bash
npm run typecheck && npx vitest run && npx eslint src
```

Los tres tienen que pasar. `npm run build` corre además el typecheck, así que
sirve como comprobación final.

CI corre `npm run lint` (`eslint .` completo), el typecheck, `npm test` y el build; **no** corre `check:i18n` ni `gen:agents -- --check`. Por eso, si tocaste textos de interfaz, corre `npm run check:i18n`, y si tocaste `CLAUDE.md`, `npm run gen:agents` (CI no los comprueba hoy).

Aún no hay una suite E2E ni pruebas de integración contra Supabase; si tu cambio depende de RLS, RPCs o triggers, agrega una validación reproducible además de las pruebas de frontend.

---

## 🔀 Proceso de Pull Request

1. Trabaja sobre `main` actualizado y crea una rama: `feature/nuevo-foro`, `fix/boton-login`.
2. Verifica en local antes de abrir nada. Si falla, CI lo rechaza igual (con `eslint .` completo, no solo `src`).
3. Título claro, y menciona el issue si lo hay (`Closes #12`).
4. **Deja al día el documento que corresponda:** `ROADMAP.md` si cerraste un
   pendiente o cambiaste una decisión, `DATABASE.md` si tocaste el esquema,
   `CHANGELOG.md` si es algo que el usuario va a notar.

~~~~

</details>

## docs/REPO_MAP.md

Procedencia: `docs/REPO_MAP.md`, blob `c1552e0a85bcc75be28c7fcd0f38b4afbe0e5a30`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [referencia del repositorio](../../referencia/repositorio.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:docs/REPO_MAP.md`.

<details>
<summary>Texto original íntegro de docs/REPO_MAP.md</summary>

~~~~markdown
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

~~~~

</details>

## docs/DATABASE.md

Procedencia: `docs/DATABASE.md`, blob `c270b428290e0c02f04488c34e253b5b5516d269`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [base de datos](../../referencia/base-de-datos.md) y [operación](../../guias/despliegue.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:docs/DATABASE.md`.

<details>
<summary>Texto original íntegro de docs/DATABASE.md</summary>

~~~~markdown
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
Su `dedupe_key` lleva un uuid desde `20261021000100`: con el segundo de la época,
dos pruebas en el mismo segundo chocaban y la segunda no se creaba.

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
agrupa las entregas creadas en los últimos `días` (por defecto 7, acotado a 1–90)
en una fila por host (`host`), con lo que hay en cada estado (`sent`, `failed`,
`expired`, `pending`), la fecha de la más reciente (`last_at`) y el último error no
nulo (`last_error`). Los que más fallan van primero. Una entrega sin host sale como
`(sin host)`. Se agrupa en SQL y no en el cliente para que la pantalla pinte las
filas tal cual.

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
| `admin_push_delivery_stats(días)` | admin | Entregas de los últimos `días` (1–90, 7 por defecto), una fila por host del servicio push con cuántas hay en cada estado y el último error. Con más de 30 días solo los `failed` están completos: la purga borra antes los `sent` y `expired` |
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
  `https://udp-map.vercel.app`).
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

Sale de `send-push/index.ts`; si cambia, cambia esto.

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

**El payload** es el híbrido, el que entrega en iPhone: el bloque `web_push: 8030` /
`notification` más los campos planos de la raíz (`notificationId`, `title`, `body`,
`url`, `type`, `category`, `payload`) y `payload` también dentro de
`notification.data`. Va literal en `index.ts`, bajo el cerrojo de `golden.test.ts`.
Si pasa de `MAX_PLAINTEXT_BYTES` (3993 B), la entrega se cierra `failed` con
«payload demasiado grande»; con los topes de título y cuerpo de cada aviso no se
acerca.

Hubo un formato declarativo puro tras el secreto `PUSH_PAYLOAD_FORMAT` (Push 6,
`fc32c71`), apagado por defecto. Se quitó sin llegar a activarse: el 37 % que
ahorraba no compraba nada con estos topes, y mantener dos formatos para siempre
era peor que recuperarlo de ese commit si algún día hace falta.

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

-- Entregas de la última semana por servicio push, una fila por host
select coalesce(push_host, '(sin host)') as host,
       count(*) filter (where status = 'sent')    as sent,
       count(*) filter (where status = 'failed')  as failed,
       count(*) filter (where status = 'expired') as expired,
       count(*) filter (where status = 'pending') as pending
from public.notification_push_deliveries
where created_at >= now() - interval '7 days'
group by 1 order by 3 desc, 1;

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

~~~~

</details>

## docs/SALAS.md

Procedencia: `docs/SALAS.md`, blob `7df26f85846863e99f67a62255ac4904abe28b8a`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [salas](../../referencia/salas.md) y [decisiones](../../decisiones/arquitectura.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:docs/SALAS.md`.

<details>
<summary>Texto original íntegro de docs/SALAS.md</summary>

~~~~markdown
# Salas y direcciones del campus

Este documento es el **estudio previo** del módulo de salas: qué fuente existe,
qué formato tiene el código de sala de verdad —no el que suponíamos—, qué
edificio corresponde a qué dirección y a qué facultad, y qué haría falta para
que una sala acabe siendo un pin en el mapa.

**Primero se escribió, después se implementó.** Fue deliberado: la parte cara de
esto no es el código, es acordar el vocabulario. Mientras no esté claro que
`E441.4.L.D` no se parte en tres, que el prefijo del código **es** la dirección
postal y que una facultad puede tener cuatro direcciones, cualquier
implementación va a nacer torcida. Hoy este archivo es el contrato del módulo, y
la implementación vive en `shared/utils/roomCode.ts`, `roomCatalog.ts` y
`roomSearch.ts`, en `features/mapping/salasEit.ts` y `RoomImportPanel.tsx`, y en
`features/map/roomSubtitle.ts` (ver §10). Dónde tocar para cada cambio:
`docs/REPO_MAP.md`.

Fecha del levantamiento: **2026-08-10**. Los datos de horario son un corte del
segundo semestre 2026.

Relacionado: `docs/ROADMAP.md` §3.4 (el código de sala), §13.3 (buscar dentro de
una facultad) y §14 ("Salas libres" — el bloqueo que este documento levanta).

---

## 1. La fuente existe y es pública

`docs/ROADMAP.md` §14 decía que a "Salas libres" le **faltaba el acceso a la
fuente**. Ya no falta:

```
GET https://salas.docencia-eit.cl/data.json
```

- `Content-Type: application/json`
- `Access-Control-Allow-Origin: *` → **se puede consultar desde el navegador**,
  sin proxy y sin Edge Function.
- Trae `Last-Modified` y `ETag`, así que se puede revalidar barato.
- En el corte del **2026-08-26**: **1304 registros, 82 salas distintas, 11
  edificios**. El corte anterior (2026-08-10) traía 799 registros y 61 salas: el
  archivo se republica, así que **cualquier número de este documento es una
  foto, no una constante**. La receta para rehacerlo está en la §7.

Es el `data.json` que consume `salas.docencia-eit.cl`, la web de "salas vacías"
de la FIC. La forma del JSON delata que aguas arriba hay una API GraphQL:

```jsonc
{ "data": { "allSalasUdps": { "edges": [
  { "node": {
      "code":    "CBE2000",                    // sigla del ramo
      "section": 1,                            // sección
      "course":  "PROBABILIDADES Y ESTADÍSTICA",
      "place":   "E441.4.S401",                // ← el código de sala
      "start":   "8:30:00",
      "finish":  "9:50:00",
      "day":     1,                            // 1 = lunes … 5 = viernes
      "teacher": "GUERRERO MIGUEL ANGEL"
  } }
] } } }
```

### Lo que hay que saber antes de apoyarse en ella

- **No es una API oficial de la universidad.** Es el archivo estático de una web
  de la Facultad de Ingeniería y Ciencias, servida en Vercel. No tiene versión,
  ni contrato, ni licencia publicada. Puede cambiar de forma o desaparecer sin
  aviso, y una implementación que la lea tiene que **degradar a "sin datos"**,
  nunca romper el mapa.
- **Solo cubre la FIC.** Son los ramos de la FIC, no todos los del campus. Los
  ramos de la FIC ocupan salas de otras facultades (§4), pero de esas facultades
  solo vemos las salas que la FIC usa, no su horario completo.
- **Las filas incompletas cambian de un corte a otro, y mucho.** El 2026-08-10
  eran 30 sin `course` y 38 sin `teacher` (~4 %). El 2026-08-26 no falta
  **ningún** `course` y faltan **360** `teacher` — el 28 %. O sea que la
  completitud del archivo no es una propiedad estable en la que apoyarse: sirven
  para "ocupada", no para "quién la dicta".
- **Diez filas no dicen en qué sala están.** Siete traen `LOC` y tres el campo
  vacío. `LOC` no es basura: es una sala real del subterráneo de `V432` que
  aparece en el listado estático de la §5.2, escrita sin el prefijo de edificio
  y planta. Se descartan al derivar el catálogo, porque sin planta no se puede
  colocar el pin, pero conviene saber que esa sala existe.
- **Antes de depender de esto en producción, hay que hablar con quien la
  mantiene** (Facultad de Ingeniería y Ciencias / los estudiantes de
  `open-source-udp`). Que un archivo sea accesible no lo hace un permiso, y aquí
  interesa la relación más que el archivo: una fuente acordada dura, una
  raspada no.

### De dónde salen esos datos

Averiguado el 2026-08-10, desde fuera. **Nada de esto lo cargan los estudiantes
de `salas-vacias`: se lo dan hecho.** La cadena es esta:

1. **`docencia-eit.udp.cl` es —era— la plataforma de docencia de la Escuela de
   Informática y Telecomunicaciones.** El Archive conserva de ella un
   `/oauth2/login?client_id=…` y una app Next.js en `/app`. O sea: una
   plataforma **con sesión**, de la escuela, no un sitio de alumnos. Hoy
   responde **521** (Cloudflare: el origen está caído), y ahí está la pista de
   por qué el servicio se mudó a un dominio propio.
2. **`salas.docencia-eit.cl` es esa mudanza.** Es un Next.js en Vercel, con
   Material UI, y su bundle pide **`/data.json` en ruta relativa** — el archivo
   es suyo, de su propio origen. Es el eslabón que publica el dato.
3. **`salas-vacias` (tus amigos) solo consume ese archivo.** Su
   `app/axios/getSalas.ts` tiene la URL absoluta
   `https://salas.docencia-eit.cl/data.json` clavada. En el repositorio hay un
   `data.json` propio, pero se subió **una sola vez, en octubre de 2024**, y en
   marzo de 2026 el commit *"fix: corrección en la ruta del json"* cambió a leer
   el de la facultad. Traducido: su copia se les quedó vieja y pasaron a tirar
   de la fuente.

**Y el dato no lo escribe nadie a mano.** La prueba está en la forma del
archivo:

```jsonc
{ "data": { "allSalasUdps": { "edges": [ { "node": { … } } ] } } }
```

Eso es **la respuesta de una consulta GraphQL volcada a disco tal cual**, con
sobre y todo (`data` → `edges` → `node`, que es paginación estilo Relay). Nadie
diseña un archivo estático así, y menos escribe 799 registros envueltos uno por
uno. Alguien corre una consulta contra el sistema académico de la escuela y
guarda la salida entera en `public/data.json`. El nombre de la colección,
`allSalasUdps`, es de estilo Gatsby/Relay y no existe en ninguna parte pública.

Lo que **sí** apunta a que se republica sola: el archivo trae
`Last-Modified: 2026-08-11`, o sea de esta semana, mientras el repositorio de
tus amigos lleva sin tocar el suyo desde 2024. El archivo se refresca; el
repositorio no.

Lo que **no** se puede saber desde fuera: si ese volcado lo dispara un cron o
una persona que aprieta un botón y redespliega. Para eso hay que preguntar, y es
fácil: tus amigos consumen el archivo, así que saben quién en la EIT lo
mantiene. **Esa pregunta vale más que cualquier deducción de aquí**, porque de
la respuesta depende si podemos leerlo en producción o si conviene pedir algo
más estable.

### Sobre `open-source-udp/salas-vacias`

Es el proyecto del que sale esa web. Se revisó **solo para localizar la fuente**,
y de ahí no hay que copiar nada más: es un Next.js con Material UI que resuelve
un problema distinto (una grilla de salas por piso) al nuestro (pines en un mapa
georreferenciado). Su valor para nosotros es concreto y ya está extraído:

1. La URL del `data.json`.
2. `app/utils/buildings.json` y `allRooms.json`: **un listado de salas de otro
   semestre**, que contiene salas que hoy no tienen clase. Es lo que permite
   distinguir "sala que existe" de "sala con clase esta semana" (§5).

---

## 2. El código de sala, tal como es de verdad

`docs/ROADMAP.md` §3.4 lo daba por "formato UDP confirmado: `E441.1.S101`", que
se parte en tres por los puntos. **Contra los datos reales eso falla.** El
formato de verdad es:

```
<EDIFICIO> . <PISO> . <SALA>
```

…donde **`<SALA>` puede contener puntos y espacios**, así que hay que partir por
los **dos primeros** puntos y dejar el resto entero:

```
E441.4.S401     → { edificio: 'E441', piso:  4, sala: 'S401'     }
V432.-1.SIM     → { edificio: 'V432', piso: -1, sala: 'SIM'      }
E441.4.L.D      → { edificio: 'E441', piso:  4, sala: 'L.D'      }   ← 4 trozos
E441.5. LAB INF → { edificio: 'E441', piso:  5, sala: ' LAB INF' }   ← espacio inicial, se conserva
E278B.4.S402    → { edificio: 'E278B', piso: 4, sala: 'S402'     }   ← edificio con letra
```

Reglas que hay que respetar sí o sí:

- **Partir por los dos primeros puntos, no por todos.** `place.split('.')` da
  cuatro trozos en `E441.4.L.D` y tira el laboratorio a la basura. Son 33
  registros del corte actual.
- **Normalizar espacios al comparar, no al parsear.** `E441.5. LAB INF` viene
  con un espacio después del punto, y `Lab  Informática` del listado estático
  viene con dos espacios en medio. `parseRoomCode` solo recorta el código
  completo (los extremos) y devuelve la sala tal cual, con su espacio inicial
  (`' LAB INF'`): el recorte, el colapso de espacios y las mayúsculas los hace
  `normalizeRoomCode`, y cualquier comparación tiene que pasar por ahí antes de
  cruzar. Quien recorta la sala al parsear es el comando de la §7, no el código.
- **Hay un formato de respaldo, `A-302`.** `parseRoomCode` también reconoce
  letras, guion y tres o cuatro dígitos: edificio `A`, sala `302`, y la planta es
  el **primer dígito** (la sala 302 está en el 3.º). Si ese dígito es 0 la planta
  queda en `null`, igual que con un `.0.` en el formato posicional. Es una
  convención de la aplicación, no algo que haya salido del horario de la FIC.
- **El piso puede ser negativo, y nunca es 0.** Coincide con la regla de la base
  (`check (level <> 0)` en `building_floors`, ver `docs/DATABASE.md` §4): la
  planta baja es el `1`. En los datos hay `-1`, `-2` y `-3`.
- **El edificio no es solo letra + número.** Hay sufijos de cuerpo:
  `E278A`, `E278B`, `M253A`, `M253B`, `M253C`. La letra final distingue
  **cuerpos distintos de un mismo predio**, y eso importa en el mapa: son
  edificios separados con entradas separadas.

### Los prefijos de sala

| Prefijo | Qué es | Ejemplos |
|---|---|---|
| `S` | Sala de clases común | `S401`, `S312`, `S101` |
| `L` | Laboratorio | `L601`, `L202`, `L.D`, `L.O`, `L.U` |
| `LAB …` | Laboratorio con nombre propio | `LAB INF` (Informática), `LAB TEL` (Telemática) |
| `AU` | **Auditorio** | `E441.-1.AU`, `V432.3.AU` |
| `SIM` | Laboratorio de simulación / computadores | `V432.-1.SIM` |
| `LOC` | Sin identificar. Aparece en el listado viejo, sin clases hoy | `V432.-1.LOC` |
| `E50` | Sin identificar. Listado viejo, `E441` piso 5 | — |

Dos de esos merecen explicación, porque el nombre no lo dice:

- **`AU` es "auditorio", no "aula".** `E441.-1.AU` es el auditorio subterráneo de
  la FIC —el de ~150 personas que describe la propia facultad—, y ahí se dictan
  los ramos masivos de Industrial (Contabilidad y Costos, Ingeniería Económica,
  Estática). `V432.3.AU` es el otro, en el edificio de Vergara.
- **`SIM` es una sala de computadores, no una sala de simulación clínica.** Lo
  que se dicta ahí lo delata: Econometría, Simulación, Análisis de la
  Información Empresarial, Desarrollo Web y Móvil. Es el laboratorio del
  subterráneo de Vergara 432.

### Los tres laboratorios `L.D` / `L.O` / `L.U`, piso 4 de E441

Confirmado: **`L` es "laboratorio" y la letra es el nombre del laboratorio.**
`E441.4.L.D` se lee "**Laboratorio D, piso 4 de la FIC**". Son tres laboratorios
de computación contiguos donde se dictan Bases de Datos, Estructuras de Datos,
Desarrollo Web, Talleres de Redes y Data Science. En el listado viejo del
repositorio aparecen como `"L D"`, `"L O"`, `"L U"` y también como `"LAB D"`,
`"LAB O"`, `"LAB U"` — tres grafías para las mismas tres salas, que es
exactamente por qué hay que normalizar antes de cruzar.

Y en el **piso 5** están los dos laboratorios con nombre: `LAB INF` es
literalmente el **Laboratorio de Informática** y `LAB TEL` el **Laboratorio de
Telemática** (`Lab  Informática` / `Lab  Telemática` en el listado viejo, con dos
espacios en medio).

### Bloques horarios

Siete bloques fijos, de lunes (`day: 1`) a viernes (`day: 5`):

| Bloque | Inicio | Término |
|---|---|---|
| 1 | 8:30 | 9:50 |
| 2 | 10:00 | 11:20 |
| 3 | 11:30 | 12:50 |
| 4 | 13:00 | 14:20 |
| 5 | 14:30 | 15:50 |
| 6 | 16:00 | 17:20 |
| 7 | 17:25 | 18:45 |

Ojo con `"8:30:00"`: viene **sin cero a la izquierda**, así que no es un `HH:MM:SS`
ordenable como texto. Hay que parsearlo.

---

## 3. El prefijo del edificio **es** la dirección postal

Esto es lo que faltaba tener escrito, y es la pieza que hace útil todo lo demás:
el código de sala no lleva el nombre de la facultad, lleva **la calle y el
número**. `E` = Av. Ejército Libertador, `V` = Vergara, `M` = Av. Manuel
Rodríguez Sur. El número es el número de la calle.

Por eso "¿de qué facultad es esta sala?" no se responde con el catálogo de
facultades: se responde con **un mapa de direcciones**. Y por eso hasta ahora se
resolvía a ojo ("ah, Ejército 441 es la FIC").

| Prefijo | Dirección | Qué hay ahí | `faculty_id` | Confianza |
|---|---|---|---|---|
| `E441` | Av. Ejército Libertador 441 | Facultad de Ingeniería y Ciencias | `ingenieria` | **Confirmado** (udp.cl) |
| `V432` | Vergara 432 | Facultad de Ingeniería y Ciencias — **la otra entrada del mismo recinto** | `ingenieria` | **Confirmado** (udp.cl) |
| `E326` | Av. Ejército Libertador 326 | **Aulario UDP** — edificio de salas comunes a todas las facultades del eje Ejército | `aulario` | **Confirmado** (udp.cl) |
| `E333` | Av. Ejército Libertador 333 | Facultad de Ciencias Sociales e Historia | `ciencias-sociales` | **Confirmado** (udp.cl) |
| `E260` | Av. Ejército Libertador 260 | Instituto de Filosofía | `filosofia` | **Confirmado** (udp.cl) |
| `E233` | Av. Ejército Libertador 233 | Facultad de Salud y Odontología / Medicina | `salud` | **Confirmado** (udp.cl) |
| `M253A/B/C` | Av. Manuel Rodríguez Sur 253, **edificios A, B y C** | Facultad de Salud y Odontología (decanato y direcciones de escuela) | `salud` | **Confirmado** (udp.cl + terreno) |
| `V275` | Vergara 275 | Facultad de Psicología | `psicologia` | **Confirmado** (udp.cl) |
| `E306` | Av. Ejército Libertador 306 | **Facultad de Comercio**, justo al lado del Aulario | `comercio` | **Confirmado** (terreno) |
| `E278A` / `E278B` | Av. Ejército Libertador 278, edificios A y B | Salas "ED"/"EC"; el ICSO ocupa el edificio B, piso 2 | `ciencias-sociales` | **Probable** — hay que verlo en terreno |
| `V210` | Vergara 210 | Facultad de Educación (su "Sala de Ciencias" está aquí) | `educacion` | **Probable** |

Dos cosas que la tabla dice de pasada y conviene no perder:

- **La letra final del edificio es literal.** `M253A`, `M253B` y `M253C` son los
  edificios **A**, **B** y **C** de Salud y Odontología: así se llaman en la
  facultad, no es una invención del sistema de salas. Lo mismo para `E278A` y
  `E278B`. Son edificios distintos, con entradas distintas, y en el mapa van
  como edificios separados.
- **`E306` era el único hueco y ya está cerrado:** es la Facultad de Comercio,
  vecina del Aulario. Es además el edificio con **más salas de todo el
  conjunto** (17 en el corte del 08-10; 18 en el del 08-26, solo por detrás de
  `E441`), lo que encaja: ahí se dictan los ramos de plan común que la
  FIC no alcanza a meter en sus dos edificios.

---

## 4. Una facultad tiene varias direcciones. Ese es el punto.

De lo anterior se sigue la regla que hay que grabarse:

> **La relación entre facultad y dirección es uno-a-muchos, y la FIC ni siquiera
> ocupa solo sus propias direcciones.**

Dos cosas distintas se cruzan aquí y conviene no confundirlas:

1. **Una facultad ocupa varios predios y tiene varias entradas.** La FIC es un
   solo recinto con acceso por Av. Ejército 441 **y** por Vergara 432 — no son
   dos facultades, son dos puertas. Salud y Odontología ocupa cuatro
   direcciones. La Biblioteca Nicanor Parra tiene puerta por Vergara y puerta
   por Ejército.
2. **Los ramos de una facultad se dictan en edificios de otras.** Es exactamente
   lo que se ve en los datos: ramos de la FIC en `E278A` (Ciencias Sociales), en
   `E326` (Aulario), en `M253A` (Salud y Odontología), en `E306`. **Un pin de
   sala pertenece al edificio donde está, no a la facultad que la usa esa hora.**
   La facultad del pin es la del predio; el ramo es un dato del horario.

Confundir las dos hace que la sala aparezca en el sitio equivocado del mapa, que
es justo lo que el módulo tiene que evitar.

### Direcciones y entradas por facultad

Fuentes: udp.cl (oficial) y OpenStreetMap (marcado como tal). Lo que dice OSM
**no es oficial** y hay que confirmarlo en terreno antes de usarlo para trazar un
perímetro.

| `faculty_id` | Facultad / recinto | Direcciones y entradas | Fuente |
|---|---|---|---|
| `ingenieria` | Ingeniería y Ciencias (FIC) | **Av. Ejército Libertador 441** (principal) · **Vergara 432** | udp.cl |
| `salud` | Salud y Odontología | **Av. Manuel Rodríguez Sur 253** (decanato) · **Av. Ejército 233** · **Av. Ejército 219** (clínica odontológica) · **Av. Ejército 141** | udp.cl |
| `medicina` | Medicina | **Av. Ejército 233** (comparte predio con Odontología) | udp.cl / OSM |
| `psicologia` | Psicología | **Vergara 275** | udp.cl |
| `ciencias-sociales` | Ciencias Sociales e Historia | **Av. Ejército 333** · **Av. Ejército 278** edificios A y B (ICSO en el B, piso 2) | udp.cl |
| `filosofia` | Instituto de Filosofía | **Av. Ejército 260** | udp.cl |
| `educacion` | Educación | **Vergara 210** | udp.cl (infraestructura) |
| `comunicacion` | Comunicación y Letras | **Vergara 240** | OSM |
| `biblioteca` | Biblioteca Nicanor Parra | **Vergara 324** (oficial) · **una segunda entrada por Av. Ejército, número por confirmar** | udp.cl + terreno |
| `aulario` | Aulario UDP | **Av. Ejército 326** | udp.cl |
| `comercio` | Comercio | **Av. Ejército Libertador 306** | terreno |
| `derecho` | Derecho | **Av. República 105** | udp.cl |
| `arquitectura` | Arquitectura, Arte y Diseño | **Av. República 180** · Salvador Sanfuentes 2221 | OSM |
| `economia` | Economía y Empresa | **Av. Santa Clara 797**, Ciudad Empresarial, Huechuraba | udp.cl |
| — | Casa Central | **Av. Ejército Libertador 412** | OSM |

**Lo que falta por confirmar en terreno**, en orden de lo que más estorba:

1. El número por Ejército de la Biblioteca Nicanor Parra.
2. Si `E278A`/`E278B` son de Ciencias Sociales o son salas comunes como el
   Aulario. Que en `E278A` se dicten Cálculo, Álgebra Lineal e Introducción a la
   Ingeniería —ramos de plan común de la FIC— hace sospechar lo segundo.
3. Los números de Ejército 219 y 141 de Salud y Odontología: udp.cl los lista,
   pero en los datos de salas no aparece ninguno.

### Las 8 facultades que hacen falta ya existen

Comprobado el 2026-08-10: los edificios de la tabla de abajo caen sobre
**ocho** facultades, y **las ocho están en el catálogo de facultades**
(`campusData.ts` como semilla, tabla `faculties` en vivo). No hay que crear
ninguna. Los edificios, en cambio, **no** están en `campusData.ts`: ese archivo
solo declara que el mapeo interior vive en `buildings` / `building_floors` /
`areas`.

| Facultad | `faculty_id` | Sus edificios |
|---|---|---|
| Ingeniería y Ciencias | `ingenieria` | `E441`, `V432` |
| Comercio | `comercio` | `E306` |
| Aulario UDP | `aulario` | `E326` |
| Ciencias Sociales e Historia | `ciencias-sociales` | `E333`, `E278A`, `E278B` |
| Salud y Odontología | `salud` | `M253A`, `M253B`, `M253C`, `E233` |
| Instituto de Filosofía | `filosofia` | `E260` |
| Psicología | `psicologia` | `V275` |
| Educación | `educacion` | `V210` |

Lo que sí falta es lo de abajo: **los edificios y sus plantas**, que no salen del
catálogo de facultades sino de `buildings` / `building_floors`, y se trazan a
mano en `/admin/mapeo`.

---

## 5. El catálogo de salas

### 5.1 Salas con clase en el corte del 2026-08-26

**82 salas en 11 edificios.** Entre paréntesis, cuántos bloques semanales ocupa.
Un número alto es señal de sala grande y muy usada; un `1` es señal de sala que
casi no se usa —o de un dato mal cargado.

Este listado **no se mantiene a mano**: sale de correr la receta de la §7. Si
alguna vez discrepa del archivo, manda el archivo.

| Edificio | Piso | Salas |
|---|---|---|
| E278A | 4 | S402 (25), S403 (22), S404 (2) |
| E278B | 4 | S402 (6), S403 (1) |
| E306 | 1 | S101 (18), S102 (3), S103 (5), S104 (4), S107 (24), S108 (5) |
| E306 | 2 | L201 (1), L202 (7), L203 (5), S204 (23), S205 (4), S206 (3), S207 (2), S208 (24), S210 (2), S212 (5) |
| E306 | 3 | S307 (7), S310 (1) |
| E326 | 2 | S202 (1), S203 (1), S204 (1) |
| E326 | 3 | S303 (1), S304 (2) |
| E333 | −3 | S301 (3) |
| E333 | 2 | L201 (1) |
| E333 | 3 | L301 (1) |
| E333 | 5 | S502 (1) |
| E333 | 6 | S601 (2) |
| E441 | −1 | **AU** (14) — auditorio |
| E441 | 1 | S101 (30), S102 (10), S105 (15), S106 (34) |
| E441 | 2 | S201 (31), S203 (7), S204 (25), S205 (29), S206 (32), S207 (29) |
| E441 | 3 | S302 (28), S303 (30), S304 (29) |
| E441 | 4 | L.D (21), L.O (11), L.U (22), S401 (24), S402 (27), S403 (31) |
| E441 | 5 | EE50 (3), LAB INF (15), LAB TEL (20) |
| M253A | 3 | S308 (1) |
| M253A | 5 | S503 (4) |
| M253A | 6 | L601 (27), L602 (27), L603 (25) |
| M253B | 4 | S402 (1) |
| V210 | 2 | L201 (7) |
| V275 | 1 | S107 (1) |
| V275 | 2 | S202 (1) |
| V275 | 3 | L301 (1) |
| V432 | −1 | ERP (3), **FIS** (147) — ver abajo, **SIM** (23) — laboratorio de computadores |
| V432 | 3 | **AU** (19) — auditorio, S312 (34), S313 (32), S314 (14), S315 (21) |
| V432 | 4 | S412 (30), S413 (29), S414 (19), S415 (20) |
| V432 | 5 | S512 (1), S513 (29), S514 (22), S515 (26) |

**Tres cosas de este corte que no estaban en el anterior:**

- **`V432.-1.FIS` con 147 bloques** es un valor atípico enorme: la siguiente
  más ocupada tiene 34. Con siete bloques al día y cinco días, el techo de una
  sala son 35. **147 no cabe en una semana**, así que o son secciones apiladas
  en el mismo bloque —un laboratorio con varios grupos a la vez— o es un dato
  cargado mal. No se puede usar para decir "esta sala está ocupada" sin
  entenderlo primero.
- **`E333.-3.S301`**: una sala numerada como del piso 3 declarada en el −3. El
  número de sala y la planta del código **no tienen por qué coincidir**, y aquí
  se contradicen. Antes de mapearla hay que ir a mirar.
- **Aparecen `E333`, `V210`, `V275` y `M253B`**, que en el corte anterior solo
  estaban en el listado estático de la §5.2. Su presencia aquí confirma que
  existen; no dice cuántas salas más tienen.

### 5.2 Salas que existen pero hoy no tienen clase de la FIC

Salen del listado estático del repositorio `salas-vacias` (`allRooms.json`), que
es de un semestre anterior. **Que no aparezcan arriba no significa que no
existan**: significa que este semestre la FIC no las ocupa. Son útiles para dos
cosas: saber que la sala existe antes de ir a mapearla, y saber que el edificio
tiene ese piso.

| Edificio | Piso | Salas |
|---|---|---|
| E233 | −2 | S200 |
| E260 | 1 | S101 |
| E326 | 2, 4 | S204, S403 |
| E333 | −3 | S302 |
| E441 | 2, 4, 5 | S202, LAB D / LAB O / LAB U *(los mismos `L.D`/`L.O`/`L.U`)*, E50 |
| M253A | 5, 6 | S502, L604 |
| M253B | 4 | S401, S402, S403, S404 |
| M253C | 2 | S202 |
| V210 | 2 | S202, L201 |
| V275 | −1, 2, 3 | L10, S203, L301 |
| V432 | −1 | LOC |

### 5.3 Qué NO se puede inferir de aquí

- **La numeración no es densa.** En `E441` piso 1 hay S101, S102, S105 y S106;
  no hay S103 ni S104. En `E306` piso 2 hay S204…S212 salteadas. **No se
  autocompleta el hueco**: puede ser una oficina, un baño o una bodega. Inventar
  una S103 mete un pin en un lugar que no es una sala.
- **La capacidad no está en ningún lado.** El conteo de bloques la insinúa
  (`E441.4.S403` con 31 bloques es claramente grande) pero no la dice. El
  ROADMAP §14 ya anota "capacidad de sala" como campo futuro; se llenará a mano.
- **Los pisos que aparecen aquí no son todos los pisos del edificio.** Son los
  pisos que tienen sala docente. `E441` tiene planta 1 a 5 y un −1, pero eso no
  dice si hay un −2.

### 5.4 Qué cubre el horario, y qué no

Sí: **están los cinco días, de lunes a viernes**, con los siete bloques. Pero la
cobertura no es pareja, y las dos rarezas hay que conocerlas antes de escribir
"esta sala está libre".

**El miércoles está casi vacío, y es de verdad.**

| Día | Bloques ocupados |
|---|---|
| Lunes | 222 |
| Martes | 194 |
| **Miércoles** | **18** |
| Jueves | 227 |
| Viernes | 138 |

No es un dato perdido: es cómo está armada la malla. Las secciones se dictan
emparejadas **lunes–jueves** (151 secciones) o **martes–viernes** (114), y el
miércoles queda reservado. Los 18 registros que sí hay son casi todos secciones
de laboratorio de `LAB INF` y `LAB TEL`.

Anotado el 2026-08-10: **el miércoles se va a llenar cuando partan las
ayudantías y los laboratorios**, que a esta altura del semestre todavía no
empiezan. O sea que este corte es un piso, no un techo — cuando llegue el corte
con ayudantías hay que rehacer la §5.1, y las salas que hoy figuran con pocos
bloques pueden subir bastante.

**Y solo se ven los ramos de la FIC.** Esto es lo que de verdad limita "sala
libre":

- **43 de las 82 salas (52 %) están en edificios que no son de la FIC** —
  `E306` (18), `E326` (5), `E333` (5), `M253A` (5), `E278A` (3), `V275` (3),
  `E278B` (2), `M253B` (1), `V210` (1). *(En el corte del 2026-08-10 eran 25 de
  61, 41 %: el corte nuevo sumó 21 salas, 18 de ellas fuera de la FIC.)*
- El **27 % de los bloques semanales** de la FIC se dictan fuera de sus dos
  edificios *(cifra del corte 2026-08-10; no se recalculó con el del 08-26)*.

En `E441` y `V432` "no aparece en el horario" ≈ "está libre", porque son de la
FIC y casi todo lo que pasa ahí es de la FIC. **En las otras 43 salas esa
inferencia es falsa**: una sala de Comercio en `E306` puede estar ocupada por un
ramo de Comercio que este archivo no ve, y la marcaríamos verde con gente
dentro. Para esas salas el archivo sirve para decir "**ocupada**", nunca para
decir "libre".

---

## 6. Cómo lo resolvieron en `salas-vacias`

Leído el código el 2026-08-10, porque la pregunta era si la idea sirve. **La
idea sirve y es la correcta; la implementación tiene fugas que nosotros no
podemos heredar.**

La idea, en una línea: **"vacías = todas las salas menos las que el horario dice
que están ocupadas ahora"**. Se parte de una lista estática de todas las salas
del edificio (`app/utils/buildings.json`), se filtra el horario al día y bloque
actuales, y cada sala ocupada se **borra** de la lista. Lo que queda, se pinta.

```ts
// app/utils/filters.ts, resumido
const buildingRooms = clonar(allRoomsJSON[buildingKey])   // todas las salas
rooms = filterByBlock(block, rooms)                       // las ocupadas ahora
rooms.forEach(c => buildingRooms[c.room.floor].splice(idx, 1))  // resta
return buildingRooms                                      // las libres
```

Es simple y es honesto: no inventa salas, parte de un listado real. **Ese
listado es justamente lo que le sacamos al repositorio** (§5.2).

### Dónde se rompe

Todo lo de abajo es consecuencia de una sola decisión: **que "libre" sea el
valor por defecto**. Si algo no calza, la sala queda en la lista y se pinta como
libre. El error siempre cae del lado peligroso.

1. **Los laboratorios del piso 5 nunca se marcan ocupados.** El horario trae
   `E441.5. LAB INF` (con espacio) y el listado estático dice
   `"Lab  Informática"` (con dos espacios). No calzan, no se restan: `LAB INF` y
   `LAB TEL` salen **siempre verdes**, tengan clase o no. Y `Lab  Telemática` ni
   siquiera está en `buildings.json` para el piso 5 de `E441`.
2. **El listado estático es de otro semestre y está clavado en el repositorio.**
   Sala que se inaugure o se cierre, no se entera. Es el mismo problema que
   tuvimos con `facultyPerimeters.ts`: dos contenedores que hay que mantener a
   la par, y uno se queda atrás sin que nadie lo vea.
3. **El parseo del código adivina.** `convertToRoomType` hace `split(".")` y
   decide por la cantidad de trozos: si son 2, **asume** `E441` piso 5; si es 1,
   asume `V32` piso −1 — y `V32` es un typo de `V432`, así que ese caso no calza
   con nada nunca.
4. **Fuera de horario dice cualquier cosa.** `convertHourToBlock` hace
   `return 1` cuando la hora no cae en ningún bloque, así que a las 22:00 la app
   contesta con la ocupación del bloque de las 8:30. Y `filterByBlock` usa
   `new Date().getDay()`, que el fin de semana vale 6 o 0: no coincide con
   ningún día del horario, no se resta nada, **todo el edificio sale libre**.
5. **Solo funciona para `E441` y `V432`.** Lo dice su propio comentario. Con
   cualquier otro edificio, `allRooms[buildingKey]` es `undefined` y revienta.

### Qué nos llevamos y qué no

**Nos llevamos la idea**: restar lo ocupado de un listado completo. Y nos
llevamos su `buildings.json`, ya extraído en la §5.2.

**No nos llevamos el mecanismo**, y no por prolijidad: es que nuestro caso es
más exigente que el suyo. Ellos pintan una grilla de dos edificios de la FIC;
nosotros pintamos pines georreferenciados en doce edificios de ocho facultades,
donde —por la §5.4— "no aparece en el horario" **no** significa libre. Con
nuestro modelo, además, el listado completo de salas no es un JSON clavado: son
los pines `sala` de la base, que es justo el contenedor que no se queda atrás.

Tres reglas para cuando toque implementarlo:

- **El valor por defecto es "no sé", no "libre".** Tres estados —ocupada, libre,
  sin datos— y las 43 salas fuera de la FIC viven en "sin datos" mientras no
  haya una fuente que las cubra.
- **Normalizar antes de cruzar**: `trim()`, colapsar espacios, mayúsculas. Es lo
  que se les escapó con `LAB INF`.
- **Fuera de bloque y fin de semana no se responde "libre"**, se responde "sin
  clases programadas", que es distinto y es lo que de verdad se sabe.

---

## 7. Cómo volver a derivar todo esto

El corte de arriba (§5.1) es del 2026-08-26 y **caduca cada semestre**. Para rehacerlo
sin depender de que alguien lo haga a mano:

```bash
curl -s https://salas.docencia-eit.cl/data.json -o salas.json
```

Y para el catálogo por edificio y piso:

```bash
node -e 'const r=require("./salas.json").data.allSalasUdps.edges.map(e=>e.node),m={};for(const x of r){const i=x.place.indexOf("."),b=x.place.slice(0,i),t=x.place.slice(i+1),j=t.indexOf("."),f=t.slice(0,j),s=t.slice(j+1).trim();((m[b]??={})[f]??={})[s]=(m[b][f][s]||0)+1}console.log(JSON.stringify(m,null,1))'
```

Fíjate en el `indexOf(".")` doble y el `.trim()`: es la regla de la §2, y es todo
lo que separa un catálogo correcto de uno que pierde los tres laboratorios.

**Desde el 2026-08-26 esa regla vive en el repositorio y no solo en esta línea
de shell:** `shared/utils/roomCatalog.ts` (`buildRoomCatalog`) hace lo mismo con
pruebas, y `features/mapping/salasEit.ts` es quien descarga el archivo. Si hay
que tocar la regla, se toca ahí; el comando de arriba queda para mirar el
catálogo desde la terminal sin abrir la aplicación.

Y un aviso que costó encontrar: `parseRoomCode` exigía que el prefijo del
edificio terminara en dígito, así que **`E278A`, `E278B`, `M253A` y `M253B` no
parseaban** y sus once salas se quedaban sin planta. Son direcciones con dos
entradas en el mismo número (§3), no erratas.

---

## 8. Cómo esto se convierte en pines

El modelo ya lo soporta entero, sin migración. Un pin de sala usa:

| Columna de `pins` | Qué va |
|---|---|
| `category_id` | `'sala'` — la sala como **lugar**. No confundir con `'sala-libre'`, que es el aviso efímero de que hay una libre ahora |
| `room_code` | El código completo, tal cual: `'E441.4.S403'` |
| `floor` | El piso del código: `4` |
| `faculty_id` | La facultad **del predio** (§4), no la del ramo |
| `lat` / `lng` | A mano, sobre el mapa |
| `is_permanent` | Ver abajo |

Y hay dos cosas del ciclo de vida que hay que tener presentes antes de cargar
nada (`docs/DATABASE.md` §3 y §4):

- **La categoría `sala` nace con TTL de 720 horas (30 días)** y deja de expirar
  al verificarse. Un pin de sala cargado a mano y no verificado **se borra solo
  en un mes**.
- **`trg_validate_pin_floor` rechaza pisos que no existan** en
  `building_floors` de la facultad. Si vas a cargar salas del piso 6 de `M253A`,
  ese piso tiene que estar declarado antes en el editor de mapeo, o el `INSERT`
  falla. Falla a propósito: un pin en una planta que nadie declaró es un pin
  **invisible** (ROADMAP §15).

### El orden de carga

Ya no hay nada bloqueando: las ocho facultades existen (§4) y los doce edificios
tienen dirección. Lo que queda es trabajo, y el orden importa porque cada paso
depende del anterior.

1. **Declarar el edificio y sus plantas en `/admin/mapeo`.** Sin esto el
   `INSERT` de sus salas **falla**, por `trg_validate_pin_floor`. No es un
   estorbo, es la red: un pin en una planta que nadie declaró es un pin
   invisible (ROADMAP §15). Las plantas de cada edificio salen de la §5.1 y la
   §5.2 — para `E441`, por ejemplo, son −1, 1, 2, 3, 4 y 5.
2. **Cargar las salas de ese edificio**, con las coordenadas puestas encima del
   plano.
3. **Pasar al siguiente edificio.**

Por dónde empezar, por lo que más rinde:

| Orden | Edificio | Salas | Por qué |
|---|---|---|---|
| 1.º | `E441` | 23 | El más grande, ya trazado en el mapa, y es "tu" facultad |
| 2.º | `V432` | 16 | Ya trazado, completa la FIC — con los dos, 39 de 82 |
| 3.º | `E306` | 18 | El segundo con más salas, y con él quedan 57 de 82 |
| 4.º | `M253A`, `E278A/B`, `E326`, `E333`, `V275`, `M253B`, `V210` | 25 | La cola, edificio por edificio |

*(Recontado con el corte del 2026-08-26, §5.1. El de 2026-08-10, con 61 salas,
daba 22, 14 y 17 para los tres primeros.)*

### Por qué no hay un seed generado

Se podría escribir el `INSERT` de las 82 salas ahora mismo. **No conviene**, y la
razón es una sola pero decisiva: **las coordenadas serían inventadas**. Las 82
caerían apiladas en el centroide de su edificio, y después habría que arrastrar
una por una — más trabajo que crearlas donde van, y con el riesgo de que alguna
se quede sin mover y apunte a un sitio falso. El mapeo interior existe
justamente para no hacer eso.

Lo que sí se puede generar sin mentir es el **esqueleto**: código, piso,
facultad y título, con las coordenadas en blanco, para ir rellenando. Eso es una
tarea de carga, no de documentación, y sale de las tablas de la §5.1 con el
comando de la §7.

Cuando toque cargar, el `INSERT` va con `creator_id =
'9ea3f0ad-f7ed-4d42-bdd0-ce3284453112'`, igual que
`supabase/seed/fic_dummy_50_pins.sql`.

---

## 9. Lo que este documento deja decidido

- El código de sala se parte por **los dos primeros puntos**, y los espacios se
  normalizan **al comparar** (`normalizeRoomCode`), no al parsear: `parseRoomCode`
  devuelve `' LAB INF'` con su espacio. `E441.4.L.D` ("Laboratorio D, piso 4") y
  `E441.5. LAB INF` son los casos que rompen cualquier otra regla, y existen.
- El prefijo del edificio **es una dirección postal**, no un nombre de facultad.
  La tabla de la §3 es la traducción, y vive aquí — no repartida por el código.
  La letra final (`M253A`, `E278B`) es el nombre real del edificio.
- **Una facultad tiene varias direcciones**, y **una sala pertenece al edificio,
  no al ramo que la ocupa**. Los ramos de la FIC se dictan en cinco edificios que
  no son de la FIC.
- **Las ocho facultades que hacen falta ya existen** en el catálogo. Lo que falta
  son los edificios y sus plantas, y eso se traza a mano.
- El horario lo publica la **facultad**, no los estudiantes: es el volcado de una
  consulta GraphQL a `public/data.json`. Lo que falta no es acceso técnico —CORS
  está abierto— sino hablar con quien lo mantiene.
- **"No aparece en el horario" no significa "libre"** en 43 de las 82 salas (corte 2026-08-26). El
  valor por defecto de una sala sin datos es "no sé", nunca verde.

---

## 10. Qué lógica de sala existe HOY

Comprobado contra el código el 2026-08-10, porque la pregunta salió y la
respuesta honesta es **casi ninguna**. Lo que hay:

| Qué | Dónde |
|---|---|
| La categoría `sala`, con `ttl_hours: 720` — distinta de `sala-libre`, que son 6 h | la entrada `sala` de `CATEGORIES` en `campusData.ts` |
| El campo de código de sala, que **solo aparece si la categoría es `sala`** (`isRoom`) | `isRoom` en `IndoorFields.tsx`, pasado desde `CreatePinModal.tsx` |
| `pins.room_code`, que el autor puede editar con un `UPDATE` directo | el bloque de `room_code` de `updatePin` en `features/pins/api.ts` |
| El chip con el código en la ficha del pin | el chip de `room_code` en `PinDetail.tsx` |
| La validación de planta en servidor | `trg_validate_pin_floor` (ROADMAP §15) |

**Lo que se añadió el 2026-08-26** y que esta sección daba por inexistente:

| Qué | Dónde |
|---|---|
| `parseRoomCode`: `E441.4.S403` → edificio, planta y sala | `shared/utils/roomCode.ts` |
| El catálogo derivado del horario, con sus pruebas | `shared/utils/roomCatalog.ts` |
| La descarga del `data.json`, que nunca lanza | `features/mapping/salasEit.ts` |
| El importador de `/admin/mapeo` (§12.7 punto 3) | `features/mapping/RoomImportPanel.tsx` |
| Las salas se dibujan más pequeñas que los avisos (22 px contra 26) | `isFixedInfraCategory`, `styles/index.css` |
| `searchRooms` y `roomSubtitle`: el buscador del mapa encuentra salas por código, número o edificio, ordenadas por cuánto encajan (fecha de alta no registrada; verificado 2026-10-21) | `shared/utils/roomSearch.ts`, `features/map/roomSubtitle.ts`, usados en `MapPage.tsx` |

**Lo que sigue sin existir:**

- **La etiqueta con el código al lado del marcador** a zoom alto (ROADMAP §9.2).
  El tamaño ya distingue; el código todavía hay que abrir el pin para verlo.
- **Nada cruza con horarios en el mapa del estudiante.** El `data.json` se lee
  **solo** en el editor de administración. La capa de "libre / ocupada" es la
  §11.4 punto 4 y no está.
- **No hay flujo de sugerencia de sala** (§12.5): un estudiante puede crear un
  pin `sala`, pero no entra a ninguna cola ni recibe respuesta.

**Y la trampa sigue en pie, ahora con más salas:** la categoría `sala` nace con
**TTL de 30 días**. Una sala cargada y no verificada por un moderador **se borra
sola** — y eso incluye las que coloque el importador, que crea pines normales,
no permanentes. Si se cargan las 82 y no se verifican, en un mes no queda
ninguna.

---

## 11. Recomendación: la sala es el lugar, el horario es una capa

Anotado el 2026-08-10 a partir de la conversación sobre a dónde llevar esto.

**La idea de fondo es correcta y conviene decirla en una línea:** salas EIT
contesta *"¿está ocupada?"*; UDP Map puede contestar *"¿qué es esta sala, cómo
llego, cómo es por dentro y qué dice la gente de ella?"*. Son preguntas
distintas, y la segunda no la responde nadie hoy.

De ahí salen tres decisiones que conviene tomar ahora, porque condicionan el
modelo:

### 11.1 No competir con salas EIT: colgarse

Ellos tienen el dato; nosotros tenemos el mapa, la ubicación exacta, las fotos y
la gente que comenta. **El pin `sala` es la entidad estable** —existe con o sin
horario— y el horario es una **capa encima**. Si el `data.json` cambia de forma o
muere, la sala sigue en el mapa con su foto y sus comentarios; solo se apaga el
chip de "ocupada". Es la única forma de que una dependencia externa no se lleve
por delante lo que construimos.

### 11.2 El horario NO se guarda en la base

Tentación evidente: meter los bloques en `pin_schedule_items` y listo. **No.**

Esa tabla es para el **programa de un evento**, que alguien escribe a mano y no
existe en ningún otro sitio. El horario académico es lo contrario: dato
**derivado** de una fuente externa que se republica sola. Copiarlo a la base
crea dos contenedores que hay que mantener a la par — que es exactamente el error
de `facultyPerimeters.ts`, y allí la copia mala estuvo mala meses sin que nadie
lo notara (`docs/DATABASE.md` §4).

Lo que sí: **leer, cachear y derivar**. El archivo trae `ETag` y
`Last-Modified`, así que revalidar es barato, y con todos los registros en
memoria (1304 en el corte del 08-26) se calcula todo lo que hace falta:

- si la sala está ocupada **ahora**,
- **hasta qué hora** y qué ramo,
- y la **tira de los 7 bloques del día**, que es justo lo que pedías: "esta sala
  está ocupada en el bloque 1, 3 y 5". No hay que guardarlo — se infiere de la
  misma data, y de la data fresca, no de una copia de hace un mes.

### 11.3 Tres estados, y "no sé" es uno de ellos

Es la conclusión de la §5.4 y de los errores de la §6, y hay que grabarla en el
modelo desde el principio:

| Estado | Cuándo | Cómo se ve |
|---|---|---|
| **Ocupada** | El horario dice que hay clase ahora | Chip con el ramo y hasta qué hora |
| **Libre** | Es sala de `E441` o `V432`, dentro de horario, y no aparece | Verde |
| **Sin datos** | Las otras 43 salas, o fin de semana, o fuera de bloque | Sin chip. **No verde** |

Un verde falso es peor que no decir nada: alguien camina hasta el quinto piso
para encontrar una clase dentro. `sala-libre` (el aviso humano, TTL 6 h) sigue
teniendo sentido justo ahí — en las salas donde no hay datos, una persona sí
puede avisar.

### 11.4 Lo que hay que construir, en orden

1. - [x] **`parseRoomCode`** con la regla de la §2. Función pura en
     `shared/utils/`, testeable y sin dependencias. Hecha, y corregida el
     2026-08-26 para los prefijos con sufijo de letra (§7).
2. - [ ] **Cargar las salas** (§8). Sin pines no hay nada contra qué cruzar. **Y
     verificarlas**, o el TTL de 30 días se las lleva. **El importador del
     editor ya está** (§12.7 punto 3): pone el código y la planta, y quien mapea
     pone el punto. Lo que falta es pasar por los edificios.
3. - [x] **Dibujarlas distinto** (ROADMAP §9.2, Fase 4). Hecho el 2026-08-26: la
     infraestructura fija se dibuja a 22 px y los avisos a 26. Solo el tamaño,
     nunca el tono.
4. **La capa de horario**, con los tres estados de arriba.
5. **Recién ahí, hablar con la universidad.** Con las salas cargadas y la capa
   funcionando, la conversación deja de ser "¿nos dan datos?" y pasa a ser "esto
   ya funciona, ¿lo hacemos oficial?". Es una posición mucho mejor, y de paso
   para entonces ya sabremos —por la §1— quién mantiene el archivo.

---

## 12. ¿La sala es un área o un pin? — resuelto

Planteado y **cerrado el 2026-08-10**. Se deja el razonamiento entero porque la
decisión no es obvia y el que la lea en un año va a querer saber por qué.

> **La decisión, en una línea: la sala se guarda y se usa como un pin —la misma
> ficha, sin excepciones—, y se DIBUJA como área en cuanto alguien le trace el
> polígono. Tocar el área abre el front del pin.**

El detalle del flujo está en la §12.5. Lo de arriba es cómo se llegó ahí.

### El dilema, en dos frases

**Una sala es un área, no un punto.** Dibujarla como polígono con su código
encima es lo correcto: es su forma real, se lee como un plano, y una chincheta
en mitad de una sala de 60 m² dice algo que no es cierto.

**Pero las áreas las dibuja solo un moderador** (`areas_write`,
`baseline.sql:2589`). Y lo que se quería de UDP Map desde el principio es que
cualquiera llegue y diga *"oye, aquí falta una sala"*. Si la sala es un área, esa
persona no puede aportar nada, en ninguna facultad.

O sea: **lo que se ve mejor es lo que cierra la puerta a la comunidad.**

### Lo que cada camino cuesta de verdad

Medido contra el esquema, no contra la intuición.

| | **A. Solo área** | **B. Solo pin** (hoy) | **C. Área + ficha** |
|---|---|---|---|
| Forma real en el plano | ✅ | ❌ chincheta | ✅ |
| Etiqueta con el código en el mapa | ✅ | ⚠️ solo al lado del marcador | ✅ |
| Cualquiera puede aportar una sala | ❌ **nunca** | ✅ | ✅ donde no hay polígono |
| Fotos | ✅ `place_photos.area_id` ya existe | ✅ | ✅ |
| **Comentarios** | ❌ **hay que construirlos** | ✅ | ✅ |
| **Votos, favoritos, karma, denuncias** | ❌ **hay que construirlos** | ✅ | ✅ |
| Autor y verificación | ❌ un área no tiene autor | ✅ | ✅ |
| Migración necesaria | **grande** | ninguna | ninguna |

El costo escondido del camino A es el que decide: **un área no tiene autor.** No
es que le falten comentarios y ya — le falta toda la capa social, que en los
pines existe entera y probada: `pin_comments`, `pin_votes`, `favorites`,
`content_reports`, `adjust_karma`, las notificaciones. Rehacer eso para áreas es
duplicar media aplicación, y deja dos sistemas de moderación que hay que
mantener a la par. Es exactamente la clase de error que este repositorio ya
cometió con `facultyPerimeters.ts`.

### La salida (esto es lo que se decidió)

El dilema se disuelve si se separa **qué se guarda** de **qué se dibuja**, que
son dos preguntas distintas que estábamos contestando juntas.

- **El área es la forma.** La dibuja un moderador, lleva el nombre y el color.
- **El pin es la ficha.** Foto, comentarios, votos, autor. Y `pins.area_id`
  **ya se deduce solo** del punto (`baseline.sql:241`), así que se enlazan sin
  que nadie escriba nada.
- **Y una vez trazada el área, el área sustituye a la chincheta.** Se pinta el
  polígono con su código encima; se toca el polígono y **se abre exactamente la
  misma ficha del pin**: cómo llegar, favorito, comentarios, votos, fotos. No es
  una vista nueva ni una ficha parecida — es la misma.

Ahí está la clave de todo el asunto, y por eso costó decirla: **"que la sala se
vea como un pin" no significa que se dibuje como una chincheta, significa que se
comporte como un pin.** Lo que se dibuja es el área, que es su forma real; lo que
se abre es el front del pin, que es donde vive todo lo que la gente hace con
ella.

Hasta que alguien trace el área, la sala se dibuja como chincheta — porque es lo
único que hay. El polígono no cambia el objeto, cambia cómo se pinta.

Y la comunidad no queda fuera, porque el mismo mecanismo cubre los dos casos:

| Situación | Qué ve el estudiante | Qué puede hacer |
|---|---|---|
| Sala ya mapeada | El polígono con su código | Comentar, votar, subir foto |
| Sala que falta | Nada ahí | **Crear un pin `sala`** → queda de chincheta |
| Un moderador la dibuja después | El polígono | El `area_id` se enlaza solo, y quien la reportó gana **+25 de karma** |

Eso no es un flujo nuevo: es el ciclo **reporte → verificado** que la aplicación
ya tiene (`verify_pin`), aplicado a la geometría. **El pin es la propuesta; el
área es la forma verificada.** Y degrada bien: una facultad sin mapear igual
acumula salas de la comunidad como chinchetas, hasta que alguien las dibuje.

### Lo que falta para que ese camino funcione

Ninguna migración de datos, pero sí tres cosas:

1. **La regla de dibujo:** pin con `area_id` → se pinta el polígono con su
   código y **no** la chincheta; tocarlo abre la ficha del pin. Es lo que hoy no
   existe, y es lo que hace que 82 salas no se vean como 82 chinchetas
   amontonadas. Va con Fase 4 (§9.2), y para las salas **sin** área trazada
   sigue valiendo la regla de ahí: marcador más pequeño, **solo tamaño, nunca
   tono** — el desvanecido ya significa "por vencer".
2. **La etiqueta con el código** sobre el polígono, y al lado del marcador
   mientras no haya polígono. `pins.room_code` ya guarda el texto; falta
   pintarlo.
3. **La cola de sugerencias en administración**, que es lo único de verdad
   nuevo. ROADMAP §13.2.
4. **Cerrar "mover un pin" en el servidor**, que hoy es solo una comprobación de
   interfaz. Ver §12.5.

### La objeción del trabajo, que es la real

"Modelarlo como administrador lleva trabajo" es cierto, y no se arregla con
argumentos: 82 salas son 82 polígonos.

Lo que sí lo arregla es **que el editor proponga las salas**. `/admin/mapeo` lee
el `data.json` (§1), y para el edificio abierto ofrece las salas que faltan con
**código y planta ya rellenos** — el moderador solo dibuja el contorno. Ahí el
trabajo deja de ser "inventar 82 fichas" y pasa a ser "trazar 82 rectángulos
sobre un plano", que es otra cosa.

Y es también lo que hace defendible pedirle a la universidad —o a quien mantiene
`salas.docencia-eit.cl`— que esto se mantenga aquí: si mantenerlo significa
cargar salas a mano, es más pega que la que tienen hoy y nadie va a querer. Si
significa apretar "importar" y dibujar lo que falta, es una conversación
distinta.

### 12.5 El flujo acordado, de punta a punta

**Las dos reglas que mandan sobre el resto:**

1. **La ficha es siempre la del pin.** No hay una vista especial de sala, ni un
   componente aparte. Si alguien propone "una ficha propia para salas", la
   respuesta es no: es la misma, con sus comentarios, sus votos, su favorito y
   su "cómo llegar".
2. **Lo que se dibuja depende de si hay área.** Sin área trazada, chincheta. Con
   área trazada, **polígono con el código encima, y la chincheta desaparece**.
   Tocar el polígono abre la ficha del pin. El objeto no cambia; cambia cómo se
   pinta.

#### Del lado del estudiante

1. **Antes de publicar se le dice qué va a pasar.** Del tenor de: *"Esto se
   enviará a administración como sugerencia de sala. Quedarás como quien la
   añadió y ganarás karma si se acepta."* Más lo que la §10.5 del ROADMAP pide
   para toda la aplicación: cuánto dura, qué significa que la verifiquen.
2. **Confirma** — es una acción con consecuencias (entra a una cola, la va a
   revisar una persona), así que lleva confirmación explícita, no se publica de
   corrido.
3. **La sala vive desde el primer momento**: se ve en el mapa, se comenta, se
   vota. No nace escondida esperando aprobación. Es un pin normal que además
   está en una cola.
4. **Recibe respuesta.** Aceptada o rechazada, **con motivo**. Un rechazo mudo
   es la forma más rápida de que alguien no vuelva a aportar nunca.

#### Del lado de administración

Todo esto ocurre **dentro de `/admin/mapeo`**, no en una pantalla aparte: la
decisión necesita ver el plano.

1. **Una lista de "salas sugeridas pendientes"**, con las que caen en el
   edificio y la planta abiertos.
2. **Acomodar el pin** si está mal puesto. Es lo primero que se necesita: el
   estudiante marca de memoria y rara vez cae exacto.
3. **Aceptar o rechazar, con motivo**, que le llega a quien la sugirió.
4. **Al aceptar**: pasa a permanente (`verify_and_make_permanent` ya lo hace:
   `type='place'`, `expires_at = null`, **+25 de karma** al autor).
5. **Y entonces aparece "trazar el área"**, en el mismo sitio y en el mismo
   gesto. El área se crea ya asociada a la sala —su código, su nombre— y
   `pins.area_id` queda enlazado.
6. **Desde ese momento la sala se dibuja como polígono** con su código, y se
   abre como pin.

**Un hueco de seguridad que este flujo destapa:** *"mover un pin de sitio"*
**hoy solo se comprueba en la interfaz, no en la base** (`docs/DATABASE.md` §2,
es el único permiso en esa situación). El paso 2 lo convierte en una acción
central del flujo, así que hay que cerrarlo en el servidor antes de construirlo,
o cualquiera con la clave pública podrá reubicar pines ajenos.

**Lo que se descartó:** que el estudiante dibuje el polígono él mismo. Trazar
geometría sobre un plano es una herramienta de edición, no un gesto de aporte, y
abrirla a cualquiera convierte cada sugerencia en algo que hay que revisar trazo
a trazo. **La sugerencia es un punto; el trazo es curaduría.**

#### El plazo de la sugerencia

**No hay plazo fijo: la sugerencia espera hasta que alguien la resuelva.** Se
descartó el "24 horas y se decide sola" — una sala que se aprueba por
vencimiento del reloj es una sala que nadie miró, y el punto de la cola es justo
que alguien la mire.

Lo que sí caduca mientras tanto es el pin, por su TTL de categoría (30 días para
`sala`). O sea: hay un tope natural de un mes, y ese tope es el que obliga a que
la cola se atienda. Si una sugerencia se pierde ahí, es señal de que la cola no
funciona, no de que la sala no valía.

#### ¿Moderador o solo administrador?

Hoy los roles están partidos de una forma que **no encaja** con este flujo
(`docs/DATABASE.md` §2):

| Paso | Quién puede hoy |
|---|---|
| Verificar la sala | moderador y admin |
| Dibujar el área | moderador y admin (`areas_write`) |
| **Entrar al panel de administración** | **solo admin** |
| Resolver denuncias | solo admin |

O sea: un moderador puede verificar la sala y trazar su área, pero **no puede
entrar al sitio donde estaría la cola**. Hay que resolverlo en una de dos
direcciones, y conviene decidirlo antes de construir la pantalla:

- **La cola vive en `/admin/mapeo`** y la ve quien ya puede mapear —moderador y
  admin—, coherente con que las dos acciones que la resuelven ya son suyas.
- **O la cola es de admin**, y entonces el moderador queda como una figura que
  puede trazar pero no decidir qué se traza, que es una división rara.

La primera es la que encaja con los permisos que ya existen. La segunda es la que
dijiste preferir, y es defendible si la idea es que las salas las curen pocas
manos — pero entonces conviene revisar para qué queda el rol `moderator`, porque
sus poderes actuales apuntan al otro lado.

### 12.6 Esto no es solo para salas

Anotado el 2026-08-10. La sala fue el caso que obligó a diseñar el flujo, pero
**no es el único que lo necesita**. Un casino es un área. Un laboratorio es un
área. Un bicicletero y una cancha también. Todos ellos son hoy pines, y todos
podrían acabar con su polígono trazado.

Lo que separa a los que sí de los que no son **dos preguntas**, y hay que
hacerlas las dos:

1. **¿Es permanente?** Un food truck no merece curaduría: mañana no está.
2. **¿Tiene superficie, o es un punto?** Un casino ocupa media planta. Una
   impresora es un punto, y dibujar su contorno no le dice nada a nadie.

Solo cuando las dos respuestas son que sí tiene sentido pasar por la cola y
acabar en un polígono:

**Decidido el 2026-08-10: solo tres**, y se deja corto a propósito. Cada
categoría que se marque como área es trabajo de trazado para alguien; ampliar la
lista se puede hacer cuando estas tres estén cubiertas y se eche de menos una
cuarta.

| Categoría | ¿Área? | `area_kind` que le tocaría |
|---|---|---|
| `sala` | ✅ | `room` (aún no existe, §12.7) |
| `casino` | ✅ | `cafeteria` |
| `computacion` | ✅ | `lab` |
| `bano`, `bicicletero`, `deporte` | ⏸️ | Tienen superficie y son permanentes, así que **encajarían**. Quedan fuera por ahora: no urgen |
| `ascensor`, `rampa`, `escalera` | ❌ | son **puntos** |
| `impresora`, `agua`, `microondas`, `enchufe`, `entrada` | ❌ | son puntos |
| `food-truck`, `feria`, `estudio`, `sala-libre`… | ❌ | son efímeros |

#### `computacion` pasa a llamarse "Sala de computación"

Mismo `id`, mismo SVG, mismo color: cambia **solo el nombre visible**
(`categories.name` y `name_en`, en el seed y en `campusData.ts`). Hoy dice
"Computación", que nombra una materia y no un lugar — y desde que la sala es un
área, lo que se está marcando es un recinto.

Y hay una razón de fondo para dejarlo escrito, porque el nombre no va a calzar
del todo nunca: **en el campus a estas salas las llaman de tres maneras
distintas.** En unas facultades son "laboratorios" —`E441.4.L.D`, `M253A.6.L601`
en el catálogo de la §5.1 son exactamente eso—, en otras son literalmente salas,
y en el piso 5 de la FIC son "Laboratorio de Informática" y "de Telemática" con
nombre propio.

Encima hay un caso que el catálogo de horarios **no ve**: las salas de
computación **de libre acceso**, tipo las salas Alfa. No tienen código de sala
porque no se dictan clases ahí, así que no aparecen en el `data.json` ni van a
aparecer nunca. Solo pueden entrar al mapa si alguien las agrega — que es,
precisamente, para lo que sirve el flujo de sugerencia de la §12.5.

Dos consecuencias prácticas:

- **`room_code` tiene que poder quedar vacío en esta categoría.** Ya lo permite
  el esquema ("hay salas sin código"), pero la interfaz no debe pedirlo como
  obligatorio ni tratar su ausencia como un error.
- **El nombre de la categoría no manda sobre el título.** Si la sala se llama
  "Sala Alfa" o "Laboratorio de Telemática", eso va en el título tal cual. La
  categoría dice qué tipo de sitio es; el título, cómo se llama.

**Las escaleras y los ascensores merecen una explicación**, porque la intuición
dice que sí son áreas. No conviene: lo que importa de una escalera es *por aquí
se sube*, que es un punto — y además **atraviesan plantas** (ROADMAP §4.2), así
que su polígono habría que repetirlo en cada piso, que es justo el problema que
el rango de plantas resuelve. La caja de escalera grande de un edificio es la
excepción, y para eso está el área `service` dibujada a mano.

#### Cómo hacerlo sin una lista clavada en la interfaz

La tentación es un `if` con las seis categorías. Mejor: **una columna nueva en
`categories`, `area_kind`, que puede ser nula.**

- Si la categoría **tiene** `area_kind`, el pin entra a la cola de sugerencias y
  al aceptarlo aparece "trazar el área" **con el tipo ya elegido**.
- Si es **nula**, verificar es solo verificar y ahí termina.

Con eso, una categoría nueva se comporta bien sola: quien la crea decide si es
un área rellenando una columna, y no hay que tocar la interfaz. Es la misma idea
que ya usa `ttl_hours` — el comportamiento vive en el catálogo, no repartido por
el código.

### 12.7 Lo que queda por decidir

Lo de arriba está cerrado. Esto no:

1. **¿La cola es de moderador o solo de admin?** Ver el cuadro de arriba.
2. **¿Se añade `'room'` a `area_kind`?** `area_kind` es la lista cerrada de
   tipos de área que acepta la base — hoy: `hall`, `corridor`, `cafeteria`,
   `kiosk`, `lab`, `office`, `service`, `courtyard`, `sports`, `parking`,
   `green`, `other`. **No hay ninguno para "sala de clases"**, así que una sala
   tendría que entrar como `other` con el texto "Sala" al lado. Funciona, pero
   deja al tipo más común de un edificio docente clasificado como "otro", y el
   color por defecto del área sale del `kind`. Añadirlo es una migración de una
   línea.
3. ~~**¿El importador entra en el editor?**~~ **Sí, y está hecho el
   2026-08-26.** `/admin/mapeo` lee el `data.json`, y con un edificio
   seleccionado enseña sus salas: cuáles ya tienen pin y cuáles faltan. Al
   elegir una que falta, el siguiente clic en el mapa crea el pin con el código
   y la planta ya puestos.

   **Lo que NO hace, y no es un olvido: crearlas todas de golpe.** Un alta
   masiva las pondría a todas en el centroide del edificio, que es el resultado
   inútil contra el que avisa el ROADMAP — y ni siquiera funcionaría, porque
   `prevent_occupied_pin_location` rechaza dos pines vivos en el mismo punto y
   la misma planta. **La coordenada es justamente el dato que la fuente no
   tiene**, y no hay forma de deducirla: desde arriba el piso 1 y el 3 ocupan el
   mismo sitio. Así que el reparto es ese — la fuente pone lo tedioso y lo que
   se escribe mal, la persona pone el punto.

   Tres detalles del comportamiento que conviene conocer:

   - **El edificio se reconoce por su dirección postal** (§3): el importador
     busca el código del catálogo (`E441`, `E278A`) en el `short_name` o en los
     `aliases` del edificio. Un edificio sin ese código no ofrece salas, y lo
     dice en vez de quedarse vacío sin explicar por qué.
   - **Una sala cuya planta no esté declarada no se puede colocar**, y la lista
     la marca en vez de dejar un botón que fallaría contra
     `trg_validate_pin_floor`. La planta se declara en el mismo editor.
   - **Si la fuente está caída, el importador dice que no hay datos y ya.** Es
     un archivo de terceros y no puede tumbar el editor de mapeo.
   - **"Ya están en el mapa" cuenta pines VIVOS, no pines que existieron.** La
     lista se compara contra `fetchPins`, que filtra por
     `is_permanent OR expires_at > now()`. O sea que una sala **vuelve a salir
     como pendiente** en dos casos: si alguien borra su pin, y —el que sorprende—
     si su pin CADUCA. Con el TTL de 30 días de la categoría `sala`, una sala
     colocada y no verificada reaparece sola al mes como si nunca se hubiera
     puesto. No es un fallo del importador: es que efectivamente ya no hay un
     pin ahí. Pero significa que **colocar sin verificar es trabajo que se
     deshace solo**.
   - **Un techo que hoy no molesta y algún día sí:** esa consulta trae como
     mucho **300 pines** de la facultad (`limit(300)` en `fetchPins`). La FIC
     tiene 14, así que sobra sitio; pero si algún día pasa de 300 vivos, el
     importador empezaría a ofrecer salas que YA están puestas, y colocarlas
     otra vez chocaría contra `prevent_occupied_pin_location` o dejaría un
     duplicado. Cuando se acerque, el arreglo es una consulta propia que traiga
     solo los `room_code` de la facultad en vez de los pines enteros.
   - **La sala tiene que caer dentro de la huella de su edificio.** Su código
     lo dice: `E441.1.S101` es del E441 por definición. Salió al probarlo, y de
     la peor manera: E441 es un edificio HUECO, así que el centro de su
     rectángulo cae en el patio interior y no en el edificio. Dos salas se
     crearon ahí, con `building_id` null y sin que nada se quejara. Ahora se
     rechaza el punto con un aviso que menciona los patios, que es donde
     vuelve a pasar.

---

## Fuentes

- [`data.json` de Salas FIC](https://salas.docencia-eit.cl/data.json) — el horario
- [open-source-udp/salas-vacias](https://github.com/open-source-udp/salas-vacias) — de donde sale la URL y el listado de salas de otro semestre
- [Facultad de Ingeniería y Ciencias — UDP](https://www.udp.cl/pregrado-y-formacion-general/facultades/facultad-de-ingenieria-y-ciencias/) — las dos entradas de la FIC
- [Facultad de Salud y Odontología — UDP](https://www.udp.cl/pregrado-y-formacion-general/facultades/facultad-de-salud-y-odontologia/) — las cuatro direcciones
- [Conoce el campus — UDP](https://www.udp.cl/pregrado-y-formacion-general/vida-universitaria/conoce-el-campus/) y [Contacto — UDP](https://www.udp.cl/contacto/)
- [Edificio Aulario — UDP](https://www.udp.cl/tema/edificio-aulario/) — Ejército 326
- [Infraestructura — Facultad de Educación UDP](https://educacion.udp.cl/facultad/infraestructura/) — Vergara 210
- [Contacto — ICSO UDP](https://icso.udp.cl/contacto/) — Ejército 278 edificio B
- OpenStreetMap (consulta Overpass sobre el Barrio Universitario) — las direcciones marcadas como OSM

~~~~

</details>

## docs/NOTIFICATIONS_AND_MODERATION.md

Procedencia: `docs/NOTIFICATIONS_AND_MODERATION.md`, blob `951c713b2dcbe6f7e2ae1fe5d872de00d44d6866`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [notificaciones](../../referencia/notificaciones.md) y [validación](../../guias/validacion.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:docs/NOTIFICATIONS_AND_MODERATION.md`.

<details>
<summary>Texto original íntegro de docs/NOTIFICATIONS_AND_MODERATION.md</summary>

~~~~markdown
# Web Push y cola de moderación — etapas y Definition of Done

La implementación está separada en etapas comprobables. Solo debe marcarse una etapa como lista después
de validar su Definition of Done en Supabase y en navegadores reales.

> **Estado (verificado 2026-10-21):** las etapas 1 a 7 están implementadas en el código. Las
> casillas se conservan como criterio de verificación, no como plan pendiente. Los tipos de aviso,
> las categorías y las tablas vigentes están en [DATABASE.md](DATABASE.md) §4 (la matriz de abajo
> es la lista de orígenes con su destino); dónde tocar cada pieza, en [REPO_MAP.md](REPO_MAP.md).

## Matriz de notificaciones

| Audiencia | Sección | Origen | Destino |
|---|---|---|---|
| Personal | Perfil | Nueva insignia/logro | `/perfil?tab=badges` |
| Personal | Foro | Respuesta al hilo o comentario del usuario | `/foro?thread={id}` |
| Personal | Eventos | Evento con RSVP dentro de los próximos 20 días | `/eventos?event={id}` |
| Personal | Perfil | Resolución de un reporte enviado | `/perfil` |
| Personal | Pines | Un pin tuyo queda verificado (`pin_verified`) | `/mapa?pin={id}` |
| Personal | Pines | Comentario en un pin tuyo (`pin_comment`) | `/mapa?pin={id}` |
| Personal | Eventos | Evento oficial de tu facultad (`event_official`) | `/eventos?event={id}` |
| Personal | Sistema | Difusión del panel de administración (`announcement`) | La ruta que elija quien difunde (`/` por defecto) |
| Administrador | Moderación | Nuevo contenido reportado | `/admin/moderacion?report={id}` (el SQL guarda `/moderacion?report={id}` y la app lo redirige) |

Los administradores conservan sus avisos personales, pero Moderación se muestra en un bloque
**Administración** separado. Los moderadores no acceden a esa cola.

## Etapa 1 — Esquema y RLS

Alcance: el esquema vigente en `supabase/schema/baseline.sql`. La migración original
`20260722000001_notifications_and_moderation.sql` se archivó en `supabase/_archive/migrations/`.

### Definition of Done

- [ ] La migración se aplica completa sin errores.
- [ ] Un estudiante solo lee sus notificaciones y sus reportes.
- [ ] Un estudiante no inserta notificaciones, no lee entregas push y no modifica reportes directamente.
- [ ] Solo `admin` consulta la cola completa; `student` y `moderator` no pueden hacerlo.
- [ ] Dos reportes activos del mismo usuario contra el mismo contenido producen un solo caso.
- [ ] Las claves privadas VAPID y el service role no aparecen en el frontend ni en tablas públicas.

## Etapa 2 — Generación automática

### Definition of Done

- [ ] Una insignia nueva crea exactamente un aviso `achievement` para su dueño.
- [ ] Un comentario raíz notifica al creador del hilo; una respuesta anidada, al comentario padre.
- [ ] Las autorrespuestas no generan notificación.
- [ ] Un RSVP cuyo evento comienza entre ahora y 20 días crea un solo `event_reminder`.
- [ ] Ejecutar varias veces `enqueue_upcoming_event_notifications()` no duplica recordatorios.
- [ ] Resolver un reporte avisa al reportante sin exponer notas internas.

## Etapa 3 — Suscripción Web Push

Configuración requerida:

1. Generar un par VAPID.
2. Configurar `VITE_VAPID_PUBLIC_KEY` en el frontend.
3. Configurar como secretos de `send-push`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT`, `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y opcionalmente `ALLOWED_ORIGINS` (lista de dominios separados por coma).
4. Servir producción por HTTPS.
5. **Configuración de CORS estricto:** La Edge Function autoriza por defecto únicamente coincidencias exactas con `http://localhost:5173`, `http://localhost:4173`, `http://localhost:3000` y `https://udp-map.vercel.app`. Si el dominio cambia en el futuro, se puede configurar en Supabase la variable de entorno `ALLOWED_ORIGINS=https://nuevo-dominio.cl`.

### Definition of Done

- [ ] **Activar** pide permiso y crea una suscripción asociada al usuario actual.
- [ ] Recargar mantiene el estado activado; **Desactivar** desuscribe el navegador y, después, borra la fila
  (si el servidor falla, el dispositivo queda dado de baja igual). Si falla el navegador, **Reintentar** vuelve
  a desactivar, no a activar.
- [ ] Cerrar sesión usa esa misma baja —navegador primero, fila después— antes de cerrar la sesión, y deja el
  estado de push reiniciado.
- [ ] Si la sesión termina sin pasar por **Cerrar sesión** (otra pestaña, token caducado), el navegador se
  desuscribe solo en local; al iniciar sesión de nuevo se vuelve a resolver y sincronizar. El arranque nunca da
  de baja nada.
- [ ] «Activadas» sale del navegador. Si el servidor no pudo registrar el dispositivo (error o sin sesión), la
  tarjeta lo avisa y ofrece reintentar la sincronización; no se queda en «Activadas» sin más.
- [ ] Otro usuario en el mismo navegador reasigna el endpoint mediante RPC, sin romper RLS.
- [ ] Si el navegador rota el endpoint, el cliente manda el último que el servidor confirmó
  (`p_old_endpoint`, guardado en `localStorage` como `udpmap.push.endpoint`) para que la base mueva las
  entregas pendientes. Con la migración `20261021000100` sin aplicar se reintenta sin él.
- [ ] La página no repite el registro del mismo usuario y endpoint hace menos de una hora.
- [ ] En iPhone fuera de la pantalla de inicio sale la pista de instalación aunque Safari no exponga la Push API.
- [ ] Un navegador sin Push API o con permiso denegado sigue usando la app sin errores. En modo demo (sin
  Supabase) la tarjeta de push no se muestra.

## Etapa 4 — Envío y service worker

Despliegue requerido:

1. Desplegar `send-push` respetando `supabase/config.toml`. La función autoriza por
   `x-cron-secret` o por una sesión de administrador.
2. Programar cada minuto un `POST` a
   `https://{project-ref}.supabase.co/functions/v1/send-push` con
   `x-cron-secret: {CRON_SECRET}`.
3. Nunca enviar el service role desde el cron ni desde el cliente.

### Definition of Done

- [ ] El cron responde 200 con `processed`, `sent` y `failed`.
- [ ] Se crea una entrega por dispositivo y una entrega exitosa no se reenvía.
- [ ] Errores transitorios usan backoff y terminan tras cinco intentos.
- [ ] Respuestas 404/410 eliminan el endpoint vencido.
- [ ] Pulsar el push abre/enfoca la PWA, navega al destino y marca leído el aviso.
- [ ] `push-sw.js` lee cada campo del bloque declarativo y, si falta, del campo plano; con el payload
  actual pinta lo mismo que antes. Si no puede leer el payload o `showNotification` falla, muestra una
  notificación mínima (Safari revoca el permiso si un push no muestra nada). `pushsubscriptionchange` usa la
  clave de la suscripción perdida y cae a la constante; iOS no dispara ese evento. Lo prueba
  `pushServiceWorker.test.ts`.
- [ ] El payload no contiene correos, secretos ni notas internas.

## Etapa 5 — Sidebar de Notificaciones

### Definition of Done

- [ ] **Comunidad** se reemplaza por **Notificaciones** (`Notifications` en inglés).
- [ ] Perfil, Foro y Eventos muestran contadores separados y hasta tres avisos recientes.
- [ ] Abrir un aviso lo marca leído; abrir una sección marca leída esa categoría.
- [ ] Realtime actualiza los contadores sin recargar.
- [ ] Invitados no ven datos privados.
- [ ] Administradores ven **Tus notificaciones** y **Administración** por separado.

## Etapa 6 — Reportes de contenido

### Definition of Done

- [ ] Un usuario autenticado reporta contenido ajeno en pines, comentarios, hilos y respuestas.
- [ ] Invitados y autores del contenido no tienen la acción disponible.
- [ ] Los motivos y el máximo de 1000 caracteres se validan también en servidor.
- [ ] La RPC verifica que el contenido exista y guarda un snapshot generado en servidor.
- [ ] Cada reporte crea un aviso para cada administrador, sin avisar al autor reportado.

## Etapa 7 — Cola administrativa

### Definition of Done

- [ ] La cola vive en `/admin/moderacion` y solo entran administradores: `AdminLayout` redirige a `/mapa` a
  cualquier otro rol. La ruta vieja `/moderacion` se conserva porque `notify_content_report` sigue guardando
  esa url en los avisos; `LegacyModerationRedirect` la reenvía a `/admin/moderacion` conservando `?report=`.
- [ ] Admin filtra Pendientes, En revisión, Resueltos y Descartados.
- [ ] **Tomar caso** asigna el reporte; otro admin no puede resolverlo mientras está asignado.
- [ ] **Descartar** conserva el contenido y registra administrador, nota y hora.
- [ ] **Eliminar** borra el original, conserva el snapshot y registra la resolución.
- [ ] El reportante recibe un aviso de cierre sin ver la nota interna.
- [ ] Cola y avisos administrativos se actualizan en tiempo real.

## Etapa 8 — Cierre operativo

### Definition of Done

- [ ] Se validan los casos en Chrome/Edge de escritorio y Android como PWA instalada.
- [ ] Se validan permiso denegado, endpoint vencido y cambio de usuario.
- [ ] El cron funciona al menos un ciclo completo y no deja entregas sobre cinco intentos.
- [ ] Ningún secreto aparece en `dist`, variables `VITE_*` o payloads push.

~~~~

</details>

## docs/PWA_UPDATE.md

Procedencia: `docs/PWA_UPDATE.md`, blob `40dc474acb24b67feb971e93ef8f598586fbc6ce`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [PWA](../../referencia/pwa.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:docs/PWA_UPDATE.md`.

<details>
<summary>Texto original íntegro de docs/PWA_UPDATE.md</summary>

~~~~markdown
# Actualización de la PWA

Cómo la app detecta y aplica una versión nueva. Implementación en
[UpdatePrompt.tsx](../src/shared/ui/UpdatePrompt.tsx), decisión pura en
[pwa.ts](../src/shared/utils/pwa.ts), aplicación del relevo en
[swUpdate.ts](../src/shared/utils/swUpdate.ts), stamps en [vite.config.ts](../vite.config.ts).

## Diseño

La detección **no** usa eventos del service worker. Compara dos stamps:

| Stamp | Origen |
|---|---|
| `__BUILD_ID__` | Incrustado en el bundle por `define` en build time |
| `buildId` de `/update-info.json` | Emitido por el plugin `udp-map-update-info` en el mismo build |

Ambos valen `process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev'`. Cada despliegue es un commit
distinto, así que los dos cambian juntos. Si el bundle que corre trae un `buildId`
distinto al que responde el servidor, hay versión nueva.

`update-info.json` no entra al precache (`globPatterns` no incluye `.json`) y se pide con
`cache: 'no-store'`, así que la respuesta viene del servidor y no del worker instalado.
Si eso cambia, el stamp queda congelado y la detección deja de funcionar.

**Cuándo se comprueba:** al montar y en cada `visibilitychange` con la pestaña visible.

**Cómo se aplica:** `registration.update()` para forzar la comprobación, se **espera** a
que haya un worker instalado (`waitForWaitingWorker`, hasta 30 s), se le manda
`SKIP_WAITING`, se espera al `controllerchange` (hasta 10 s) y se recarga. El `finally`
recarga pase lo que pase, así que no existe camino en el que el botón quede esperando.

Los 30 s no son generosidad: **el precache son 9 MB**. Ese es el tiempo que tarda el
worker nuevo en instalarse con datos móviles, y esperarlo es justo lo que arregla el
bucle de más abajo.

**Descarte:** "Más tarde" guarda el `buildId` del servidor en
`localStorage['udp-update-dismissed-build']`. Sobrevive recargas y arranques en frío;
reaparece cuando el servidor sirve un id distinto.

## Restricciones

- `registerType: 'prompt'` en `vite.config.ts`. El registro lo inyecta el plugin en
  `index.html` vía `registerSW.js`; no se importa `virtual:pwa-register`.
- `sw.js` es generado (`generateSW`) y no se edita.
- La versión visible (`__APP_VERSION__`, `0.SPRINT+COMMITS`) es solo para mostrar. No
  sirve como identificador de despliegue: Vercel construye desde un clon superficial y
  el conteo de commits se repite entre despliegues.

## Probar en local

Ambos stamps valen `dev` en un build local, así que el aviso nunca aparece solo. Hay que
forzar dos ids:

```bash
VERCEL_GIT_COMMIT_SHA=a npm run build && npm run preview
```

Con eso corriendo, editar `buildId` en `dist/update-info.json` a otro valor y volver a la
pestaña: el aviso aparece.

## Límites conocidos

- ~~El aviso puede salir antes de que el worker haya descargado el build nuevo. En esa
  ventana el primer toque recarga sobre la versión vieja y el aviso vuelve; el segundo
  entra.~~ **Esto no era un límite: era el bug** (arreglado el 2026-08-27). Y no se
  arreglaba solo al segundo intento — el usuario reportó "le doy a actualizar como 40
  veces".

  El aviso y el arreglo eran dos mecanismos que no se hablaban: el aviso sale con una
  petición de 200 bytes a `update-info.json`, y activar la versión exige instalar 9 MB de
  precache. Al pulsar no había nada en `waiting`, el `SKIP_WAITING` caía al vacío, se
  recargaba a los 1500 ms sobre la versión vieja, y **cada recarga reiniciaba la
  instalación desde cero**, así que no convergía nunca. Encima el botón se rehabilitaba
  con un `setTimeout` de 3 s aunque la descarga siguiera, que es literalmente lo que
  invitaba a pulsarlo otra vez.

  Ahora se espera al worker antes de pedirle el relevo, el botón no se rehabilita solo, y
  mientras tanto se dice que está descargando. Cubierto por `swUpdate.test.ts` (módulo `swUpdate.ts`, que contiene `waitForWaitingWorker`).
- Sin red no se avisa: la detección depende del fetch.
- Fuera de Vercel, sin `VERCEL_GIT_COMMIT_SHA`, `buildId` queda fijo en `dev` y la
  detección se apaga en silencio.

~~~~

</details>

## docs/CHANGELOG.md

Procedencia: `docs/CHANGELOG.md`, blob `8a64fe1ce9b0b6254a189a79f37551c87f3edf67`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [notas](../../CHANGELOG.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:docs/CHANGELOG.md`.

<details>
<summary>Texto original íntegro de docs/CHANGELOG.md</summary>

~~~~markdown
### Novedades en esta versión (v0.8.0)

- Rediseño integral de la interfaz con estética cálida, bordes suaves y mejor legibilidad
- Nueva Lente Contextual sobre el mapa para filtrar edificio y planta sin tapar la vista
- Selector de pisos adaptable que se convierte en carrusel cuando hay muchas plantas
- Nueva guía paso a paso al pulsar "Cómo llegar" con ruta accesible ("Sin escaleras") y conexión vertical
- Cabecera de facultad reorganizada en dos filas desahogadas para evitar choques de botones
- Barra de navegación inferior más limpia y botón central directo para publicar en el mapa
- Píldoras de salas en el mapa con código tabular de lectura rápida
- Tus eventos marcados ahora aparecen en tu perfil
- El buscador encuentra salas por código, edificio o número
- Puedes ver el perfil de quien va a tu evento
- Te avisamos cuando verifican tu publicación o alguien la comenta
- Los avisos de la universidad ahora pueden llevarte al pin del que hablan
- Actualizar la aplicación es mucho más rápido y ya no hay que insistir
- Al marcar asistencia a un evento se te dice que quien organiza verá tu nombre
- Centro de avisos rehecho: agrupados por día, más legibles y con "Vaciar todo"

~~~~

</details>

## supabase/migrations/README.md

Procedencia: `supabase/migrations/README.md`, blob `7af03298920452f8cb8969d14ab9a5f12451ad4f`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [guía local](../../../supabase/migrations/README.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:supabase/migrations/README.md`.

<details>
<summary>Texto original íntegro de supabase/migrations/README.md</summary>

~~~~markdown
# Migraciones

Aquí van los cambios nuevos del esquema, uno por archivo, con nombre
`<timestamp>_descripcion.sql`.

Las 33 migraciones anteriores están en
[`../_archive/migrations/`](../_archive/migrations/): ya se aplicaron en
producción y no deben ejecutarse.

## La regla

Cada cambio en la base son **tres cosas en el mismo commit**:

1. la migración nueva en esta carpeta, que es lo que se ejecuta contra la base;
2. la actualización de [`../schema/baseline.sql`](../schema/baseline.sql), que
   es lo que reconstruye la base desde cero;
3. la actualización de [`../../docs/DATABASE.md`](../../docs/DATABASE.md), que
   explica por qué el esquema es así.

Si se separan, el baseline deja de describir la realidad y volvemos al
desorden que motivó todo esto.

Desde `20260827` cada migración trae además un `<timestamp>_descripcion.down.sql`
que la deshace. Se aplica a mano, igual que la migración.

En este proyecto las migraciones se aplican **a mano** desde el SQL Editor: no
hay `db push` ni en CI ni en los scripts de npm.

El detalle de qué hace cada pieza del esquema está en
[`docs/DATABASE.md`](../../docs/DATABASE.md).

~~~~

</details>

## supabase/_archive/migrations/README.md

Procedencia: `supabase/_archive/migrations/README.md`, blob `d89823fc9613a6e444c70d72c136e4f12f9e577f`, commit `b16bb4b59207550952e4e177c1de999413c9123e`. Captura: 2026-10-23.

Destino vigente: [archivo de migraciones](../../../supabase/_archive/migrations/README.md). Recuperación desde Git: `git show b16bb4b59207550952e4e177c1de999413c9123e:supabase/_archive/migrations/README.md`.

<details>
<summary>Texto original íntegro de supabase/_archive/migrations/README.md</summary>

~~~~markdown
# Migraciones históricas

**Estas 33 migraciones ya están aplicadas en producción. No las ejecutes.**

Se conservan como historia: sirven para entender por qué el esquema llegó a ser
lo que es, y a veces el comentario de cabecera de una de ellas explica una
decisión que hoy parece arbitraria.

Se movieron fuera de `supabase/migrations/` para que quede claro cuál es la
fuente de verdad, que ahora es [`supabase/schema/baseline.sql`](../../schema/baseline.sql).

## Por qué no se hizo un squash de verdad

Supabase lleva el registro de qué migraciones se aplicaron en la tabla
`supabase_migrations.schema_migrations`. Reemplazar estos archivos por un único
baseline "de verdad" obligaría a reescribir esa tabla con
`supabase migration repair`, sobre la base de producción y con usuarios reales
encima. Si queda a medias, el CLI intenta reaplicar cosas que ya existen.

A cambio de ese riesgo se ganaría una carpeta ordenada, nada más. El problema
real —poder reconstruir la base y saber qué hay dentro— lo resuelve el baseline,
que además se construyó leyendo la base viva y por eso captura cosas que estos
archivos nunca tuvieron (la política `profiles_admin_update` y el cron job de
notificaciones push, ambos creados a mano en el dashboard).

El squash tendrá sentido el día que exista un proyecto de staging donde probarlo,
o cuando se cree un proyecto Supabase nuevo desde cero: ahí el baseline pasa a
ser la migración número uno sin necesidad de reparar nada.

## Nota sobre dos de ellas

`20260724090638_add_easter_eggs_report_reason.sql` y
`20260724090714_revert_easter_eggs_report_reason.sql` se anulan entre sí: se
añadió un motivo de denuncia y se revirtió 36 minutos después. La base concuerda
con el revert. La categoría de pin `easter-egg`, que es otra cosa, sí sigue viva.

~~~~

</details>

