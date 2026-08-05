-- =============================================================================
-- Mapeo interior: edificios, plantas y áreas
-- =============================================================================
-- Tres tablas que le dan a un punto del mapa los contenedores que hoy le faltan.
-- Un pin sabe en qué facultad está y nada más; con esto podrá saber además en
-- qué edificio, en qué planta y en qué área.
--
--   Facultad  (ya existía)
--    └─ Edificio      buildings        huella + altura 3D
--        └─ Planta    building_floors  una fila por planta que existe
--            └─ Área  areas            hall, casino, pasillo, laboratorio…
--
-- Tres decisiones que conviene dejar escritas:
--
-- 1. Las plantas son una TABLA, no un rango min/max en el edificio. Con un
--    rango, añadir un subterráneo a un edificio ya mapeado obliga a recalcular
--    y no hay dónde poner "Zócalo". Con una fila por planta se agrega o se
--    quita una y ya. Los edificios de la FIC varían mucho entre sí: uno tiene
--    tres plantas y ningún subterráneo, otro sí lo tiene, y así.
--
-- 2. El nivel 0 no existe. En Chile la planta baja es el 1 y el primer
--    subterráneo es el -1; dejar pasar un 0 solo genera dudas sobre cuál de
--    los dos quiso decir quien lo escribió.
--
-- 3. El exterior no es una excepción sino un caso del mismo modelo: el patio
--    es un área con building_id y floor en null. La constraint
--    areas_floor_coherent obliga a que esos dos vayan siempre juntos, para que
--    no exista un área "en la planta 3 de ningún edificio".
--
-- Las áreas las dibuja un moderador o un administrador desde /admin/mapeo.
-- Las salas NO viven aquí: son pines, con su categoría y su verificación.
-- =============================================================================


-- ── Tipo de área ────────────────────────────────────────────────────────────
-- Determina el color por defecto en el mapa. `color` en la fila lo sobreescribe
-- cuando el automático no convenga.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'area_kind') then
    create type public.area_kind as enum (
      'hall',       -- hall de acceso, recepción
      'corridor',   -- pasillo
      'cafeteria',  -- casino, cafetería
      'kiosk',      -- quiosco
      'lab',        -- laboratorio
      'office',     -- secretaría, oficinas
      'service',    -- baños, ascensores, escaleras
      'courtyard',  -- patio, explanada        (exterior)
      'sports',     -- cancha                  (exterior)
      'parking',    -- estacionamiento         (exterior)
      'green',      -- jardín                  (exterior)
      'other'
    );
  end if;
end $$;


-- ── Edificios ───────────────────────────────────────────────────────────────
-- id de texto, legible, a la altura del resto del catálogo (faculties,
-- categories). `code` es el prefijo del código de sala UDP: en E441.1.S101 el
-- edificio es E441, y de ahí se deduce a qué edificio pertenece una sala.
-- `height_m` solo se rellena para edificios que faltan en OpenStreetMap; el
-- resto ya los levanta en 3D el estilo del mapa.

create table if not exists public.buildings (
  id             text         primary key,
  faculty_id     text         not null references public.faculties(id) on delete cascade,
  code           text,
  name           text         not null check (char_length(name) between 1 and 120),
  short_name     text         check (short_name is null or char_length(short_name) <= 40),
  aliases        text[]       not null default '{}',
  footprint      jsonb        not null,
  default_floor  integer      not null default 1 check (default_floor <> 0),
  height_m       numeric      check (height_m is null or (height_m > 0 and height_m <= 500)),
  color          text         check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order     integer      not null default 0,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);


-- ── Plantas ─────────────────────────────────────────────────────────────────

create table if not exists public.building_floors (
  building_id  text     not null references public.buildings(id) on delete cascade,
  level        integer  not null check (level <> 0),
  label        text     check (label is null or char_length(label) <= 40),
  primary key (building_id, level)
);


