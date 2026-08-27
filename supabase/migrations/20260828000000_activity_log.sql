-- ============================================================================
-- Un registro de actividad de verdad.
--
-- Lo que había NO era un log: `fetchRecentActivity` leía los últimos 15 pines y
-- las últimas 15 denuncias y los mezclaba en el cliente. Tres problemas que se
-- notan justo cuando hace falta:
--
--  1. Solo enseñaba lo que TODAVÍA EXISTE. Se borra un pin y su creación
--     desaparece del registro — o sea que lo único que un administrador querría
--     auditar (qué se borró, quién y cuándo) era precisamente lo que no podía
--     verse.
--  2. Solo sabía de dos cosas, porque solo hay dos tablas que consultar. Un
--     cambio de rol, una verificación o una difusión no dejan rastro en ningún
--     sitio.
--  3. No tenía autor. "Pin publicado" sin decir quién.
--
-- ESPACIO — que es la preocupación que originó esto
--
-- Un log crece para siempre si nadie lo corta, así que aquí se decide por
-- adelantado:
--
--  · La clave es `bigint identity`, no uuid: 8 bytes en vez de 16, y como la
--    tabla es de solo-añadir, ordenar por id ya es ordenar por fecha.
--  · NO se guarda el contenido. Se guarda un resumen de una línea, ya legible,
--    más los ids para ir a buscar el resto si existe todavía. Una fila anda por
--    los 150-250 bytes.
--  · Hay poda: `prune_activity_log(dias)`. Sin ejecutarla esto crece sin
--    freno — ver la nota del final.
--
-- Se alimenta con TRIGGERS y no llamando desde cada función. Es a propósito:
-- meter la llamada dentro de `create_pin_with_daily_limit`, `verify_and_...` y
-- las demás obligaría a reescribir el cuerpo entero de cada una en esta
-- migración, que es la forma más fácil de que una se quede atrás. Los triggers
-- capturan el hecho sin tocar a nadie.
--
-- APLICAR A MANO desde el SQL Editor de Supabase. Para deshacer:
-- 20260828000000_activity_log.down.sql
-- ============================================================================

-- ── 1. La tabla ─────────────────────────────────────────────────────────────

create table if not exists public.activity_log (
  id           bigint       generated always as identity primary key,
  -- Quién lo hizo. `set null` y no `cascade`: si se borra la cuenta, el hecho
  -- siguió ocurriendo y el registro tiene que seguir contándolo.
  actor_id     uuid         references public.profiles(id) on delete set null,
  action       text         not null check (action in (
                              'pin_created', 'pin_deleted',
                              'pin_verified', 'pin_unverified',
                              'report_filed', 'report_claimed',
                              'report_resolved', 'report_dismissed',
                              'role_changed', 'broadcast_sent'
                            )),
  target_type  text         check (target_type is null or target_type in ('pin', 'report', 'profile', 'broadcast')),
  target_id    uuid,
  -- Una línea ya legible. El registro tiene que poder leerse aunque lo que
  -- describe ya no exista, que es justo para lo que sirve.
  summary      text         not null check (char_length(summary) <= 200),
  metadata     jsonb        not null default '{}'::jsonb,
  created_at   timestamptz  not null default now()
);

-- El único acceso que hay: los últimos N por fecha.
create index if not exists activity_log_created_idx
  on public.activity_log (created_at desc);

-- ── 2. Cómo se escribe ──────────────────────────────────────────────────────

