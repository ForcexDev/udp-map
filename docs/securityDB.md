# Security DB — Registro histórico de pendientes

**Última actualización:** 2026-07-24

## Cómo usar este documento

Este archivo es el registro histórico de seguridad y arquitectura de base de datos del proyecto. Para mantenerlo útil en el tiempo:

1. **Nunca borres un pendiente ni su historial**, aunque ya esté resuelto.
2. Cuando comiences un trabajo, cambia su estado de `Pendiente` a `En progreso`.
3. Cuando termines, cambia el estado a `Completado` y rellena `Fecha de finalización` con formato `AAAA-MM-DD`.
4. Agrega en `Historial` una línea indicando qué se hizo, la migración o PR relacionada y cómo se verificó.
5. Si una solución se reemplaza, conserva la información anterior y agrega una nueva entrada indicando que quedó `Reemplazada`.
6. Cada vez que modifiques este archivo, actualiza la fecha **Última actualización** ubicada al comienzo.
7. Los estados permitidos son: `Pendiente`, `En progreso`, `Completado`, `Aceptado` y `Reemplazado`.

Plantilla para nuevos pendientes:

```md
## SEC-XXX — Título

- Estado: Pendiente
- Severidad: Crítica | Alta | Media | Baja
- Fecha de detección: AAAA-MM-DD
- Fecha de finalización: —
- Alcance: componente, tabla, función o policy

### Problema

Descripción y evidencia.

### Acción requerida

Solución esperada.

### Criterio de cierre

Cómo demostrar que quedó resuelto.

### Historial

- AAAA-MM-DD: Pendiente registrado.
```

## Resumen de pendientes

| ID | Severidad | Estado | Tema |
|---|---|---|---|
| SEC-001 | Alta | Pendiente | Aplicar y validar rate limit diario de pines |
| SEC-002 | Crítica | Completado | Funciones internas `SECURITY DEFINER` expuestas |
| SEC-003 | Crítica | Completado | Usuarios pueden modificar columnas protegidas de su perfil |
| SEC-004 | Alta | Completado | Lectura pública de todas las columnas de perfiles |
| SEC-005 | Crítica | Completado | Dueños pueden modificar campos internos de sus pines |
| SEC-006 | Alta | Completado | Policy defectuosa para fijar hilos del foro |
| SEC-007 | Media | En progreso | RSVP públicos y sin validación del tipo de pin |
| SEC-008 | Alta | En progreso | Escrituras directas de votos pueden desincronizar contadores |
| SEC-009 | Alta | En progreso | Estandarizar permisos y `search_path` de funciones privilegiadas |
| SEC-010 | Media | Pendiente | Agregar pruebas de regresión de seguridad de base de datos |

## SEC-001 — Aplicar y validar rate limit diario de pines

- Estado: Pendiente
- Severidad: Alta
- Fecha de detección: 2026-07-21
- Fecha de finalización: —
- Alcance: `public.pins`, `public.pin_creation_events`, RPC `create_pin_with_daily_limit`

### Problema

La implementación está preparada localmente, pero debe ejecutarse y validarse en Supabase. Los estudiantes deben tener un máximo de 10 pines creados por día UTC. Moderadores y administradores quedan exentos. Eliminar un pin no debe recuperar el cupo consumido.

### Acción requerida

Ejecutar completa la migración `supabase/migrations/20260721000001_pin_daily_limit.sql`, desplegar el frontend que utiliza la RPC y validar permisos, concurrencia y reinicio diario.

### Criterio de cierre

- Un estudiante puede crear exactamente 10 pines durante el mismo día UTC.
- El intento número 11 devuelve `DAILY_PIN_LIMIT_REACHED`.
- Eliminar un pin no libera cupo.
- Solicitudes simultáneas no superan el máximo.
- Moderadores y administradores pueden crear sin límite.
- No existe una policy que permita `INSERT` directo sobre `public.pins`.
- `authenticated` puede ejecutar la RPC y `anon` no puede hacerlo.

