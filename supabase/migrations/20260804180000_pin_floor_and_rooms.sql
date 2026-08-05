-- =============================================================================
-- Crear pines con planta, y las categorías de sala, ascensor y rampa
-- =============================================================================
-- Cuatro cambios que van juntos porque describen lo mismo: un pin que sabe en
-- qué planta está.
--
-- 1. La RPC de creación acepta planta, edificio, área y código de sala. Hasta
--    ahora `pins.floor` existía y nunca se llenaba, porque el único camino de
--    creación no lo recibía.
--
-- 2. La ubicación única pasa a comparar la planta. Antes, dos pines en el mismo
--    lat/lng chocaban aunque estuvieran en pisos distintos: en un edificio de
--    salas eso es lo normal, no un conflicto.
--
-- 3. Categorías nuevas: sala, ascensor y rampa. Las tres describen algo fijo,
--    así que nacen con 720 h de plazo (un mes para que un moderador las
--    verifique) y al verificarse dejan de expirar. Ascensor y rampa son además
--    la base del ruteo accesible: sin ellas, "cómo llegar" en silla de ruedas
--    solo sabe de veredas y deja a la persona en la puerta de la escalera.
--
-- 4. Se van `buildings.code` y `buildings.has_rooms`. Asumían que el código de
--    sala era una propiedad del edificio, y no lo es: un mismo edificio hospeda
--    salas con esquemas distintos (E441.1.S101 y SMV-03), hay edificios con una
--    sola sala con código, y hay salas de estudio sin ninguno. El código vive
--    en `pins.room_code`, opcional, uno por sala.
-- =============================================================================


-- ── 1. Ubicación única, por planta ──────────────────────────────────────────

create or replace function public.prevent_occupied_pin_location()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'UPDATE'
    and new.lat is not distinct from old.lat
    and new.lng is not distinct from old.lng
    and new.floor is not distinct from old.floor then
    return new;
  end if;

  if not (new.is_permanent or new.expires_at is null or new.expires_at > now()) then
    return new;
  end if;

  -- La cerradura incluye la planta: dos pines del mismo punto en pisos
  -- distintos no compiten y no tienen por qué serializarse entre sí.
  perform pg_advisory_xact_lock(
    hashtext(new.lat::text || ':' || new.lng::text || ':' || coalesce(new.floor, 0)::text)
  );

  if exists (
    select 1
    from public.pins as existing
    where existing.id is distinct from new.id
      and existing.lat = new.lat
      and existing.lng = new.lng
      -- Una impresora en el piso 2 y otra en el 3 de la misma esquina son dos
      -- cosas distintas, no un duplicado.
      and existing.floor is not distinct from new.floor
      and (
        existing.is_permanent
        or existing.expires_at is null
        or existing.expires_at > now()
      )
  ) then
    raise exception 'PIN_LOCATION_OCCUPIED';
  end if;

  return new;
end;
$fn$;

-- El trigger de UPDATE solo escuchaba lat/lng: mover un pin de planta sin
-- moverlo de sitio se saltaba la comprobación entera.
drop trigger if exists trg_prevent_occupied_pin_location_update on public.pins;
create trigger trg_prevent_occupied_pin_location_update
  before update of lat, lng, floor on public.pins
  for each row execute function public.prevent_occupied_pin_location();


-- ── 2. Creación de pines con planta ─────────────────────────────────────────
-- `create or replace` con una firma distinta crearía una SOBRECARGA, no un
-- reemplazo, y PostgREST fallaría por ambigüedad al no saber cuál llamar. Por
-- eso se borra la versión vieja por su firma exacta antes de crear la nueva.

