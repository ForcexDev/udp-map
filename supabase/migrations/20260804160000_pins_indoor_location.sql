-- =============================================================================
-- Los pines aprenden dónde están, por debajo de la facultad
-- =============================================================================
-- Hasta ahora un pin sabía en qué facultad estaba y nada más. Con esto sabe
-- además en qué edificio y en qué área, y `floor` (que existía desde el
-- principio pero nunca se escribía) empieza a llenarse de verdad.
--
-- Los tres se deducen de forma distinta, y la diferencia importa:
--
--   building_id  del punto: la huella que lo contiene. Automático.
--   area_id      del punto: el área de MENOR superficie que lo contiene, para
--                que un quiosco dentro del casino resuelva "quiosco".
--   floor        NO se puede deducir. Desde arriba, el piso 1 y el 3 son el
--                mismo punto. Lo elige la persona al publicar.
--
-- `room_code` es el identificador de sala de la universidad (E441.1.S101,
-- SMV-03). Va en el PIN y no en el edificio, porque un mismo edificio hospeda
-- salas con esquemas distintos, y hay salas de estudio que no tienen ninguno.
-- Es texto libre a propósito: no valida formato ni decide nada, solo sirve para
-- buscar y, más adelante, para cruzar con el sistema de horarios.
--
-- on delete set null en las dos claves: si se reorganiza el mapeo y desaparece
-- un área, el pin sigue existiendo. Perder la referencia es aceptable; perder
-- el aporte de un estudiante, no.
-- =============================================================================

alter table public.pins
  add column if not exists building_id text references public.buildings(id) on delete set null,
  add column if not exists area_id     uuid references public.areas(id)     on delete set null,
  add column if not exists room_code   text
    check (room_code is null or char_length(room_code) between 1 and 40);

create index if not exists pins_building_floor_idx on public.pins (building_id, floor);
create index if not exists pins_area_idx           on public.pins (area_id);

-- Búsqueda por código de sala sin distinguir mayúsculas: quien escribe "s101"
-- espera encontrar la S101.
create index if not exists pins_room_code_idx on public.pins (upper(room_code))
  where room_code is not null;

comment on column public.pins.building_id is
  'Edificio que contiene el punto. Se deduce al crear y al mover el pin.';
comment on column public.pins.area_id is
  'Área de menor superficie que contiene el punto, dentro de la planta elegida.';
comment on column public.pins.room_code is
  'Código de sala de la universidad. Texto libre: no decide edificio ni planta.';


-- ── Campos que el autor no decide ───────────────────────────────────────────
-- building_id y area_id se calculan del punto, así que nadie debería poder
-- escribirlos a mano: si se pudieran, un pin podría decir que está en un
-- edificio en el que no está. Se revierten en silencio, como el resto de campos
-- derivados. `floor` y `room_code` NO se protegen: esos sí los elige el autor.
create or replace function public.protect_pin_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if public.user_role() not in ('moderator', 'admin') then
    -- Campos que el autor no decide nunca.
    new.is_permanent := old.is_permanent;
    new.verifier_entity_name := old.verifier_entity_name;
    new.is_official := old.is_official;
    new.official_entity_name := old.official_entity_name;
    new.type := old.type;
    new.creator_id := old.creator_id;
    new.reports := old.reports;
    -- Derivados del punto: los calcula el servidor al crear y al mover. Si el
    -- autor pudiera escribirlos, un pin podría afirmar que está en un edificio
    -- en el que no está. Mover un pin es permiso de moderador, y los
    -- moderadores no pasan por este bloque.
    new.building_id := old.building_id;
    new.area_id := old.area_id;

    if old.is_permanent and new.category_id is distinct from old.category_id then
      raise exception 'No puedes cambiar la categoría de un pin verificado.';
    end if;

    -- expires_at solo se acepta si acompaña a ends_at en un evento vivo. Se
    -- exige que no sea null para que nadie convierta su evento en eterno
    -- vaciando la fecha.
    if new.expires_at is distinct from old.expires_at then
      if old.is_permanent
         or old.type <> 'event'
         or new.expires_at is null
         or new.expires_at is distinct from new.ends_at then
        new.expires_at := old.expires_at;
      end if;
    end if;

    if current_setting('udpmap.vote_rpc', true) is distinct from 'on' then
      new.votes_up := old.votes_up;
      new.votes_down := old.votes_down;
    end if;
  end if;

  return new;
end;
$fn$;
