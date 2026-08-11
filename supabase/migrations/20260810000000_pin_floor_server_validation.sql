-- =============================================================================
-- La planta de un pin tiene que existir de verdad
-- =============================================================================
-- Hasta ahora la única comprobación de `pins.floor` en el servidor era que no
-- fuera 0, dentro de create_pin_with_daily_limit. Que la planta EXISTIERA en el
-- edificio lo garantizaba solo el formulario: `IndoorFields.tsx` ofrece los
-- chips de las plantas de building_floors y no hay forma de elegir otra.
--
-- Eso deja dos puertas abiertas, y la segunda es la que importa:
--
--   1. La RPC acepta cualquier `p_floor`. La clave anon viaja en el bundle, así
--      que llamar a la API sin pasar por la interfaz es trivial.
--   2. `pins_owner_update` deja al autor escribir su propia fila, y
--      protect_pin_sensitive_fields NO protege `floor` — a propósito, porque
--      corregir en qué piso está tu sala es la edición más común. Un solo PATCH
--      cambia la planta a cualquier número. Por eso esto va en un trigger y no
--      dentro de la RPC: validar solo al crear no cierra nada.
--
-- Y una tercera que ningún check dentro de una función cubre: el SQL Editor.
-- Ahí se escribe como service_role, sin RLS y sin pasar por la RPC, que es como
-- entraron los pines de prueba en plantas -1, -2 y -3 que no existen en ningún
-- edificio. Los triggers sí se disparan para service_role.
--
-- El daño no es de seguridad, es que el pin DESAPARECE. El selector de plantas
-- solo ofrece los niveles que existen en building_floors (`facultyLevels`), y un
-- pin se ve si su planta es la activa (`pinVisibleOnFloor`). Un pin en una
-- planta inexistente no tiene chip que lo seleccione: existe, consume el cupo
-- diario de su autor, y no lo ve nadie — ni quien lo creó.
--
-- La regla del pin es más laxa que la del área a propósito. `areas` tiene FK
-- compuesta a building_floors y ahí no cabe otra cosa: un área SIEMPRE se dibuja
-- dentro de un edificio. Un pin no — puede tener planta y no tener edificio,
-- porque building_id se deduce de la huella y el mapeo puede estar a medias.
-- Por eso esto es un trigger con tres casos y no una FK.
-- =============================================================================

create or replace function public.validate_pin_floor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  -- Sin planta no hay nada que validar: es un pin de exterior.
  if new.floor is null then
    return new;
  end if;

  -- El 0 no existe: la planta baja es el 1 y el primer subterráneo el -1. Este
  -- check vivía en create_pin_with_daily_limit y se mueve aquí para que también
  -- cubra el UPDATE, y para que la regla tenga un solo dueño.
  if new.floor = 0 then
    raise exception 'La planta 0 no existe: usa 1 para la planta baja y -1 para el subterráneo.';
  end if;

  -- Caso 1: el pin cayó dentro de un edificio. La planta tiene que estar
  -- declarada en ESE edificio. Es la misma regla que la FK de `areas`.
  if new.building_id is not null then
    if not exists (
      select 1
      from public.building_floors
      where building_id = new.building_id
        and level = new.floor
    ) then
      raise exception 'INVALID_FLOOR_FOR_BUILDING';
    end if;

    return new;
  end if;

  -- Caso 2: hay planta pero no edificio. Pasa de verdad —el mapeo puede estar a
  -- medias, o el punto cae en el patio entre dos edificios— así que no se puede
  -- exigir edificio. Lo que sí se exige es que el nivel exista en ALGÚN edificio
  -- de la facultad, que es exactamente el criterio con el que el selector decide
  -- qué chips pintar. Un pin en un nivel que la facultad no tiene es un pin que
  -- no se va a poder ver nunca.
  if new.faculty_id is not null
     and exists (select 1 from public.buildings where faculty_id = new.faculty_id)
     and not exists (
       select 1
       from public.building_floors f
       join public.buildings b on b.id = f.building_id
       where b.faculty_id = new.faculty_id
         and f.level = new.floor
     ) then
    raise exception 'FLOOR_NOT_IN_FACULTY';
  end if;

  -- Caso 3: facultad sin edificios mapeados, o pin sin facultad. No hay contra
  -- qué comprobar y NO se rechaza. Exigir mapeo para poder decir "piso 2"
  -- bloquearía el uso normal de la app en todo el campus que aún no se ha
  -- trazado, que es casi todo. La planta ahí no estorba: sin plantas en la
  -- facultad tampoco hay selector, y el pin se ve siempre.
  return new;
end;
$fn$;

-- El nombre importa. Postgres dispara los triggers BEFORE en orden alfabético,
-- y este tiene que correr DESPUÉS de trg_protect_pin_sensitive_fields: ese
-- revierte `building_id` al valor antiguo cuando quien edita no es moderador, y
-- validar antes compararía la planta contra un edificio que no va a quedar
-- escrito. `trg_validate_...` ordena después de `trg_protect_...` por la v.
drop trigger if exists trg_validate_pin_floor on public.pins;
create trigger trg_validate_pin_floor
  before insert or update of floor, building_id, faculty_id on public.pins
  for each row execute function public.validate_pin_floor();

-- create_pin_with_daily_limit pierde su check de la planta 0: ahora lo hace el
-- trigger, para las dos operaciones. El resto del cuerpo va idéntico — se
-- reemplaza entera porque plpgsql no permite parchear un trozo.
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

  if v_role not in ('moderator', 'admin') then
    perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

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

  -- La planta la valida trg_validate_pin_floor en el INSERT de más abajo.

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

-- =============================================================================
-- Pines que YA están en una planta que no existe
-- =============================================================================
-- El trigger solo mira lo que se escribe: las filas que ya están no se tocan, y
-- por tanto siguen invisibles. Esta consulta las lista para poder decidir qué
-- hacer con ellas. No se corrige nada automáticamente — mover un pin de planta
-- es una decisión sobre el contenido, no sobre el esquema.
--
--   select p.id, p.title, p.faculty_id, p.building_id, p.floor
--   from public.pins p
--   where p.floor is not null
--     and (
--       (p.building_id is not null and not exists (
--          select 1 from public.building_floors f
--          where f.building_id = p.building_id and f.level = p.floor))
--       or (p.building_id is null and p.faculty_id is not null
--           and exists (select 1 from public.buildings b where b.faculty_id = p.faculty_id)
--           and not exists (
--             select 1 from public.building_floors f
--             join public.buildings b on b.id = f.building_id
--             where b.faculty_id = p.faculty_id and f.level = p.floor))
--     );
--
-- Ojo: mientras una de esas filas siga mal, cualquier UPDATE sobre ella que
-- toque floor, building_id o faculty_id va a fallar. Es lo correcto —no se
-- puede editar un pin hacia un estado inválido— pero conviene saberlo antes de
-- que alguien lo reporte como un bug de la edición.
-- =============================================================================
