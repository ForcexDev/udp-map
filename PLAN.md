# 📍 UDP Map v0.1 — Documento Maestro de Reestructuración

> **Documento self-contained.** Contiene TODO lo necesario para reconstruir la app desde cero:
> estado actual del repo, visión, modelo de datos, permisos, arquitectura, decisiones técnicas y
> un plan de ejecución a **2 meses con 3 developers**. Un agente o dev puede implementar el
> proyecto usando solo este documento. Todo el stack es **gratis** (o *free tier* con límites).

- **Producto:** Mapa colaborativo de pines + eventos + foro social para la comunidad UDP.
- **Alcance:** 8 semanas / 4 sprints de 2 semanas / 3 developers.
- **Última actualización:** 2026-07-08.

---

## 📦 0. Estado actual del repositorio (punto de partida)

App existente (v1) que se va a **reestructurar**. Datos clave para el que implemente:

- **Stack v1:** React 19 + TypeScript + Vite 6, **Leaflet** (mapa), **Supabase** (Postgres + Auth Google + Realtime + Storage), **Google Gemini** (moderación, hoy en el frontend ⚠️), Tailwind, Lucide, i18n propio (ES/EN).
- **Estructura v1:**
  ```
  src/
  ├── app/ (App.tsx, index.tsx)
  ├── components/ (AddPostModal, FacultyExplorer, Login, Onboarding, Sidebar, Toast, Map/*)
  ├── config/ (types.ts, constants.ts)
  ├── hooks/ (usePosts.ts, useUserSession.ts)
  ├── services/ (supabaseService.ts, geminiService.ts)
  ├── utils/ (mapUtils.ts)
  └── i18n.ts
  ```
- **Tablas Supabase v1:** `profiles`, `posts` (pines), `chat` (chat por facultad). Bucket Storage `udp-map-assets`.
- **Datos estáticos v1** en `src/config/constants.ts`: 3 campus (Ejército, República, Huechuraba), ~10 facultades con `coords`, `polygon` y `careers`, y 11 categorías con `svgPath`/color. **Migrar a la DB.**
- **Variables de entorno:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend), `GEMINI_API_KEY` (debe pasar a backend).
- **Roles v1:** `guest | student | admin` (admin por lista de correos).

### 🔎 Auditoría v1 — qué rescatar y qué rehacer
Hallazgos reales del código actual (usarlos como checklist al reimplementar):

| Área | 🟢 Rescatar | 🔴 Rehacer / arreglar |
|---|---|---|
| **Pines** | Realtime con re-suscripción por usuario; UI optimista con rollback | `getPosts()` trae **todos** los pines sin paginar → paginar/filtrar (bounds/facultad) con TanStack Query. `createdAt` es `Date.now()` del cliente → `timestamptz` server. Tipos `any`. |
| **Votos** | Existe RPC seguro `vote_on_post` | `handleVote` usa `updatePost` directo (race conditions) en vez del RPC; anti-fraude solo con `localStorage` (evadible) → tabla `pin_votes` (1 fila/usuario) + RPC. Downvote y "report" están mezclados → separarlos. |
| **Fotos** | Compresión con canvas (1200px, JPEG 0.7) antes de subir | Nombre `Math.random()+'.jpg'` (colisión) → `crypto.randomUUID()` + ruta por usuario. `compressImage` **sin manejo de error** (promesa cuelga si la imagen falla). Solo **1 foto** por pin → N fotos. No borra la imagen del Storage al eliminar el pin (fuga). Sin validar tipo/peso. |
| **Comentarios** | — | **No existen comentarios por pin** en v1 (solo `chat` por facultad). Es feature nueva; reusar el patrón realtime del chat pero con tabla propia y paginación. |
| **Seguridad** | RLS parcial + RPC de voto | 🚨 **API key de Gemini en el frontend** → mover a Edge Function. RLS que bloquee escritura de `guest`. |

---

## 🎯 1. Visión

