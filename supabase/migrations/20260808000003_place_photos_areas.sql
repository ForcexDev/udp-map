-- Galería propia para las áreas exteriores (el Patio, una plaza, una cancha).
--
-- Las áreas ya eran ciudadanas de primera en la ficha: tienen su chip, filtran
-- los posts por `area_id` y se pueden enfocar desde el mapa. Lo único que les
-- faltaba era la portada, y sin ella la ficha del Patio enseñaba la fachada de
-- la facultad — la misma foto que miente sobre lo que estás mirando que ya se
-- decidió no heredar para los edificios.

alter table public.place_photos
  add column if not exists area_id uuid references public.areas(id) on delete cascade;

alter table public.place_photos
  drop constraint if exists place_photos_one_owner;

alter table public.place_photos
  add constraint place_photos_one_owner
  check (num_nonnulls(faculty_id, building_id, area_id) = 1);

create index if not exists place_photos_area_idx
  on public.place_photos (area_id, sort_order)
  where area_id is not null;

-- El tope de 10 se cuenta por dueño, así que la función tiene que saber del
-- tercero. Sin esto, las fotos de un área se contarían contra el cajón de
-- (faculty_id null, building_id null) que comparten TODAS las áreas.
create or replace function public.enforce_place_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_count integer;
  v_owner text;
begin
  v_owner := coalesce(
    'faculty:' || new.faculty_id,
    'building:' || new.building_id,
    'area:' || new.area_id
  );
  perform pg_advisory_xact_lock(hashtext('place_photos:' || v_owner));

  select count(*) into v_count
  from public.place_photos
  where faculty_id is not distinct from new.faculty_id
    and building_id is not distinct from new.building_id
    and area_id is not distinct from new.area_id;

  if v_count > 10 then
    raise exception 'Una galería no puede tener más de 10 fotos.';
  end if;

  return null;
end;
$fn$;

revoke execute on function public.enforce_place_photo_limit() from public, anon, authenticated;