### Historial

- 2026-07-21: Migración y cambios de frontend preparados; falta ejecución y validación en Supabase.

## SEC-002 — Funciones internas `SECURITY DEFINER` expuestas

- Estado: Completado
- Severidad: Crítica
- Fecha de detección: 2026-07-21
- Fecha de finalización: 2026-07-24
- Alcance: funciones privilegiadas del esquema `public`

### Problema

El catálogo de producción confirmó que `anon` y `authenticated` pueden ejecutar funciones internas con `SECURITY DEFINER`. El caso más crítico es `adjust_karma(uuid, integer)`, que recibe un usuario y una cantidad arbitraria. También están expuestas las funciones `check_*_badge`, incluidas `check_pioneer_badge(uuid, integer)`, y las funciones destinadas exclusivamente a triggers.

### Acción requerida

Clasificar las funciones y aplicar privilegios mínimos:

- Revocar a clientes todas las funciones internas: `adjust_karma`, `check_explorer_badge`, `check_guardian_badge`, `check_host_badge`, `check_photographer_badge`, `check_pioneer_badge`, `handle_new_user`, `on_*_trigger`, `on_*_change_karma` y `protect_pin_sensitive_fields`.
- Permitir `vote_pin` y `vote_thread` solamente a `authenticated`.
- Permitir `extend_pin_ttl`, `set_pin_permanent` y `verify_and_make_permanent` solamente a `authenticated`, manteniendo además sus validaciones de rol dentro de la función.
- Revisar `user_role` por separado porque es utilizado por policies RLS; conservar únicamente los permisos requeridos para que esas policies funcionen.

### Criterio de cierre

Las funciones internas devuelven `false` en `has_function_privilege` para `anon` y `authenticated`; las RPC públicas tienen únicamente los permisos estrictamente necesarios y sus validaciones internas siguen activas.

### Historial

- 2026-07-21: Exposición confirmada mediante `has_function_privilege` para todas las funciones `SECURITY DEFINER` revisadas.
- 2026-07-24: Migración `supabase/migrations/20260724000007_lock_down_internal_functions.sql` aplicada a prod. Recon adicional detectó `admin_broadcast_push_notification`, `admin_count_push_subscribers` y `admin_set_user_role` también expuestas a `anon`/`PUBLIC` (no listadas originalmente); las tres tienen chequeo interno `user_role() = 'admin'` pero igual se restringieron a `authenticated` por defensa en profundidad. Verificado: `has_function_privilege('anon'/'authenticated', 'adjust_karma(uuid,integer)', 'execute')` = `false`; `vote_pin(uuid,smallint)` y `admin_set_user_role(uuid,text)` = `false` para `anon`, `true` para `authenticated`; `user_role()` intacto para `anon` (`true`, requerido por RLS).

## SEC-003 — Usuarios pueden modificar columnas protegidas de su perfil

- Estado: Completado
- Severidad: Crítica
- Fecha de detección: 2026-07-21
- Fecha de finalización: 2026-07-24
- Alcance: tabla `public.profiles`, policy `profiles_update_own`

### Problema

La policy propia solo comprueba `id = auth.uid()` y que el rol no cambie. RLS controla filas, no columnas, por lo que un cliente puede intentar actualizar directamente `karma`, `email`, `created_at` u otros campos administrados por el servidor. Una actualización manual de `karma` también activa `on_profile_badge`.

### Acción requerida

Definir explícitamente las columnas editables por el usuario —por ejemplo nombre, facultad, carrera, año y avatar— y proteger las demás mediante privilegios por columna, una RPC dedicada o un trigger `BEFORE UPDATE`.

### Criterio de cierre

Un estudiante puede editar solo los campos de perfil autorizados. Los intentos de cambiar `karma`, `role`, `email`, `id` o fechas administradas por el servidor son rechazados o restaurados por la base de datos.

