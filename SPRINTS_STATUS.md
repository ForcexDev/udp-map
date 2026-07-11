# Estado de Sprints — UDP Map v0.1

Este documento rastrea el progreso exacto de las funcionalidades definidas en el `PLAN.md` original, al pie de la letra.

---

## 🏗️ Sprint 1 — Fundaciones (Sem 1–2)
**Meta:** el mapa nuevo carga, un usuario UDP inicia sesión, un invitado mira pero no escribe.

### Dev A (Frontend & Mapa)
- [x] Migrar Leaflet → MapLibre GL + OpenFreeMap (3 campus, estilo UDP, marcadores por categoría).
- [x] PWA instalable + shell offline.
- [x] Base del design system (Tailwind + Radix + tema claro/oscuro).

### Dev B (Backend & Datos)
- [x] Esquema `profiles`, `campuses`, `faculties`, `careers`, `pins` (enum `pin_type`) + RLS.
- [x] Seed de campus/facultades como `place` pins en base de datos.
- [x] Auth Google `@mail.udp.cl` + trigger automático de creación de `profile`.
- [x] Tipos de TypeScript autogenerados (`supabase gen types`).

### Dev C (Estructura y Ruteo)
- [x] Providers globales (TanStack Query, Router, i18n, Theme, Zustand).
- [x] Rutas `/mapa`, `/eventos`, `/foro`, `/perfil` + layout/nav.
- [x] Modo invitado (lógica de `permissions.ts` + modal de barrera).
- [x] Migrar i18n a react-i18next (ES/EN).

### Infraestructura
- [x] Repo estructurado por features (`src/features/*`).
- [x] GitHub Actions configurado (lint + typecheck + test continuos).
- [x] Entorno de testing con Vitest levantado.

---

## 📌 Sprint 2 — Pines de 3 tipos (Sem 3–4)
**Meta:** crear y ver pines `place` y `report` con fotos, comentarios y votos; expiración; permanente por admin; indoor y ruteo.

### Dev C (Lead motor de pines)
- [x] UI crear/editar pin (react-hook-form + zod).
- [ ] Subida de N fotos (compresión + manejo de error + UUID).
- [x] Comentarios por pin en tiempo real (paginados).
- [x] Votos vía RPC `vote_pin`.
- [x] Eliminar pin propio.
- [x] Lógica de Favoritos.
- [x] Estados de desvanecimiento visual por `expires_at`.
- [x] Badge visual de "permanente".

### Dev B (Backend)
- [x] Tablas `pin_photos`, `pin_comments`, `pin_votes`, `favorites` + RLS.
- [x] RPC de base de datos para `vote_pin`.
- [x] Expiración (Tarea CRON `pg_cron` + Edge Function `expire-pins` para Storage).
- [x] Realtime de pines y comentarios.
- [x] Policy de permanente (solo admin) y de crear `place` (solo mod/admin).

### Dev A (Mapa Avanzado)
- [x] Ruteo peatonal ("cómo llegar" + rutas accesibles).
- [x] Filtros combinados (facultad + categoría + tipo + favoritos).
- [x] Capas (toggles) por tipo de pin.

---

## 📅 Sprint 3 — Eventos & Foro (Sem 5–6)
*Aún no iniciado.*
- [ ] Eventos (RSVP, creación anclada, oficial/estudiantil).
- [ ] Capa de eventos en el mapa y en calendario.
- [ ] Foro con hilos por facultad (upvotes, tags, tablón de anuncios).
- [ ] Moderación IA en Edge Function (Gemini + Groq).

---

## 🏅 Sprint 4 — Social, Gamificación & Launch (Sem 7–8)
*Aún no iniciado.*
- [ ] Perfiles expansibles, Karma e Insignias (Leaderboard).
- [ ] Web Push (Notificaciones push reales por interacciones).
- [ ] Cola de moderación para administradores.
- [ ] Despliegue, Accesibilidad AA final y modo oscuro optimizado.

---

## 🗺️ Sprint 5 — Planos Indoor (Sem 9+)
*Aún no iniciado. Pospuesto por complejidad.*
- [ ] Tablas `floor_plans` + RLS.
- [ ] Planos indoor (selector edificio/piso, renderizado GeoJSON en el mapa).