> **UDP Map es el mapa vivo del campus + eventos + foro estudiantil, en una PWA gratuita, para la
> comunidad de la Universidad Diego Portales.**

Un estudiante abre la app y ve un mapa lleno de **pines**: los **lugares** (facultades y edificios),
los **eventos** que están ocurriendo, y las **cosas random** que la gente reporta ahora mismo
(el camión de Monster, comida barata, una mochila encontrada, alguien buscando con quién estudiar).
En **cualquier pin** puede ver fotos y **comentar**. Un invitado mira todo; para participar necesita
cuenta `@mail.udp.cl`.

### Principios
1. **Gratis y sostenible** — solo *free tier* generoso.
2. **Mobile-first / PWA** — instalable y con soporte offline.
3. **Solo comunidad UDP** — participación restringida a `@mail.udp.cl`.
4. **Efímero por defecto, permanente por curaduría** — los pines temporales expiran solos; los lugares y lo que el admin conserva quedan.
5. **Tiempo real** — pines, comentarios, eventos y foro en vivo.
6. **Comunidad autogestionada** — moderación híbrida (IA + reportes + admins).

---

## 📌 2. Concepto central: UN pin, TRES tipos

Todo en el mapa es un **pin**. Hay **tres tipos**, con el mismo motor de fotos + comentarios + votos,
pero distinta finalidad y ciclo de vida:

### 🏛️ Tipo `place` — Lugares (facultades y edificios grandes)
- Los edificios/facultades del campus (Ingeniería, Derecho, Biblioteca, Casino, etc.).
- **Permanentes** (`is_permanent = true`, no expiran). Gestionados por **admin/moderator**.
- Son el **ancla del mapa**: los eventos y los reportes ocurren "dentro de" un lugar (`faculty_id`).
- Pueden tener **planos indoor** por piso.
- La gente puede **comentar** (ej.: "el 3er piso tiene enchufes", "hoy cerrado por evento").

### 🎉 Tipo `event` — Eventos (dentro de las facultades)
- Actividades con fecha: **charlas, fiestas, deportes, ayudantías, ferias**.
- Creados por estudiantes (estudiantil) o por mod/admin (oficial/`is_official`).
- **Ubicación anclada al mapa** (clic fija lat/lng, normalmente dentro de un lugar).
- **Temporales:** se muestran hasta que terminan (`ends_at` + margen), luego se archivan/ocultan.
- Tienen **RSVP** ("voy" / "me interesa") + recordatorios push. La gente puede **comentar**.

### 📍 Tipo `report` — Cosas random (lo efímero del día a día)
- Reportes de la comunidad con **categoría**: comida (ej. "Italiano Veloz"), objeto perdido/encontrado
  (ej. "mochila encontrada"), buscar con quién estudiar, **food truck** (ej. "camión de Monster"),
  baño, impresora, deporte, etc.
- Creados por **estudiantes**. **Temporales:** nacen con `expires_at` (TTL por categoría, p. ej. 6–24 h
  un food truck, unos días un objeto perdido). Se **desvanecen** y se **eliminan** al expirar.
- La gente puede **comentar** y **votar** (útil / no útil).
- Un **admin** puede promover un report a permanente si resultó ser un lugar estable.

### Resumen de comportamiento por tipo
| | `place` (lugar) | `event` (evento) | `report` (random) |
|---|---|---|---|
| Quién lo crea | admin / moderator | student (estudiantil), mod/admin (oficial) | student |
| ¿Permanente? | ✅ siempre | ❌ (hasta `ends_at`) | ❌ (`expires_at`) |
| Campos propios | building, floors, indoor | starts_at, ends_at, is_official | category TTL |
| Fotos | ✅ | ✅ | ✅ |
| **Comentarios** | ✅ | ✅ | ✅ |
| Votos | ✅ | — (usa RSVP) | ✅ |
| RSVP | — | ✅ | — |
| Indoor / ruteo | ✅ | ✅ (cómo llegar) | ✅ (cómo llegar) |