### Historial

- 2026-07-21: Riesgo identificado al revisar la policy vigente y el trigger de badges.
- 2026-07-24: Migración `supabase/migrations/20260724000009_protect_profile_columns.sql` aplicada a prod. Se reemplazó el chequeo ad hoc de `role` en `profiles_update_own` por trigger `trg_protect_profile_privileged_fields` (`BEFORE UPDATE`) que congela `email`, `role`, `karma`, `created_at` e `id` salvo admin. Campos editables por el dueño: `name`, `faculty_id`, `career`, `year`, `avatar_url`. Enfoque unificado con trigger en vez de `GRANT` columna por columna, mismo patrón que SEC-005/SEC-006.
- 2026-07-24: Migración `supabase/migrations/20260724000011_fix_admin_downgrade_and_profile_trigger.sql` agregada. Se solucionó la imposibilidad de degradar administradores: `protect_profile_privileged_fields` se actualizó para otorgar bypass a superusuarios de la base de datos (`postgres`, `service_role`, `supabase_admin`, `dashboard_user`) cuando ejecutan consultas SQL directamente (donde `auth.uid()` es `null`), y `admin_set_user_role` se simplificó para permitir a un admin cambiar el rol de cualquier otro usuario a `student`, `moderator` o `admin`.

## SEC-004 — Lectura pública de todas las columnas de perfiles

- Estado: Completado
- Severidad: Alta
- Fecha de detección: 2026-07-21
- Fecha de finalización: 2026-07-24
- Alcance: tabla `public.profiles`, policies `profiles_read` y `profiles_read_authenticated`

### Problema

Continúa activa `profiles_read USING (true)`. Las policies permisivas se combinan con `OR`, por lo que `profiles_read_authenticated` no limita la policy pública. Aunque el frontend selecciona campos seguros, un cliente puede solicitar directamente otras columnas, incluido `email`.

### Acción requerida

Eliminar la lectura pública de la tabla base y exponer solamente campos seguros mediante una vista o RPC de perfiles públicos. Actualizar las consultas del frontend y conservar el acceso del usuario a su perfil completo cuando corresponda.

### Criterio de cierre

Un usuario anónimo o autenticado no puede consultar correos ni columnas privadas de otros perfiles. Los nombres, avatares y datos destinados al perfil público siguen disponibles.

### Historial

- 2026-07-21: Se confirmó que una migración anterior eliminaba nombres alternativos de policy, pero no eliminaba `profiles_read`.
- 2026-07-24: Migración `supabase/migrations/20260724000009_protect_profile_columns.sql` aplicada a prod. Se eliminaron `profiles_read` y `profiles_read_authenticated`; se agregaron `profiles_read_own` (`id = auth.uid()`) y `profiles_read_admin` (solo admin, para el panel). Se creó vista `public.profiles_public` (id, name, avatar_url, role, karma, faculty_id, career, year, created_at — sin email) con `select` para `anon`/`authenticated`. Frontend actualizado: [publicProfileApi.ts](../src/features/profile/publicProfileApi.ts) (`fetchPublicProfile`, `fetchLeaderboard`) ahora consulta `profiles_public` en vez of `profiles`. Verificado: `has_table_privilege('anon'/'authenticated', 'public.profiles_public', 'select')` = `true`; policies restantes en `profiles` = `profiles_read_own`, `profiles_read_admin`, `profiles_update_own`, `profiles_admin_update`.
- 2026-07-24: Migración `supabase/migrations/20260724000011_fix_admin_downgrade_and_profile_trigger.sql` resolvió la advertencia de linter Supabase `security_definer_view`: `public.profiles_public` se configuró con `security_invoker = true`. Para respetar la evaluación de RLS del invocador preservando la privacidad del correo, se asignó `profiles_read_public` en `profiles` restringiendo los `GRANT SELECT` de la tabla base por columnas (excluyendo `email` para usuarios anónimos).
- 2026-07-24: Migración `supabase/migrations/20260724000013_fix_karma_update_in_profile_trigger.sql` corregida en prod. Se ajustaron `adjust_karma` y `protect_profile_privileged_fields` mediante la variable de sesión `udpmap.internal_karma_update`, permitiendo que las acciones de votación/pines/comentarios de usuarios con rol `student` actualicen el karma del autor sin ser rechazadas por el trigger de protección del perfil.

