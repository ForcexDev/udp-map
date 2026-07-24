# Estado de Sprints — UDP Map v0.2.0

**Última actualización:** 2026-07-24

Este documento refleja el avance comprobable del repositorio. Se distingue entre:

- **Completado:** existe en código, migraciones SQL probadas y rutas funcionales.
- **Preparado:** está implementado localmente, pero requiere despliegue o validación en entorno externo de Supabase.
- **Pendiente:** no existe o falta una parte necesaria para considerarlo terminado.

Los problemas de seguridad y arquitectura de base de datos se registran, sin borrar historial, en [securityDB.md](securityDB.md).

## Resumen

| Sprint | Estado | Resultado actual |
|---|---|---|
| Sprint 1 — Fundaciones | Completado | Arquitectura por features, MapLibre, PWA, Auth Google, roles, modo invitado, i18n y CI |
| Sprint 2 — Motor de pines | Completado | Pines, fotos, comentarios, votos, favoritos, expiración, ruteo y filtros |
| Sprint 3 — Eventos y foro | Completado | Eventos, RSVP validado en DB, calendario, foro con respuestas anidadas, votos RPC y hilos oficiales |
| Sprint 4 — Social, admin y notificaciones | Completado | Perfil, karma, insignias, orientación giroscópica, notificaciones Web Push, panel admin (`/admin`) y cola de moderación (`/moderacion`) |
| Sprint 5 — Expansión y multicampus | En progreso | Perímetros GeoJSON multicampus y asignación automática por ubicación; resta clustering visual Waze |
| Sprint 6 — IA y planos indoor | Planificado | Moderación IA y fuente productiva de planos por edificio/piso |

---

## Sprint 1 — Fundaciones

**Meta:** el mapa nuevo carga, un usuario UDP inicia sesión y un invitado puede leer sin escribir.

### Frontend y mapa

- [x] Migración de Leaflet a MapLibre GL + OpenFreeMap.
- [x] Tres campus, selector de campus y búsqueda de facultades.
- [x] PWA instalable, shell offline y caché de tiles.
- [x] Base del design system con Tailwind CSS 4, Radix UI y tema claro/oscuro/sistema.
- [x] Tutorial inicial y navegación mobile-first.

### Backend, autenticación y datos

- [x] Esquema `profiles`, `campuses`, `faculties`, `careers`, `categories` y `pins`.
- [x] Enum `pin_type` con `place`, `event` y `report`.
- [x] RLS habilitado en las tablas públicas de la aplicación.
- [x] Seed de campus, facultades, categorías y pines iniciales.
- [x] Auth Google restringido a `@mail.udp.cl` en frontend y trigger de perfil.
- [x] Roles `guest`, `student`, `moderator` y `admin`.

### Arquitectura e infraestructura

- [x] Estructura `src/features/*` (10 dominios funcionales desacoplados).
- [x] Providers de React Router 7, TanStack Query, Zustand e i18n.
- [x] Rutas `/mapa`, `/eventos`, `/foro`, `/perfil`, `/moderacion` y `/admin`.
- [x] Matriz central de permisos y barrera de login para invitados.
- [x] GitHub Actions CI con lint, typecheck, tests y build.

---

## Sprint 2 — Motor de pines

**Meta:** crear y consumir contenido geolocalizado con fotos, interacción y ciclo de vida.

### Pines y contenido asociado

- [x] Crear y editar pines mediante `react-hook-form` + `Zod`.
- [x] Pines `report`, `event` y `place` según permisos del usuario.
- [x] Subida de múltiples fotos con validación, compresión, UUID y rutas por usuario.
- [x] Edición y eliminación de fotos, incluyendo limpieza de Storage.
- [x] Comentarios paginados por pin, UI optimista y suscripción Realtime.
- [x] Votos mediante RPC `vote_pin`.
- [x] Favoritos y filtro por favoritos.
- [x] Eliminación propia y moderación según rol.
- [x] TTL por categoría, desvanecimiento visual y ocultamiento de expirados.
- [x] Verificación de pines, conversión a permanente y extensión de TTL por moderador/admin.
- [x] Protección de campos de pines verificados e internos mediante triggers y RLS (`20260724000010_protect_pin_fields.sql`).

### Mapa

- [x] Lectura de pines filtrada por bounds, tipo, facultad y categoría, con límite de 300 filas por consulta.
- [x] Capas/toggles por tipo y panel de filtros.
- [x] Ruteo peatonal y alternativa accesible vía OpenRouteService.
- [x] Límites visuales y de navegación del mapa.
- [x] Desbloqueo de límites exclusivo para administradores.
- [x] Perímetros de facultades y asignación automática de `faculty_id` según la ubicación del pin.

### Backend

- [x] Tablas `pin_photos`, `pin_comments`, `pin_votes` y `favorites`.
- [x] RLS para tablas satélite y Storage.
- [x] CRON de expiración y Edge Function `expire-pins`.
- [x] Publicación Realtime para pines y comentarios.

---

## Sprint 3 — Eventos y foro

**Meta:** calendario de eventos con RSVP y foro estudiantil por facultad.

### Eventos

