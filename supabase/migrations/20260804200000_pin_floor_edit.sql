-- =============================================================================
-- El área de un pin no sobrevive a un cambio de planta
-- =============================================================================
-- Desde esta versión el autor de un pin puede corregir su planta y su código de
-- sala desde el formulario de edición. La base ya lo permitía —`floor` y
-- `room_code` nunca estuvieron entre los campos que revierte
-- protect_pin_sensitive_fields— pero faltaba resolver una incoherencia que solo
-- aparece cuando esa edición existe de verdad:
--
--   `area_id` SÍ está protegido, porque se deduce del punto y dejar que se
--   escriba a mano permitiría afirmar que un pin está en un área en la que no
--   está. Consecuencia: si el autor movía su pin del piso 2 al 3, el área se
--   quedaba apuntando a un área DEL PISO 2. El pin decía estar en dos plantas
--   a la vez.
--
-- La salida honesta es soltar el área: el breadcrumb pasa de
-- "Edificio · Piso 3 · Hall central" a "Edificio · Piso 3", que es exactamente
-- lo que se sabe. Recalcularla aquí no es opción —el punto en polígono vive en
-- el cliente, sobre `areas.polygon` en jsonb— y dejar que la mande el navegador
-- devolvería el agujero que el campo protegido cierra. Un moderador la vuelve a
-- fijar moviendo el pin, que sí recalcula ambos.
--
-- Los moderadores no pasan por este bloque: ellos mandan building_id y area_id
-- ya calculados desde `updatePinLocation`.
-- =============================================================================

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

    -- El área cuelga de una planta concreta. Al cambiar de planta, la vieja
    -- deja de aplicar y no hay forma de deducir la nueva desde aquí: se suelta.
    if new.floor is distinct from old.floor then
      new.area_id := null;
    else
      new.area_id := old.area_id;
    end if;

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