## SEC-005 — Dueños pueden modificar campos internos de sus pines

- Estado: Completado
- Severidad: Crítica
- Fecha de detección: 2026-07-21
- Fecha de finalización: 2026-07-24
- Alcance: tabla `public.pins`, policy `pins_owner_update`, trigger `protect_pin_sensitive_fields`

### Problema

La policy permite actualizar cualquier pin propio mientras `creator_id` siga siendo el usuario. El trigger actual protege permanencia, oficialidad, tipo y expiración, y congela parte de la estructura de pines permanentes, pero no protege todos los campos administrados por el servidor. Entre ellos están `votes_up`, `votes_down` y `reports`. En pines no permanentes también debe decidirse explícitamente si el autor puede modificar ubicación, facultad y categoría.

Esta revisión no propone recuperar la restricción GPS de 1 km: la colaboración desde casa y el límite geográfico del mapa continúan siendo decisiones funcionales vigentes.

### Acción requerida

Crear una lista explícita de campos editables por el dueño y proteger los contadores y metadatos internos mediante privilegios de columnas, una RPC de edición o un trigger completo. La autorización visible en el frontend no debe ser el único control.

### Criterio de cierre

Un estudiante no puede alterar contadores, autoría, oficialidad, verificación, permanencia, tipo ni expiración mediante una petición directa. El comportamiento de ubicación, facultad y categoría queda documentado y aplicado en base de datos.

### Historial

- 2026-07-21: Se confirmó que existe `trg_protect_pin_sensitive_fields`, pero su cobertura es parcial.
- 2026-07-24: Migración `supabase/migrations/20260724000010_protect_pin_fields.sql` aplicada a prod. `protect_pin_sensitive_fields` extendida para congelar también `creator_id`, `votes_up`, `votes_down` y `reports` salvo mod/admin (antes solo protegía `is_permanent`, `verifier_entity_name`, `is_official`, `official_entity_name`, `type`, `expires_at`). Decisión de producto confirmada: en pines no permanentes el dueño puede seguir editando `lat`/`lng`/`faculty_id`/`category_id` (colaboración desde casa, sin restricción GPS — ver Decisiones vigentes).
- 2026-07-24: Migración `supabase/migrations/20260724000012_fix_vote_counter_protection_triggers.sql` corregida en prod. Se ajustó `protect_pin_sensitive_fields` para evaluar `current_setting('udpmap.vote_rpc', true) = 'on'`, permitiendo que la RPC autorizada `vote_pin()` actualice los contadores `votes_up` y `votes_down` para usuarios con rol `student`.

## SEC-006 — Policy defectuosa para fijar hilos del foro

- Estado: Completado
- Severidad: Alta
- Fecha de detección: 2026-07-21
- Fecha de finalización: 2026-07-24
- Alcance: tabla `public.forum_threads`, policy `threads_update_owner_or_mod`

### Problema

La condición que intenta conservar `is_pinned` usa una subconsulta equivalente a `id = id`. No referencia correctamente la fila original y puede devolver varias filas, bloquear actualizaciones o no proteger el campo de forma confiable.

### Acción requerida

Separar las policies de dueño y moderación o proteger `is_pinned` mediante un trigger/RPC. Solo moderadores y administradores deben poder fijar o desfijar hilos.

### Criterio de cierre

El dueño puede editar el contenido permitido de su hilo, pero no puede cambiar `author_id` ni `is_pinned`. Moderadores y administradores pueden fijar y desfijar correctamente.