> **Todos los pines comparten** el mismo sistema de **fotos (N)**, **comentarios** y **votos**,
> implementado una sola vez y referenciado por `pin_id`.

---

## 👥 3. Roles y modo invitado

| Rol | Cómo se obtiene |
|---|---|
| `guest` | Sin login. Solo lectura |
| `student` | Login Google **`@mail.udp.cl`** |
| `moderator` | Estudiante promovido (centro de alumnos / staff) |
| `admin` | Lista blanca de correos + gestión total |

### 🔐 Matriz de permisos

| Acción | guest | student | moderator | admin |
|---|:---:|:---:|:---:|:---:|
| Ver mapa, pines, fotos y comentarios | ✅ | ✅ | ✅ | ✅ |
| Ver planos indoor / ruteo | ✅ | ✅ | ✅ | ✅ |
| **Crear pin `report`** (con fotos) | ❌ | ✅ | ✅ | ✅ |
| **Comentar** en cualquier pin | ❌ | ✅ | ✅ | ✅ |
| Votar (útil/no útil) | ❌ | ✅ | ✅ | ✅ |
| Eliminar **su propio** pin/comentario | ❌ | ✅ | ✅ | ✅ |
| Crear **evento** estudiantil | ❌ | ✅ | ✅ | ✅ |
| RSVP a eventos | ❌ | ✅ | ✅ | ✅ |
| Publicar en foro | ❌ | ✅ | ✅ | ✅ |
| Reportar contenido | ❌ | ✅ | ✅ | ✅ |
| Crear/editar **pin `place`** (lugar) | ❌ | ❌ | ✅ | ✅ |
| Marcar evento **oficial** | ❌ | ❌ | ✅ | ✅ |
| **Hacer permanente** un report | ❌ | ❌ | ⚠️ opc. | ✅ |
| Moderar (ocultar/eliminar ajeno) | ❌ | ❌ | ✅ | ✅ |
| Gestionar usuarios / roles | ❌ | ❌ | ❌ | ✅ |

> **Regla de oro:** un `guest` **consume** pero **no produce ni interactúa**. Toda escritura le
> muestra el modal *"Inicia sesión con tu correo UDP para participar"*. Se aplica en **UI + RLS**.

---

## 🛠️ 4. Stack técnico (todo gratis)

| Capa | Tecnología | Free tier / límite |
|---|---|---|
| **Framework** | React 19 + TypeScript + Vite 6 | Gratis |
| **Mapa** | **MapLibre GL JS + OpenFreeMap** | Sin API key, sin límite |
| **Ruteo peatonal** | **OpenRouteService** (o grafo GeoJSON propio) | 2.000 req/día |
| **Estado server** | TanStack Query | Gratis |
| **Estado UI** | Zustand | Gratis |
| **Routing** | React Router (o TanStack Router) | Gratis |
| **Formularios** | react-hook-form + zod | Gratis |
| **Backend** | Supabase (Postgres + Auth + Realtime + Storage) | 500MB DB, 1GB storage, 50k MAU |
| **Serverless** | Supabase Edge Functions (Deno) | 500k inv./mes |
| **Moderación IA** | Gemini (primaria) + Groq/Llama (respaldo) | 1500/día · 30 rpm |
| **Push** | Web Push API (VAPID) | Gratis |
| **Emails** | Resend | 3.000/mes |
| **Hosting** | Cloudflare Pages / Vercel | Gratis |
| **PWA/offline** | vite-plugin-pwa (Workbox) | Gratis |
| **UI** | Tailwind + Lucide + Radix UI | Gratis |
| **i18n** | react-i18next | Gratis |
| **Tests / CI** | Vitest + Playwright + GitHub Actions | Gratis (2.000 min/mes CI) |
| **Expiración de pines** | Supabase `pg_cron` | Incluido |

---

## 🗂️ 5. Arquitectura y carpetas (por features)

