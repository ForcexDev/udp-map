-- =============================================================================
-- UDP Map — BASELINE DEL ESQUEMA
-- =============================================================================
-- Retrato fiel del estado de producción leído el 2026-08-03 desde los catálogos
-- de Postgres (PostgreSQL 17.6). Reconstruye la base completa sobre un proyecto
-- Supabase vacío: extensiones, tipos, tablas, constraints, índices, funciones,
-- triggers, vista, RLS, políticas, permisos, Storage y Realtime.
--
-- ESTE ARCHIVO ES LA FUENTE DE VERDAD DEL ESQUEMA.
-- Las migraciones de supabase/_archive/migrations/ son historia: ya están
-- aplicadas en producción y no deben ejecutarse.
--
-- Cada cambio futuro = una migración nueva en supabase/migrations/ MÁS la
-- actualización de este archivo. Si los dos se separan, este archivo miente.
--
-- La explicación de por qué cada cosa es como es está en docs/DATABASE.md.
-- Los datos de catálogo (campus, facultades, carreras, categorías, insignias)
-- están en supabase/seed/seed.sql y se cargan después de este archivo.
--
-- Orden de ejecución sobre un proyecto nuevo:
--   1. supabase/schema/baseline.sql   (este archivo)
--   2. supabase/seed/seed.sql
--   3. los pasos manuales del runbook en docs/DATABASE.md
--      (secretos de Vault, cron jobs, proveedor de Google, admin_emails)
-- =============================================================================


-- =============================================================================
-- 1. EXTENSIONES
-- =============================================================================
-- pg_cron y pg_net normalmente se activan desde el dashboard
-- (Database → Extensions) porque necesitan ir en esquemas concretos. Si estas
-- líneas fallan, actívalas ahí y vuelve a ejecutar desde este punto.

create extension if not exists pgcrypto      with schema extensions;
create extension if not exists "uuid-ossp"   with schema extensions;
create extension if not exists pg_cron       with schema pg_catalog;
create extension if not exists pg_net        with schema public;


-- =============================================================================
-- 2. TIPOS
-- =============================================================================
-- Los tres tipos de pin. `report` y `event` los crea cualquier estudiante;
-- `place` solo lo crea un moderador, o aparece cuando un moderador verifica un
-- reporte y este se gradúa a lugar permanente.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pin_type') then
    create type public.pin_type as enum ('place', 'event', 'report');
  end if;
end $$;

-- Tipo de área del mapeo interior. Determina el color por defecto en el mapa;
-- `areas.color` lo sobreescribe cuando el automático no convenga.

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


-- =============================================================================
-- 3. TABLAS
-- =============================================================================
-- Orden por dependencias: catálogo → identidad → contenido → interacción →
-- moderación → notificaciones.

-- ── 3.1 Catálogo (datos de referencia, se cargan desde seed.sql) ────────────

create table if not exists public.campuses (
  id    text              primary key,
  name  text              not null,
  lat   double precision  not null,
  lng   double precision  not null
);

create table if not exists public.faculties (
  id         text              primary key,
  name       text              not null,
  name_en    text              not null,
  campus_id  text              not null references public.campuses(id),
  lat        double precision  not null,
  lng        double precision  not null,
  polygon    jsonb,
  image      text
);

create table if not exists public.careers (
  id          serial  primary key,
  faculty_id  text    not null references public.faculties(id),
  name        text    not null,
  name_en     text    not null
);

