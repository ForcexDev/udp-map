-- =============================================================================
-- Límite de fotos por pin, en la base
-- =============================================================================
-- MAX_PHOTOS_PER_PIN vale 5 y hasta ahora solo existía en el navegador
-- (src/features/pins/photos.ts). La tabla aceptaba las que fueran.
--
-- Va como trigger AFTER y no BEFORE a propósito: dentro de un INSERT de varias
-- filas, un trigger BEFORE no ve las filas que la misma sentencia acaba de
-- insertar, así que contaría de menos. En AFTER la fila ya está y la cuenta es
-- exacta; la excepción revierte la sentencia entera igual.
--
-- El advisory lock cierra el hueco de dos subidas simultáneas sobre el mismo
-- pin, que si no podrían pasar de 5 entre las dos.
-- =============================================================================

create or replace function public.enforce_pin_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('pin_photos:' || new.pin_id::text));

  select count(*) into v_count
  from public.pin_photos
  where pin_id = new.pin_id;

  if v_count > 5 then
    raise exception 'Un pin no puede tener más de 5 fotos.';
  end if;

  return null;
end;
$fn$;

revoke execute on function public.enforce_pin_photo_limit() from public, anon, authenticated;

drop trigger if exists trg_enforce_pin_photo_limit on public.pin_photos;
create trigger trg_enforce_pin_photo_limit
  after insert on public.pin_photos
  for each row execute function public.enforce_pin_photo_limit();