```
src/
├── app/                  → entrada, providers (Query, Router, i18n, Theme, Zustand), layout
├── features/
│   ├── auth/             → login, sesión, modo invitado, permissions.ts (can())
│   ├── map/              → MapLibre, campus, capas por tipo de pin, indoor, ruteo, filtros
│   ├── pins/             → motor común de pines: fotos, comentarios, votos, expiración
│   │   ├── places/       → pines tipo lugar (indoor, gestión admin)
│   │   ├── events/       → pines tipo evento (RSVP, oficial, calendario)
│   │   └── reports/      → pines tipo random (categorías, TTL)
│   ├── forum/            → hilos, comentarios anidados, tags, anuncios
│   ├── profile/          → perfil, karma, insignias, leaderboard
│   ├── notifications/    → push, preferencias, centro de notificaciones
│   └── moderation/       → reportes, cola de moderación, roles
├── shared/
│   ├── ui/               → design system (botones, modales, cards, toasts, sheet)
│   ├── hooks/            → hooks transversales
│   ├── lib/              → supabase client, query client, config, i18n
│   ├── types/            → tipos generados de DB + tipos de dominio
│   └── utils/            → geo, fechas, permisos
└── styles/
supabase/
├── migrations/           → esquema SQL versionado
├── functions/            → Edge Functions: moderate-content, send-push, expire-pins
└── seed/                 → campus, facultades (place pins), categorías
```

**Reglas:** una feature no importa internos de otra (se comunica por `shared/` o su `index.ts`);
toda escritura pasa por un servicio; permisos centralizados en `features/auth/permissions.ts`.

---

## 🗄️ 6. Modelo de datos (Postgres/Supabase)

Diseño **unificado**: una tabla `pins` con columna `type`, y tablas satélite (`pin_photos`,
`pin_comments`, `pin_votes`) que sirven a los 3 tipos por `pin_id`. Todas con **RLS**.

```sql
-- Enum de tipo de pin
create type pin_type as enum ('place', 'event', 'report');

-- Usuarios (extiende auth.users)
profiles (
  id uuid PK references auth.users,
  email text unique,            -- validado @mail.udp.cl
  name text,
  role text default 'student',  -- guest|student|moderator|admin
  faculty_id text references faculties,
  career text, year int,
  karma int default 0,
  avatar_url text, created_at timestamptz
)

-- Taxonomía geográfica (para filtros y agrupar; migrado de constants.ts)
campuses  (id text PK, name text, lat float, lng float)
faculties (id text PK, name, name_en, campus_id, lat, lng, polygon jsonb, image)
careers   (id serial PK, faculty_id text, name, name_en)

-- ★ TABLA CENTRAL: pines (los 3 tipos)
pins (
  id uuid PK default gen_random_uuid(),
  type pin_type not null,            -- 'place' | 'event' | 'report'
  title text not null,
  description text,
  category_id text,                  -- categoría (según tipo)
  faculty_id text references faculties,  -- lugar contenedor
  lat float not null, lng float not null,
  floor int, building text,          -- place/indoor
  creator_id uuid references profiles,
  votes_up int default 0, votes_down int default 0, reports int default 0,
  is_permanent bool default false,   -- true en 'place'; admin puede activarlo en 'report'
  expires_at timestamptz,            -- null si permanente; NOW()+TTL en report/event
  -- campos de evento (solo type='event'):
  starts_at timestamptz, ends_at timestamptz, is_official bool default false,
  created_at timestamptz default now()
)
-- índices sugeridos: (type), (faculty_id), (expires_at), (lat,lng)

-- Satélites (sirven a los 3 tipos)
pin_photos (
  id uuid PK, pin_id uuid references pins on delete cascade,
  url text, width int, height int, created_at timestamptz default now()
)
pin_comments (
  id uuid PK, pin_id uuid references pins on delete cascade,  -- mueren con el pin
  author_id uuid references profiles, body text,
  created_at timestamptz default now()
)
pin_votes (                          -- 1 voto por usuario por pin
  pin_id uuid references pins on delete cascade,
  user_id uuid references profiles,
  value smallint,                    -- 1 = útil, -1 = no útil
  primary key (pin_id, user_id)
)
favorites (user_id uuid, pin_id uuid, primary key (user_id, pin_id))

-- Solo eventos
event_rsvps (
  pin_id uuid references pins on delete cascade,
  user_id uuid references profiles,
  status text,                       -- going | interested
  primary key (pin_id, user_id)
)

-- Planos indoor (ligados a un place)
floor_plans (
  id uuid PK, place_pin_id uuid references pins, faculty_id text,
  building text, floor int, geojson jsonb, bounds jsonb, image_overlay text
)

-- Foro
threads (
  id uuid PK, title, body, faculty_id text,
  type text default 'discussion',    -- discussion|announcement|lost_found|wanted
  author_id uuid, upvotes int default 0, tags text[], is_locked bool default false,
  created_at timestamptz default now()
)
comments (
  id uuid PK, thread_id uuid references threads on delete cascade,
  author_id uuid, body text, parent_id uuid references comments,  -- anidado
  upvotes int default 0, created_at timestamptz default now()
)
votes (user_id uuid, target_type text, target_id uuid, value smallint,
       primary key (user_id, target_type, target_id))

-- Gamificación
badges      (id text PK, name, description, icon, criteria jsonb)
user_badges (user_id uuid, badge_id text, awarded_at timestamptz, primary key (user_id, badge_id))
-- karma vive en profiles.karma; leaderboard = query ordenada por faculty

-- Notificaciones
push_subscriptions (user_id uuid, endpoint text, keys jsonb, primary key (user_id, endpoint))
notifications (id uuid PK, user_id uuid, type text, payload jsonb, read bool default false,
               created_at timestamptz default now())

-- Moderación
reports_mod (id uuid PK, target_type text, target_id uuid, reporter_id uuid,
             reason text, status text default 'open', created_at timestamptz default now())
```