create or replace function public.log_activity(
  p_action      text,
  p_summary     text,
  p_target_type text default null,
  p_target_id   uuid default null,
  p_metadata    jsonb default '{}'::jsonb,
  p_actor_id    uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  insert into public.activity_log (actor_id, action, target_type, target_id, summary, metadata)
  values (
    coalesce(p_actor_id, auth.uid()),
    p_action,
    p_target_type,
    p_target_id,
    left(p_summary, 200),
    coalesce(p_metadata, '{}'::jsonb)
  );
exception when others then
  -- Un fallo del registro NO puede tumbar la operación que lo generó. Que no
  -- se apunte que se creó un pin es molesto; que no se pueda crear el pin
  -- porque el registro falló es inaceptable.
  raise warning 'activity_log: no se pudo registrar % (%)', p_action, sqlerrm;
end;
$fn$;

revoke all on function public.log_activity(text, text, text, uuid, jsonb, uuid) from anon, authenticated;

-- ── 3. Los triggers que lo alimentan ────────────────────────────────────────

create or replace function public.trg_log_pin_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(
      'pin_created', new.title, 'pin', new.id,
      jsonb_build_object('type', new.type, 'category', new.category_id),
      new.creator_id
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    -- El actor es quien BORRA, que no siempre es quien creó: puede ser un
    -- moderador resolviendo una denuncia. Por eso el autor va en metadata.
    perform public.log_activity(
      'pin_deleted', old.title, 'pin', old.id,
      jsonb_build_object('type', old.type, 'creator_id', old.creator_id)
    );
    return old;
  end if;

  -- UPDATE: solo interesa el cruce de la verificación.
  if new.is_permanent and not old.is_permanent then
    perform public.log_activity(
      'pin_verified', new.title, 'pin', new.id,
      jsonb_build_object('creator_id', new.creator_id)
    );
  elsif old.is_permanent and not new.is_permanent then
    perform public.log_activity(
      'pin_unverified', new.title, 'pin', new.id,
      jsonb_build_object('creator_id', new.creator_id)
    );
  end if;
  return new;
end;
$fn$;

drop trigger if exists on_pin_activity_log on public.pins;
create trigger on_pin_activity_log
  after insert or delete or update of is_permanent on public.pins
  for each row execute function public.trg_log_pin_activity();

create or replace function public.trg_log_report_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_accion text;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity(
      'report_filed', 'Denuncia por ' || new.reason, 'report', new.id,
      jsonb_build_object('target_type', new.target_type, 'target_id', new.target_id),
      new.reporter_id
    );
    return new;
  end if;

  if new.status is not distinct from old.status then return new; end if;

  v_accion := case new.status
    when 'reviewing' then 'report_claimed'
    when 'resolved'  then 'report_resolved'
    when 'dismissed' then 'report_dismissed'
    else null
  end;
  if v_accion is null then return new; end if;

  perform public.log_activity(
    v_accion, 'Denuncia por ' || new.reason, 'report', new.id,
    jsonb_build_object('accion', new.resolution_action, 'target_type', new.target_type)
  );
  return new;
end;
$fn$;

drop trigger if exists on_report_activity_log on public.content_reports;
create trigger on_report_activity_log
  after insert or update of status on public.content_reports
  for each row execute function public.trg_log_report_activity();

create or replace function public.trg_log_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if new.role is not distinct from old.role then return new; end if;
  perform public.log_activity(
    'role_changed',
    coalesce(new.name, 'Sin nombre') || ': ' || old.role || ' → ' || new.role,
    'profile', new.id,
    jsonb_build_object('de', old.role, 'a', new.role)
  );
  return new;
end;
$fn$;

drop trigger if exists on_role_change_activity_log on public.profiles;
create trigger on_role_change_activity_log
  after update of role on public.profiles
  for each row execute function public.trg_log_role_change();

-- ── 4. Leerlo: solo administración ──────────────────────────────────────────

alter table public.activity_log enable row level security;

drop policy if exists activity_log_read_admin on public.activity_log;
create policy activity_log_read_admin on public.activity_log
  for select using (public.user_role() = 'admin');

-- Nadie escribe ni borra desde la API: solo entra por `log_activity`, que es
-- SECURITY DEFINER, y solo sale por la poda. Un registro que sus propios
-- sujetos pueden editar no sirve para auditar nada.
revoke all on public.activity_log from anon, authenticated;
grant select on public.activity_log to authenticated;

-- ── 5. La poda ──────────────────────────────────────────────────────────────

create or replace function public.prune_activity_log(p_days integer default 90)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_borradas integer;
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden podar el registro.';
  end if;
  if p_days < 7 then
    raise exception 'La ventana mínima del registro es de 7 días.';
  end if;

  delete from public.activity_log
   where created_at < now() - make_interval(days => p_days);
  get diagnostics v_borradas = row_count;
  return v_borradas;
end;
$fn$;

grant execute on function public.prune_activity_log(integer) to authenticated, service_role;

-- ── 6. Lo que se lee desde el panel ─────────────────────────────────────────
--
-- Va por función y no por SELECT directo para poder traer el nombre de quien
-- actuó sin exponer `profiles` entera ni obligar al cliente a un join.

create or replace function public.admin_activity_log(p_limit integer default 100)
returns table (
  id          bigint,
  actor_id    uuid,
  actor_name  text,
  action      text,
  target_type text,
  target_id   uuid,
  summary     text,
  metadata    jsonb,
  created_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden ver el registro de actividad.';
  end if;

  return query
    select l.id, l.actor_id, p.name, l.action, l.target_type, l.target_id,
           l.summary, l.metadata, l.created_at
      from public.activity_log l
      left join public.profiles p on p.id = l.actor_id
     order by l.id desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end;
$fn$;

grant execute on function public.admin_activity_log(integer) to authenticated, service_role;

-- ── NOTA PARA QUIEN APLIQUE ESTO ────────────────────────────────────────────
--
-- La poda no se ejecuta sola. Hay dos formas y conviene elegir una HOY, porque
-- un registro sin poda es una tabla que solo crece:
--
--  a) Con pg_cron, si está disponible en el proyecto:
--       select cron.schedule('podar-registro', '0 4 * * 0',
--         $$delete from public.activity_log
--            where created_at < now() - interval '90 days'$$);
--
--  b) A mano, desde el panel, cuando se vea que abulta.
--
-- Con el volumen de hoy (unas decenas de filas al día) 90 días son unos pocos
-- megabytes, así que no corre prisa — pero conviene no olvidarlo.
