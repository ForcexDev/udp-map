# 📍 UDP Map v0.2.0 — Documento Maestro y Plan Vivo

> **Documento vivo.** Conserva la visión y el plan original, pero refleja el estado real del
> repositorio v0.2.0. Para el seguimiento operativo consulta también
> [SPRINTS_STATUS.md](SPRINTS_STATUS.md) y, para los pendientes de seguridad y base de datos,
> [securityDB.md](securityDB.md).

- **Producto:** Mapa colaborativo de pines + eventos + foro social para la comunidad UDP.
- **Plan base original:** 8 semanas / 4 sprints de 2 semanas / 3 developers; el roadmap activo se amplía hasta Sprint 6.
- **Estado actual:** Sprints 1–2 completados, núcleo de Sprint 3 completado y Sprint 4 en progreso.
- **Versión del paquete:** 0.2.0.
- **Última actualización:** 2026-07-21.

---

## 📦 0. Estado actual del repositorio

La reestructuración v1 → v0.2.0 ya ocurrió. El repositorio actual usa:

- React 19, TypeScript, Vite 6, React Router, Zustand y TanStack Query.
- MapLibre GL + OpenFreeMap, OpenRouteService opcional, límites geográficos, perímetros y orientación nativa.
- Supabase Auth, Postgres, RLS, Realtime, Storage, `pg_cron` y una Edge Function de expiración.
- Tailwind CSS 4, Radix UI, Lucide, react-hook-form, Zod y react-i18next.
- PWA con Workbox, caché de tiles y actualización bajo confirmación del usuario.

### Entregado

| Área | Estado comprobable |
|---|---|
| **Mapa** | Tres campus, filtros, bounds, ruteo, ubicación/rumbo, asignación por perímetro, modo 2D/3D y desbloqueo admin |
| **Pines** | Tres tipos, fotos múltiples, comentarios paginados/Realtime, votos RPC, favoritos, TTL, verificación y edición |
| **Eventos** | Calendario/lista, eventos oficiales/estudiantiles y RSVP |
| **Foro** | Hilos por facultad, tags, comentarios anidados, votos y controles de moderación en UI |
| **Perfil** | Edición, perfil público, gestión admin de roles, karma, insignias y leaderboard |
| **PWA** | Instalación, offline shell, caché de tiles, chequeo automático de versión y pop-up con changelog |
| **Calidad** | CI con lint, typecheck, 51 pruebas Vitest y build |

### Preparado, pendiente de despliegue

- Rate limit de 10 pines por estudiante y día UTC mediante `pin_creation_events` y
  `create_pin_with_daily_limit`. El frontend y la migración están listos, pero todavía deben
  ejecutarse y validarse en Supabase.

### Pendiente real

- Hardening de RLS, permisos de columnas y funciones `SECURITY DEFINER`.
- Reportes y cola administrativa; la moderación IA queda asignada al Sprint 6.
- Web Push y centro de notificaciones.
- Realtime y búsqueda de texto completo para el foro.
- Planos indoor productivos desde Supabase; todo el alcance indoor queda agrupado en Sprint 6.
- Clustering visual de pines tipo Waze.
- E2E con Playwright e integración automatizada contra Supabase.
- Accesibilidad AA y despliegue final documentado.