### Políticas RLS clave
```sql
-- Lectura pública de pines; escritura solo autenticados no-guest
create policy "pins_read"  on pins for select using (true);
create policy "pins_insert" on pins for insert with check (
  auth.uid() is not null
  and (select role from profiles where id = auth.uid()) <> 'guest'
  -- 'place' solo lo crean mod/admin; 'report'/'event' cualquier student
  and (type <> 'place'
       or (select role from profiles where id = auth.uid()) in ('moderator','admin'))
);
-- Hacer permanente / editar lugar: solo mod/admin
create policy "pins_admin_update" on pins for update using (
  (select role from profiles where id = auth.uid()) in ('moderator','admin')
);
-- El creador puede borrar lo suyo
create policy "pins_owner_delete" on pins for delete using (creator_id = auth.uid());

-- Comentarios: leer todos, escribir autenticado no-guest
create policy "comments_read"  on pin_comments for select using (true);
create policy "comments_write" on pin_comments for insert with check (
  auth.uid() is not null and (select role from profiles where id = auth.uid()) <> 'guest'
);
```

### Votos seguros (RPC) y expiración (job)
```sql
-- 1 voto por usuario, atómico (reemplaza el localStorage de v1)
create function vote_pin(p_pin uuid, p_value smallint) returns void as $$
  insert into pin_votes(pin_id, user_id, value) values (p_pin, auth.uid(), p_value)
  on conflict (pin_id, user_id) do update set value = excluded.value;
  update pins set
    votes_up   = (select count(*) from pin_votes where pin_id = p_pin and value = 1),
    votes_down = (select count(*) from pin_votes where pin_id = p_pin and value = -1)
  where id = p_pin;
$$ language sql security definer;

-- pg_cron diario: borra pines temporales vencidos (cascade limpia fotos/comentarios/votos)
-- (además, borrar los archivos del Storage vía Edge Function 'expire-pins')
delete from pins where is_permanent = false and expires_at < now();
```

---

## 🧩 7. Funcionalidades detalladas

