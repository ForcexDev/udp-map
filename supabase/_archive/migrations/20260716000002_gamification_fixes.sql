-- ═══════════════════════════════════════════════════════════════
-- Sprint 4 Fix — Correcciones al módulo de Gamificación
-- ═══════════════════════════════════════════════════════════════
-- Esta migración aplica sobre 20260716000001_gamification.sql
-- que ya está en producción.
-- Cambios:
--   1. Karma solo por upvotes/downvotes en posts (sin creación, sin comentarios)
--   2. Badges permanentes (no se revocan nunca)
--   3. Eliminar columna icon de badges
--   4. Leaderboard solo para autenticados (RLS)
--   5. Recalcular karma de todos los usuarios desde cero
--   6. Re-evaluar badges con nueva lógica (retroactividad one-shot)
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Eliminar triggers y funciones de karma por CREACIÓN y COMENTARIOS ──

drop trigger if exists on_pin_karma         on public.pins;
drop trigger if exists on_forum_thread_karma on public.forum_threads;
drop trigger if exists on_pin_comment_karma  on public.pin_comments;
drop trigger if exists on_forum_comment_karma on public.forum_comments;

drop function if exists public.on_pin_change_karma();
drop function if exists public.on_forum_thread_change_karma();
drop function if exists public.on_pin_comment_change_karma();
drop function if exists public.on_forum_comment_change_karma();

-- ── 2. Actualizar funciones de votos de pines (lógica igual, mantener) ──
-- on_pin_vote_change_karma ya es correcta (upvote +10, downvote -2, deltas en UPDATE)
-- on_forum_vote_change_karma ya es correcta

-- ── 3. Hacer badges permanentes — reemplazar todas las funciones check_*_badge ──
-- Se elimina la cláusula ELSE DELETE para que las insignias nunca se revoquen

create or replace function public.check_explorer_badge(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
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
  -- Sin ELSE: los badges son permanentes una vez obtenidos
end;
$$;

create or replace function public.check_photographer_badge(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
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
$$;

create or replace function public.check_host_badge(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
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
$$;

create or replace function public.check_guardian_badge(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
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
$$;

create or replace function public.check_pioneer_badge(p_user_id uuid, p_karma integer)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_user_id is null then return; end if;
  if p_karma >= 100 then
    insert into public.user_badges (user_id, badge_id)
    values (p_user_id, 'pioneer')
    on conflict do nothing;
  end if;
  -- Sin ELSE: badge permanente
end;
$$;

-- ── 4. Eliminar columna icon de la tabla badges ──

alter table public.badges drop column if exists icon;

-- Actualizar semilla (sin icon)
insert into public.badges (id, name, name_en, description, description_en) values
  ('explorer',     'Explorador', 'Explorer',     'Crea 5 o más pines en el mapa',          'Create 5 or more pins on the map')       ,
  ('photographer', 'Fotógrafo',  'Photographer', 'Sube 3 o más fotos a tus pines',         'Upload 3 or more photos to your pins')    ,
  ('host',         'Anfitrión',  'Host',         'Organiza 2 o más eventos',               'Host 2 or more events')                   ,
  ('guardian',     'Guardián',   'Guardian',     'Vota en 10 o más publicaciones',         'Vote 10 or more times on posts')          ,
  ('pioneer',      'Pionero',    'Pioneer',      'Alcanza 100 o más puntos de Karma',      'Reach 100 or more Karma points')
on conflict (id) do update set
  name           = excluded.name,
  name_en        = excluded.name_en,
  description    = excluded.description,
  description_en = excluded.description_en;

-- ── 5. RLS: Leaderboard / Profiles solo para usuarios autenticados ──
-- Remplaza la política de lectura pública en profiles por una que requiere auth

-- Nota: el nombre de la política existente puede variar; usamos IF EXISTS para seguridad
drop policy if exists "profiles_read_all"    on public.profiles;
drop policy if exists "Profiles are viewable by everyone." on public.profiles;
drop policy if exists "profiles_select"      on public.profiles;

create policy "profiles_read_authenticated"
  on public.profiles for select
  using (auth.uid() is not null);

-- ── 6. Recalcular karma de todos los usuarios (solo votos, one-shot) ──

update public.profiles p
set karma = greatest(0, (
  -- Karma de votos en pines recibidos
  coalesce((
    select sum(case when pv.value = 1 then 10 else -2 end)
    from public.pin_votes pv
    join public.pins pi on pv.pin_id = pi.id
    where pi.creator_id = p.id
  ), 0)
  +
  -- Karma de votos en hilos del foro recibidos
  coalesce((
    select sum(case when fv.value = 1 then 10 else -2 end)
    from public.forum_votes fv
    join public.forum_threads ft on fv.thread_id = ft.id
    where ft.author_id = p.id
  ), 0)
));

-- ── 7. Re-evaluar badges para todos los usuarios con la nueva lógica ──

do $$
declare
  r record;
begin
  for r in select id, karma from public.profiles loop
    perform public.check_explorer_badge(r.id);
    perform public.check_photographer_badge(r.id);
    perform public.check_host_badge(r.id);
    perform public.check_guardian_badge(r.id);
    perform public.check_pioneer_badge(r.id, r.karma);
  end loop;
end;
$$;
