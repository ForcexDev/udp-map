-- =============================================================================
-- Recolector de basura de Storage
-- =============================================================================
-- Problema: de los cuatro caminos por los que desaparece un pin, solo uno
-- borraba sus fotos del bucket.
--
--   borrar desde el mapa (deletePin)            → sí las borraba
--   panel de administración (adminDeletePin)    → no
--   resolver una denuncia con acción 'delete'   → no
--   cron #1, cada 30 minutos                    → no
--
-- El cron es el que más pesa: casi todo reporte temporal con fotos acababa
-- dejando sus archivos huérfanos, y como la fila de pin_photos desaparece en
-- cascada se perdía la URL y el archivo ya no se podía asociar a nada.
--
-- Solución: los cuatro caminos terminan en lo mismo, que es una fila de
-- pin_photos desapareciendo. Un único trigger AFTER DELETE los cubre a todos,
-- incluidos los borrados en cascada.
--
-- Por qué una cola y no borrar directo desde el trigger: borrar la fila de
-- storage.objects no borra el archivo real, solo su metadato, y quedaría basura
-- invisible que igual se factura. Y hacer una llamada HTTP dentro del DELETE
-- haría que un fallo de red abortara el borrado del pin.
-- =============================================================================

create table if not exists public.storage_cleanup_queue (
  id            bigserial    primary key,
  bucket_id     text         not null,
  path          text         not null,
  attempts      integer      not null default 0 check (attempts >= 0),
  last_error    text,
  created_at    timestamptz  not null default now(),
  processed_at  timestamptz
);

comment on table public.storage_cleanup_queue is
  'Archivos de Storage pendientes de borrar. La llena un trigger sobre pin_photos y la drena la Edge Function storage-gc.';

create index if not exists storage_cleanup_pending_idx
  on public.storage_cleanup_queue (created_at)
  where processed_at is null;

-- Tabla interna: misma pauta que pin_creation_events y
-- notification_push_deliveries. RLS activo y sin ninguna política, de modo que
-- solo la ven service_role y las funciones SECURITY DEFINER.
alter table public.storage_cleanup_queue enable row level security;
revoke all on public.storage_cleanup_queue from anon, authenticated;
revoke all on sequence public.storage_cleanup_queue_id_seq from anon, authenticated;


-- La URL pública tiene la forma
--   https://<ref>.supabase.co/storage/v1/object/public/pin-photos/pins/<uid>/<uuid>.jpg
-- y lo que necesita la API de Storage es solo lo que va después del bucket.
create or replace function public.enqueue_pin_photo_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_path text;
begin
  v_path := split_part(old.url, '/pin-photos/', 2);

  -- Una URL con otra forma (una foto migrada de otro sitio, por ejemplo) no se
  -- encola: preferimos dejar un archivo de más antes que arriesgar un borrado
  -- con una ruta mal deducida.
  if v_path is null or v_path = '' then
    return null;
  end if;

  insert into public.storage_cleanup_queue (bucket_id, path)
  values ('pin-photos', v_path);

  return null;
end;
$fn$;

revoke execute on function public.enqueue_pin_photo_cleanup() from public, anon, authenticated;

drop trigger if exists on_pin_photo_deleted on public.pin_photos;
create trigger on_pin_photo_deleted
  after delete on public.pin_photos
  for each row execute function public.enqueue_pin_photo_cleanup();