### Historial

- 2026-07-21: Error tautológico confirmado en el output real de policies.
- 2026-07-24: Migración `supabase/migrations/20260724000008_fix_threads_pin_policy.sql` aplicada a prod. `threads_update_owner_or_mod` simplificada a solo dueño-o-mod (sin subconsulta); trigger nuevo `trg_protect_thread_privileged_fields` congela `is_pinned`, `is_official`, `official_entity_name`, `author_id`, `votes_up`, `votes_down` salvo mod/admin — se agregó protección de `author_id`/votos que el hallazgo original no mencionaba pero compartía la misma falla estructural. Verificado: `with_check` de `threads_update_owner_or_mod` ya no contiene subconsulta `old_thread`.
- 2026-07-24: Migración `supabase/migrations/20260724000012_fix_vote_counter_protection_triggers.sql` corregida en prod. Se ajustó `protect_thread_privileged_fields` para permitir actualizaciones de `votes_up`/`votes_down` cuando `current_setting('udpmap.vote_rpc', true) = 'on'`, de modo que `vote_thread()` funcione correctamente para usuarios `student`.

## SEC-007 — RSVP públicos y sin validación del tipo de pin

- Estado: En progreso
- Severidad: Media
- Fecha de detección: 2026-07-21
- Fecha de finalización: —
- Alcance: tabla `public.event_rsvps`, policies `event_rsvps_read` y `event_rsvps_all_own`

### Problema

`event_rsvps_read USING (true)` expone públicamente las filas con usuario y estado de asistencia. Además, la escritura propia no comprueba en base de datos que `pin_id` corresponda a un pin de tipo `event`.

### Acción requerida

Definir si la asistencia individual debe ser pública. Si solo se necesitan cantidades, exponer agregados sin identificadores personales. Validar mediante policy, trigger o RPC que el pin sea un evento.

### Criterio de cierre

La API revela únicamente la información de asistencia aprobada y rechaza RSVP asociados a pines que no sean eventos.

### Historial

- 2026-07-21: Exposición y ausencia de validación detectadas al revisar las policies actuales.
- 2026-07-24: Verificado contra prod: la mitad de tipo ya está resuelta por `supabase/migrations/20260724000006_validate_rsvp_event_type.sql` (trigger `trg_validate_rsvp_targets_event`, rechaza RSVP hacia pines que no son `event`). Sigue pendiente la exposición pública: `event_rsvps_read USING (true)` continúa activa, confirmado con consulta directa a `pg_policy`. No se toca en esta corrida.

## SEC-008 — Escrituras directas de votos pueden desincronizar contadores

- Estado: En progreso
- Severidad: Alta
- Fecha de detección: 2026-07-21
- Fecha de finalización: —
- Alcance: `public.pin_votes`, `public.forum_votes`, `public.pins`, `public.forum_threads`

### Problema

Las tablas de votos permiten operaciones directas mediante RLS mientras las RPC `vote_pin` y `vote_thread` recalculan los contadores agregados. Un cliente que escriba directamente puede activar los triggers de karma sin ejecutar el recálculo de `votes_up` y `votes_down`, dejando datos inconsistentes.

### Acción requerida

Elegir una única vía de escritura: bloquear DML directo y usar exclusivamente RPC, o mover los contadores a triggers transaccionales que cubran toda escritura. Mantener la restricción de un voto por usuario y objetivo.

### Criterio de cierre

No existe una ruta que modifique un voto sin actualizar en la misma transacción los contadores y el karma correspondientes. Las pruebas cubren insertar, cambiar y eliminar un voto.

### Historial

- 2026-07-21: La combinación de policies, RPC y triggers existentes confirmó dos vías de escritura con efectos diferentes.
- 2026-07-21: La migración local `20260721000003_forum_vote_consistency.sql` bloquea DML directo, serializa votos, protege contadores y repara valores históricos. Falta desplegarla y ejecutar pruebas de integración en Supabase para cerrar el hallazgo.

