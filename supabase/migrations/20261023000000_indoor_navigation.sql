-- ============================================================================
-- Grafo de navegación interior: "cómo llegar" hasta la puerta de una sala.
--
-- Un NODO es un punto donde la persona puede estar o decidir (un tramo de
-- pasillo, una puerta, el descanso de una escalera); una ARISTA, un tramo que
-- se puede recorrer. El grafo es explícito y no se deduce de los polígonos de
-- `areas`: inferir pasillos a partir de la geometría es frágil, y un grafo de
-- unas decenas de nodos por planta se rutea y se prueba sin esfuerzo. El
-- editor de /admin/mapeo genera casi todo a partir del eje del pasillo y de las
-- puertas.
--
-- Las aristas NO tienen sentido: (a, b) y (b, a) son la misma y el índice
-- único lo impone. Las verticales (escalera, ascensor) las genera el editor
-- uniendo los nodos que comparten `shaft` en plantas consecutivas.
--
-- El exterior usa el mismo modelo que `areas`: building_id y floor null a la
-- vez. La ruta de la calle hasta la entrada no vive aquí: la pide el cliente a
-- ORS/OSRM solo para la entrada elegida.
--
-- Lectura pública, como el resto del mapeo: sin ella el mapa de un invitado no
-- puede calcular una ruta. Escritura con la capacidad `mapping`.
--
-- REQUIERE 20260831000200 (has_capability).
-- APLICAR A MANO. Deshacer: 20261023000000_indoor_navigation.down.sql
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'nav_node_kind') then
    create type public.nav_node_kind as enum (
      'walk',      -- punto de pasillo, hall o lobby
      'door',      -- vano de puerta (de sala, de núcleo o interior)
      'room',      -- dentro de una sala: es el destino de una ruta
      'stairs',    -- descanso de escalera en una planta
      'elevator',  -- cabina de ascensor en una planta
      'entrance',  -- puerta de fachada: donde se empalma la ruta de calle
      'outdoor'    -- punto exterior (patio, vereda)
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'nav_edge_kind') then
    create type public.nav_edge_kind as enum ('walk', 'stairs', 'elevator');
  end if;
end $$;

create table if not exists public.nav_nodes (
  id           uuid         primary key default gen_random_uuid(),
  faculty_id   text         not null references public.faculties(id) on delete cascade,
  building_id  text         references public.buildings(id) on delete cascade,
  floor        integer,
  kind         public.nav_node_kind not null,
  lng          double precision not null,
  lat          double precision not null,
  -- Lo que la persona ve en este punto, con su artículo: "los torniquetes",
  -- "el pasillo, frente a los baños". Alimenta las instrucciones.
  landmark     text         check (landmark is null or char_length(landmark) <= 80),
  -- Solo exterior: por dónde se camina hasta aquí ("la vereda de Vergara").
  via          text         check (via is null or char_length(via) <= 80),
  -- Sala a la que pertenece un nodo `room` o `door`.
  area_id      uuid         references public.areas(id) on delete set null,
  -- Llave con pins.room_code. Se compara normalizado (mayúsculas, espacios
  -- colapsados); se guarda como se escribió, igual que en pins.
  room_code    text         check (room_code is null or char_length(room_code) between 1 and 40),
  -- Núcleo vertical ("ESC-A", "ASC-1") que agrupa sus nodos entre plantas.
  shaft        text         check (shaft is null or char_length(shaft) <= 20),
  -- Ancho del vano: dibuja la puerta y corta el muro en la vista 3D.
  width_m      numeric      check (width_m is null or (width_m > 0 and width_m <= 10)),
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),

  constraint nav_nodes_floor_coherent check (
    (building_id is null and floor is null) or
    (building_id is not null and floor is not null)
  ),
  constraint nav_nodes_floor_fkey foreign key (building_id, floor)
    references public.building_floors(building_id, level) on delete cascade,
  constraint nav_nodes_vertical_has_shaft check (
    kind not in ('stairs', 'elevator') or shaft is not null
  )
);

create table if not exists public.nav_edges (
  id          uuid     primary key default gen_random_uuid(),
  faculty_id  text     not null references public.faculties(id) on delete cascade,
  a           uuid     not null references public.nav_nodes(id) on delete cascade,
  b           uuid     not null references public.nav_nodes(id) on delete cascade,
  kind        public.nav_edge_kind not null default 'walk',
  -- false = no apta para silla de ruedas (escalones, torniquete sin pase ancho).
  -- Una escalera nunca lo es; el check lo impone.
  step_free   boolean  not null default true,
  constraint nav_edges_not_loop check (a <> b),
  constraint nav_edges_stairs_not_step_free check (kind <> 'stairs' or step_free = false)
);

create unique index if not exists nav_edges_pair_uniq
  on public.nav_edges (least(a, b), greatest(a, b));
create index if not exists nav_nodes_faculty_idx on public.nav_nodes (faculty_id);
create index if not exists nav_nodes_building_floor_idx on public.nav_nodes (building_id, floor);
create index if not exists nav_nodes_room_code_idx
  on public.nav_nodes (upper(room_code)) where room_code is not null;
create index if not exists nav_nodes_area_idx on public.nav_nodes (area_id) where area_id is not null;
create index if not exists nav_edges_faculty_idx on public.nav_edges (faculty_id);
create index if not exists nav_edges_b_idx on public.nav_edges (b);

drop trigger if exists nav_nodes_updated_at on public.nav_nodes;
create trigger nav_nodes_updated_at
  before update on public.nav_nodes
  for each row execute function public.set_notification_updated_at();

alter table public.nav_nodes enable row level security;
alter table public.nav_edges enable row level security;

drop policy if exists nav_nodes_read on public.nav_nodes;
create policy nav_nodes_read on public.nav_nodes for select using (true);

drop policy if exists nav_nodes_write on public.nav_nodes;
create policy nav_nodes_write on public.nav_nodes
  for all using (public.has_capability('mapping'))
  with check (public.has_capability('mapping'));

drop policy if exists nav_edges_read on public.nav_edges;
create policy nav_edges_read on public.nav_edges for select using (true);

drop policy if exists nav_edges_write on public.nav_edges;
create policy nav_edges_write on public.nav_edges
  for all using (public.has_capability('mapping'))
  with check (public.has_capability('mapping'));

grant all on public.nav_nodes to anon, authenticated;
grant all on public.nav_edges to anon, authenticated;
