-- ═══════════════════════════════════════════════════════════════
-- Sprint 1 — Fundaciones: taxonomía, perfiles, pins (3 tipos) + RLS
-- ═══════════════════════════════════════════════════════════════

create type pin_type as enum ('place', 'event', 'report');

-- ── Taxonomía geográfica (migrada de constants.ts v1) ──
create table campuses (
  id   text primary key,
  name text not null,
  lat  double precision not null,
  lng  double precision not null
);

create table faculties (
  id        text primary key,
  name      text not null,
  name_en   text not null,
  campus_id text not null references campuses,
  lat       double precision not null,
  lng       double precision not null,
  polygon   jsonb,
  image     text
);

create table careers (
  id         serial primary key,
  faculty_id text not null references faculties,
  name       text not null,
  name_en    text not null
);

-- Categorías con TTL por categoría (plan §2: reports efímeros)
create table categories (
  id        text primary key,
  kind      text not null check (kind in ('report', 'event')),
  name      text not null,
  name_en   text not null,
  color     text not null,
  svg_path  text,
  ttl_hours int
);

-- ── Perfiles (extiende auth.users) ──
create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text unique not null,
  name       text,
  role       text not null default 'student'
             check (role in ('guest', 'student', 'moderator', 'admin')),
  faculty_id text references faculties,
  career     text,
  year       int,
  karma      int not null default 0,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Lista blanca de correos admin (plan §3)
create table admin_emails (email text primary key);

-- ── ★ Tabla central: pins (los 3 tipos) ──
create table pins (
  id           uuid primary key default gen_random_uuid(),
  type         pin_type not null,
  title        text not null check (char_length(title) between 3 and 80),
  description  text check (char_length(description) <= 500),
  category_id  text references categories,
  faculty_id   text references faculties,
  lat          double precision not null,
  lng          double precision not null,
  floor        int,
  building     text,
  creator_id   uuid references profiles on delete set null,
  votes_up     int not null default 0,
  votes_down   int not null default 0,
  reports      int not null default 0,
  is_permanent boolean not null default false,
  expires_at   timestamptz,           -- null si permanente; NOW()+TTL en report
  -- campos de evento (solo type='event', Sprint 3):
  starts_at    timestamptz,
  ends_at      timestamptz,
  is_official  boolean not null default false,
  created_at   timestamptz not null default now()  -- server-side, no Date.now() del cliente
);

create index pins_type_idx on pins (type);
create index pins_faculty_idx on pins (faculty_id);
create index pins_expires_idx on pins (expires_at);
create index pins_lat_lng_idx on pins (lat, lng);

-- ── Helper de rol (security definer para usar en RLS sin recursión) ──
create or replace function public.user_role()
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce((select role from profiles where id = auth.uid()), 'guest')
$$;

-- ── Trigger: crear profile al registrarse; solo @mail.udp.cl ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
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
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══ RLS ═══
alter table campuses     enable row level security;
alter table faculties    enable row level security;
alter table careers      enable row level security;
alter table categories   enable row level security;
alter table profiles     enable row level security;
alter table admin_emails enable row level security;
alter table pins         enable row level security;

-- Taxonomía: lectura pública, escritura solo admin
create policy "campuses_read"   on campuses   for select using (true);
create policy "faculties_read"  on faculties  for select using (true);
create policy "careers_read"    on careers    for select using (true);
create policy "categories_read" on categories for select using (true);
create policy "faculties_admin" on faculties  for all
  using (public.user_role() = 'admin');

-- Perfiles: lectura pública (nombres en comentarios), cada uno edita el suyo
-- (sin poder auto-promoverse de rol)
create policy "profiles_read" on profiles for select using (true);
create policy "profiles_update_own" on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.user_role());

-- admin_emails: solo visible para admins
create policy "admin_emails_admin" on admin_emails for select
  using (public.user_role() = 'admin');

-- ── Pins: lectura pública; escritura solo autenticados no-guest ──
create policy "pins_read" on pins for select using (true);

create policy "pins_insert" on pins for insert with check (
  auth.uid() is not null
  and creator_id = auth.uid()
  and public.user_role() <> 'guest'
  -- 'place' solo mod/admin (plan §3)
  and (type <> 'place' or public.user_role() in ('moderator', 'admin'))
  -- eventos oficiales solo mod/admin
  and (is_official = false or public.user_role() in ('moderator', 'admin'))
  -- is_permanent solo vía type='place' o RPC set_pin_permanent (admin)
  and (is_permanent = false or type = 'place')
);

-- El dueño edita lo suyo (sin tocar permanencia ni convertirlo en place)
create policy "pins_owner_update" on pins for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid() and type <> 'place' and is_permanent = false);

-- Mod/admin editan cualquier pin (moderación, lugares)
create policy "pins_mod_update" on pins for update
  using (public.user_role() in ('moderator', 'admin'));

-- Borra el dueño o mod/admin
create policy "pins_owner_delete" on pins for delete
  using (creator_id = auth.uid() or public.user_role() in ('moderator', 'admin'));