Los detalles, evidencia y criterios de cierre de seguridad viven en [securityDB.md](securityDB.md).

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
- Un **moderador o admin** puede verificar un report y convertirlo en permanente.

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
| **Crear pin `report`** (con fotos) | ❌ | ✅ (máx. 10/día UTC al desplegar la migración) | ✅ sin límite | ✅ sin límite |
| **Comentar** en cualquier pin | ❌ | ✅ | ✅ | ✅ |
| Votar (útil/no útil) | ❌ | ✅ | ✅ | ✅ |
| Eliminar **su propio** pin/comentario | ❌ | ✅ | ✅ | ✅ |
| Crear **evento** estudiantil | ❌ | ✅ | ✅ | ✅ |
| RSVP a eventos | ❌ | ✅ | ✅ | ✅ |
| Publicar en foro | ❌ | ✅ | ✅ | ✅ |
| Reportar contenido | ❌ | ✅ | ✅ | ✅ |
| Crear/editar **pin `place`** (lugar) | ❌ | ❌ | ✅ | ✅ |
| Marcar evento **oficial** | ❌ | ❌ | ✅ | ✅ |
| **Hacer permanente** un report | ❌ | ❌ | ✅ | ✅ |
| Moderar (ocultar/eliminar ajeno) | ❌ | ❌ | ✅ | ✅ |
| Gestionar usuarios / roles | ❌ | ❌ | ❌ | ✅ |
| Desbloquear límites del mapa | ❌ | ❌ | ❌ | ✅ |

> **Regla de oro:** un `guest` **consume** pero **no produce ni interactúa**. Toda escritura le
> muestra el modal *"Inicia sesión con tu correo UDP para participar"*. Se aplica en **UI + RLS**.
>
> El rate limit está implementado en el frontend y en una migración local, pero no debe marcarse
> como activo en Supabase hasta ejecutar y validar `20260721000001_pin_daily_limit.sql`.

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
| **Tests / CI** | Vitest + GitHub Actions; Playwright planificado | Gratis (2.000 min/mes CI) |
| **Expiración de pines** | Supabase `pg_cron` | Incluido |

---

## 🗂️ 5. Arquitectura y carpetas (por features)

```text
src/
├── app/                  → entrada, rutas y layout
├── features/
│   ├── auth/             → login, sesión, modo invitado, permissions.ts (can())
│   ├── events/           → calendario y RSVP
│   ├── forum/            → hilos, comentarios anidados, tags y votos
│   ├── map/              → MapLibre, campus, límites, perímetros, indoor demo y ruteo
│   ├── pins/             → motor común: creación, fotos, comentarios, votos, TTL y verificación
│   └── profile/          → perfil propio/público, roles, karma, insignias y leaderboard
├── shared/
│   ├── data/             → campus, facultades, categorías, perímetros y planos demo
│   ├── lib/              → Supabase, QueryClient e i18n
│   ├── stores/           → estado UI, filtros y sidebar
│   ├── types/            → tipos de base de datos y dominio
│   ├── ui/               → design system y UpdatePrompt
│   └── utils/            → geo, fechas, expiración y rate limit
├── styles/
└── test/
supabase/
├── migrations/           → esquema SQL versionado
├── functions/            → actualmente solo expire-pins
└── seed/                 → campus, facultades, pines y categorías
docs/                     → plan, estado, changelog, contributing y registro de seguridad
```

**Reglas:** una feature no importa internos de otra (se comunica por `shared/` o su `index.ts`);
toda escritura pasa por un servicio; permisos centralizados en `features/auth/permissions.ts`.
Las carpetas `notifications/` y `moderation/` contienen el centro de avisos, Web Push, reportes y cola administrativa.

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
  official_entity_name text,       -- autor institucional visible
  verifier_entity_name text,       -- entidad que verificó/hizo permanente
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

-- Auditoría de creación para rate limit (migración preparada, pendiente de despliegue)
pin_creation_events (
  id uuid PK, pin_id uuid unique references pins on delete set null,
  creator_id uuid references profiles, created_at timestamptz default now()
)

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

-- Foro implementado
forum_threads (
  id uuid PK, faculty_id text, author_id uuid,
  title text, content text, tags text[],
  votes_up int default 0, votes_down int default 0,
  is_pinned bool default false, created_at timestamptz, updated_at timestamptz
)
forum_comments (
  id uuid PK, thread_id uuid references forum_threads on delete cascade,
  parent_comment_id uuid references forum_comments, author_id uuid,
  content text, created_at timestamptz
)
forum_votes (
  thread_id uuid, user_id uuid, value int,
  primary key (thread_id, user_id)
)

