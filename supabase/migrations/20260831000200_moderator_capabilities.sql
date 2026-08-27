-- ============================================================================
-- Permisos por persona, no por rol entero.
--
-- Hoy "moderador" es un paquete cerrado: quien lo tiene puede verificar pines,
-- borrar contenido ajeno, marcar eventos oficiales Y trazar el mapeo interior
-- completo — edificios, plantas y áreas de toda la universidad. Dárselo a
-- alguien para que ayude a mapear le entrega de paso el poder de borrar
-- cualquier hilo del foro. Eso empuja a no dar el rol a nadie, que es como se
-- queda el trabajo sin hacer.
--
-- LO QUE ESTO CAMBIA, Y LO QUE NO
--
-- No sustituye a los roles: `admin` sigue pudiéndolo todo y `student` nada.
-- Lo que se parte en piezas es el escalón de en medio. Un moderador NUEVO no
-- puede nada hasta que se le concede algo, y eso es deliberado: el permiso se
-- da a propósito, no por herencia.
--
-- COMPATIBILIDAD — la parte delicada
--
-- Los moderadores que YA existen tienen que seguir funcionando igual el minuto
-- después de aplicar esto. Por eso al final se les concede todo lo que hoy
-- pueden hacer: no es una concesión generosa, es que quitarles permisos en
-- silencio durante una migración es la forma de romper a alguien sin avisarle.
-- Si luego se les quiere recortar, se hace desde el panel y con intención.
--
-- ALCANCE: se aplica a las políticas del MAPEO y a la cola de denuncias. Las
-- demás (`pins_owner_or_mod`, foro…) siguen mirando el rol a secas. Reescribir
-- las treinta políticas de golpe es la forma de meter un agujero sin darse
-- cuenta; se irán moviendo una a una, con su comprobación.
--
-- REQUIERE 20260828000000 (activity_log) para el registro de concesiones.
-- APLICAR A MANO. Deshacer: 20260831000200_moderator_capabilities.down.sql
-- ============================================================================

-- ── 1. Qué se puede conceder ────────────────────────────────────────────────

create table if not exists public.moderator_capabilities (
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  capability  text        not null check (capability in (
                            'mapping',   -- trazar edificios, plantas y áreas
                            'reports',   -- ver y resolver denuncias
                            'verify',    -- verificar pines y alargar plazos
                            'content',   -- editar y borrar contenido ajeno
                            'official'   -- marcar eventos y publicar como entidad
                          )),
  granted_by  uuid        references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (user_id, capability)
);

alter table public.moderator_capabilities enable row level security;

-- Cada quien ve lo suyo —la interfaz necesita saber qué puede—, y admin ve todo.
drop policy if exists moderator_capabilities_read on public.moderator_capabilities;
create policy moderator_capabilities_read on public.moderator_capabilities
  for select using (user_id = auth.uid() or public.user_role() = 'admin');

-- Conceder y quitar es SOLO por RPC, nunca por escritura directa: si un
-- moderador pudiera insertar aquí, se concedería a sí mismo lo que quisiera.
revoke all on public.moderator_capabilities from anon, authenticated;
grant select on public.moderator_capabilities to authenticated;

-- ── 2. La pregunta que sustituye a `user_role() in (...)` ───────────────────

/**
 * ¿Puede quien llama hacer esto?
 *
 * `admin` siempre sí — el administrador no necesita que le concedan nada, y
 * hacerlo dependiente de una fila abriría el caso de un proyecto sin ningún
 * administrador capaz de repararse a sí mismo.
 *
 * `moderator` solo si tiene la concesión. Cualquier otro rol, no.
 */