-- ── Áreas ───────────────────────────────────────────────────────────────────
-- La clave foránea compuesta (building_id, floor) → building_floors es lo que
-- impide que un área quede colgando de una planta que no existe, y el
-- `on delete cascade` se lleva las áreas cuando se elimina la planta. Con
-- MATCH SIMPLE, si building_id es null la constraint no se evalúa, que es justo
-- lo que hace falta para las áreas exteriores.

create table if not exists public.areas (
  id           uuid         primary key default gen_random_uuid(),
  faculty_id   text         not null references public.faculties(id) on delete cascade,
  building_id  text         references public.buildings(id) on delete cascade,
  floor        integer,
  kind         public.area_kind not null default 'other',
  name         text         not null check (char_length(name) between 1 and 120),
  polygon      jsonb        not null,
  color        text         check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order   integer      not null default 0,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),

  constraint areas_floor_coherent check (
    (building_id is null and floor is null) or
    (building_id is not null and floor is not null)
  ),

  constraint areas_floor_fkey foreign key (building_id, floor)
    references public.building_floors(building_id, level) on delete cascade
);


-- ── Índices ─────────────────────────────────────────────────────────────────
-- El editor y el mapa siempre consultan "dame lo de esta facultad" o "dame lo
-- de esta planta de este edificio".

create index if not exists buildings_faculty_idx on public.buildings (faculty_id);

-- El código de edificio identifica una sala dentro de su facultad, así que no
-- puede repetirse ahí. Parcial porque `code` es opcional.
create unique index if not exists buildings_faculty_code_uidx
  on public.buildings (faculty_id, upper(code)) where code is not null;

create index if not exists areas_faculty_idx on public.areas (faculty_id);
create index if not exists areas_building_floor_idx on public.areas (building_id, floor);


-- ── updated_at ──────────────────────────────────────────────────────────────
-- set_notification_updated_at() es genérica pese al nombre: pone now() en
-- updated_at y devuelve la fila. Ya la usan content_reports y
-- push_subscriptions.

drop trigger if exists buildings_updated_at on public.buildings;
create trigger buildings_updated_at
  before update on public.buildings
  for each row execute function public.set_notification_updated_at();

drop trigger if exists areas_updated_at on public.areas;
create trigger areas_updated_at
  before update on public.areas
  for each row execute function public.set_notification_updated_at();


-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Lo lee todo el mundo, incluido un invitado: sin esto el mapa no puede dibujar
-- el interior de un edificio. Lo escribe quien modera, igual que floor_plans.

alter table public.buildings       enable row level security;
alter table public.building_floors enable row level security;
alter table public.areas           enable row level security;

drop policy if exists buildings_read on public.buildings;
create policy buildings_read on public.buildings for select using (true);

drop policy if exists buildings_write on public.buildings;
create policy buildings_write on public.buildings
  for all using (public.user_role() = any (array['moderator', 'admin']))
  with check (public.user_role() = any (array['moderator', 'admin']));

drop policy if exists building_floors_read on public.building_floors;
create policy building_floors_read on public.building_floors for select using (true);

drop policy if exists building_floors_write on public.building_floors;
create policy building_floors_write on public.building_floors
  for all using (public.user_role() = any (array['moderator', 'admin']))
  with check (public.user_role() = any (array['moderator', 'admin']));

drop policy if exists areas_read on public.areas;
create policy areas_read on public.areas for select using (true);

drop policy if exists areas_write on public.areas;
create policy areas_write on public.areas
  for all using (public.user_role() = any (array['moderator', 'admin']))
  with check (public.user_role() = any (array['moderator', 'admin']));


-- ── Permisos ────────────────────────────────────────────────────────────────
-- Mismo criterio que el resto del catálogo público: el permiso lo abre RLS.

grant all on public.buildings       to anon, authenticated;
grant all on public.building_floors to anon, authenticated;
grant all on public.areas           to anon, authenticated;