- [x] Eventos sobre la tabla `pins` con fechas de inicio/fin.
- [x] Creación anclada al mapa.
- [x] Eventos estudiantiles y oficiales según rol.
- [x] Calendario/lista con agrupación por fecha.
- [x] RSVP `going` / `interested`, cambio y cancelación.
- [x] Capa de eventos en el mapa y acceso al detalle/ruteo.
- [x] Notificaciones push de recordatorio para eventos guardados.
- [x] Validación en base de datos de que un RSVP solo apunte a un pin de tipo `event` (`20260724000006_validate_rsvp_event_type.sql`).

### Foro

- [x] Hilos por facultad y tablón general.
- [x] Creación y eliminación de hilos.
- [x] Tags y orden por reciente o puntaje.
- [x] Comentarios y respuestas anidadas.
- [x] Conteo real de respuestas en tarjetas y actualización tras crear/eliminar comentarios.
- [x] Mención automática al autor del hilo o comentario al responder.
- [x] Votos únicos y consistentes mediante RPC atómica `vote_thread`.
- [x] Publicaciones oficiales del Centro de Alumnos / Administración (`20260723000001_forum_official_threads.sql`).
- [x] Fijar/desfijar hilos desde la UI de moderación con policy corregida y segura (`20260724000008_fix_threads_pin_policy.sql`).
- [x] Suscripciones Realtime del foro.
- [ ] Búsqueda de texto completo (FTS) y filtro por tags.

---

## Sprint 4 — Social, gamificación, notificaciones y administración

**Meta:** completar identidad social, operación administrativa, notificaciones Web Push y salida a producción.

### Completado en código y base de datos

- [x] Edición de perfil: nombre, facultad y carrera.
- [x] Perfil público con aportes, karma, rol e insignias.
- [x] Gestión de roles desde perfil público y panel admin (`20260724000001_admin_set_user_role.sql` y `20260724000004_fix_role_rank_guest_regression.sql`).
- [x] Panel de Administración dedicado (`/admin`) con métricas, conteo de suscriptores push y gestión de usuarios.
- [x] Karma por pines, comentarios, hilos y votos.
- [x] Insignias permanentes y leaderboard por facultad.
- [x] Badge Cartógrafo por pines verificados.
- [x] Publicaciones oficiales diferenciadas por rol.
- [x] Verificación y protección adicional de pines permanentes.
- [x] Orientación nativa con giroscopio, rumbo del usuario y rotación del mapa.
- [x] PWA Auto-Update al reactivar la aplicación o volver a la pestaña.
- [x] Pop-up de actualización alimentado desde `docs/CHANGELOG.md`.
- [x] Toggle administrativo para desbloquear los límites del mapa.
- [x] Web Push y centro de notificaciones (Drawer) implementados en frontend y Edge Function (`send-push`).
- [x] Cola de moderación (`/moderacion`) para reportes de contenido.
- [x] Cierre de parches de seguridad DB SEC-002, SEC-003, SEC-004, SEC-005 y SEC-006.
- [ ] SEC-007: validación de tipo de RSVP ya aplicada; la lectura pública de `event_rsvps` sigue sin resolver.

### Preparado, pendiente de despliegue en producción

- [ ] **Rate limit de 10 pines por día UTC:** frontend, modo demo, pruebas y migración `20260721000001_pin_daily_limit.sql` preparados. Falta ejecutarla y validarla en Supabase productivo.

### Pendiente

- [ ] Hardening final de RLS y funciones restantes documentado en `securityDB.md`.
- [ ] Pruebas de integración E2E automatizadas con Playwright.
- [ ] Accesibilidad AA final.
- [ ] Optimización final del modo oscuro y rendimiento.
- [ ] Guía formal de despliegue en producción.

---

## Sprint 5 / Backlog — Expansión y multicampus

- [x] Perímetros GeoJSON para múltiples facultades y campus UDP.
- [x] Asignación automática del `faculty_id` al crear o reubicar un pin.
- [ ] Atribución oficial dinámica por facultad/CEE.
- [ ] Clustering visual de pines tipo Waze cuando varios reportan en el mismo punto.
- [ ] Completar pruebas geográficas de todos los perímetros.

---

## Sprint 6 — IA y planos indoor

### Planos indoor

- [x] Tabla `floor_plans` y RLS inicial.
- [x] Planos demo con selector de piso y capa GeoJSON.
- [ ] Fuente productiva por edificio/piso desde Supabase; hoy la UI usa `DEMO_FLOOR_PLANS`.
- [ ] Ampliar y validar datos indoor para más edificios.

### Inteligencia artificial

- [ ] Edge Function de moderación IA con proveedor principal y respaldo.
- [ ] Evaluación de falsos positivos, límites, costos y degradación segura.
- [ ] Integración con reportes y cola administrativa.

---

## Estado de Calidad

- **12 archivos de pruebas Vitest.**
- **54 pruebas unitarias y de componentes pasando al 100%.**
- CI ejecuta `lint` (ESLint 9), `typecheck` (TypeScript 5.7), `test` (Vitest 3) y `build` (Vite 6).
- El build de producción (`npm run build`) está completamente operativo.

---

*Documento vivo: actualizar al cerrar una tarea, distinguir código local de despliegue real y conservar los pendientes de seguridad en `securityDB.md`.*