### Motor común de pines (los 3 tipos)
- **Fotos (N por pin):** subir múltiples; comprimir en cliente (canvas, ~1200px, JPEG 0.75) **con
  manejo de error** (rechazar promesa si la imagen falla); nombre `crypto.randomUUID()`; ruta
  `pins/{userId}/{uuid}.jpg`; validar tipo y peso (<5MB). Al borrar/expirar el pin, **borrar también
  los archivos del Storage** (evitar fugas).
- **Comentarios:** hilo bajo cada pin, en **tiempo real** (Realtime filtrado por `pin_id`),
  paginado; moderación IA al crear. Se eliminan en cascada con el pin.
- **Votos:** `vote_pin` RPC (1 por usuario, atómico). Separado de "reportar contenido".
- **Carga eficiente:** pines por **bounds del mapa** y/o **facultad** con TanStack Query (no traer todo).

### 🏛️ Lugares (`place`)
- Seed inicial desde `FACULTIES` de `constants.ts`. Gestión por admin/moderator.
- **Planos indoor** por piso/edificio (GeoJSON). Comentarios y fotos habilitados.

### 🎉 Eventos (`event`)
- Crear con **ubicación anclada al mapa**, categoría (charla/fiesta/deporte/ayudantía/feria),
  `starts_at`/`ends_at`; **oficial** solo mod/admin.
- **RSVP** + recordatorios push. Vistas: calendario + lista + **capa en el mapa**.
- **Cómo llegar** al evento (ruteo). Se ocultan al terminar.

### 📍 Random (`report`)
- Categorías: comida, food-truck, objeto-perdido/encontrado, busco-estudio, baño, impresora, deporte…
- **TTL por categoría** (`expires_at`): efímeros. Desvanecimiento visual antes de expirar.
- Admin puede promover a permanente.

### 🗺️ Mapa & navegación
- **MapLibre GL + OpenFreeMap**, estilo UDP, 3 campus. **Capas por tipo** (lugares / eventos / random) con toggles.
- **Filtros combinados**: facultad + categoría + tipo (+ favoritos), en vivo.
- **Indoor** por piso y **ruteo peatonal** ("cómo llegar", con rutas accesibles).

### 💬 Foro & anuncios
- Hilos por facultad/tema con **upvotes**, **tags** y **comentarios anidados**.
- **Tablón de anuncios**: `se busca` / `perdidos` + discusión. Búsqueda FTS + por tag.

### 🏅 Perfil & gamificación
- Perfil (carrera, año, facultad, avatar, historial). **Karma** por upvotes/aportes.
- **Insignias** (Explorador, Fotógrafo, Anfitrión, Guardián, Pionero). **Leaderboard por facultad**.

### 🔔 Transversales
- **Push (VAPID):** comentario en tu pin, respuesta en foro, evento próximo.
- **Modo oscuro + accesibilidad (AA) + rutas accesibles**. **i18n ES/EN** (react-i18next).
- **Moderación híbrida:** IA (Gemini + Groq respaldo) en Edge Function + reportes + roles.

---

## 👥 8. Equipo y roles

| Dev | Rol | Áreas |
|---|---|---|
| **Dev A** | Frontend & Mapas | MapLibre, capas por tipo, indoor, ruteo, filtros, PWA, design system |
| **Dev B** | Backend & Datos | Esquema `pins` unificado, RLS, RPCs, Edge Functions (moderación, expiración, push), auth, realtime |
| **Dev C** | Features & Producto | Motor de pines (fotos/comentarios/votos), eventos+RSVP, foro, perfil, gamificación, i18n |

---

## 🚀 9. Roadmap — 8 semanas / 4 sprints

```
Semana:  1    2    3    4    5    6    7    8
Sprint:  |--- S1 ---|--- S2 ---|--- S3 ---|--- S4 ---|
Foco:    Fundaciones  Pines(3 tipos) Eventos+Foro  Social+Launch
```

