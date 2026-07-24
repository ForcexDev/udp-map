# Estado de Sprints — UDP Map v0.2.0

**Última actualización:** 2026-07-21

Este documento refleja el avance comprobable del repositorio. Se distingue entre:

- **Completado:** existe en código y tiene una ruta funcional.
- **Preparado:** está implementado localmente, pero todavía requiere despliegue o validación externa.
- **Pendiente:** no existe o falta una parte necesaria para considerarlo terminado.

Los problemas de seguridad y arquitectura de base de datos se registran, sin borrar historial, en [securityDB.md](securityDB.md).

## Resumen

| Sprint | Estado | Resultado actual |
|---|---|---|
| Sprint 1 — Fundaciones | Completado | Arquitectura por features, MapLibre, PWA, Auth, roles, modo invitado, i18n y CI |
| Sprint 2 — Motor de pines | Completado | Pines, fotos, comentarios, votos, favoritos, expiración, ruteo y filtros |
| Sprint 3 — Eventos y foro | En estabilización | Eventos, RSVP, calendario y foro; faltan FTS y tiempo real del foro |
| Sprint 4 — Social y lanzamiento | En progreso | Perfil, karma, badges, orientación, actualización PWA y controles administrativos listos |
| Sprint 5 — Expansión | Backlog activo | Clustering visual, atribución dinámica y multicampus |
| Sprint 6 — IA y planos indoor | Planificado | Moderación IA y fuente productiva de planos por edificio/piso |

---

## Sprint 1 — Fundaciones

**Meta:** el mapa nuevo carga, un usuario UDP inicia sesión y un invitado puede leer sin escribir.

### Frontend y mapa

- [x] Migración de Leaflet a MapLibre GL + OpenFreeMap.
- [x] Tres campus, selector de campus y búsqueda de facultades.
- [x] PWA instalable, shell offline y caché de tiles.
- [x] Base del design system con Tailwind, Radix y tema claro/oscuro/sistema.
- [x] Tutorial inicial y navegación mobile-first.

### Backend, autenticación y datos

- [x] Esquema `profiles`, `campuses`, `faculties`, `careers`, `categories` y `pins`.
- [x] Enum `pin_type` con `place`, `event` y `report`.
- [x] RLS habilitado en las tablas públicas de la aplicación.
- [x] Seed de campus, facultades, categorías y pines iniciales.
- [x] Auth Google restringido a `@mail.udp.cl` en frontend y trigger de perfil.
- [x] Roles `guest`, `student`, `moderator` y `admin`.

### Arquitectura e infraestructura

- [x] Estructura `src/features/*` y utilidades compartidas.
- [x] Providers de React Router, TanStack Query, Zustand e i18n.
- [x] Rutas `/mapa`, `/eventos`, `/foro` y `/perfil`.
- [x] Matriz central de permisos y barrera de login para invitados.
- [x] GitHub Actions con lint, typecheck, tests y build.

---

## Sprint 2 — Motor de pines

**Meta:** crear y consumir contenido geolocalizado con fotos, interacción y ciclo de vida.

### Pines y contenido asociado

- [x] Crear y editar pines mediante react-hook-form + Zod.
- [x] Pines `report`, `event` y `place` según permisos.
- [x] Subida de múltiples fotos con validación, compresión, UUID y rutas por usuario.
- [x] Edición y eliminación de fotos, incluyendo limpieza de Storage.
- [x] Comentarios paginados por pin, UI optimista y suscripción Realtime.
- [x] Votos mediante RPC `vote_pin`.
- [x] Favoritos y filtro por favoritos.
- [x] Eliminación propia y moderación según rol.
- [x] TTL por categoría, desvanecimiento visual y ocultamiento de expirados.
- [x] Verificación de pines, conversión a permanente y extensión de TTL por moderador/admin.
- [x] Protección parcial de campos de pines verificados mediante trigger.

### Mapa

- [x] Lectura de pines filtrada por bounds, tipo, facultad y categoría, con límite de 300 filas por consulta.
- [x] Capas/toggles por tipo y panel de filtros.
- [x] Ruteo peatonal y alternativa accesible.
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
- [ ] Recordatorios push de eventos.
- [ ] Validación en base de datos de que un RSVP solo apunte a un pin `event`.

### Foro

