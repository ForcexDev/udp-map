-- =============================================================================
-- Galería de fotos por entidad: facultades y edificios
-- =============================================================================
-- Documentada en docs/DATABASE.md, sección "Galerías de lugares".
--
-- Hasta ahora una facultad tenía UNA foto (`faculties.image`) y un edificio
-- ninguna. La ficha del mapa enseña esa única imagen de portada y no se puede
-- abrir, mientras que un pin sí tiene carrusel (`pin_photos`).
--
-- ── Una tabla y no dos ───────────────────────────────────────────────────────
-- `faculty_photos` + `building_photos` obligaría a duplicar RLS, trigger de
-- límite y el gestor de fotos del cliente. Con una sola tabla, el mismo gestor
-- sirve para las dos entidades.
--
-- ── Dos FK y no (entity_type, entity_id) ─────────────────────────────────────
-- El par tipo+id es la forma habitual de hacer esto y es la que NO se usa aquí:
-- un `text` que apunta a dos tablas no puede tener clave foránea, así que ni la
-- base garantiza que la entidad exista ni el borrado arrastra sus fotos.
-- Con dos columnas anulables y un CHECK de "exactamente una", se conservan las
-- FK reales y el ON DELETE CASCADE, que es lo que evita fotos huérfanas
-- apuntando a un edificio que ya se borró desde el editor de mapeo.
-- =============================================================================

create table if not exists public.place_photos (
  id           uuid         primary key default gen_random_uuid(),
  faculty_id   text         references public.faculties(id) on delete cascade,
  building_id  text         references public.buildings(id) on delete cascade,
  url          text         not null,
  width        integer,
  height       integer,
  -- El orden lo decide quien administra. El 0 es la PORTADA: es la que sale en
  -- la cabecera de la ficha y la que se ve sin abrir el carrusel.
  sort_order   integer      not null default 0,
  created_at   timestamptz  not null default now(),
  constraint place_photos_one_owner check (num_nonnulls(faculty_id, building_id) = 1)
);

create index if not exists place_photos_faculty_idx
  on public.place_photos (faculty_id, sort_order)
  where faculty_id is not null;

create index if not exists place_photos_building_idx
  on public.place_photos (building_id, sort_order)
  where building_id is not null;

-- ── Límite de fotos ──────────────────────────────────────────────────────────
-- Mismo criterio y misma forma que `enforce_pin_photo_limit`: trigger AFTER
-- (un BEFORE no ve las filas que la propia sentencia acaba de insertar y
-- contaría de menos) y advisory lock para dos subidas simultáneas.
--
-- El tope es 10 y no 5: la galería de una facultad es material curado por la
-- administración, no las fotos que alguien saca al vuelo para un reporte.

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
  v_owner := coalesce('faculty:' || new.faculty_id, 'building:' || new.building_id);
  perform pg_advisory_xact_lock(hashtext('place_photos:' || v_owner));

  select count(*) into v_count
  from public.place_photos
  where faculty_id is not distinct from new.faculty_id
    and building_id is not distinct from new.building_id;

  if v_count > 10 then
    raise exception 'Una galería no puede tener más de 10 fotos.';
  end if;

  return null;
end;
$fn$;

revoke execute on function public.enforce_place_photo_limit() from public, anon, authenticated;

drop trigger if exists trg_enforce_place_photo_limit on public.place_photos;
create trigger trg_enforce_place_photo_limit
  after insert on public.place_photos
  for each row execute function public.enforce_place_photo_limit();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Lectura pública, escritura solo admin. La comprobación va AQUÍ y no solo en
-- el cliente: esconder el botón de editar no impide llamar al endpoint.

alter table public.place_photos enable row level security;

drop policy if exists place_photos_read on public.place_photos;
create policy place_photos_read on public.place_photos for select using (true);

drop policy if exists place_photos_admin on public.place_photos;
create policy place_photos_admin on public.place_photos
  for all using (public.user_role() = 'admin');

-- ── Migración de lo que ya había ─────────────────────────────────────────────
-- La foto única de cada facultad pasa a ser la portada de su galería.
-- `faculties.image` NO se borra: queda como respaldo para que una facultad sin
-- galería siga enseñando algo, y para no romper nada que aún lo lea.

insert into public.place_photos (faculty_id, url, sort_order)
select id, image, 0
  from public.faculties
 where image is not null
   and not exists (
     select 1 from public.place_photos p where p.faculty_id = faculties.id
   );