drop function if exists public.create_pin_with_daily_limit(
  public.pin_type, text, text, text, text, double precision, double precision,
  boolean, text, timestamptz, timestamptz, timestamptz);

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
  p_ends_at              timestamptz,
  p_floor                integer default null,
  p_building_id          text    default null,
  p_area_id              uuid    default null,
  p_room_code            text    default null
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

  -- La planta 0 no existe: la baja es el 1 y el primer subterráneo el -1.
  if p_floor = 0 then
    raise exception 'La planta 0 no existe: usa 1 para la planta baja y -1 para el subterráneo.';
  end if;

  -- El plazo no se acepta del cliente: se deduce del tipo y de la categoría.
  -- p_expires_at se conserva en la firma pero se ignora — cambiarla obligaría a
  -- crear otra función y repartir de nuevo los permisos de EXECUTE, a cambio de
  -- nada. Esto es lo que convierte categories.ttl_hours en autoridad real; antes
  -- solo lo leía el navegador y cualquiera que llamase la API directamente podía
  -- crear un reporte que caducara cuando quisiera.
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
    is_permanent, expires_at, starts_at, ends_at, is_official, official_entity_name,
    floor, building_id, area_id, room_code
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
    case when coalesce(p_is_official, false) then p_official_entity_name else null end,
    p_floor,
    p_building_id,
    p_area_id,
    nullif(trim(p_room_code), '')
  )
  returning * into v_pin;

  insert into public.pin_creation_events (pin_id, creator_id)
  values (v_pin.id, auth.uid());

  return next v_pin;
end;
$fn$;

-- Mismos destinatarios que la versión anterior: la función ya rechaza a los
-- invitados por dentro (auth.uid() null), y quitarle el grant a anon aquí sería
-- un cambio de permisos escondido en una migración que va de otra cosa.
grant execute on function public.create_pin_with_daily_limit(
  public.pin_type, text, text, text, text, double precision, double precision,
  boolean, text, timestamptz, timestamptz, timestamptz, integer, text, uuid, text
) to anon, authenticated, service_role;


-- ── 3. Categorías nuevas y dos iconos equivocados ───────────────────────────
-- `sala` es la sala como lugar fijo, distinta de `sala-libre`, que es el aviso
-- efímero de que hay una libre ahora. La primera se verifica y se queda; la
-- segunda dura seis horas y se va.

insert into public.categories (id, kind, name, name_en, color, svg_path, ttl_hours) values
  ('sala', 'report', 'Sala', 'Room', '#0EA5E9',
   'M19 19V5c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v14H3v2h18v-2h-2zm-4-6h-2v-2h2v2z', 720),
  ('ascensor', 'report', 'Ascensor', 'Elevator', '#6366F1',
   'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h10V4H7zm5 2.5l3.5 4h-7l3.5-4zm0 11.5l-3.5-4h7l-3.5 4z', 720),
  ('rampa', 'report', 'Rampa', 'Ramp', '#0D9488',
   'M9.08 5.88c.86-.08 1.53-.82 1.53-1.69C10.61 3.26 9.85 2.5 8.92 2.5s-1.69.76-1.69 1.69c0 .28.08.58.21.82l.6 8.49h6.22l2.55 5.97 3.35-1.31-.52-1.23-1.87.68-2.47-5.69-5.78.04-.08-1.08h4.18v-1.59h-4.34L9.08 5.88zM15.33 18.06c-1.05 2.07-3.24 3.44-5.59 3.44C6.31 21.5 3.5 18.69 3.5 15.25c0-2.42 1.46-4.66 3.65-5.65l.14 1.84c-1.29.81-2.09 2.28-2.09 3.82 0 2.5 2.04 4.53 4.53 4.53 2.28 0 4.23-1.75 4.5-4l1.1 2.27z', 720)
on conflict (id) do update
  set name = excluded.name,
      name_en = excluded.name_en,
      color = excluded.color,
      svg_path = excluded.svg_path,
      ttl_hours = excluded.ttl_hours;

-- El casino usaba el emoji y el icono de un hospital (círculo con cruz), y la
-- feria repetía ese mismo dibujo. Copiar y pegar de la primera versión.
update public.categories
set svg_path = 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z'
where id = 'casino';

update public.categories
set svg_path = 'M12 2 3 7v2h18V7l-9-5zm-7 9v9h4v-6h6v6h4v-9H5zm7 3h-2v3h2v-3z'
where id = 'feria';


-- ── 4. El código de sala no es del edificio ─────────────────────────────────

drop index if exists public.buildings_faculty_code_uidx;

alter table public.buildings
  drop column if exists code,
  drop column if exists has_rooms;