-- Gamificación implementada
badges      (id text PK, name, name_en, description, description_en, icon)
user_badges (user_id uuid, badge_id text, awarded_at timestamptz, primary key (user_id, badge_id))
-- karma vive en profiles.karma; leaderboard = query ordenada por faculty

-- Notificaciones y Web Push (IMPLEMENTADO EN CÓDIGO)
notifications, push_subscriptions, notification_push_deliveries

-- Moderación (IMPLEMENTADO EN CÓDIGO)
content_reports con snapshot, asignación, resolución y auditoría
```

### Políticas RLS clave

El esquema desplegado tiene RLS habilitado en todas las tablas públicas de la aplicación. Las
migraciones son la fuente de verdad; este documento no duplica las policies completas.

- La lectura de pines, contenido público y taxonomías es pública por diseño.
- Las escrituras requieren sesión y rol suficiente.
- Moderadores y administradores gestionan lugares, oficialidad, verificación y moderación.
- Al desplegar el rate limit debe eliminarse `pins_insert`; toda creación pasará por
  `create_pin_with_daily_limit`.
- Las correcciones pendientes de perfiles, pines, foro, RSVP, votos y funciones privilegiadas
  están registradas en `securityDB.md` y evitan considerar cerrado el hardening de seguridad.

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

-- pg_cron cada 30 minutos: borra pines temporales vencidos (cascade limpia fotos/comentarios/votos)
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
  paginado y con UI optimista. Se eliminan en cascada con el pin. La moderación IA sigue pendiente.
- **Votos:** `vote_pin` RPC (1 por usuario, atómico). Separado de "reportar contenido".
  Falta cerrar la vía de DML directo documentada en `securityDB.md`.
- **Carga eficiente:** pines por **bounds del mapa** y/o **facultad** con TanStack Query (no traer todo).
- **Rate limit:** máximo de 10 creaciones por estudiante/día UTC; implementado localmente y pendiente
  de despliegue/validación en Supabase. Moderadores y administradores quedan exentos.

### 🏛️ Lugares (`place`)
- Seed inicial desde `FACULTIES` de `constants.ts`. Gestión por admin/moderator.
- **Planos indoor** por piso/edificio (GeoJSON). La UI y datos demo están implementados; la lectura
  productiva desde `floor_plans` sigue pendiente.

### 🎉 Eventos (`event`)
- Crear con **ubicación anclada al mapa**, categoría (charla/fiesta/deporte/ayudantía/feria),
  `starts_at`/`ends_at`; **oficial** solo mod/admin.
- **RSVP** implementado. Los recordatorios push siguen pendientes. Vistas: calendario + lista +
  **capa en el mapa**.
- **Cómo llegar** al evento (ruteo). Se ocultan al terminar.

### 📍 Random (`report`)
- Categorías: comida, food-truck, objeto-perdido/encontrado, busco-estudio, baño, impresora, deporte…
- **TTL por categoría** (`expires_at`): efímeros. Desvanecimiento visual antes de expirar.
- Moderador/admin puede verificar y convertir a permanente.

### 🗺️ Mapa & navegación
- **MapLibre GL + OpenFreeMap**, estilo UDP, 3 campus. **Capas por tipo** (lugares / eventos / random) con toggles.
- **Filtros combinados**: facultad + categoría + tipo (+ favoritos), en vivo.
- **Indoor demo** por piso y **ruteo peatonal** ("cómo llegar", con rutas accesibles).
- Límites del mapa para todos los usuarios y desbloqueo exclusivo para administradores.
- Asignación de facultad por perímetros GeoJSON. El clustering visual de pines tipo Waze no está implementado.

### 💬 Foro & anuncios
- Hilos por facultad/tema con **upvotes**, **tags** y **comentarios anidados**.
- **Tablón general** + discusiones por facultad. Búsqueda FTS, filtro por tags y Realtime siguen pendientes.

### 🏅 Perfil & gamificación
- Perfil (carrera, año, facultad, avatar, historial). **Karma** por upvotes/aportes.
- **Insignias** (Explorador, Fotógrafo, Anfitrión, Guardián, Pionero). **Leaderboard por facultad**.

### 🔔 Transversales
- **Push (VAPID):** pendiente.
- **Modo oscuro**, rutas accesibles e **i18n ES/EN** implementados; auditoría AA final pendiente.
- **Moderación híbrida:** pendiente la Edge Function IA, los reportes y la cola; los roles y controles UI sí existen.

---

## 👥 8. Equipo y roles

| Dev | Rol | Áreas |
|---|---|---|
| **Dev A** | Frontend & Mapas | MapLibre, capas por tipo, indoor, ruteo, filtros, PWA, design system |
| **Dev B** | Backend & Datos | Esquema `pins` unificado, RLS, RPCs, Edge Functions (moderación, expiración, push), auth, realtime |
| **Dev C** | Features & Producto | Motor de pines (fotos/comentarios/votos), eventos+RSVP, foro, perfil, gamificación, i18n |

---

## 🚀 9. Roadmap — 12 semanas / 6 sprints

El calendario siguiente conserva el plan original. La columna de estado refleja el repositorio al
2026-07-21; el detalle operativo está en [SPRINTS_STATUS.md](SPRINTS_STATUS.md).

```
Semana:  1    2    3    4    5    6    7    8    9   10   11   12
Sprint:  |--- S1 ---|--- S2 ---|--- S3 ---|--- S4 ---|--- S5 ---|--- S6 ---|
Foco:    Fundaciones  Pines(3 tipos) Eventos+Foro  Social+Launch  Expansión  IA+Indoor
```

| Sprint | Semanas | Estado | Meta demostrable |
|---|---|---|---|
| **S1 — Fundaciones** | 1–2 | Completado | App reestructurada, mapa MapLibre, auth + modo invitado, esquema `pins` base |
| **S2 — Pines (3 tipos)** | 3–4 | Completado | Crear/ver `place`/`report` con fotos, comentarios, votos, expiración, ruteo y filtros |
| **S3 — Eventos & Foro** | 5–6 | En estabilización | Eventos + RSVP y foro funcional; FTS y Realtime del foro pendientes |
| **S4 — Social & Launch** | 7–8 | En progreso | Social/gamificación entregados; push, moderación, hardening y deploy pendientes |
| **S5 — Expansión** | 9–10 | Backlog activo | Clustering visual, atribución dinámica y expansión multicampus |
| **S6 — IA & Planos Indoor** | 11–12 | Planificado | Moderación IA y fuente productiva de planos por edificio/piso |

---

## 📋 10. Detalle por Sprint

### 🏗️ Sprint 1 — Fundaciones (Sem 1–2)
**Meta:** el mapa nuevo carga, un usuario UDP inicia sesión, un invitado mira pero no escribe.

**Estado actual: completado.**

- **Dev A:** migrar Leaflet → **MapLibre GL + OpenFreeMap** (3 campus, estilo UDP, marcadores por categoría); **PWA** instalable + shell offline; base del **design system** (Tailwind + Radix + tema claro/oscuro).
- **Dev B:** esquema `profiles`, `campuses`, `faculties`, `careers`, **`pins` (enum `pin_type`)** + **RLS**; **seed** de campus/facultades como `place` pins; auth Google **`@mail.udp.cl`** + trigger de `profile`; **tipos autogenerados** (`supabase gen types`).
- **Dev C:** providers globales (**TanStack Query, Router, i18n, Theme, Zustand**); **rutas** `/mapa`, `/eventos`, `/foro`, `/perfil` + layout/nav; **modo invitado** (`permissions.ts` + modal); migrar i18n a **react-i18next**.
- **Infra:** repo por features, **GitHub Actions** (lint + typecheck + test), Vitest.

**DoD S1:** cumplida en código. El comportamiento productivo de Auth depende de la configuración
del proyecto Supabase.

### 📌 Sprint 2 — Pines de 3 tipos (Sem 3–4)
**Meta:** crear y ver pines `place` y `report` con **fotos, comentarios y votos**; temporalidad; permanencia curada por moderador/admin y ruteo.

**Estado actual: completado para el motor de pines.**

- **Dev C (lead motor de pines):** UI **crear/editar pin** (react-hook-form + zod) con **subida de N fotos** (compresión + manejo de error + UUID); **comentarios** por pin en tiempo real (paginados); **votos** vía RPC `vote_pin`; eliminar propio; favoritos; estados de **desvanecimiento** por `expires_at`; badge de **permanente**.
- **Dev B:** tablas `pin_photos`, `pin_comments`, `pin_votes`, `favorites` + RLS; **RPC `vote_pin`**; **expiración** (`pg_cron` + Edge Function `expire-pins` que también borra archivos del Storage); Realtime de pines y comentarios; verificación/permanencia y creación de `place` para mod/admin.
- **Dev A:** **ruteo peatonal** ("cómo llegar" + rutas accesibles); **filtros combinados** (facultad + categoría + tipo + favoritos) y **capas por tipo**.

**DoD S2:** cumplida para pines, fotos, comentarios, votos, TTL, filtros y ruteo. Falta conectar
`floor_plans` productivo y cerrar los pendientes de seguridad relacionados con escrituras directas.

### 📅 Sprint 3 — Eventos & Foro (Sem 5–6)
**Meta:** pin `event` con RSVP anclado al mapa y foro funcional.

**Estado actual: núcleo funcional completado; DoD original parcial.**

- **Dev C (eventos):** `event_rsvps` + RLS (oficial solo mod/admin); **crear evento** (`type='event'`, `starts_at`/`ends_at`, categoría, ubicación anclada); **RSVP** + vistas calendario/lista; oficiales/destacados.
- **Dev A:** **capa de eventos** en el mapa + "cómo llegar" (reusa ruteo S2); estilos de destacados.
- **Dev B:** foro (`forum_threads`, `forum_comments`, `forum_votes`) + RLS implementado. `reports_mod`, Realtime y FTS siguen pendientes; `moderate-content` se mueve al Sprint 6.
- **Dev C (foro UI, apoyo A):** hilos por facultad/tema, **upvotes**, **tags**, **comentarios anidados**; **tablón** (se busca / perdidos).

**DoD S3:** eventos, RSVP, hilos, comentarios anidados y votos consistentes están listos. Falta
cerrar recordatorios push, Realtime, FTS y reportes; la moderación IA ya no forma parte de este sprint.

### 🏅 Sprint 4 — Social, Gamificación & Launch (Sem 7–8)
**Meta:** perfil vivo, comunidad premiada, notificaciones y producción.

**Estado actual: en progreso.**

- **Dev C — completado:** perfil, perfil público, karma, insignias y leaderboard por facultad.
- **Dev B — implementado en código:** Web Push, `send-push`, tablas de notificaciones y cola de moderación; falta despliegue y validación operativa.
- **Dev A — parcial:** modo oscuro, rutas accesibles, PWA/offline y actualización automática listos; AA final, deploy y Playwright pendientes.
- **Transversal — en progreso:** rate limit preparado; hardening RLS/funciones, E2E y revisión productiva pendientes.

**DoD S4:** parcialmente cumplida. La parte social está lista; faltan push, cola/reportes,
hardening, E2E y despliegue final.

### 🗺️ Sprint 5 — Expansión y Multicampus (Sem 9–10)
**Meta:** clustering visual, atribución oficial dinámica y expansión geográfica.

**Estado actual: backlog activo.** Los perímetros y la asignación automática existen; faltan el
clustering de pines, la atribución por facultad/CEE y completar la cobertura multicampus.

### 🤖 Sprint 6 — IA y Planos Indoor (Sem 11–12)
**Meta:** concentrar la moderación asistida por IA y toda la evolución de planos interiores.

**Estado actual: planificado.** Para indoor ya existen tabla, RLS, selector, render GeoJSON y datos
demo; falta conectar una fuente productiva por edificio/piso. La moderación IA, sus proveedores,
fallbacks, evaluación y operación administrativa se implementarán en este sprint.

---

## ✅ 11. Definition of Done (global)
1. Cumple criterios y permisos (modo invitado; `place` y permanente solo admin/mod).
2. **RLS** correcta (guests sin escritura) verificada.
3. Pasa **lint + typecheck + tests** en CI.
4. Funciona en **móvil**, respeta **accesibilidad AA** y **modo oscuro**.
5. Textos **ES/EN**.
6. PR revisado por otro dev.

## 🧪 12. Testing & CI
- **Estado actual:** 11 archivos y 51 pruebas Vitest.
- **Unit:** permisos, dominio UDP, expiración/TTL, geografía, perímetros, rate limit, fotos y árbol de comentarios.
- **Componentes:** MapView y badges visuales de pines.
- **Pendiente:** pruebas de formularios completos, RSVP, perfil/gamificación, RPC/RLS y migraciones.
- **E2E (Playwright):** planificado, todavía no instalado ni implementado.
- **CI actual:** lint → typecheck → test → build en pushes a `main` y Pull Requests.

## ⚠️ 13. Riesgos y mitigaciones
| Riesgo | Mitigación |
|---|---|
| Datos indoor inexistentes | Empezar con GeoJSON manual de 1–2 edificios; crowdsourcing luego |
| Límite ruteo (ORS 2k/día) | Cachear rutas; grafo GeoJSON propio como fallback |
| Storage/DB free tier corto | Expiración de pines + borrar fotos del Storage + comprimir; monitorear |
| Spam en pines/comentarios/foro | Moderación IA + reportes + rate limit + solo `@mail.udp.cl` |
| Costo IA | Gemini free + Groq respaldo; degradar a filtro de palabras |
| 3 devs = poco margen | Alcance por sprint es *must-have*; extras a backlog |
| Funciones privileged expuestas | Revocar `EXECUTE` y aplicar mínimo privilegio según `securityDB.md` |
| Policies/columnas demasiado permisivas | Migraciones de hardening + pruebas de integración por rol |
| Rate limit aún no desplegado | Ejecutar la migración completa y validar estudiante/mod/admin en Supabase |
| Contadores de votos inconsistentes | Unificar escrituras en RPC o triggers transaccionales |

## 🔭 14. Backlog / Fase 2
- Menú del casino + precios del día · Marketplace (apuntes/libros) · Buscar compañeros por ramo ·
  Horario de clases + "dónde está mi próxima sala" · Calendario académico oficial · Chat directo ·
  Pines colaborativos con varias fotos de distintos usuarios.
- [x] **Perfiles públicos:** modal con karma, rol, insignias, aportes y gestión de roles para admin.
- **Distintivos de Moderación:** Badges e indicadores visuales junto al nombre para moderadores y administradores en pines y comentarios.
- **Clustering visual tipo Waze:** agrupar pines cercanos/duplicados y mostrar cantidad o consenso.
- **Atribución oficial dinámica:** resolver el CEE/entidad según facultad y rol; hoy el texto de moderador está fijado a FIC.
- **Sprint 6 — Indoor productivo:** cargar `floor_plans` desde Supabase para más edificios.

---

*Documento vivo — actualizar al cierre de cada sprint con lo entregado y ajustes de alcance.*
