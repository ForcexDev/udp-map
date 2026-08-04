-- =============================================================================
-- Qué puede editar el autor de su propio pin
-- =============================================================================
-- Dos correcciones en direcciones opuestas sobre el mismo trigger.
--
-- 1. MENOS restricción donde el estudiante es dueño de lo suyo.
--    Un evento tiene dos fechas: ends_at, que es la que ve el usuario, y
--    expires_at, que es la que decide si el pin sigue vivo. El trigger revertía
--    expires_at en silencio para cualquiera que no fuese moderador, así que un
--    estudiante cambiaba la fecha de fin de su evento, la interfaz mostraba la
--    nueva, y el evento seguía desapareciendo a la hora vieja. Era una
--    restricción que no protegía nada y rompía algo que el autor debería poder
--    hacer. Ahora se acepta el cambio mientras las dos fechas vayan juntas.
--
-- 2. MÁS restricción donde ya hubo una decisión de un moderador.
--    La categoría de un pin verificado forma parte de lo que se verificó: si
--    alguien confirmó "acá hay un microondas", el autor no debería poder
--    convertirlo después en otra cosa conservando el sello. La interfaz ya
--    deshabilitaba el selector, pero la base aceptaba el cambio igual.
--
-- Este caso lanza excepción en vez de revertir en silencio, al revés que el
-- resto de campos protegidos. La diferencia es intencional: los demás campos la
-- interfaz nunca intenta cambiarlos, así que un error ahí sería solo ruido;
-- este sí puede intentarlo una persona, y merece enterarse en vez de ver un
-- "guardado" que no guardó.
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