## SEC-009 — Estandarizar permisos y `search_path` de funciones privilegiadas

- Estado: En progreso
- Severidad: Alta
- Fecha de detección: 2026-07-21
- Fecha de finalización: —
- Alcance: todas las funciones `SECURITY DEFINER` del esquema `public`

### Problema

Las funciones privilegiadas no siguen una política uniforme de permisos ni de `search_path`. Algunas fijan `search_path = public`, otras no lo fijan, y actualmente los permisos por defecto exponen funciones nuevas a `PUBLIC`.

### Acción requerida

Adoptar un patrón obligatorio para cada función privilegiada:

- Fijar un `search_path` seguro y usar nombres de objetos calificados.
- Revocar `EXECUTE` a `PUBLIC` inmediatamente después de crear la función.
- Conceder ejecución solo al rol que realmente la necesita.
- Mantener verificaciones de identidad y rol dentro de las RPC que mutan datos.
- Configurar `ALTER DEFAULT PRIVILEGES` si se decide impedir que futuras funciones nazcan ejecutables por `PUBLIC`.

### Criterio de cierre

La revisión del catálogo no encuentra funciones privilegiadas con permisos o `search_path` fuera del estándar documentado.

### Historial

- 2026-07-21: Pendiente creado después de confirmar que todas las funciones privilegiadas revisadas eran ejecutables por clientes.
- 2026-07-24: Parte de permisos resuelta junto con SEC-002 (ver su historial). Pendiente: `extend_pin_ttl`, `protect_pin_sensitive_fields` y `verify_and_make_permanent` siguen sin `search_path` fijo (`proconfig` vacío, reconfirmado); falta `ALTER DEFAULT PRIVILEGES` para que funciones nuevas no nazcan ejecutables por `PUBLIC`. Queda `En progreso`.

## SEC-010 — Pruebas de regresión de seguridad de base de datos

- Estado: Pendiente
- Severidad: Media
- Fecha de detección: 2026-07-21
- Fecha de finalización: —
- Alcance: migraciones, RLS, permisos de funciones y flujos RPC

### Problema

Las pruebas de frontend no demuestran que las RLS, privilegios de funciones y triggers desplegados en Supabase tengan el comportamiento esperado. Los errores detectados podían ser explotados mediante peticiones directas aunque la interfaz no ofreciera esas acciones.

### Acción requerida

Agregar pruebas de integración para los roles `anon`, `student`, `moderator` y `admin`. Cubrir perfiles, pines, votos, foro, RSVP y rate limit, incluyendo intentos directos contra tablas y funciones internas.

### Criterio de cierre

El pipeline ejecuta pruebas contra una base de datos aislada y falla si una policy o un permiso vuelve a exponer una operación no autorizada.

### Historial

- 2026-07-21: Pendiente registrado como control preventivo después de la auditoría manual.

## Decisiones vigentes y riesgos aceptados

Estas entradas documentan decisiones actuales; no son pendientes y no deben eliminarse:

- Estado: Aceptado — Las tablas públicas de la aplicación tienen RLS habilitado.
- Estado: Aceptado — `FORCE ROW LEVEL SECURITY` está desactivado; esto es normal para el uso cliente de Supabase, pero no reemplaza la revisión de funciones privilegiadas y `service_role`.
- Estado: Aceptado — Pines, publicaciones, taxonomías y fotografías destinadas al mapa son de lectura pública.
- Estado: Aceptado — Los usuarios pueden colaborar creando pines desde casa; no existe una restricción GPS de 1 km.
- Estado: Aceptado (2026-07-24) — En pines no permanentes, el dueño puede seguir editando `lat`, `lng`, `faculty_id` y `category_id` tras crear el pin; `trg_protect_pin_sensitive_fields` no los congela (ver SEC-005).
- Estado: Aceptado — Moderadores y administradores están exentos del límite diario de 10 pines.
