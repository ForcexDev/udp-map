-- ═══════════════════════════════════════════════════════════════
-- Sprint 2 — Motor de pines: fotos, comentarios, votos, favoritos,
-- planos indoor, RPCs seguros, expiración y Storage
-- ═══════════════════════════════════════════════════════════════

-- ── Satélites (sirven a los 3 tipos por pin_id, plan §6) ──
create table pin_photos (
  id         uuid primary key default gen_random_uuid(),
  pin_id     uuid not null references pins on delete cascade,
  url        text not null,
  width      int,
  height     int,
  created_at timestamptz not null default now()
);
create index pin_photos_pin_idx on pin_photos (pin_id);

create table pin_comments (
  id         uuid primary key default gen_random_uuid(),
  pin_id     uuid not null references pins on delete cascade, -- mueren con el pin
  author_id  uuid references profiles on delete set null,
  body       text not null check (char_length(body) between 1 and 400),
  created_at timestamptz not null default now()
);
create index pin_comments_pin_created_idx on pin_comments (pin_id, created_at desc);

create table pin_votes (
  pin_id  uuid not null references pins on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  value   smallint not null check (value in (1, -1)),
  primary key (pin_id, user_id)          -- 1 voto por usuario por pin
);

create table favorites (
  user_id uuid not null references profiles on delete cascade,
  pin_id  uuid not null references pins on delete cascade,
  primary key (user_id, pin_id)
);

create table floor_plans (
  id            uuid primary key default gen_random_uuid(),
  place_pin_id  uuid references pins on delete set null,
  faculty_id    text references faculties,
  building      text not null,
  floor         int not null,
  geojson       jsonb not null,
  bounds        jsonb,
  image_overlay text
);

-- ═══ RLS ═══
alter table pin_photos   enable row level security;
alter table pin_comments enable row level security;
alter table pin_votes    enable row level security;
alter table favorites    enable row level security;
alter table floor_plans  enable row level security;

-- Fotos: lectura pública; inserta el dueño del pin; borra dueño o mod/admin
create policy "photos_read" on pin_photos for select using (true);
create policy "photos_insert" on pin_photos for insert with check (
  public.user_role() <> 'guest'
  and exists (select 1 from pins where id = pin_id and creator_id = auth.uid())
);
create policy "photos_delete" on pin_photos for delete using (
  exists (select 1 from pins where id = pin_id and creator_id = auth.uid())
  or public.user_role() in ('moderator', 'admin')
);

-- Comentarios: leer todos; escribir autenticado no-guest; borrar propio o mod/admin
create policy "comments_read" on pin_comments for select using (true);
create policy "comments_write" on pin_comments for insert with check (
  auth.uid() is not null
  and author_id = auth.uid()
  and public.user_role() <> 'guest'
);
create policy "comments_delete" on pin_comments for delete using (
  author_id = auth.uid() or public.user_role() in ('moderator', 'admin')
);

-- Votos: cada usuario ve/gestiona su fila (el conteo vive en pins)
create policy "votes_read_own" on pin_votes for select using (user_id = auth.uid());
create policy "votes_upsert" on pin_votes for insert with check (
  user_id = auth.uid() and public.user_role() <> 'guest'
);
create policy "votes_update_own" on pin_votes for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Favoritos: privados de cada usuario
create policy "favorites_all_own" on favorites for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.user_role() <> 'guest');

-- Planos indoor: lectura pública, gestión mod/admin
create policy "floor_plans_read" on floor_plans for select using (true);
create policy "floor_plans_admin" on floor_plans for all
  using (public.user_role() in ('moderator', 'admin'));

-- ── RPC: voto atómico, 1 por usuario (reemplaza localStorage v1, plan §6) ──
create or replace function public.vote_pin(p_pin uuid, p_value smallint)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or public.user_role() = 'guest' then
    raise exception 'Debes iniciar sesión con tu correo UDP para votar';
  end if;
  if p_value not in (1, -1) then
    raise exception 'Voto inválido';
  end if;

  insert into pin_votes (pin_id, user_id, value)
  values (p_pin, auth.uid(), p_value)
  on conflict (pin_id, user_id) do update set value = excluded.value;

  update pins set
    votes_up   = (select count(*) from pin_votes where pin_id = p_pin and value = 1),
    votes_down = (select count(*) from pin_votes where pin_id = p_pin and value = -1)
  where id = p_pin;
end;
$$;

-- ── RPC: hacer permanente un report (solo admin, plan §3) ──
create or replace function public.set_pin_permanent(p_pin uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo un admin puede hacer permanente un pin';
  end if;
  update pins set is_permanent = true, expires_at = null where id = p_pin;
end;
$$;

-- ── Expiración: pg_cron cada 30 min borra pines temporales vencidos ──
-- (cascade limpia fotos/comentarios/votos; los ARCHIVOS del Storage los
-- borra la Edge Function `expire-pins`, que debe correr ANTES — ver README)
create extension if not exists pg_cron;
select cron.schedule(
  'expire-pins',
  '*/30 * * * *',
  $$ delete from pins where is_permanent = false and expires_at < now() $$
);

-- ── Storage: bucket público de fotos, escritura por carpeta de usuario ──
insert into storage.buckets (id, name, public)
values ('pin-photos', 'pin-photos', true)
on conflict (id) do nothing;

-- Ruta esperada: pins/{userId}/{uuid}.jpg
drop policy if exists "pin_photos_upload" on storage.objects;
create policy "pin_photos_upload" on storage.objects for insert with check (
  bucket_id = 'pin-photos'
  and public.user_role() <> 'guest'
  and (storage.foldername(name))[1] = 'pins'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "pin_photos_public_read" on storage.objects;
create policy "pin_photos_public_read" on storage.objects for select
  using (bucket_id = 'pin-photos');

drop policy if exists "pin_photos_delete_own" on storage.objects;
create policy "pin_photos_delete_own" on storage.objects for delete using (
  bucket_id = 'pin-photos'
  and ((storage.foldername(name))[2] = auth.uid()::text
       or public.user_role() in ('moderator', 'admin'))
);

-- ── Realtime para pines y comentarios (plan §7) ──
alter publication supabase_realtime add table pins;
alter publication supabase_realtime add table pin_comments;
