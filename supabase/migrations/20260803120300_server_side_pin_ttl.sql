-- =============================================================================
-- El plazo de un pin lo calcula el servidor
-- =============================================================================
-- Hasta ahora create_pin_with_daily_limit recibía p_expires_at ya calculado
-- desde el navegador y lo insertaba tal cual. El trigger protege expires_at en
-- las modificaciones, pero no en la creación, así que cualquiera que llamara la
-- API directamente podía crear un reporte que caducara cuando quisiera.
--
-- Y categories.ttl_hours, que es donde debería estar escrita esa regla, solo lo
-- leía el frontend: era decoración.
--
-- El parámetro p_expires_at se conserva en la firma pero se ignora. Cambiar la
-- firma obligaría a crear otra función y volver a repartir permisos de EXECUTE,
-- a cambio de nada.
--
-- Comportamiento resultante, idéntico al que ya tenía el cliente:
--   place  → sin caducidad
--   event  → caduca cuando termina (ends_at)
--   report → categories.ttl_hours, y 24 horas si la categoría no lo define
-- =============================================================================

create or replace function public.create_pin_with_daily_limit(
  p_type                 public.pin_type,
  p_title                text,
  p_description          text,
  p_category_id          text,
  p_faculty_id           text,
  p_lat                  double precision,
  p_lng                  double precision,
  p_is_official          boolean,
  p_official_entity_name text,
  p_expires_at           timestamptz,
  p_starts_at            timestamptz,
  p_ends_at              timestamptz
)
returns setof public.pins
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_role          text;
  v_created_today integer;
  v_day_start     timestamptz;
  v_ttl_hours     integer;
  v_expires_at    timestamptz;
  v_pin           public.pins;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para crear un pin';
  end if;

  v_role := public.user_role();
  if v_role = 'guest' then
    raise exception 'Los invitados no pueden crear pines';
  end if;

  -- Moderadores y administradores no tienen rate limit. Para el resto,
  -- serializa las creaciones del mismo usuario para evitar superar el límite
  -- con solicitudes simultáneas.
  if v_role not in ('moderator', 'admin') then
    perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

    -- El límite se calcula siempre con días UTC, independientemente de la
    -- zona horaria configurada en la sesión de Postgres.
    v_day_start := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';

    select count(*)::integer
    into v_created_today
    from public.pin_creation_events
    where creator_id = auth.uid()
      and created_at >= v_day_start
      and created_at < v_day_start + interval '1 day';

    if v_created_today >= 10 then
      raise exception 'DAILY_PIN_LIMIT_REACHED';
    end if;
  end if;

  if p_type = 'place' and v_role not in ('moderator', 'admin') then
    raise exception 'Solo moderadores y administradores pueden crear lugares';
  end if;

  if coalesce(p_is_official, false) and v_role not in ('moderator', 'admin') then
    raise exception 'Solo moderadores y administradores pueden crear contenido oficial';
  end if;

  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Coordenadas del pin inválidas';
  end if;

  -- El plazo no se acepta del cliente: se deduce del tipo y de la categoría.
  if p_type = 'place' then
    v_expires_at := null;
  elsif p_type = 'event' then
    v_expires_at := coalesce(p_ends_at, now() + interval '24 hours');
  else
    select ttl_hours into v_ttl_hours
    from public.categories
    where id = p_category_id;

    v_expires_at := now() + make_interval(hours => coalesce(v_ttl_hours, 24));
  end if;

  insert into public.pins (
    type, title, description, category_id, faculty_id, lat, lng, creator_id,
    is_permanent, expires_at, starts_at, ends_at, is_official, official_entity_name
  ) values (
    p_type,
    p_title,
    p_description,
    p_category_id,
    p_faculty_id,
    p_lat,
    p_lng,
    auth.uid(),
    p_type = 'place',
    v_expires_at,
    p_starts_at,
    p_ends_at,
    coalesce(p_is_official, false),
    case when coalesce(p_is_official, false) then p_official_entity_name else null end
  )
  returning * into v_pin;

  insert into public.pin_creation_events (pin_id, creator_id)
  values (v_pin.id, auth.uid());

  return next v_pin;
end;
$fn$;