-- ── Mapeo interior: edificio → planta → área ────────────────────────────────
-- Le dan a un punto del mapa los contenedores que le faltan por debajo de la
-- facultad. Se trazan a mano desde /admin/mapeo.
--
-- Las plantas son una TABLA y no un rango min/max en el edificio: con un rango,
-- añadir un subterráneo a un edificio ya mapeado obliga a recalcular y no hay
-- dónde poner "Zócalo". Los edificios de una facultad varían mucho entre sí.
-- El nivel 0 no existe: la planta baja es el 1 y el primer subterráneo el -1.
--
-- `buildings.code` es el prefijo del código de sala UDP: en E441.1.S101 el
-- edificio es E441. `height_m` solo se rellena para edificios que faltan en
-- OpenStreetMap; al resto ya los levanta en 3D el estilo del mapa.
create table if not exists public.buildings (
  id             text         primary key,
  faculty_id     text         not null references public.faculties(id) on delete cascade,
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

create table if not exists public.building_floors (
  building_id  text     not null references public.buildings(id) on delete cascade,
  level        integer  not null check (level <> 0),
  label        text     check (label is null or char_length(label) <= 40),
  primary key (building_id, level)
);

-- El exterior no es una excepción sino un caso del mismo modelo: el patio es un
-- área con building_id y floor en null, y areas_floor_coherent obliga a que
-- esos dos vayan siempre juntos. La clave foránea compuesta impide que un área
-- cuelgue de una planta que no existe; con MATCH SIMPLE no se evalúa cuando
-- building_id es null, que es justo lo que hace falta para el exterior.
create table if not exists public.areas (
  id           uuid         primary key default gen_random_uuid(),
  faculty_id   text         not null references public.faculties(id) on delete cascade,
  building_id  text         references public.buildings(id) on delete cascade,
  floor        integer,
  kind         public.area_kind not null default 'other',
  -- La lista de tipos siempre se queda corta en un edificio real. Con
  -- kind = 'other' este texto lleva el nombre del tipo y es el que se muestra.
  custom_kind  text         check (custom_kind is null or char_length(custom_kind) between 1 and 40),
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

-- ttl_hours: cuánto vive un reporte de esta categoría antes de expirar.
-- kind distingue las categorías de reporte de las de evento; no existe kind
-- 'place' a propósito: un lugar permanente nace de verificar un reporte y
-- conserva la categoría con la que se creó.
create table if not exists public.categories (
  id          text     primary key,
  kind        text     not null check (kind in ('report', 'event')),
  name        text     not null,
  name_en     text     not null,
  color       text     not null,
  svg_path    text,
  ttl_hours   integer
);

create table if not exists public.badges (
  id              text  primary key,
  name            text  not null,
  name_en         text  not null,
  description     text  not null,
  description_en  text  not null
);

-- Correos que reciben rol admin automáticamente al registrarse
-- (lo aplica handle_new_user). Se rellena a mano, no va en el seed.
create table if not exists public.admin_emails (
  email  text  primary key
);


-- ── 3.2 Identidad ───────────────────────────────────────────────────────────

-- Espejo de auth.users con los datos de la aplicación. Lo crea el trigger
-- on_auth_user_created; nunca se inserta desde el cliente.
create table if not exists public.profiles (
  id          uuid         primary key references auth.users(id) on delete cascade,
  email       text         not null unique,
  name        text,
  role        text         not null default 'student'
                           check (role in ('guest', 'student', 'moderator', 'admin')),
  faculty_id  text         references public.faculties(id),
  career      text,
  year        integer,
  karma       integer      not null default 0,
  avatar_url  text,
  created_at  timestamptz  not null default now()
);


-- ── 3.3 Contenido ───────────────────────────────────────────────────────────

-- reports: columna heredada de la v1. Siempre vale 0: nada la incrementa y
-- nada la lee. El sistema real de denuncias es public.content_reports.
create table if not exists public.pins (
  id                    uuid              primary key default gen_random_uuid(),
  type                  public.pin_type   not null,
  title                 text              not null check (char_length(title) between 3 and 80),
  description           text              check (char_length(description) <= 1500),
  category_id           text              references public.categories(id),
  faculty_id            text              references public.faculties(id),
  lat                   double precision  not null,
  lng                   double precision  not null,
  -- floor NO se deduce del punto: desde arriba, el piso 1 y el 3 son el mismo
  -- sitio. Lo elige quien publica. building_id y area_id sí se deducen.
  floor                 integer,
  building_id           text              references public.buildings(id) on delete set null,
  area_id               uuid              references public.areas(id) on delete set null,
  -- Código de sala de la universidad (E441.1.S101, SMV-03). Texto libre: no
  -- decide edificio ni planta, solo sirve para buscar y para cruzar con el
  -- sistema de horarios. Vive en el pin porque un edificio hospeda salas con
  -- esquemas distintos y hay salas sin código.
  room_code             text              check (room_code is null or char_length(room_code) between 1 and 40),
  -- Heredada de la v1, siempre null. La reemplaza building_id.
  building              text,
  creator_id            uuid              references public.profiles(id) on delete set null,
  votes_up              integer           not null default 0,
  votes_down            integer           not null default 0,
  reports               integer           not null default 0,
  is_permanent          boolean           not null default false,
  expires_at            timestamptz,
  starts_at             timestamptz,
  ends_at               timestamptz,
  is_official           boolean           not null default false,
  created_at            timestamptz       not null default now(),
  official_entity_name  text,
  verifier_entity_name  text
);

create table if not exists public.pin_photos (
  id          uuid         primary key default gen_random_uuid(),
  pin_id      uuid         not null references public.pins(id) on delete cascade,
  url         text         not null,
  width       integer,
  height      integer,
  created_at  timestamptz  not null default now()
);

-- Galería de una facultad, de un edificio o de un área exterior (el Patio, una
-- plaza). Exactamente uno de los tres ids va relleno, y el CHECK lo garantiza.
-- FK anulables en vez del par (entity_type, entity_id) para conservar la
-- integridad referencial y el borrado en cascada: un `text` que apunta a tres
-- tablas no puede tener FK. `sort_order` 0 es la portada.
create table if not exists public.place_photos (
  id           uuid         primary key default gen_random_uuid(),
  faculty_id   text         references public.faculties(id) on delete cascade,
  building_id  text         references public.buildings(id) on delete cascade,
  area_id      uuid         references public.areas(id) on delete cascade,
  url          text         not null,
  width        integer,
  height       integer,
  sort_order   integer      not null default 0,
  created_at   timestamptz  not null default now(),
  constraint place_photos_one_owner check (num_nonnulls(faculty_id, building_id, area_id) = 1)
);

create index if not exists place_photos_faculty_idx
  on public.place_photos (faculty_id, sort_order)
  where faculty_id is not null;

create index if not exists place_photos_building_idx
  on public.place_photos (building_id, sort_order)
  where building_id is not null;

create index if not exists place_photos_area_idx
  on public.place_photos (area_id, sort_order)
  where area_id is not null;

create table if not exists public.pin_comments (
  id          uuid         primary key default gen_random_uuid(),
  pin_id      uuid         not null references public.pins(id) on delete cascade,
  author_id   uuid         references public.profiles(id) on delete set null,
  body        text         not null check (char_length(body) between 1 and 400),
  created_at  timestamptz  not null default now()
);

-- Programa opcional de un evento (bloques horarios). La interfaz edita esto
-- reemplazando el set completo (delete + insert), no hay policy de update.
create table if not exists public.pin_schedule_items (
  id          uuid         primary key default gen_random_uuid(),
  pin_id      uuid         not null references public.pins(id) on delete cascade,
  starts_at   timestamptz  not null,
  ends_at     timestamptz,
  title       text         not null check (char_length(title) between 1 and 120),
  subtitle    text         check (subtitle is null or char_length(subtitle) <= 160),
  sort_order  integer      not null default 0,
  created_at  timestamptz  not null default now()
);

create table if not exists public.floor_plans (
  id             uuid   primary key default gen_random_uuid(),
  place_pin_id   uuid   references public.pins(id) on delete set null,
  faculty_id     text   references public.faculties(id),
  building       text   not null,
  floor          integer not null,
  geojson        jsonb  not null,
  bounds         jsonb,
  image_overlay  text
);


-- ── 3.4 Interacción ─────────────────────────────────────────────────────────

create table if not exists public.pin_votes (
  pin_id   uuid      not null references public.pins(id) on delete cascade,
  user_id  uuid      not null references public.profiles(id) on delete cascade,
  value    smallint  not null check (value in (1, -1)),
  primary key (pin_id, user_id)
);

create table if not exists public.favorites (
  user_id  uuid  not null references public.profiles(id) on delete cascade,
  pin_id   uuid  not null references public.pins(id) on delete cascade,
  primary key (user_id, pin_id)
);

create table if not exists public.event_rsvps (
  pin_id   uuid  not null references public.pins(id) on delete cascade,
  user_id  uuid  not null references public.profiles(id) on delete cascade,
  status   text  not null check (status in ('going', 'interested')),
  primary key (pin_id, user_id)
);

-- Bitácora del límite diario de creación de pines. La fila sobrevive al pin
-- (pin_id queda en null si se borra) para que borrar y recrear no reinicie el
-- contador del día.
create table if not exists public.pin_creation_events (
  id          uuid         primary key default gen_random_uuid(),
  pin_id      uuid         references public.pins(id) on delete set null,
  creator_id  uuid         not null references public.profiles(id) on delete cascade,
  created_at  timestamptz  not null default now()
);


-- ── 3.5 Foro ────────────────────────────────────────────────────────────────

create table if not exists public.forum_threads (
  id                    uuid         primary key default gen_random_uuid(),
  faculty_id            text         references public.faculties(id) on delete set null,
  author_id             uuid         not null references public.profiles(id) on delete cascade,
  title                 text         not null,
  content               text         not null,
  tags                  text[]       default '{}'::text[],
  votes_up              integer      default 0,
  votes_down            integer      default 0,
  is_pinned             boolean      default false,
  created_at            timestamptz  not null default timezone('utc', now()),
  updated_at            timestamptz  not null default timezone('utc', now()),
  is_official           boolean      not null default false,
  official_entity_name  text
);

create table if not exists public.forum_comments (
  id                 uuid         primary key default gen_random_uuid(),
  thread_id          uuid         not null references public.forum_threads(id) on delete cascade,
  parent_comment_id  uuid         references public.forum_comments(id) on delete cascade,
  author_id          uuid         not null references public.profiles(id) on delete cascade,
  content            text         not null,
  created_at         timestamptz  not null default timezone('utc', now())
);

create table if not exists public.forum_votes (
  thread_id  uuid     not null references public.forum_threads(id) on delete cascade,
  user_id    uuid     not null references public.profiles(id) on delete cascade,
  value      integer  check (value in (1, -1)),
  primary key (thread_id, user_id)
);


-- ── 3.6 Gamificación ────────────────────────────────────────────────────────

create table if not exists public.user_badges (
  user_id     uuid         not null references public.profiles(id) on delete cascade,
  badge_id    text         not null references public.badges(id) on delete cascade,
  awarded_at  timestamptz  not null default now(),
  primary key (user_id, badge_id)
);


-- ── 3.7 Moderación ──────────────────────────────────────────────────────────

-- snapshot guarda una copia del contenido denunciado para que el admin pueda
-- juzgarlo aunque el autor lo borre mientras tanto.
create table if not exists public.content_reports (
  id                 uuid         primary key default gen_random_uuid(),
  target_type        text         not null check (target_type in ('pin', 'pin_comment', 'forum_thread', 'forum_comment')),
  target_id          uuid         not null,
  reporter_id        uuid         not null references public.profiles(id) on delete cascade,
  reason             text         not null check (reason in ('spam', 'harassment', 'misinformation', 'inappropriate', 'other')),
  details            text         check (details is null or char_length(details) <= 1000),
  snapshot           jsonb        not null,
  status             text         not null default 'pending'
                                  check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  assigned_to        uuid         references public.profiles(id) on delete set null,
  resolution_action  text         check (resolution_action is null or resolution_action in ('dismiss', 'delete')),
  resolution_note    text         check (resolution_note is null or char_length(resolution_note) <= 1000),
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),
  resolved_at        timestamptz
);


-- ── 3.8 Notificaciones y push ───────────────────────────────────────────────

-- dedupe_key + user_id es único: evita notificar dos veces el mismo hecho.
create table if not exists public.notifications (
  id          uuid         primary key default gen_random_uuid(),
  user_id     uuid         not null references public.profiles(id) on delete cascade,
  actor_id    uuid         references public.profiles(id) on delete set null,
  type        text         not null check (type in ('achievement', 'forum_reply', 'event_reminder', 'moderation_report', 'moderation_update')),
  category    text         not null check (category in ('profile', 'forum', 'events', 'moderation')),
  audience    text         not null default 'personal' check (audience in ('personal', 'admin')),
  title       text         not null,
  body        text         not null,
  url         text         not null default '/',
  payload     jsonb        not null default '{}'::jsonb,
  dedupe_key  text         not null,
  read_at     timestamptz,
  created_at  timestamptz  not null default now(),
  unique (user_id, dedupe_key)
);

create table if not exists public.push_subscriptions (
  id          uuid         primary key default gen_random_uuid(),
  user_id     uuid         not null references public.profiles(id) on delete cascade,
  endpoint    text         not null unique,
  p256dh      text         not null,
  auth        text         not null,
  user_agent  text,
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now()
);

-- Cola de entrega Web Push. La drena la Edge Function send-push, invocada por
-- un cron cada minuto.
create table if not exists public.notification_push_deliveries (
  id               uuid         primary key default gen_random_uuid(),
  notification_id  uuid         not null references public.notifications(id) on delete cascade,
  subscription_id  uuid         not null references public.push_subscriptions(id) on delete cascade,
  status           text         not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts         integer      not null default 0 check (attempts >= 0),
  next_attempt_at  timestamptz  not null default now(),
  last_error       text,
  sent_at          timestamptz,
  created_at       timestamptz  not null default now(),
  unique (notification_id, subscription_id)
);


-- ── 3.9 Limpieza de Storage ─────────────────────────────────────────────────

-- Postgres no puede borrar un archivo de Storage: eliminar la fila de
-- storage.objects quita el metadato pero deja el binario en S3, invisible y
-- facturable. Por eso el trigger sobre pin_photos solo encola la ruta, y el
-- borrado real lo hace la Edge Function storage-gc, que sí habla con esa API.
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


-- =============================================================================
-- 4. ÍNDICES
-- =============================================================================
-- Solo los que no crean las constraints. Las claves primarias y las columnas
-- unique ya vienen indexadas.

create index if not exists pins_expires_idx  on public.pins (expires_at);
create index if not exists pins_faculty_idx  on public.pins (faculty_id);
create index if not exists pins_lat_lng_idx  on public.pins (lat, lng);
create index if not exists pins_type_idx     on public.pins (type);
create index if not exists pins_building_floor_idx on public.pins (building_id, floor);
create index if not exists pins_area_idx           on public.pins (area_id);
-- Quien escribe "s101" espera encontrar la S101.
create index if not exists pins_room_code_idx on public.pins (upper(room_code))
  where room_code is not null;

create index if not exists pin_photos_pin_idx         on public.pin_photos (pin_id);
create index if not exists pin_comments_pin_created_idx on public.pin_comments (pin_id, created_at desc);
create index if not exists pin_schedule_items_pin_starts_idx on public.pin_schedule_items (pin_id, starts_at);

create index if not exists pin_creation_events_creator_day_idx
  on public.pin_creation_events (creator_id, created_at desc);
-- Un pin no puede aparecer dos veces en la bitácora, pero pin_id sí puede ser
-- null (cuando el pin se borró), y de ahí el índice parcial.
create unique index if not exists pin_creation_events_pin_uidx
  on public.pin_creation_events (pin_id) where pin_id is not null;

-- Mapeo interior. El editor y el mapa siempre consultan "lo de esta facultad"
-- o "lo de esta planta de este edificio". El índice de `code` es parcial porque
-- la columna es opcional, y va en mayúsculas para que E441 y e441 choquen.
create index if not exists buildings_faculty_idx on public.buildings (faculty_id);
create index if not exists areas_faculty_idx on public.areas (faculty_id);
create index if not exists areas_building_floor_idx on public.areas (building_id, floor);

create index if not exists idx_forum_threads_created  on public.forum_threads (created_at desc);
create index if not exists idx_forum_threads_faculty  on public.forum_threads (faculty_id);
create index if not exists idx_forum_comments_thread  on public.forum_comments (thread_id);
create index if not exists idx_forum_comments_parent  on public.forum_comments (parent_comment_id);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, category, created_at desc) where read_at is null;

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create index if not exists notification_deliveries_pending_idx
  on public.notification_push_deliveries (next_attempt_at, created_at) where status = 'pending';

create index if not exists storage_cleanup_pending_idx
  on public.storage_cleanup_queue (created_at)
  where processed_at is null;

create index if not exists content_reports_queue_idx
  on public.content_reports (status, created_at desc);
-- Un mismo usuario no puede tener dos denuncias abiertas sobre el mismo
-- contenido; sí puede volver a denunciar una vez resuelta la anterior.
create unique index if not exists content_reports_active_reporter_target_uidx
  on public.content_reports (reporter_id, target_type, target_id)
  where status in ('pending', 'reviewing');


-- =============================================================================
-- 5. FUNCIONES
-- =============================================================================
-- Casi todas son SECURITY DEFINER: se ejecutan con los permisos de postgres,
-- no con los de quien llama. Es lo que permite que un estudiante cree un pin
-- (pasando por el límite diario) sin tener INSERT directo sobre la tabla, y
-- que las políticas RLS puedan leer public.profiles pese a que anon y
-- authenticated no tienen SELECT a nivel de tabla sobre ella.
--
-- Regla: toda función SECURITY DEFINER debe fijar `set search_path`. Sin él,
-- quien llama puede anteponer un esquema propio y hacer que la función use su
-- versión de una tabla. Aquí no hay excepciones.

-- ── 5.1 Rol efectivo del usuario ────────────────────────────────────────────
-- La usan casi todas las políticas RLS. Es SECURITY DEFINER porque lee
-- profiles, sobre la que quien llama no tiene SELECT de tabla. Devuelve
-- 'guest' cuando no hay sesión, para que las políticas puedan comparar
-- siempre contra un texto y nunca contra null.

create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce((select role from profiles where id = auth.uid()), 'guest')
$fn$;