- [x] Hilos por facultad y tablón general.
- [x] Creación y eliminación de hilos.
- [x] Tags y orden por reciente o puntaje.
- [x] Comentarios y respuestas anidadas.
- [x] Conteo real de respuestas en tarjetas y actualización tras crear/eliminar comentarios.
- [x] Mención automática al autor del hilo o comentario al responder.
- [x] Votos únicos y consistentes mediante RPC atómica `vote_thread`.
- [x] Fijar/desfijar hilos desde la UI de moderación.
- [ ] Corregir la policy `threads_update_owner_or_mod` antes de considerar segura la moderación.
- [ ] Suscripciones Realtime del foro.
- [ ] Búsqueda de texto completo y filtro por tags.
- [ ] Flujo de reportes de contenido.

---

## Sprint 4 — Social, gamificación y lanzamiento

**Meta:** completar identidad social, operación administrativa, notificaciones y salida a producción.

### Completado en código y base desplegada

- [x] Edición de perfil: nombre, facultad y carrera.
- [x] Perfil público con aportes, karma, rol e insignias.
- [x] Gestión de roles desde perfil público para administradores.
- [x] Karma por pines, comentarios, hilos y votos.
- [x] Insignias permanentes y leaderboard por facultad.
- [x] Badge Cartógrafo por pines verificados.
- [x] Publicaciones oficiales diferenciadas por rol.
- [x] Verificación y protección adicional de pines permanentes.
- [x] Orientación nativa con giroscopio, rumbo del usuario y rotación del mapa.
- [x] PWA Auto-Update al reactivar la aplicación o volver a la pestaña.
- [x] Pop-up de actualización alimentado desde `docs/CHANGELOG.md`.
- [x] Toggle administrativo para desbloquear los límites del mapa.

### Preparado, pendiente de despliegue

- [ ] **Rate limit de 10 pines por día UTC:** frontend, modo demo, pruebas y migración `20260721000001_pin_daily_limit.sql` preparados. Falta ejecutarla y validarla en Supabase.
- [ ] Confirmar en Supabase que no quede una policy de `INSERT` directo sobre `pins`.

### Pendiente

- [x] Web Push y centro de notificaciones implementados en código; pendientes de despliegue y validación según `NOTIFICATIONS_AND_MODERATION.md`.
- [x] Cola de moderación exclusiva para administradores implementada en código; pendiente de aplicar migración y validar DoD.
- [ ] Hardening de RLS, columnas y funciones `SECURITY DEFINER` documentado en `securityDB.md`.
- [ ] Pruebas de integración reales contra Supabase.
- [ ] Accesibilidad AA final.
- [ ] Optimización final del modo oscuro y rendimiento.
- [ ] Smoke tests E2E con Playwright.
- [ ] Despliegue de producción documentado.

---

## Sprint 5 / Backlog — Expansión y multicampus

- [x] Perímetros GeoJSON para múltiples facultades/campus.
- [x] Asignación automática del `faculty_id` al crear o reubicar un pin.
- [ ] Atribución oficial dinámica por facultad/CEE; actualmente el moderador usa el texto fijo “Centro de Alumnos FIC”.
- [ ] Clustering visual de pines tipo Waze cuando varios reportan lo mismo o están en el mismo punto.
- [ ] Completar pruebas geográficas de todos los perímetros.

---

## Sprint 6 — IA y planos indoor

### Planos indoor

- [x] Tabla `floor_plans` y RLS inicial.
- [x] Planos demo con selector de piso y capa GeoJSON.
- [ ] Fuente productiva por edificio/piso desde Supabase; hoy la UI usa `DEMO_FLOOR_PLANS`.
- [ ] Ampliar y validar datos indoor para más edificios.
- [ ] Herramientas de carga, validación y administración de GeoJSON indoor.

### Inteligencia artificial

- [ ] Edge Function de moderación IA con proveedor principal y respaldo.
- [ ] Evaluación de falsos positivos, límites, costos y degradación segura.
- [ ] Integración con reportes y cola administrativa.

---

## Estado de calidad

- 11 archivos de pruebas Vitest.
- 51 pruebas unitarias/de componentes registradas.
- CI ejecuta `lint`, `typecheck`, `test` y `build`.
- El build de producción está operativo.
- No existen pruebas E2E ni suite de integración de Supabase todavía.

---

*Documento vivo: actualizar al cerrar una tarea, distinguir código local de despliegue real y conservar los pendientes de seguridad en `securityDB.md`.*