| Sprint | Semanas | Meta demostrable |
|---|---|---|
| **S1 — Fundaciones** | 1–2 | App reestructurada, mapa MapLibre, auth + modo invitado, esquema `pins` base |
| **S2 — Pines (3 tipos)** | 3–4 | Crear/ver `place`/`report` con **fotos + comentarios + votos**, expiración, permanente por admin, indoor, ruteo, filtros |
| **S3 — Eventos & Foro** | 5–6 | Pin `event` con RSVP anclado al mapa; foro con hilos/comentarios/anuncios; moderación IA en backend |
| **S4 — Social & Launch** | 7–8 | Perfil, karma, insignias, leaderboard, push, cola de moderación, pulido y deploy |
| **S5 — Planos Indoor** | 9+ | Tablas `floor_plans`, selector edificio/piso, GeoJSON renderizado en mapa (pospuesto por complejidad) |

---

## 📋 10. Detalle por Sprint

### 🏗️ Sprint 1 — Fundaciones (Sem 1–2)
**Meta:** el mapa nuevo carga, un usuario UDP inicia sesión, un invitado mira pero no escribe.

- **Dev A:** migrar Leaflet → **MapLibre GL + OpenFreeMap** (3 campus, estilo UDP, marcadores por categoría); **PWA** instalable + shell offline; base del **design system** (Tailwind + Radix + tema claro/oscuro).
- **Dev B:** esquema `profiles`, `campuses`, `faculties`, `careers`, **`pins` (enum `pin_type`)** + **RLS**; **seed** de campus/facultades como `place` pins; auth Google **`@mail.udp.cl`** + trigger de `profile`; **tipos autogenerados** (`supabase gen types`).
- **Dev C:** providers globales (**TanStack Query, Router, i18n, Theme, Zustand**); **rutas** `/mapa`, `/eventos`, `/foro`, `/perfil` + layout/nav; **modo invitado** (`permissions.ts` + modal); migrar i18n a **react-i18next**.
- **Infra:** repo por features, **GitHub Actions** (lint + typecheck + test), Vitest.

**DoD S1:** login UDP OK; guest ve mapa pero toda escritura muestra el modal; CI verde; PWA instalable.

### 📌 Sprint 2 — Pines de 3 tipos (Sem 3–4)
**Meta:** crear y ver pines `place` y `report` con **fotos, comentarios y votos**; temporalidad; permanente por admin; indoor y ruteo.

- **Dev C (lead motor de pines):** UI **crear/editar pin** (react-hook-form + zod) con **subida de N fotos** (compresión + manejo de error + UUID); **comentarios** por pin en tiempo real (paginados); **votos** vía RPC `vote_pin`; eliminar propio; favoritos; estados de **desvanecimiento** por `expires_at`; badge de **permanente**.
- **Dev B:** tablas `pin_photos`, `pin_comments`, `pin_votes`, `favorites` + RLS; **RPC `vote_pin`**; **expiración** (`pg_cron` + Edge Function `expire-pins` que también borra archivos del Storage); Realtime de pines y comentarios; policy de **permanente** (solo admin) y de **crear `place`** (solo mod/admin).
- **Dev A:** **ruteo peatonal** ("cómo llegar" + rutas accesibles); **filtros combinados** (facultad + categoría + tipo + favoritos) y **capas por tipo**.

**DoD S2:** un estudiante crea un `report` con fotos, recibe comentarios y votos; el pin se desvanece/expira; un admin lo hace permanente o crea un `place`; se filtra por tipo y se traza la ruta; guest solo mira.

### 📅 Sprint 3 — Eventos & Foro (Sem 5–6)
**Meta:** pin `event` con RSVP anclado al mapa y foro funcional.

- **Dev C (eventos):** `event_rsvps` + RLS (oficial solo mod/admin); **crear evento** (`type='event'`, `starts_at`/`ends_at`, categoría, ubicación anclada); **RSVP** + vistas calendario/lista; oficiales/destacados.
- **Dev A:** **capa de eventos** en el mapa + "cómo llegar" (reusa ruteo S2); estilos de destacados.
- **Dev B:** foro (`threads`, `comments`, `votes`, `reports_mod`) + RLS; **Edge Function `moderate-content`** (Gemini + **Groq respaldo**, key fuera del frontend) que audita pines/comentarios/hilos; Realtime + FTS.
- **Dev C (foro UI, apoyo A):** hilos por facultad/tema, **upvotes**, **tags**, **comentarios anidados**; **tablón** (se busca / perdidos).