-- ── 5.2 Alta de usuario ─────────────────────────────────────────────────────
-- Único punto donde se crea una fila en profiles. Rechaza cualquier correo
-- que no sea @mail.udp.cl y concede rol admin si el correo está en
-- admin_emails.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if lower(new.email) not like '%@mail.udp.cl' then
    raise exception 'Solo cuentas @mail.udp.cl pueden registrarse en UDP Map';
  end if;
  insert into public.profiles (id, email, name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    case
      when exists (select 1 from admin_emails where email = lower(new.email)) then 'admin'
      else 'student'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;


-- ── 5.3 Protección de campos ────────────────────────────────────────────────
-- Estos tres triggers son la segunda línea de defensa. RLS decide QUIÉN puede
-- tocar una fila; estos deciden QUÉ COLUMNAS puede tocar. Sin ellos, la
-- política pins_owner_update dejaría a un estudiante marcarse el pin como
-- verificado u oficial editando su propio pin.

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
    --
    -- `floor` y `room_code` NO se protegen: esos sí los elige el autor, y
    -- corregir en qué piso está su sala es la edición más común de todas.
    new.building_id := old.building_id;

    -- El área cuelga de una planta concreta, así que no sobrevive a un cambio
    -- de planta: se suelta en vez de quedarse apuntando al piso anterior, que
    -- haría que el pin dijera estar en dos plantas a la vez. Recalcularla aquí
    -- no es posible —el punto en polígono se resuelve en el cliente, sobre
    -- areas.polygon en jsonb— y aceptarla del navegador reabriría justo el
    -- agujero que este campo protegido cierra. Un moderador la vuelve a fijar
    -- moviendo el pin, que sí recalcula edificio y área.
    if new.floor is distinct from old.floor then
      new.area_id := null;
    else
      new.area_id := old.area_id;
    end if;

    -- La categoría de un pin verificado forma parte de lo que se verificó.
    -- Esto lanza excepción en vez de revertir en silencio, al revés que los
    -- campos de arriba: la interfaz nunca intenta cambiar aquellos, así que un
    -- error ahí sería ruido, mientras que este sí puede intentarlo una persona
    -- y merece enterarse en vez de ver un "guardado" que no guardó.
    if old.is_permanent and new.category_id is distinct from old.category_id then
      raise exception 'No puedes cambiar la categoría de un pin verificado.';
    end if;

    -- Un evento tiene dos fechas: ends_at, que ve el usuario, y expires_at, que
    -- decide si el pin sigue vivo. El autor puede mover la suya mientras las dos
    -- vayan juntas. Se exige que no sea null para que nadie deje su evento
    -- eterno vaciando la fecha.
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

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if public.user_role() = 'admin'
     or (auth.jwt() ->> 'role') = 'service_role'
     or current_user in ('postgres', 'service_role', 'supabase_admin', 'dashboard_user', 'supabase_owner')
     or pg_has_role(current_user, 'postgres', 'member') then
    return new;
  end if;

  if new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.created_at is distinct from old.created_at
     or new.id is distinct from old.id then
    raise exception 'No autorizado para modificar campos protegidos del perfil.';
  end if;

  if new.karma is distinct from old.karma
     and current_setting('udpmap.internal_karma_update', true) is distinct from 'on' then
    raise exception 'No autorizado para modificar el karma del perfil directamente.';
  end if;

  return new;
end;
$fn$;

create or replace function public.protect_thread_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if public.user_role() = any (array['moderator', 'admin']) then
    return new;
  end if;

  if new.is_pinned is distinct from old.is_pinned
     or new.is_official is distinct from old.is_official
     or new.official_entity_name is distinct from old.official_entity_name
     or new.author_id is distinct from old.author_id then
    raise exception 'No autorizado para modificar campos protegidos del hilo.';
  end if;

  if (new.votes_up is distinct from old.votes_up or new.votes_down is distinct from old.votes_down)
     and current_setting('udpmap.vote_rpc', true) is distinct from 'on' then
    raise exception 'No autorizado para modificar contadores de votos del hilo fuera de la RPC de votación.';
  end if;

  return new;
end;
$fn$;

-- Los contadores de votos solo se tocan dentro de vote_pin / vote_thread, que
-- ponen la marca de sesión udpmap.vote_rpc antes de escribir.
create or replace function public.protect_vote_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if (
    new.votes_up is distinct from old.votes_up
    or new.votes_down is distinct from old.votes_down
  ) and current_setting('udpmap.vote_rpc', true) is distinct from 'on' then
    raise exception 'Los contadores de votos solo pueden modificarse mediante la RPC de votación';
  end if;
  return new;
end;
$fn$;


-- ── 5.4 Reglas de negocio de los pines ──────────────────────────────────────

-- Dos pines vivos no pueden ocupar exactamente la misma coordenada. Un pin ya
-- expirado no reserva su sitio. El advisory lock serializa las creaciones
-- simultáneas sobre el mismo punto.
create or replace function public.prevent_occupied_pin_location()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if tg_op = 'UPDATE'
    and new.lat is not distinct from old.lat
    and new.lng is not distinct from old.lng
    and new.floor is not distinct from old.floor then
    return new;
  end if;

  if not (new.is_permanent or new.expires_at is null or new.expires_at > now()) then
    return new;
  end if;

  -- La cerradura incluye la planta: dos pines del mismo punto en pisos
  -- distintos no compiten y no tienen por qué serializarse entre sí.
  perform pg_advisory_xact_lock(
    hashtext(new.lat::text || ':' || new.lng::text || ':' || coalesce(new.floor, 0)::text)
  );

  if exists (
    select 1
    from public.pins as existing
    where existing.id is distinct from new.id
      and existing.lat = new.lat
      and existing.lng = new.lng
      -- Una impresora en el piso 2 y otra en el 3 de la misma esquina son dos
      -- cosas distintas, no un duplicado.
      and existing.floor is not distinct from new.floor
      and (
        existing.is_permanent
        or existing.expires_at is null
        or existing.expires_at > now()
      )
  ) then
    raise exception 'PIN_LOCATION_OCCUPIED';
  end if;

  return new;
end;
$fn$;

create or replace function public.validate_rsvp_targets_event()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $fn$
begin
  if not exists (
    select 1 from public.pins where id = new.pin_id and type = 'event'
  ) then
    raise exception 'Solo se puede hacer RSVP a pines de tipo evento';
  end if;
  return new;
end;
$fn$;

-- Único camino de creación de pines. No existe política de INSERT sobre
-- public.pins: se crea aquí o no se crea. Aplica el límite de 10 al día
-- (moderadores y admins exentos), restringe `place` y el marcado oficial a
-- moderadores, y deja constancia en pin_creation_events.
create or replace function public.create_pin_with_daily_limit(
  p_type                 public.pin_type,
  p_title                text,
  p_description          text,
  p_category_id          text,
  p_faculty_id           text,
  p_lat                  double precision,
  p_lng                  double precision,
  p_is_official          boolean,
  p_official_entity_name text,
  p_expires_at           timestamptz,
  p_starts_at            timestamptz,
  p_ends_at              timestamptz,
  p_floor                integer default null,
  p_building_id          text    default null,
  p_area_id              uuid    default null,
  p_room_code            text    default null
)
returns setof public.pins
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_role          text;
  v_created_today integer;
  v_day_start     timestamptz;
  v_ttl_hours     integer;
  v_expires_at    timestamptz;
  v_pin           public.pins;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para crear un pin';
  end if;

  v_role := public.user_role();
  if v_role = 'guest' then
    raise exception 'Los invitados no pueden crear pines';
  end if;

  -- Moderadores y administradores no tienen rate limit. Para el resto,
  -- serializa las creaciones del mismo usuario para evitar superar el límite
  -- con solicitudes simultáneas.
  if v_role not in ('moderator', 'admin') then
    perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

    -- El límite se calcula siempre con días UTC, independientemente de la
    -- zona horaria configurada en la sesión de Postgres.
    v_day_start := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';

    select count(*)::integer
    into v_created_today
    from public.pin_creation_events
    where creator_id = auth.uid()
      and created_at >= v_day_start
      and created_at < v_day_start + interval '1 day';

    if v_created_today >= 10 then
      raise exception 'DAILY_PIN_LIMIT_REACHED';
    end if;
  end if;

  if p_type = 'place' and v_role not in ('moderator', 'admin') then
    raise exception 'Solo moderadores y administradores pueden crear lugares';
  end if;

  if coalesce(p_is_official, false) and v_role not in ('moderator', 'admin') then
    raise exception 'Solo moderadores y administradores pueden crear contenido oficial';
  end if;

  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Coordenadas del pin inválidas';
  end if;

  -- La planta 0 no existe: la baja es el 1 y el primer subterráneo el -1.
  if p_floor = 0 then
    raise exception 'La planta 0 no existe: usa 1 para la planta baja y -1 para el subterráneo.';
  end if;

  -- El plazo no se acepta del cliente: se deduce del tipo y de la categoría.
  -- p_expires_at se conserva en la firma pero se ignora — cambiarla obligaría a
  -- crear otra función y repartir de nuevo los permisos de EXECUTE, a cambio de
  -- nada. Esto es lo que convierte categories.ttl_hours en autoridad real; antes
  -- solo lo leía el navegador y cualquiera que llamase la API directamente podía
  -- crear un reporte que caducara cuando quisiera.
  if p_type = 'place' then
    v_expires_at := null;
  elsif p_type = 'event' then
    v_expires_at := coalesce(p_ends_at, now() + interval '24 hours');
  else
    select ttl_hours into v_ttl_hours
    from public.categories
    where id = p_category_id;

    v_expires_at := now() + make_interval(hours => coalesce(v_ttl_hours, 24));
  end if;

  insert into public.pins (
    type, title, description, category_id, faculty_id, lat, lng, creator_id,
    is_permanent, expires_at, starts_at, ends_at, is_official, official_entity_name,
    floor, building_id, area_id, room_code
  ) values (
    p_type,
    p_title,
    p_description,
    p_category_id,
    p_faculty_id,
    p_lat,
    p_lng,
    auth.uid(),
    p_type = 'place',
    v_expires_at,
    p_starts_at,
    p_ends_at,
    coalesce(p_is_official, false),
    case when coalesce(p_is_official, false) then p_official_entity_name else null end,
    p_floor,
    p_building_id,
    p_area_id,
    nullif(trim(p_room_code), '')
  )
  returning * into v_pin;

  insert into public.pin_creation_events (pin_id, creator_id)
  values (v_pin.id, auth.uid());

  return next v_pin;
end;
$fn$;

-- Extender y verificar son decisiones sobre el pin concreto, no sobre su
-- categoría: la misma categoría puede describir algo fijo del campus ("el
-- casino está acá") o algo que está pasando ahora ("hay fila en el casino"), y
-- eso solo lo sabe quien lee el pin. Por eso al moderador se le ofrecen las dos
-- opciones y no hay ninguna regla automática que las reparta.
create or replace function public.extend_pin_ttl(p_pin uuid, p_hours integer default 24)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_pin public.pins;
begin
  if public.user_role() not in ('moderator', 'admin') then
    raise exception 'Solo moderadores y administradores pueden extender el plazo de un pin.';
  end if;

  if p_hours is null or p_hours <= 0 or p_hours > 720 then
    raise exception 'El plazo a extender debe estar entre 1 y 720 horas.';
  end if;

  select * into v_pin from public.pins where id = p_pin for update;
  if not found then
    raise exception 'Pin no encontrado.';
  end if;

  if v_pin.is_permanent then
    raise exception 'Este pin es permanente: no tiene plazo que extender.';
  end if;

  update public.pins
  set expires_at = greatest(coalesce(expires_at, now()), now()) + make_interval(hours => p_hours)
  where id = p_pin;
end;
$fn$;

-- Verificar = graduar un reporte a lugar permanente. Premia al autor con 25 de
-- karma y, al segundo pin verificado, con la insignia de Cartógrafo.
create or replace function public.verify_and_make_permanent(
  p_pin uuid,
  p_verifier_name text default 'Centro de Alumnos FIC'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_pin            public.pins;
  v_verified_count integer;
begin
  if public.user_role() not in ('moderator', 'admin') then
    raise exception 'Solo moderadores y administradores pueden verificar pines.';
  end if;

  select * into v_pin from public.pins where id = p_pin for update;
  if not found then
    raise exception 'Pin no encontrado.';
  end if;

  if v_pin.is_permanent then
    raise exception 'Este pin ya está verificado.';
  end if;

  if v_pin.type <> 'report' then
    raise exception 'Solo se pueden verificar reportes.';
  end if;

  update public.pins
  set is_permanent = true,
      type = 'place',
      expires_at = null,
      verifier_entity_name = coalesce(nullif(trim(p_verifier_name), ''), 'Centro de Alumnos UDP')
  where id = p_pin;

  if v_pin.creator_id is not null then
    perform public.adjust_karma(v_pin.creator_id, 25);

    select count(*) into v_verified_count
    from public.pins
    where creator_id = v_pin.creator_id and verifier_entity_name is not null;

    if v_verified_count >= 2 then
      insert into public.user_badges (user_id, badge_id)
      values (v_pin.creator_id, 'verified_creator')
      on conflict (user_id, badge_id) do nothing;
    end if;
  end if;
end;
$fn$;

-- El camino de vuelta. Verificar es un juicio humano, así que va a haber
-- errores; sin esto, un moderador equivocado solo podía borrar el pin y con él
-- el aporte del estudiante. Devuelve los 25 de karma, pero NO retira la
-- insignia de Cartógrafo: en este proyecto los badges son permanentes una vez
-- obtenidos y no se rompe esa regla por un caso raro.
create or replace function public.unverify_pin(p_pin uuid, p_hours integer default 24)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_pin public.pins;
begin
  if public.user_role() not in ('moderator', 'admin') then
    raise exception 'Solo moderadores y administradores pueden quitar la verificación de un pin.';
  end if;

  if p_hours is null or p_hours <= 0 or p_hours > 720 then
    raise exception 'El nuevo plazo debe estar entre 1 y 720 horas.';
  end if;

  select * into v_pin from public.pins where id = p_pin for update;
  if not found then
    raise exception 'Pin no encontrado.';
  end if;

  if not v_pin.is_permanent then
    raise exception 'Este pin no está verificado.';
  end if;

  -- Un lugar creado directamente por un moderador nunca fue un reporte, así que
  -- no hay verificación que deshacer. Se reconoce por el verificador.
  if v_pin.verifier_entity_name is null then
    raise exception 'Este lugar no proviene de una verificación; no hay nada que deshacer.';
  end if;

  update public.pins
  set is_permanent = false,
      type = 'report',
      verifier_entity_name = null,
      expires_at = now() + make_interval(hours => p_hours)
  where id = p_pin;

  if v_pin.creator_id is not null then
    perform public.adjust_karma(v_pin.creator_id, -25);
  end if;
end;
$fn$;


-- ── 5.4bis Fotos: límite y limpieza ─────────────────────────────────────────

-- El máximo de 5 fotos por pin. Va en un trigger AFTER y no BEFORE a propósito:
-- dentro de un INSERT de varias filas, un BEFORE no ve las que la misma
-- sentencia acaba de insertar y contaría de menos. El advisory lock cierra el
-- hueco de dos subidas simultáneas sobre el mismo pin.
-- Mismo criterio que el de los pines: AFTER porque un BEFORE no ve las filas
-- que la propia sentencia acaba de insertar, y advisory lock para dos subidas
-- simultáneas. El tope es 10 y no 5 porque una galería es material curado por
-- la administración, no fotos sacadas al vuelo para un reporte.
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

  -- Los tres ids entran en el recuento. Con solo dos, las fotos de todas las
  -- áreas caían en el mismo cajón (faculty_id null, building_id null) y el tope
  -- de 10 se agotaba entre áreas que no tienen nada que ver.
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

-- Los cuatro caminos por los que desaparece un pin —borrado por su autor, panel
-- de administración, resolución de una denuncia y el cron de expiración—
-- terminan en lo mismo: una fila de pin_photos que se va. Un único trigger los
-- cubre a todos, incluidos los borrados en cascada.
create or replace function public.enqueue_pin_photo_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_path text;
begin
  -- La URL pública es .../object/public/pin-photos/pins/<uid>/<uuid>.jpg y lo
  -- que necesita la API de Storage es solo lo que va tras el bucket.
  v_path := split_part(old.url, '/pin-photos/', 2);

  -- Una URL con otra forma no se encola: mejor un archivo de más que un borrado
  -- con una ruta mal deducida.
  if v_path is null or v_path = '' then
    return null;
  end if;

  insert into public.storage_cleanup_queue (bucket_id, path)
  values ('pin-photos', v_path);

  return null;
end;
$fn$;

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



-- ── 5.5 Votación ────────────────────────────────────────────────────────────
-- Votar dos veces lo mismo retira el voto. El bloqueo FOR UPDATE sobre el pin
-- serializa los votos concurrentes para que el recuento no se desincronice.
-- set_config('udpmap.vote_rpc') es lo que autoriza a estas dos funciones —y
-- solo a ellas— a escribir los contadores.

create or replace function public.vote_pin(p_pin uuid, p_value smallint)
returns table (votes_up integer, votes_down integer, user_vote smallint)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_previous   smallint;
  v_votes_up   integer;
  v_votes_down integer;
begin
  if auth.uid() is null or public.user_role() = 'guest' then
    raise exception 'Debes iniciar sesión con tu correo UDP para votar';
  end if;
  if p_value not in (1, -1) then
    raise exception 'Voto inválido';
  end if;

  perform 1 from public.pins where id = p_pin for update;
  if not found then
    raise exception 'Pin no encontrado';
  end if;

  select vote.value
  into v_previous
  from public.pin_votes as vote
  where vote.pin_id = p_pin and vote.user_id = auth.uid();

  if v_previous = p_value then
    delete from public.pin_votes
    where pin_id = p_pin and user_id = auth.uid();
  else
    insert into public.pin_votes (pin_id, user_id, value)
    values (p_pin, auth.uid(), p_value)
    on conflict (pin_id, user_id) do update set value = excluded.value;
  end if;

  select
    count(*) filter (where vote.value = 1)::integer,
    count(*) filter (where vote.value = -1)::integer
  into v_votes_up, v_votes_down
  from public.pin_votes as vote
  where vote.pin_id = p_pin;

  perform set_config('udpmap.vote_rpc', 'on', true);
  update public.pins
  set votes_up = v_votes_up, votes_down = v_votes_down
  where id = p_pin;

  return query
  select
    v_votes_up,
    v_votes_down,
    (select vote.value from public.pin_votes as vote
     where vote.pin_id = p_pin and vote.user_id = auth.uid());
end;
$fn$;

create or replace function public.vote_thread(p_thread uuid, p_value integer)
returns table (votes_up integer, votes_down integer, user_vote integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_previous   integer;
  v_votes_up   integer;
  v_votes_down integer;
begin
  if auth.uid() is null or public.user_role() = 'guest' then
    raise exception 'Debes iniciar sesión con tu correo UDP para votar';
  end if;
  if p_value not in (1, -1) then
    raise exception 'Voto inválido';
  end if;

  perform 1 from public.forum_threads where id = p_thread for update;
  if not found then
    raise exception 'Hilo no encontrado';
  end if;

  select vote.value
  into v_previous
  from public.forum_votes as vote
  where vote.thread_id = p_thread and vote.user_id = auth.uid();

  if v_previous = p_value then
    delete from public.forum_votes
    where thread_id = p_thread and user_id = auth.uid();
  else
    insert into public.forum_votes (thread_id, user_id, value)
    values (p_thread, auth.uid(), p_value)
    on conflict (thread_id, user_id) do update set value = excluded.value;
  end if;

  select
    count(*) filter (where vote.value = 1)::integer,
    count(*) filter (where vote.value = -1)::integer
  into v_votes_up, v_votes_down
  from public.forum_votes as vote
  where vote.thread_id = p_thread;

  perform set_config('udpmap.vote_rpc', 'on', true);
  update public.forum_threads
  set votes_up = v_votes_up, votes_down = v_votes_down
  where id = p_thread;

  return query
  select
    v_votes_up,
    v_votes_down,
    (select vote.value from public.forum_votes as vote
     where vote.thread_id = p_thread and vote.user_id = auth.uid());
end;
$fn$;


-- ── 5.6 Karma e insignias ───────────────────────────────────────────────────
-- adjust_karma es el único camino legítimo para tocar profiles.karma: pone la
-- marca de sesión que protect_profile_privileged_fields exige.
-- Las insignias no se retiran nunca: todos los check_* insertan pero ninguno
-- borra, a propósito.

create or replace function public.adjust_karma(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_user_id is not null then
    perform set_config('udpmap.internal_karma_update', 'on', true);
    update public.profiles
    set karma = greatest(0, karma + p_amount)
    where id = p_user_id;
  end if;
end;
$fn$;

create or replace function public.check_explorer_badge(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  if p_user_id is null then return; end if;
  select count(*) into v_count from public.pins where creator_id = p_user_id;
  if v_count >= 5 then
    insert into public.user_badges (user_id, badge_id)
    values (p_user_id, 'explorer')
    on conflict do nothing;
  end if;
end;
$fn$;

create or replace function public.check_guardian_badge(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  if p_user_id is null then return; end if;
  select (
    (select count(*) from public.pin_votes where user_id = p_user_id) +
    (select count(*) from public.forum_votes where user_id = p_user_id)
  ) into v_count;
  if v_count >= 10 then
    insert into public.user_badges (user_id, badge_id)
    values (p_user_id, 'guardian')
    on conflict do nothing;
  end if;
end;
$fn$;

create or replace function public.check_host_badge(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  if p_user_id is null then return; end if;
  select count(*) into v_count
  from public.pins
  where creator_id = p_user_id and type = 'event';
  if v_count >= 2 then
    insert into public.user_badges (user_id, badge_id)
    values (p_user_id, 'host')
    on conflict do nothing;
  end if;
end;
$fn$;

create or replace function public.check_photographer_badge(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_count integer;
begin
  if p_user_id is null then return; end if;
  select count(*) into v_count
  from public.pin_photos ph
  join public.pins p on ph.pin_id = p.id
  where p.creator_id = p_user_id;
  if v_count >= 3 then
    insert into public.user_badges (user_id, badge_id)
    values (p_user_id, 'photographer')
    on conflict do nothing;
  end if;
end;
$fn$;

create or replace function public.check_pioneer_badge(p_user_id uuid, p_karma integer)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if p_user_id is null then return; end if;
  if p_karma >= 100 then
    insert into public.user_badges (user_id, badge_id)
    values (p_user_id, 'pioneer')
    on conflict do nothing;
  end if;
end;
$fn$;

-- Disparadores de karma. Un voto positivo vale +10 al autor y uno negativo
-- -2; cambiar de signo son 12 puntos de diferencia en un solo movimiento.

create or replace function public.on_pin_vote_change_karma()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_creator_id uuid;
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    select creator_id into v_creator_id from public.pins where id = new.pin_id;
  else
    select creator_id into v_creator_id from public.pins where id = old.pin_id;
  end if;

  if v_creator_id is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    if new.value = 1 then
      perform public.adjust_karma(v_creator_id, 10);
    elsif new.value = -1 then
      perform public.adjust_karma(v_creator_id, -2);
    end if;
  elsif tg_op = 'UPDATE' then
    if old.value <> new.value then
      if new.value = 1 then
        perform public.adjust_karma(v_creator_id, 12);
      else
        perform public.adjust_karma(v_creator_id, -12);
      end if;
    end if;
  elsif tg_op = 'DELETE' then
    if old.value = 1 then
      perform public.adjust_karma(v_creator_id, -10);
    elsif old.value = -1 then
      perform public.adjust_karma(v_creator_id, 2);
    end if;
  end if;

  return null;
end;
$fn$;

create or replace function public.on_forum_vote_change_karma()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_author_id uuid;
begin
  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    select author_id into v_author_id from public.forum_threads where id = new.thread_id;
  else
    select author_id into v_author_id from public.forum_threads where id = old.thread_id;
  end if;

  if v_author_id is null then
    return null;
  end if;

  if tg_op = 'INSERT' then
    if new.value = 1 then
      perform public.adjust_karma(v_author_id, 10);
    elsif new.value = -1 then
      perform public.adjust_karma(v_author_id, -2);
    end if;
  elsif tg_op = 'UPDATE' then
    if old.value <> new.value then
      if new.value = 1 then
        perform public.adjust_karma(v_author_id, 12);
      else
        perform public.adjust_karma(v_author_id, -12);
      end if;
    end if;
  elsif tg_op = 'DELETE' then
    if old.value = 1 then
      perform public.adjust_karma(v_author_id, -10);
    elsif old.value = -1 then
      perform public.adjust_karma(v_author_id, 2);
    end if;
  end if;

  return null;
end;
$fn$;

create or replace function public.on_pin_badge_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    perform public.check_explorer_badge(new.creator_id);
    if new.type = 'event' then
      perform public.check_host_badge(new.creator_id);
    end if;
  elsif tg_op = 'DELETE' then
    perform public.check_explorer_badge(old.creator_id);
    if old.type = 'event' then
      perform public.check_host_badge(old.creator_id);
    end if;
  end if;
  return null;
end;
$fn$;

create or replace function public.on_pin_photo_badge_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_creator_id uuid;
begin
  if tg_op = 'INSERT' then
    select creator_id into v_creator_id from public.pins where id = new.pin_id;
    if v_creator_id is not null then
      perform public.check_photographer_badge(v_creator_id);
    end if;
  elsif tg_op = 'DELETE' then
    select creator_id into v_creator_id from public.pins where id = old.pin_id;
    if v_creator_id is not null then
      perform public.check_photographer_badge(v_creator_id);
    end if;
  end if;
  return null;
end;
$fn$;

create or replace function public.on_pin_vote_badge_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    perform public.check_guardian_badge(new.user_id);
  elsif tg_op = 'DELETE' then
    perform public.check_guardian_badge(old.user_id);
  end if;
  return null;
end;
$fn$;

create or replace function public.on_forum_vote_badge_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if tg_op = 'INSERT' then
    perform public.check_guardian_badge(new.user_id);
  elsif tg_op = 'DELETE' then
    perform public.check_guardian_badge(old.user_id);
  end if;
  return null;
end;
$fn$;

create or replace function public.on_profile_badge_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if old.karma <> new.karma then
    perform public.check_pioneer_badge(new.id, new.karma);
  end if;
  return null;
end;
$fn$;


-- ── 5.7 Notificaciones ──────────────────────────────────────────────────────
-- create_notification es el único camino: authenticated no tiene INSERT sobre
-- notifications. El on conflict do nothing sobre (user_id, dedupe_key) es lo
-- que impide notificar dos veces el mismo hecho.

create or replace function public.create_notification(
  p_user_id    uuid,
  p_type       text,
  p_category   text,
  p_title      text,
  p_body       text,
  p_url        text,
  p_dedupe_key text,
  p_payload    jsonb default '{}'::jsonb,
  p_actor_id   uuid  default null,
  p_audience   text  default 'personal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  if p_user_id is null then return null; end if;

  insert into public.notifications (
    user_id, actor_id, type, category, audience, title, body, url, payload, dedupe_key
  ) values (
    p_user_id, p_actor_id, p_type, p_category, p_audience,
    p_title, p_body, coalesce(p_url, '/'), coalesce(p_payload, '{}'::jsonb), p_dedupe_key
  )
  on conflict (user_id, dedupe_key) do nothing
  returning id into v_id;

  return v_id;
end;
$fn$;

-- Al nacer una notificación se encola una entrega por cada suscripción push
-- del destinatario. El envío real lo hace la Edge Function send-push.
create or replace function public.queue_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.notification_push_deliveries (notification_id, subscription_id)
  select new.id, subscription.id
  from public.push_subscriptions subscription
  where subscription.user_id = new.user_id
  on conflict do nothing;
  return new;
end;
$fn$;

create or replace function public.set_notification_updated_at()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

create or replace function public.notify_forum_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_recipient    uuid;
  v_thread_title text;
  v_actor_name   text;
begin
  select title into v_thread_title
  from public.forum_threads
  where id = new.thread_id;

  if new.parent_comment_id is null then
    select author_id into v_recipient
    from public.forum_threads
    where id = new.thread_id;
  else
    select author_id into v_recipient
    from public.forum_comments
    where id = new.parent_comment_id;
  end if;

  if v_recipient is null or v_recipient = new.author_id then return new; end if;

  select coalesce(name, 'Alguien') into v_actor_name
  from public.profiles
  where id = new.author_id;

  perform public.create_notification(
    v_recipient,
    'forum_reply',
    'forum',
    'Nueva respuesta en el foro',
    v_actor_name || ' respondió en “' || left(coalesce(v_thread_title, 'tu hilo'), 80) || '”',
    '/foro?thread=' || new.thread_id::text,
    'forum_reply:' || new.id::text,
    jsonb_build_object(
      'threadId', new.thread_id,
      'commentId', new.id,
      'parentCommentId', new.parent_comment_id
    ),
    new.author_id,
    'personal'
  );
  return new;
end;
$fn$;

create or replace function public.notify_badge_awarded()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_badge public.badges%rowtype;
begin
  select * into v_badge from public.badges where id = new.badge_id;

  perform public.create_notification(
    new.user_id,
    'achievement',
    'profile',
    'Nuevo logro desbloqueado',
    coalesce(v_badge.name, 'Obtuviste una nueva insignia'),
    '/perfil?tab=badges',
    'achievement:' || new.badge_id,
    jsonb_build_object('badgeId', new.badge_id),
    null,
    'personal'
  );
  return new;
end;
$fn$;

create or replace function public.notify_admins_about_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_admin record;
begin
  for v_admin in select id from public.profiles where role = 'admin' loop
    perform public.create_notification(
      v_admin.id,
      'moderation_report',
      'moderation',
      'Nuevo contenido reportado',
      'Hay un reporte de ' || replace(new.target_type, '_', ' ') || ' esperando revisión.',
      '/moderacion?report=' || new.id::text,
      'moderation_report:' || new.id::text,
      jsonb_build_object('reportId', new.id, 'targetType', new.target_type, 'reason', new.reason),
      new.reporter_id,
      'admin'
    );
  end loop;
  return new;
end;
$fn$;

-- Solo avisa si el evento cae dentro de los próximos 20 días.
create or replace function public.enqueue_event_reminder(p_user_id uuid, p_pin_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_event           public.pins%rowtype;
  v_notification_id uuid;
begin
  select * into v_event
  from public.pins
  where id = p_pin_id
    and type = 'event'
    and starts_at > now()
    and starts_at <= now() + interval '20 days';

  if not found then return false; end if;

  v_notification_id := public.create_notification(
    p_user_id,
    'event_reminder',
    'events',
    'Evento próximo',
    '“' || left(v_event.title, 100) || '” comienza el ' ||
      to_char(v_event.starts_at at time zone 'America/Santiago', 'DD/MM a las HH24:MI'),
    '/eventos?event=' || v_event.id::text,
    'event_reminder:' || v_event.id::text,
    jsonb_build_object('pinId', v_event.id, 'startsAt', v_event.starts_at),
    v_event.creator_id,
    'personal'
  );

  return v_notification_id is not null;
end;
$fn$;

create or replace function public.notify_event_rsvp_in_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  perform public.enqueue_event_reminder(new.user_id, new.pin_id);
  return new;
end;
$fn$;

create or replace function public.enqueue_upcoming_event_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row     record;
  v_created integer := 0;
begin
  if auth.role() <> 'service_role' and public.user_role() <> 'admin' then
    raise exception 'Solo el servicio o un administrador puede generar recordatorios';
  end if;

  for v_row in
    select rsvp.user_id, rsvp.pin_id
    from public.event_rsvps rsvp
    join public.pins event on event.id = rsvp.pin_id
    where event.type = 'event'
      and event.starts_at > now()
      and event.starts_at <= now() + interval '20 days'
  loop
    if public.enqueue_event_reminder(v_row.user_id, v_row.pin_id) then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$fn$;

create or replace function public.register_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  if auth.uid() is null or public.user_role() = 'guest' then
    raise exception 'Debes iniciar sesión para activar notificaciones';
  end if;
  if nullif(trim(p_endpoint), '') is null
    or nullif(trim(p_p256dh), '') is null
    or nullif(trim(p_auth), '') is null then
    raise exception 'Suscripción Web Push inválida';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update set
    user_id = auth.uid(),
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    updated_at = now()
  returning id into v_id;

  -- Si el mismo navegador cambia de usuario, elimina entregas del dueño anterior
  -- antes de que puedan enviarse al usuario nuevo.
  delete from public.notification_push_deliveries delivery
  using public.notifications notification
  where delivery.subscription_id = v_id
    and notification.id = delivery.notification_id
    and notification.user_id <> auth.uid();

  return v_id;
end;
$fn$;


-- ── 5.8 Panel de administración ─────────────────────────────────────────────
-- Todas comprueban el rol dentro de la función: son SECURITY DEFINER, así que
-- el permiso de EXECUTE no basta como control de acceso.

create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  caller_role text;
begin
  caller_role := public.user_role();
  if caller_role <> 'admin' then
    raise exception 'Acceso denegado: solo administradores pueden cambiar roles.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'No puedes modificar tu propio rol desde el panel.';
  end if;

  if new_role not in ('student', 'moderator', 'admin') then
    raise exception 'Rol inválido especificado: %', new_role;
  end if;

  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'Usuario no encontrado con ID: %', target_user_id;
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;
end;
$fn$;

create or replace function public.admin_count_push_subscribers()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if public.user_role() <> 'admin' then
    raise exception 'Acceso denegado: solo administradores pueden ver este conteo.';
  end if;

  return (select count(*)::integer from public.push_subscriptions);
end;
$fn$;

create or replace function public.admin_broadcast_push_notification(p_title text, p_body text)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_sub   record;
  v_count integer := 0;
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden enviar notificaciones de prueba.';
  end if;

  if nullif(trim(p_title), '') is null then
    p_title := 'Notificación de prueba UDP Map';
  end if;

  if nullif(trim(p_body), '') is null then
    p_body := 'Mensaje de prueba enviado desde el panel de administración.';
  end if;

  -- Usa tipo 'achievement' para cumplir con el CHECK notifications_type_check.
  for v_sub in select distinct user_id from public.push_subscriptions loop
    perform public.create_notification(
      v_sub.user_id,
      'achievement',
      'profile',
      p_title,
      p_body,
      '/admin',
      'admin_test_' || extract(epoch from now())::text || '_' || v_sub.user_id::text
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;


-- ── 5.9 Moderación de contenido ─────────────────────────────────────────────

create or replace function public.create_content_report(
  p_target_type text,
  p_target_id   uuid,
  p_reason      text,
  p_details     text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_reporter    uuid := auth.uid();
  v_snapshot    jsonb;
  v_author_id   uuid;
  v_existing_id uuid;
  v_report_id   uuid;
begin
  if v_reporter is null or public.user_role() = 'guest' then
    raise exception 'Debes iniciar sesión para reportar contenido';
  end if;
  if p_target_type not in ('pin', 'pin_comment', 'forum_thread', 'forum_comment') then
    raise exception 'Tipo de contenido inválido';
  end if;
  if p_reason not in ('spam', 'harassment', 'misinformation', 'inappropriate', 'other') then
    raise exception 'Motivo inválido';
  end if;
  if char_length(coalesce(p_details, '')) > 1000 then
    raise exception 'El detalle no puede superar 1000 caracteres';
  end if;

  select id into v_existing_id
  from public.content_reports
  where reporter_id = v_reporter
    and target_type = p_target_type
    and target_id = p_target_id
    and status in ('pending', 'reviewing')
  limit 1;
  if v_existing_id is not null then return v_existing_id; end if;

  case p_target_type
    when 'pin' then
      select creator_id,
        jsonb_build_object('title', title, 'content', description, 'type', type, 'categoryId', category_id)
      into v_author_id, v_snapshot
      from public.pins where id = p_target_id;
    when 'pin_comment' then
      select author_id,
        jsonb_build_object('content', body, 'pinId', pin_id)
      into v_author_id, v_snapshot
      from public.pin_comments where id = p_target_id;
    when 'forum_thread' then
      select author_id,
        jsonb_build_object('title', title, 'content', content, 'facultyId', faculty_id)
      into v_author_id, v_snapshot
      from public.forum_threads where id = p_target_id;
    when 'forum_comment' then
      select author_id,
        jsonb_build_object('content', content, 'threadId', thread_id, 'parentCommentId', parent_comment_id)
      into v_author_id, v_snapshot
      from public.forum_comments where id = p_target_id;
  end case;

  if v_snapshot is null then raise exception 'El contenido ya no existe'; end if;
  if v_author_id = v_reporter then raise exception 'No puedes reportar tu propio contenido'; end if;

  insert into public.content_reports (
    target_type, target_id, reporter_id, reason, details, snapshot
  ) values (
    p_target_type, p_target_id, v_reporter, p_reason, nullif(trim(p_details), ''), v_snapshot
  ) returning id into v_report_id;

  return v_report_id;
end;
$fn$;

create or replace function public.claim_moderation_report(p_report_id uuid)
returns public.content_reports
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_report public.content_reports;
begin
  if public.user_role() <> 'admin' then raise exception 'Acceso exclusivo para administradores'; end if;

  update public.content_reports
  set status = 'reviewing', assigned_to = auth.uid()
  where id = p_report_id and status in ('pending', 'reviewing')
    and (assigned_to is null or assigned_to = auth.uid())
  returning * into v_report;

  if v_report.id is null then raise exception 'El reporte ya está asignado o resuelto'; end if;
  return v_report;
end;
$fn$;

create or replace function public.resolve_moderation_report(
  p_report_id uuid,
  p_action    text,
  p_note      text default null
)
returns public.content_reports
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_report public.content_reports;
begin
  if public.user_role() <> 'admin' then raise exception 'Acceso exclusivo para administradores'; end if;
  if p_action not in ('dismiss', 'delete') then raise exception 'Acción inválida'; end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'La nota no puede superar 1000 caracteres'; end if;

  select * into v_report from public.content_reports where id = p_report_id for update;
  if v_report.id is null then raise exception 'Reporte inexistente'; end if;
  if v_report.status in ('resolved', 'dismissed') then raise exception 'El reporte ya fue resuelto'; end if;

  if p_action = 'delete' then
    case v_report.target_type
      when 'pin' then delete from public.pins where id = v_report.target_id;
      when 'pin_comment' then delete from public.pin_comments where id = v_report.target_id;
      when 'forum_thread' then delete from public.forum_threads where id = v_report.target_id;
      when 'forum_comment' then delete from public.forum_comments where id = v_report.target_id;
    end case;
  end if;

  update public.content_reports
  set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end,
      assigned_to = auth.uid(),
      resolution_action = p_action,
      resolution_note = nullif(trim(p_note), ''),
      resolved_at = now()
  where id = p_report_id
  returning * into v_report;

  perform public.create_notification(
    v_report.reporter_id,
    'moderation_update',
    'profile',
    'Revisión de reporte completada',
    case when p_action = 'delete'
      then 'El contenido reportado fue eliminado.'
      else 'El reporte fue revisado y descartado.'
    end,
    '/perfil',
    'moderation_update:' || v_report.id::text,
    jsonb_build_object('reportId', v_report.id, 'action', p_action),
    auth.uid(),
    'personal'
  );

  return v_report;
end;
$fn$;


-- =============================================================================
-- 6. TRIGGERS
-- =============================================================================

-- Alta de usuario (sobre el esquema auth, gestionado por Supabase).
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Pines
drop trigger if exists trg_prevent_occupied_pin_location_insert on public.pins;
create trigger trg_prevent_occupied_pin_location_insert
  before insert on public.pins
  for each row execute function public.prevent_occupied_pin_location();

drop trigger if exists trg_prevent_occupied_pin_location_update on public.pins;
create trigger trg_prevent_occupied_pin_location_update
  before update of lat, lng, floor on public.pins
  for each row execute function public.prevent_occupied_pin_location();

drop trigger if exists trg_protect_pin_sensitive_fields on public.pins;
create trigger trg_protect_pin_sensitive_fields
  before update on public.pins
  for each row execute function public.protect_pin_sensitive_fields();

drop trigger if exists trg_protect_pin_vote_counters on public.pins;
create trigger trg_protect_pin_vote_counters
  before update of votes_up, votes_down on public.pins
  for each row execute function public.protect_vote_counters();

drop trigger if exists on_pin_badge on public.pins;
create trigger on_pin_badge
  after insert or delete on public.pins
  for each row execute function public.on_pin_badge_trigger();

-- Perfiles
drop trigger if exists trg_protect_profile_privileged_fields on public.profiles;
create trigger trg_protect_profile_privileged_fields
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_fields();

drop trigger if exists on_profile_badge on public.profiles;
create trigger on_profile_badge
  after update on public.profiles
  for each row execute function public.on_profile_badge_trigger();

-- Fotos
drop trigger if exists on_pin_photo_badge on public.pin_photos;
create trigger on_pin_photo_badge
  after insert or delete on public.pin_photos
  for each row execute function public.on_pin_photo_badge_trigger();

drop trigger if exists trg_enforce_pin_photo_limit on public.pin_photos;
create trigger trg_enforce_pin_photo_limit
  after insert on public.pin_photos
  for each row execute function public.enforce_pin_photo_limit();

drop trigger if exists trg_enforce_place_photo_limit on public.place_photos;
create trigger trg_enforce_place_photo_limit
  after insert on public.place_photos
  for each row execute function public.enforce_place_photo_limit();

drop trigger if exists on_pin_photo_deleted on public.pin_photos;
create trigger on_pin_photo_deleted
  after delete on public.pin_photos
  for each row execute function public.enqueue_pin_photo_cleanup();

drop trigger if exists on_place_photo_deleted on public.place_photos;
create trigger on_place_photo_deleted
  after delete on public.place_photos
  for each row execute function public.enqueue_place_photo_cleanup();

-- Votos
drop trigger if exists on_pin_vote_karma on public.pin_votes;
create trigger on_pin_vote_karma
  after insert or delete or update on public.pin_votes
  for each row execute function public.on_pin_vote_change_karma();

drop trigger if exists on_pin_vote_badge on public.pin_votes;
create trigger on_pin_vote_badge
  after insert or delete on public.pin_votes
  for each row execute function public.on_pin_vote_badge_trigger();

drop trigger if exists on_forum_vote_karma on public.forum_votes;
create trigger on_forum_vote_karma
  after insert or delete or update on public.forum_votes
  for each row execute function public.on_forum_vote_change_karma();

drop trigger if exists on_forum_vote_badge on public.forum_votes;
create trigger on_forum_vote_badge
  after insert or delete on public.forum_votes
  for each row execute function public.on_forum_vote_badge_trigger();

-- Foro
drop trigger if exists trg_protect_thread_privileged_fields on public.forum_threads;
create trigger trg_protect_thread_privileged_fields
  before update on public.forum_threads
  for each row execute function public.protect_thread_privileged_fields();

drop trigger if exists trg_protect_forum_vote_counters on public.forum_threads;
create trigger trg_protect_forum_vote_counters
  before update of votes_up, votes_down on public.forum_threads
  for each row execute function public.protect_vote_counters();

drop trigger if exists on_forum_comment_notification on public.forum_comments;
create trigger on_forum_comment_notification
  after insert on public.forum_comments
  for each row execute function public.notify_forum_reply();

-- Eventos
drop trigger if exists trg_validate_rsvp_targets_event on public.event_rsvps;
create trigger trg_validate_rsvp_targets_event
  before insert or update of pin_id on public.event_rsvps
  for each row execute function public.validate_rsvp_targets_event();

drop trigger if exists on_event_rsvp_notification on public.event_rsvps;
create trigger on_event_rsvp_notification
  after insert or update of status on public.event_rsvps
  for each row execute function public.notify_event_rsvp_in_window();

-- Insignias
drop trigger if exists on_user_badge_notification on public.user_badges;
create trigger on_user_badge_notification
  after insert on public.user_badges
  for each row execute function public.notify_badge_awarded();

-- Notificaciones y moderación
drop trigger if exists on_notification_queue_push on public.notifications;
create trigger on_notification_queue_push
  after insert on public.notifications
  for each row execute function public.queue_notification_push();

drop trigger if exists content_reports_updated_at on public.content_reports;
create trigger content_reports_updated_at
  before update on public.content_reports
  for each row execute function public.set_notification_updated_at();

drop trigger if exists on_content_report_notification on public.content_reports;
create trigger on_content_report_notification
  after insert on public.content_reports
  for each row execute function public.notify_admins_about_report();

drop trigger if exists buildings_updated_at on public.buildings;
create trigger buildings_updated_at
  before update on public.buildings
  for each row execute function public.set_notification_updated_at();

drop trigger if exists areas_updated_at on public.areas;
create trigger areas_updated_at
  before update on public.areas
  for each row execute function public.set_notification_updated_at();

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_notification_updated_at();


-- =============================================================================
-- 7. VISTA PÚBLICA DE PERFILES
-- =============================================================================
-- profiles no expone SELECT de tabla a anon ni a authenticated: el acceso va
-- por permisos de columna (sección 9) y por esta vista, que deja fuera el
-- correo. security_invoker = true hace que se apliquen los permisos y las
-- políticas de quien consulta, no las del dueño de la vista.

create or replace view public.profiles_public
  with (security_invoker = true)
  as
  select id, name, avatar_url, role, karma, faculty_id, career, year, created_at
  from public.profiles;


-- =============================================================================
-- 8. ROW LEVEL SECURITY
-- =============================================================================
-- RLS activo en las 23 tablas. Dos de ellas quedan a propósito sin ninguna
-- política (pin_creation_events y notification_push_deliveries): son internas,
-- solo las tocan funciones SECURITY DEFINER y service_role.
--
-- Las políticas usan el rol `public` de Postgres (todos los roles) y filtran
-- por user_role(), no por el rol de conexión. Un guest es un usuario sin fila
-- en profiles, no un rol de base de datos.

alter table public.campuses                     enable row level security;
alter table public.faculties                    enable row level security;
alter table public.careers                      enable row level security;
alter table public.buildings                    enable row level security;
alter table public.building_floors              enable row level security;
alter table public.areas                        enable row level security;
alter table public.categories                   enable row level security;
alter table public.badges                       enable row level security;
alter table public.admin_emails                 enable row level security;
alter table public.profiles                     enable row level security;
alter table public.pins                         enable row level security;
alter table public.pin_photos                   enable row level security;
alter table public.place_photos                 enable row level security;
alter table public.pin_comments                 enable row level security;
alter table public.pin_schedule_items            enable row level security;
alter table public.floor_plans                  enable row level security;
alter table public.pin_votes                    enable row level security;
alter table public.favorites                    enable row level security;
alter table public.event_rsvps                  enable row level security;
alter table public.pin_creation_events          enable row level security;
alter table public.forum_threads                enable row level security;
alter table public.forum_comments               enable row level security;
alter table public.forum_votes                  enable row level security;
alter table public.user_badges                  enable row level security;
alter table public.content_reports              enable row level security;
alter table public.notifications                enable row level security;
alter table public.push_subscriptions           enable row level security;
alter table public.notification_push_deliveries enable row level security;
alter table public.storage_cleanup_queue         enable row level security;


-- ── 8.1 Catálogo: lo lee todo el mundo, lo escribe un admin ─────────────────

drop policy if exists campuses_read on public.campuses;
create policy campuses_read on public.campuses for select using (true);

drop policy if exists faculties_read on public.faculties;
create policy faculties_read on public.faculties for select using (true);

-- El catálogo lo escribe un admin desde /admin/mapeo: crear una facultad y
-- trazar su perímetro. El WITH CHECK va explícito aunque el FOR ALL lo derive
-- de su USING, porque esta tabla sí se escribe desde la app.
drop policy if exists faculties_admin on public.faculties;
create policy faculties_admin on public.faculties
  for all using (public.user_role() = 'admin')
  with check (public.user_role() = 'admin');

-- Galerías: lectura pública, escritura solo admin. La comprobación va aquí y
-- no solo en el cliente: esconder el botón de editar no impide llamar al
-- endpoint.
drop policy if exists place_photos_read on public.place_photos;
create policy place_photos_read on public.place_photos for select using (true);

drop policy if exists place_photos_admin on public.place_photos;
create policy place_photos_admin on public.place_photos
  for all using (public.user_role() = 'admin');

drop policy if exists careers_read on public.careers;
create policy careers_read on public.careers for select using (true);

drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);

drop policy if exists badges_read_all on public.badges;
create policy badges_read_all on public.badges for select using (true);

drop policy if exists floor_plans_read on public.floor_plans;
create policy floor_plans_read on public.floor_plans for select using (true);

drop policy if exists floor_plans_admin on public.floor_plans;
create policy floor_plans_admin on public.floor_plans
  for all using (public.user_role() = any (array['moderator', 'admin']));

-- Mapeo interior: lo lee todo el mundo, incluido un invitado, porque sin eso el
-- mapa no puede dibujar el interior de un edificio. Lo escribe quien modera.
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

-- La lista de correos con rol admin solo la ve un admin.
drop policy if exists admin_emails_admin on public.admin_emails;
create policy admin_emails_admin on public.admin_emails
  for select using (public.user_role() = 'admin');


-- ── 8.2 Perfiles ────────────────────────────────────────────────────────────
-- Tres políticas de lectura que se suman (son permissive): cualquiera ve las
-- filas, y las columnas sensibles las corta el permiso de columna, no la RLS.

drop policy if exists profiles_read_public on public.profiles;
create policy profiles_read_public on public.profiles for select using (true);

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select using (id = auth.uid());

drop policy if exists profiles_read_admin on public.profiles;
create policy profiles_read_admin on public.profiles
  for select using (public.user_role() = 'admin');

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Creada a mano en el dashboard, no venía de ninguna migración. Permite al
-- admin editar cualquier perfil desde el panel.
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles
  for update using (public.user_role() = 'admin');


-- ── 8.3 Pines ───────────────────────────────────────────────────────────────
-- No hay política de INSERT: crear un pin pasa obligatoriamente por
-- create_pin_with_daily_limit.

drop policy if exists pins_read on public.pins;
create policy pins_read on public.pins for select using (true);

drop policy if exists pins_owner_update on public.pins;
create policy pins_owner_update on public.pins
  for update using (creator_id = auth.uid()) with check (creator_id = auth.uid());

drop policy if exists pins_mod_update on public.pins;
create policy pins_mod_update on public.pins
  for update using (public.user_role() = any (array['moderator', 'admin']));

drop policy if exists pins_owner_delete on public.pins;
create policy pins_owner_delete on public.pins
  for delete using (
    creator_id = auth.uid()
    or public.user_role() = any (array['moderator', 'admin'])
  );


-- ── 8.4 Fotos de pines ──────────────────────────────────────────────────────

drop policy if exists photos_read on public.pin_photos;
create policy photos_read on public.pin_photos for select using (true);

drop policy if exists photos_insert on public.pin_photos;
create policy photos_insert on public.pin_photos
  for insert with check (
    public.user_role() <> 'guest'
    and (
      exists (select 1 from public.pins where pins.id = pin_photos.pin_id and pins.creator_id = auth.uid())
      or public.user_role() = any (array['moderator', 'admin'])
    )
  );

drop policy if exists photos_delete on public.pin_photos;
create policy photos_delete on public.pin_photos
  for delete using (
    exists (select 1 from public.pins where pins.id = pin_photos.pin_id and pins.creator_id = auth.uid())
    or public.user_role() = any (array['moderator', 'admin'])
  );


-- ── 8.5 Comentarios de pines ────────────────────────────────────────────────

drop policy if exists comments_read on public.pin_comments;
create policy comments_read on public.pin_comments for select using (true);

drop policy if exists comments_write on public.pin_comments;
create policy comments_write on public.pin_comments
  for insert with check (
    auth.uid() is not null
    and author_id = auth.uid()
    and public.user_role() <> 'guest'
  );

drop policy if exists comments_delete on public.pin_comments;
create policy comments_delete on public.pin_comments
  for delete using (
    author_id = auth.uid()
    or public.user_role() = any (array['moderator', 'admin'])
  );


-- ── 8.5.1 Programa de eventos ───────────────────────────────────────────────
-- Sin policy de update: el autor reemplaza el set completo (delete + insert),
-- igual que con las fotos del pin.

drop policy if exists schedule_read on public.pin_schedule_items;
create policy schedule_read on public.pin_schedule_items for select using (true);

drop policy if exists schedule_insert on public.pin_schedule_items;
create policy schedule_insert on public.pin_schedule_items
  for insert with check (
    public.user_role() <> 'guest'
    and (
      exists (select 1 from public.pins where pins.id = pin_schedule_items.pin_id and pins.creator_id = auth.uid())
      or public.user_role() = any (array['moderator', 'admin'])
    )
  );

drop policy if exists schedule_delete on public.pin_schedule_items;
create policy schedule_delete on public.pin_schedule_items
  for delete using (
    exists (select 1 from public.pins where pins.id = pin_schedule_items.pin_id and pins.creator_id = auth.uid())
    or public.user_role() = any (array['moderator', 'admin'])
  );


-- ── 8.6 Votos de pines ──────────────────────────────────────────────────────
-- Cada quien ve solo su propio voto; el recuento agregado vive en las columnas
-- votes_up / votes_down del pin.

drop policy if exists votes_read_own on public.pin_votes;
create policy votes_read_own on public.pin_votes for select using (user_id = auth.uid());

drop policy if exists votes_upsert on public.pin_votes;
create policy votes_upsert on public.pin_votes
  for insert with check (user_id = auth.uid() and public.user_role() <> 'guest');

drop policy if exists votes_update_own on public.pin_votes;
create policy votes_update_own on public.pin_votes
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());


-- ── 8.7 Favoritos y asistencia a eventos ────────────────────────────────────

drop policy if exists favorites_all_own on public.favorites;
create policy favorites_all_own on public.favorites
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.user_role() <> 'guest');

drop policy if exists event_rsvps_read on public.event_rsvps;
create policy event_rsvps_read on public.event_rsvps for select using (true);

drop policy if exists event_rsvps_all_own on public.event_rsvps;
create policy event_rsvps_all_own on public.event_rsvps
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.user_role() <> 'guest');


-- ── 8.8 Foro ────────────────────────────────────────────────────────────────
-- Marcar un hilo como oficial exige ser moderador y poner un nombre de entidad
-- no vacío; eso se valida en la propia política de INSERT.

drop policy if exists threads_read_all on public.forum_threads;
create policy threads_read_all on public.forum_threads for select using (true);

drop policy if exists threads_insert_auth on public.forum_threads;
create policy threads_insert_auth on public.forum_threads
  for insert with check (
    auth.uid() is not null
    and public.user_role() <> 'guest'
    and author_id = auth.uid()
    and (
      (coalesce(is_official, false) = false and official_entity_name is null)
      or (
        coalesce(is_official, false) = true
        and public.user_role() = any (array['moderator', 'admin'])
        and nullif(trim(both from official_entity_name), '') is not null
      )
    )
  );

drop policy if exists threads_update_owner_or_mod on public.forum_threads;
create policy threads_update_owner_or_mod on public.forum_threads
  for update using (
    author_id = auth.uid() or public.user_role() = any (array['moderator', 'admin'])
  ) with check (
    author_id = auth.uid() or public.user_role() = any (array['moderator', 'admin'])
  );

drop policy if exists threads_delete_owner_or_mod on public.forum_threads;
create policy threads_delete_owner_or_mod on public.forum_threads
  for delete using (
    author_id = auth.uid() or public.user_role() = any (array['moderator', 'admin'])
  );

drop policy if exists comments_read_all on public.forum_comments;
create policy comments_read_all on public.forum_comments for select using (true);

drop policy if exists comments_insert_auth on public.forum_comments;
create policy comments_insert_auth on public.forum_comments
  for insert with check (
    auth.uid() is not null
    and public.user_role() <> 'guest'
    and author_id = auth.uid()
  );

drop policy if exists comments_update_owner on public.forum_comments;
create policy comments_update_owner on public.forum_comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists comments_delete_owner_or_mod on public.forum_comments;
create policy comments_delete_owner_or_mod on public.forum_comments
  for delete using (
    author_id = auth.uid() or public.user_role() = any (array['moderator', 'admin'])
  );

drop policy if exists votes_read_own on public.forum_votes;
create policy votes_read_own on public.forum_votes for select using (user_id = auth.uid());

drop policy if exists votes_insert_own on public.forum_votes;
create policy votes_insert_own on public.forum_votes
  for insert with check (user_id = auth.uid() and public.user_role() <> 'guest');

drop policy if exists votes_update_own on public.forum_votes;
create policy votes_update_own on public.forum_votes
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.user_role() <> 'guest');

drop policy if exists votes_delete_own on public.forum_votes;
create policy votes_delete_own on public.forum_votes
  for delete using (user_id = auth.uid());


-- ── 8.9 Insignias ───────────────────────────────────────────────────────────
-- Se leen públicamente (aparecen en el perfil de cualquiera) y solo las
-- conceden funciones internas.

drop policy if exists user_badges_read_all on public.user_badges;
create policy user_badges_read_all on public.user_badges for select using (true);


-- ── 8.10 Moderación y notificaciones ────────────────────────────────────────

drop policy if exists content_reports_read_own_or_admin on public.content_reports;
create policy content_reports_read_own_or_admin on public.content_reports
  for select using (reporter_id = auth.uid() or public.user_role() = 'admin');

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete using (user_id = auth.uid());

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.user_role() <> 'guest');


-- =============================================================================
-- 9. PERMISOS
-- =============================================================================
-- Supabase concede por defecto ALL sobre todo public a anon y authenticated,
-- de modo que RLS es lo único que separa a un anónimo de cada tabla. Aquí se
-- fija explícitamente qué tiene cada rol, en vez de heredarlo.

-- 9.1 Catálogo y contenido público: permisos por defecto de Supabase.
grant all on public.campuses      to anon, authenticated;
grant all on public.faculties     to anon, authenticated;
grant all on public.careers       to anon, authenticated;
grant all on public.categories    to anon, authenticated;
grant all on public.badges        to anon, authenticated;
grant all on public.admin_emails  to anon, authenticated;
grant all on public.floor_plans   to anon, authenticated;
grant all on public.buildings       to anon, authenticated;
grant all on public.building_floors to anon, authenticated;
grant all on public.areas           to anon, authenticated;
grant all on public.pins          to anon, authenticated;
grant all on public.pin_photos    to anon, authenticated;
grant all on public.place_photos  to anon, authenticated;
grant all on public.pin_comments  to anon, authenticated;
grant all on public.pin_schedule_items to anon, authenticated;
grant all on public.favorites     to anon, authenticated;
grant all on public.event_rsvps   to anon, authenticated;
grant all on public.forum_threads to anon, authenticated;
grant all on public.forum_comments to anon, authenticated;
grant all on public.user_badges   to anon, authenticated;
grant all on public.profiles_public to anon, authenticated;

-- 9.2 Votos.
-- ATENCIÓN: la migración 20260721000003 revocó INSERT/UPDATE/DELETE a anon y
-- authenticated sobre estas dos tablas, para que votar pasara solo por las RPC
-- vote_pin y vote_thread. En producción los permisos están otra vez completos:
-- alguien reaplicó un GRANT masivo sobre el esquema public. Se reproduce el
-- estado real; el candado se restaura en la tanda de arreglos.
grant all on public.pin_votes   to anon, authenticated;
grant all on public.forum_votes to anon, authenticated;

-- 9.3 Perfiles: sin SELECT de tabla. La lectura va por columnas, de modo que
-- el correo solo lo ve un usuario autenticado y nunca un anónimo.
revoke select on public.profiles from anon, authenticated;
grant insert, update, delete, truncate, references, trigger on public.profiles to anon, authenticated;
grant select (id, name, avatar_url, role, karma, faculty_id, career, year, created_at, email)
  on public.profiles to authenticated;
grant select (id, name, avatar_url, role, karma, faculty_id, career, year, created_at)
  on public.profiles to anon;

-- 9.4 Tablas donde escribir pasa siempre por una RPC.
revoke all on public.content_reports    from anon, authenticated;
grant select, references, trigger, truncate on public.content_reports to authenticated;

revoke all on public.notifications from anon, authenticated;
grant select, delete, references, trigger, truncate on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete, references, trigger, truncate on public.push_subscriptions to authenticated;

-- 9.5 Tablas internas: ni anon ni authenticated las ven.
revoke all on public.pin_creation_events          from anon, authenticated;
revoke all on public.notification_push_deliveries from anon, authenticated;
revoke all on public.storage_cleanup_queue        from anon, authenticated;
revoke all on sequence public.storage_cleanup_queue_id_seq from anon, authenticated;

-- 9.6 Secuencias.
grant usage, select on all sequences in schema public to anon, authenticated, service_role;

-- 9.7 EXECUTE. Por defecto Postgres concede EXECUTE a PUBLIC en cada función
-- nueva, así que hay que revocarlo explícitamente y volver a conceder solo lo
-- necesario. Las funciones internas (karma, insignias, notificaciones,
-- protecciones) no las puede invocar nadie desde la API.

revoke execute on all functions in schema public from public, anon, authenticated;

-- Cualquiera, incluido un visitante sin sesión.
grant execute on function public.user_role() to public, anon, authenticated, service_role;
grant execute on function public.protect_vote_counters() to public, anon, authenticated, service_role;
grant execute on function public.set_notification_updated_at() to public, anon, authenticated, service_role;
grant execute on function public.prevent_occupied_pin_location() to anon, authenticated, service_role;
grant execute on function public.validate_rsvp_targets_event() to anon, authenticated, service_role;
grant execute on function public.create_pin_with_daily_limit(
  public.pin_type, text, text, text, text, double precision, double precision,
  boolean, text, timestamptz, timestamptz, timestamptz, integer, text, uuid, text
) to anon, authenticated, service_role;

-- Solo con sesión iniciada.
grant execute on function public.vote_pin(uuid, smallint)                    to authenticated, service_role;
grant execute on function public.vote_thread(uuid, integer)                  to authenticated, service_role;
grant execute on function public.extend_pin_ttl(uuid, integer)               to authenticated, service_role;
grant execute on function public.verify_and_make_permanent(uuid, text)       to authenticated, service_role;
grant execute on function public.unverify_pin(uuid, integer)                 to authenticated, service_role;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated, service_role;
grant execute on function public.create_content_report(text, uuid, text, text)      to authenticated, service_role;
grant execute on function public.claim_moderation_report(uuid)               to authenticated, service_role;
grant execute on function public.resolve_moderation_report(uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_set_user_role(uuid, text)             to authenticated, service_role;
grant execute on function public.admin_count_push_subscribers()              to authenticated, service_role;
grant execute on function public.admin_broadcast_push_notification(text, text) to authenticated, service_role;

-- Solo el servicio (cron y Edge Functions).
grant execute on function public.enqueue_upcoming_event_notifications() to service_role;


-- =============================================================================
-- 10. STORAGE
-- =============================================================================
-- Un único bucket público. La ruta es pins/{user_id}/{uuid}.jpg y las
-- políticas se apoyan en ese segundo segmento para saber de quién es el
-- archivo: por eso la ruta no es libre.
--
-- Hoy el bucket no impone límite de tamaño ni lista de tipos permitidos: la
-- compresión a 1200 px y JPEG 0.75 ocurre solo en el navegador.

insert into storage.buckets (id, name, public)
values ('pin-photos', 'pin-photos', true)
on conflict (id) do nothing;

drop policy if exists pin_photos_public_read on storage.objects;
create policy pin_photos_public_read on storage.objects
  for select using (bucket_id = 'pin-photos');

drop policy if exists pin_photos_upload on storage.objects;
create policy pin_photos_upload on storage.objects
  for insert with check (
    bucket_id = 'pin-photos'
    and public.user_role() <> 'guest'
    and (storage.foldername(name))[1] = 'pins'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists pin_photos_delete_own on storage.objects;
create policy pin_photos_delete_own on storage.objects
  for delete using (
    bucket_id = 'pin-photos'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or public.user_role() = any (array['moderator', 'admin'])
    )
  );

drop policy if exists place_photos_upload on storage.objects;
create policy place_photos_upload on storage.objects
  for insert with check (
    bucket_id = 'pin-photos'
    and public.user_role() = 'admin'
    and (storage.foldername(name))[1] = 'places'
  );

drop policy if exists place_photos_delete on storage.objects;
create policy place_photos_delete on storage.objects
  for delete using (
    bucket_id = 'pin-photos'
    and public.user_role() = 'admin'
    and (storage.foldername(name))[1] = 'places'
  );


-- =============================================================================
-- 11. REALTIME
-- =============================================================================
-- Tablas que emiten eventos por websocket a los clientes suscritos.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

alter publication supabase_realtime add table public.pins;
alter publication supabase_realtime add table public.pin_comments;
alter publication supabase_realtime add table public.forum_threads;
alter publication supabase_realtime add table public.forum_comments;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.content_reports;


-- =============================================================================
-- 12. TAREAS PROGRAMADAS (no se crean aquí)
-- =============================================================================
-- Los dos cron jobs no van en este archivo porque uno depende de secretos de
-- Vault, que están cifrados y no se pueden exportar. Se crean a mano después
-- de un reset; el procedimiento completo está en docs/DATABASE.md.
--
--   #1  expire-pins                    cada 30 min
--       delete from pins where is_permanent = false and expires_at < now()
--
--   #2  udp-map-send-push-every-minute cada minuto
--       net.http_post a la Edge Function send-push, leyendo de Vault los
--       secretos udp_map_project_url y udp_map_send_push_cron_secret
--
--   #3  udp-map-storage-gc             cada 10 min
--       net.http_post a la Edge Function storage-gc, que vacía
--       storage_cleanup_queue. Reutiliza los mismos dos secretos.
--       Su SQL está en supabase/migrations/20260803120500_schedule_storage_gc.sql
--
-- =============================================================================
-- FIN DEL BASELINE
-- =============================================================================
