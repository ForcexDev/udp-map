# 📍 UDP Map v0.2.0 — Documento Maestro y Plan Vivo

> **Documento vivo.** Conserva la visión y el plan original, pero refleja el estado real del
> repositorio v0.2.0 al **2026-07-24**. Para el seguimiento operativo consulta también
> [SPRINTS_STATUS.md](SPRINTS_STATUS.md) y, para los pendientes de seguridad y base de datos,
> [securityDB.md](securityDB.md).

- **Producto:** Mapa colaborativo de pines + eventos + foro social + notificaciones + panel de administración para la comunidad UDP.
- **Plan base original:** 8 semanas / 4 sprints de 2 semanas / 3 desarrolladores; el roadmap activo se amplía hasta Sprint 6.
- **Estado actual:** Sprints 1, 2, 3 y 4 completados y operativos en código. Sprint 5 (expansión y clustering) en progreso.
- **Versión del paquete:** 0.2.0.
- **Última actualización:** 2026-07-24.

---

## 📦 0. Estado actual del repositorio

El repositorio v0.2.0 utiliza:

- React 19, TypeScript 5.7, Vite 6, React Router 7, Zustand y TanStack Query.
- MapLibre GL JS + OpenFreeMap, OpenRouteService opcional, límites geográficos, perímetros GeoJSON y orientación nativa.
- Supabase Auth, PostgreSQL 15, RLS, Realtime, Storage, `pg_cron` y Edge Functions (`expire-pins` y `send-push`).
- Tailwind CSS 4, Radix UI, Lucide React, Framer Motion, react-hook-form, Zod y react-i18next.
- Web Push API con Service Worker y VAPID.
- PWA con Workbox, caché de tiles y actualización bajo confirmación del usuario.

### Entregado en Código y Base de Datos

| Área | Estado comprobable |
|---|---|
| **Mapa** | Tres campus, filtros combinados, bounds, ruteo peatonal e indoor accesible, ubicación/rumbo con giroscopio, asignación por perímetro GeoJSON, modo 2D/3D y desbloqueo admin |
| **Pines** | Tres tipos (`place`, `event`, `report`), fotos múltiples, comentarios paginados/Realtime, votos RPC, favoritos, TTL por categoría, verificación y edición protegida por RLS |
| **Eventos** | Calendario/lista, eventos oficiales/estudiantiles, RSVP con comprobación DB del tipo de pin |
| **Foro** | Hilos por facultad, tags, comentarios anidados, votos RPC, fijado de hilos seguro y publicaciones oficiales (CEE / Admin) |
| **Perfil & Social** | Edición, perfil público, karma, insignias y leaderboard por facultad |
| **Notificaciones** | Centro de notificaciones en vivo (Drawer), suscripción Web Push API y disparadores automáticos |
| **Moderación & Admin** | Panel de administración dedicado (`/admin`), cola de reportes (`/moderacion`), asignación de roles de usuario y conteo de suscriptores push |
| **Seguridad DB** | Cierre comprobado de parches SEC-002, SEC-003, SEC-004, SEC-005 y SEC-006 vía migraciones SQL; SEC-007 solo la mitad (validación de tipo) — lectura pública de RSVP sigue abierta |
| **PWA** | Instalación, offline shell, caché de tiles, chequeo automático de versión y pop-up con changelog |
| **Calidad** | CI con lint, typecheck, 54 pruebas unitarias/de componentes en 12 suites de Vitest y build productivo |

### Preparado, pendiente de despliegue en entorno remoto

- Rate limit de 10 pines por estudiante y día UTC mediante `pin_creation_events` y `create_pin_with_daily_limit`. El frontend y la migración están listos, pero deben ejecutarse y validarse en Supabase productivo.

---

## 🎯 1. Visión

> **UDP Map es el mapa vivo del campus + eventos + foro estudiantil + notificaciones en una PWA gratuita para la comunidad de la Universidad Diego Portales.**

Un estudiante abre la app y ve un mapa lleno de **pines**: los **lugares** (facultades y edificios), los **eventos** que están ocurriendo, y las **cosas random** que la gente reporta ahora mismo (comida barata, objetos perdidos, zonas de estudio). En **cualquier pin** puede ver fotos y **comentar**. Un invitado mira todo; para participar necesita cuenta `@mail.udp.cl`.

---

