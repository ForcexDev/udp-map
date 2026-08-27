-- =============================================================================
-- Mover un pin de sitio se comprueba en el servidor
-- =============================================================================
-- Era el ÚNICO permiso del proyecto que vivía solo en la interfaz (§2 de
-- docs/DATABASE.md, fila "Mover un pin de sitio"). `can(role,
-- 'pin.update.location')` pide moderador y `PinDetail` esconde el botón, pero
-- esconder un botón no impide llamar a la API: la clave anon viaja en el
-- bundle.
--
-- El agujero concreto: `pins_owner_update` deja al autor escribir su propia
-- fila, y `protect_pin_sensitive_fields` no protege `lat` ni `lng`. Protege
-- `building_id` y `area_id` —los derivados del punto— con un comentario que
-- dice "mover un pin es permiso de moderador", pero el punto en sí quedó
-- suelto. O sea que hoy un estudiante puede arrastrar SU pin a donde quiera con
-- un PATCH: no puede tocar el edificio ni el área, pero sí las coordenadas, y
-- el pin acaba dibujado en otra manzana con el edificio viejo colgando.
--
-- No llega a "reubicar pines ajenos" —para eso haría falta saltarse la política
-- de dueño, y esa sí cierra—, pero sí rompe la regla escrita, y el flujo de
-- salas la vuelve central: ahí mover el pin al sitio correcto es el gesto de
-- curaduría del moderador (docs/SALAS.md §12.5).
--
-- POR QUÉ UN TRIGGER APARTE Y NO UNA LÍNEA MÁS EN protect_pin_sensitive_fields
--
-- Por el orden. Postgres dispara los triggers BEFORE por orden alfabético, y
-- `trg_prevent_occupied_pin_location_update` va antes que `trg_protect_...`:
-- si la comprobación viviera ahí, mover un pin a un punto ya ocupado
-- respondería PIN_LOCATION_OCCUPIED —un error sobre un movimiento que de todos
-- modos se iba a rechazar— en vez de decir que falta el permiso. `authorize`
-- ordena antes que `prevent`, así que el permiso se resuelve primero.
--
-- Y porque la regla de exención es distinta de las de esa función, y mezclarlas
-- dejaría una asimetría sin explicar dentro del mismo cuerpo.
--
-- POR QUÉ ESTE SÍ EXIME A service_role Y validate_pin_floor NO
--
-- Porque no son la misma clase de regla. Una planta que no existe está mal la
-- escriba quien la escriba, así que `trg_validate_pin_floor` cubre también el
-- SQL Editor — para eso se hizo. "Quién puede mover un pin" es una regla de
-- AUTORIZACIÓN, y no significa nada frente a la llave que ES la
-- administración: bloquearla solo conseguiría que corregir a mano la
-- coordenada de un pin mal puesto —que es trabajo legítimo de mantenimiento—
-- fallara con un error de permisos.
--
-- `anon` no se cuela por esa exención: las dos políticas de UPDATE sobre `pins`
-- exigen o ser el autor (`creator_id = auth.uid()`) o tener rol de moderador, y
-- sin sesión no se cumple ninguna de las dos.
-- =============================================================================

create or replace function public.authorize_pin_move()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  -- El trigger va acotado a `update of lat, lng`, pero eso dispara también
  -- cuando se escribe el mismo valor. Mover es cambiar de sitio.
  if new.lat is not distinct from old.lat
     and new.lng is not distinct from old.lng then
    return new;
  end if;

  -- Sin sesión no hay a quién pedirle permiso: es service_role o el SQL Editor.
  if auth.uid() is null then
    return new;
  end if;

  if public.user_role() in ('moderator', 'admin') then
    return new;
  end if;

  raise exception 'Mover un pin de sitio es permiso de moderador.';
end;
$fn$;

grant execute on function public.authorize_pin_move() to anon, authenticated, service_role;

-- El nombre importa, igual que en trg_validate_pin_floor: `authorize` ordena
-- antes que `prevent` y que `protect`, así que la falta de permiso se responde
-- antes de comprobar si el destino está ocupado y antes de revertir columnas.
drop trigger if exists trg_authorize_pin_move on public.pins;
create trigger trg_authorize_pin_move
  before update of lat, lng on public.pins
  for each row execute function public.authorize_pin_move();

-- ── Comprobación ─────────────────────────────────────────────────────────────
-- Con una sesión de estudiante, esto tiene que fallar sobre un pin propio:
--   update public.pins set lat = lat + 0.0001 where creator_id = auth.uid();
-- Y con una de moderador, pasar.