create or replace function public.has_capability(p_capability text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select case
    when public.user_role() = 'admin' then true
    when public.user_role() <> 'moderator' then false
    else exists (
      select 1 from public.moderator_capabilities
       where user_id = auth.uid() and capability = p_capability
    )
  end;
$fn$;

grant execute on function public.has_capability(text) to anon, authenticated, service_role;

-- ── 3. Conceder y quitar ────────────────────────────────────────────────────

create or replace function public.admin_set_capability(
  p_user_id    uuid,
  p_capability text,
  p_granted    boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_rol    text;
  v_nombre text;
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden repartir permisos.';
  end if;

  select role, name into v_rol, v_nombre from public.profiles where id = p_user_id;
  if v_rol is null then
    raise exception 'Usuario no encontrado.';
  end if;
  -- Conceder capacidades a un estudiante crearía un moderador encubierto: con
  -- permisos reales y sin el rol que se lo explique a nadie que mire la lista.
  if v_rol <> 'moderator' then
    raise exception 'Los permisos se reparten entre moderadores. % tiene rol %.', coalesce(v_nombre, 'Esa persona'), v_rol;
  end if;

  if p_granted then
    insert into public.moderator_capabilities (user_id, capability, granted_by)
    values (p_user_id, p_capability, auth.uid())
    on conflict (user_id, capability) do nothing;
  else
    delete from public.moderator_capabilities
     where user_id = p_user_id and capability = p_capability;
  end if;

  perform public.log_activity(
    'capability_changed',
    coalesce(v_nombre, 'Sin nombre') || ': ' || (case when p_granted then '+' else '−' end) || p_capability,
    'profile',
    p_user_id,
    jsonb_build_object('capability', p_capability, 'granted', p_granted)
  );
end;
$fn$;

grant execute on function public.admin_set_capability(uuid, text, boolean) to authenticated, service_role;

alter table public.activity_log drop constraint if exists activity_log_action_check;
alter table public.activity_log
  add constraint activity_log_action_check check (action in (
    'pin_created', 'pin_deleted', 'pin_verified', 'pin_unverified',
    'report_filed', 'report_claimed', 'report_resolved', 'report_dismissed',
    'role_changed', 'broadcast_sent', 'push_unsubscribed',
    'capability_changed'
  ));

/** Las capacidades de alguien, para pintarlas en el panel. */
create or replace function public.admin_user_capabilities(p_user_id uuid)
returns table (capability text, granted_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden ver los permisos de otro.';
  end if;
  return query
    select c.capability, c.created_at
      from public.moderator_capabilities c
     where c.user_id = p_user_id
     order by c.capability;
end;
$fn$;

grant execute on function public.admin_user_capabilities(uuid) to authenticated, service_role;

-- ── 4. Las políticas que pasan a mirar la capacidad ─────────────────────────

drop policy if exists floor_plans_admin on public.floor_plans;
create policy floor_plans_admin on public.floor_plans
  for all using (public.has_capability('mapping'));

drop policy if exists buildings_write on public.buildings;
create policy buildings_write on public.buildings
  for all using (public.has_capability('mapping'))
  with check (public.has_capability('mapping'));

drop policy if exists building_floors_write on public.building_floors;
create policy building_floors_write on public.building_floors
  for all using (public.has_capability('mapping'))
  with check (public.has_capability('mapping'));

drop policy if exists areas_write on public.areas;
create policy areas_write on public.areas
  for all using (public.has_capability('mapping'))
  with check (public.has_capability('mapping'));

-- La cola de denuncias deja de ser exclusiva de admin: un moderador con
-- 'reports' la ve. Era el hueco más citado — quien modera contenido no podía
-- ver lo que la gente denunciaba.
drop policy if exists content_reports_read_own_or_admin on public.content_reports;
create policy content_reports_read_own_or_admin on public.content_reports
  for select using (reporter_id = auth.uid() or public.has_capability('reports'));

-- ── 5. Los moderadores de hoy conservan lo de hoy ───────────────────────────
--
-- No es generosidad: quitarle permisos a alguien en silencio, durante una
-- migración, es romperle el trabajo sin avisarle. Recortar se hace después,
-- desde el panel y a propósito.

insert into public.moderator_capabilities (user_id, capability)
select p.id, c.capability
  from public.profiles p
 cross join (values ('mapping'), ('verify'), ('content'), ('official')) as c(capability)
 where p.role = 'moderator'
on conflict do nothing;
