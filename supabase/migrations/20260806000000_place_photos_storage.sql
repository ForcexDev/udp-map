-- =============================================================================
-- Permisos y GC para fotos de lugares en Storage
-- =============================================================================

-- ── Políticas de Storage para places ─────────────────────────────────────────
-- El bucket pin-photos se creó para pines, pero ahora también aloja las
-- fotos de los lugares bajo la ruta places/. Los administradores pueden
-- subir y borrar fotos ahí.

create policy place_photos_upload on storage.objects
  for insert with check (
    bucket_id = 'pin-photos'
    and public.user_role() = 'admin'
    and (storage.foldername(name))[1] = 'places'
  );

create policy place_photos_delete on storage.objects
  for delete using (
    bucket_id = 'pin-photos'
    and public.user_role() = 'admin'
    and (storage.foldername(name))[1] = 'places'
  );

-- ── Garbage Collector (GC) ───────────────────────────────────────────────────
-- Mismo mecanismo que pin_photos: cuando se borra una fila de place_photos,
-- el archivo correspondiente queda huérfano en Storage. Lo encolamos para que
-- el cron (storage-gc) lo limpie físicamente.

create or replace function public.enqueue_place_photo_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_path text;
begin
  v_path := split_part(old.url, '/pin-photos/', 2);

  if v_path is null or v_path = '' then
    return null;
  end if;

  insert into public.storage_cleanup_queue (bucket_id, path)
  values ('pin-photos', v_path);

  return null;
end;
$fn$;

revoke execute on function public.enqueue_place_photo_cleanup() from public, anon, authenticated;

drop trigger if exists on_place_photo_deleted on public.place_photos;
create trigger on_place_photo_deleted
  after delete on public.place_photos
  for each row execute function public.enqueue_place_photo_cleanup();