## 📌 2. Concepto central: UN pin, TRES tipos

Todo en el mapa es un **pin**. Hay **tres tipos**, con el mismo motor de fotos + comentarios + votos, pero distinta finalidad y ciclo de vida:

| | `place` (lugar) | `event` (evento) | `report` (random) |
|---|---|---|---|
| Quién lo crea | admin / moderator | student (estudiantil), mod/admin (oficial) | student |
| ¿Permanente? | ✅ siempre | ❌ (hasta `ends_at`) | ❌ (`expires_at`) |
| Campos propios | building, floors, indoor | starts_at, ends_at, is_official | category TTL |
| Fotos | ✅ | ✅ | ✅ |
| Comentarios | ✅ | ✅ | ✅ |
| Votos | ✅ | — (usa RSVP) | ✅ |
| RSVP | — | ✅ | — |
| Indoor / ruteo | ✅ | ✅ (cómo llegar) | ✅ (cómo llegar) |

---

## 👥 3. Roles y matriz de permisos

| Rol | Descripción |
|---|---|
| `guest` | Sin inicio de sesión. Solo lectura |
| `student` | Login `@mail.udp.cl`. Creación de reportes, eventos, hilos, comentarios, votos y RSVP |
| `moderator` | Estudiantes promovidos. Creación de lugares permanentes, verificación, moderación de contenido y publicaciones CEE |
| `admin` | Acceso total. Gestión de usuarios/roles, panel `/admin`, desprotección de bounds y moderación global |

---

## 📂 4. Arquitectura de Carpetas (`src/features/*`)

```text
src/
├── app/                  → Entrada, router principal (App.tsx) y layout global
├── features/
│   ├── about/            → Licencias e información institucional
│   ├── admin/            → Panel de administración (/admin), métricas y roles
│   ├── auth/             → Autenticación, sesión, modo invitado y permissions.ts
│   ├── events/           → Calendario de eventos, filtros y RSVP
│   ├── forum/            → Foro estudiantil, hilos por facultad y publicaciones oficiales
│   ├── map/              → MapLibre GL, selectores de campus, perímetros GeoJSON y ruteo
│   ├── moderation/       → Cola de reportes de contenido y resolución
│   ├── notifications/    → Suscripción Web Push API, service worker y sidebar/drawer
│   ├── pins/             → Motor común de pines: creador, fotos, expiración, votos y comentarios
│   └── profile/          → Perfil de usuario, perfil público, karma e insignias
├── shared/               → UI Kit (Tailwind CSS 4 + Radix UI), hooks, tipos DB y utilidades
└── styles/               → Estilos globales en Tailwind CSS (index.css)

supabase/
├── migrations/           → Esquema SQL, RLS, triggers, RPCs y parches SEC-001 a SEC-010
├── seed/                 → Datos iniciales (campus, facultades, categorías)
└── functions/            → Edge Functions Deno (`expire-pins` y `send-push`)
```

---

## 🗄️ 5. Modelo de Datos y Seguridad DB

Diseño unificado: la tabla `pins` almacena todos los elementos geolocalizados, con tablas satélite (`pin_photos`, `pin_comments`, `pin_votes`, `favorites`) enlazadas por `pin_id`.

Las siguientes migraciones de seguridad clave han sido aplicadas y verificadas:
- `20260724000006_validate_rsvp_event_type.sql` (SEC-007)
- `20260724000007_lock_down_internal_functions.sql` (SEC-002 / SEC-009)
- `20260724000008_fix_threads_pin_policy.sql` (SEC-006)
- `20260724000009_protect_profile_columns.sql` (SEC-003 / SEC-004)
- `20260724000010_protect_pin_fields.sql` (SEC-005)

---

## 🧪 6. Testing & CI

- **Estado actual:** 12 archivos de prueba y 54 tests unitarios/de componentes pasando en Vitest.
- **Cobertura actual:** Permisos de usuario, dominio de correos UDP, expiración/TTL, operaciones geográficas, perímetros de facultades, rate limit diario, subida de fotos, árbol de comentarios, gestión de roles de admin, renderizado de MapView y badges.
- **CI actual:** GitHub Actions ejecuta `lint` (ESLint 9) → `typecheck` (TypeScript 5.7) → `test` (Vitest 3) → `build` (Vite 6).

---

*Documento vivo — actualizado al 2026-07-24.*