**DoD S3:** crear evento oficial + RSVP con recordatorio; abrir hilo, comentar anidado y votar; contenido pasa por moderación IA.

### 🏅 Sprint 4 — Social, Gamificación & Launch (Sem 7–8)
**Meta:** perfil vivo, comunidad premiada, notificaciones y producción.

- **Dev C:** **perfil** (carrera, año, facultad, historial); **karma** (triggers) + **insignias**; **leaderboard por facultad**.
- **Dev B:** **Web Push** (VAPID, Edge Function `send-push`, `push_subscriptions`, `notifications`); triggers: comentario o like en tu pin / respuesta en foro / evento próximo / nuevo pin en tu facultad (silenciosa); **cola de moderación**.
- **Dev A:** **accesibilidad AA**, modo oscuro final, rutas accesibles; optimización PWA (offline, caché de tiles); **deploy** (Cloudflare/Vercel) + smoke tests Playwright.
- **Transversal:** hardening RLS, e2e críticos, docs de usuario, revisión de free tiers.

**DoD S4:** perfil con karma e insignias; leaderboard; push OK (incl. comentarios en pines); moderadores gestionan reportes; **app en producción**.

### 🗺️ Sprint 5 — Planos Indoor (Sem 9+)
**Meta:** renderizado de planos internos de facultades.
- **Dev A / Dev B:** tablas `floor_plans` + RLS; planos indoor (selector edificio/piso, GeoJSON). Pospuesto a fase posterior por alta complejidad de datos geoespaciales.

---

## ✅ 11. Definition of Done (global)
1. Cumple criterios y permisos (modo invitado; `place` y permanente solo admin/mod).
2. **RLS** correcta (guests sin escritura) verificada.
3. Pasa **lint + typecheck + tests** en CI.
4. Funciona en **móvil**, respeta **accesibilidad AA** y **modo oscuro**.
5. Textos **ES/EN**.
6. PR revisado por otro dev.

## 🧪 12. Testing & CI
- **Unit** (Vitest): permisos, expiración/TTL, votos, utils geo.
- **Componentes:** crear pin, subir N fotos, comentar.
- **E2E** (Playwright): login UDP, guest bloqueado, crear `report` con fotos, expiración, hacer permanente (admin), crear `place` (mod), RSVP en `event`, comentar en foro.
- **CI:** lint → typecheck → test por PR + deploy preview.

## ⚠️ 13. Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| Datos indoor inexistentes | Empezar con GeoJSON manual de 1–2 edificios; crowdsourcing luego |
| Límite ruteo (ORS 2k/día) | Cachear rutas; grafo GeoJSON propio como fallback |
| Storage/DB free tier corto | Expiración de pines + borrar fotos del Storage + comprimir; monitorear |
| Spam en pines/comentarios/foro | Moderación IA + reportes + rate limit + solo `@mail.udp.cl` |
| Costo IA | Gemini free + Groq respaldo; degradar a filtro de palabras |
| 3 devs = poco margen | Alcance por sprint es *must-have*; extras a backlog |

## 🔭 14. Backlog / Fase 2
- Menú del casino + precios del día · Marketplace (apuntes/libros) · Buscar compañeros por ramo ·
  Horario de clases + "dónde está mi próxima sala" · Calendario académico oficial · Chat directo ·
  Pines colaborativos con varias fotos de distintos usuarios.
- **Perfiles Públicos:** Al hacer clic en el nombre de un usuario en un pin o comentario, desplegar su perfil (karma, likes, rol, foto).
- **Distintivos de Moderación:** Badges e indicadores visuales junto al nombre para moderadores y administradores en pines y comentarios.

---

*Documento vivo — actualizar al cierre de cada sprint con lo entregado y ajustes de alcance.*
