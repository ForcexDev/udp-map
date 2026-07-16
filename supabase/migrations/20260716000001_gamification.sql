-- ═══════════════════════════════════════════════════════════════
-- Sprint 4 — Módulo Social & Gamificación: Karma, Badges & Leaderboard
-- ═══════════════════════════════════════════════════════════════

-- ── Tablas ──
create table public.badges (
  id             text primary key,
  name           text not null,
  name_en        text not null,
  description    text not null,
  description_en text not null,
  icon           text not null
);

create table public.user_badges (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_id   text not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

-- Habilitar RLS
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

-- Políticas de RLS
create policy "badges_read_all" on public.badges for select using (true);
create policy "user_badges_read_all" on public.user_badges for select using (true);

-- Semilla de insignias por defecto
insert into public.badges (id, name, name_en, description, description_en, icon) values
  ('explorer', 'Explorador', 'Explorer', 'Crea 5 o más pines en el mapa', 'Create 5 or more pins on the map', '🧭'),
  ('photographer', 'Fotógrafo', 'Photographer', 'Sube 3 o más fotos a tus pines', 'Upload 3 or more photos to your pins', '📸'),
  ('host', 'Anfitrión', 'Host', 'Organiza 2 o más eventos', 'Host 2 or more events', '🎉'),
  ('guardian', 'Guardián', 'Guardian', 'Vota en 10 o más publicaciones', 'Vote 10 or more times on posts', '🛡️'),
  ('pioneer', 'Pionero', 'Pioneer', 'Alcanza 100 o más puntos de Karma', 'Reach 100 or more Karma points', '🚀')
on conflict (id) do update set
  name = excluded.name,
  name_en = excluded.name_en,
  description = excluded.description,
  description_en = excluded.description_en,
  icon = excluded.icon;

-- ── Helper para ajustar karma ──
create or replace function public.adjust_karma(p_user_id uuid, p_amount integer)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_user_id is not null then
    update public.profiles
    set karma = greatest(0, karma + p_amount)
    where id = p_user_id;
  end if;
end;
$$;

-- ── Triggers de cálculo automático de Karma ──

-- Triggers para pines (Creación +5, Eliminación -5)
create or replace function public.on_pin_change_karma()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.adjust_karma(new.creator_id, 5);
  elsif tg_op = 'DELETE' then
    perform public.adjust_karma(old.creator_id, -5);
  end if;
  return null;
end;
$$;

create trigger on_pin_karma
  after insert or delete on public.pins
  for each row execute function public.on_pin_change_karma();

-- Triggers para comentarios (Creación +2, Eliminación -2)
create or replace function public.on_pin_comment_change_karma()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.adjust_karma(new.author_id, 2);
  elsif tg_op = 'DELETE' then
    perform public.adjust_karma(old.author_id, -2);
  end if;
  return null;
end;
$$;

create trigger on_pin_comment_karma
  after insert or delete on public.pin_comments
  for each row execute function public.on_pin_comment_change_karma();

-- Triggers para hilos del foro (Creación +5, Eliminación -5)
create or replace function public.on_forum_thread_change_karma()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.adjust_karma(new.author_id, 5);
  elsif tg_op = 'DELETE' then
    perform public.adjust_karma(old.author_id, -5);
  end if;
  return null;
end;
$$;

create trigger on_forum_thread_karma
  after insert or delete on public.forum_threads
  for each row execute function public.on_forum_thread_change_karma();

-- Triggers para comentarios del foro (Creación +2, Eliminación -2)
create or replace function public.on_forum_comment_change_karma()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.adjust_karma(new.author_id, 2);
  elsif tg_op = 'DELETE' then
    perform public.adjust_karma(old.author_id, -2);
  end if;
  return null;
end;
$$;

create trigger on_forum_comment_karma
  after insert or delete on public.forum_comments
  for each row execute function public.on_forum_comment_change_karma();

-- Triggers para votos en pines (Upvote +10, Downvote -2)
create or replace function public.on_pin_vote_change_karma()
returns trigger
language plpgsql security definer set search_path = public
as $$
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
        perform public.adjust_karma(v_creator_id, 12); -- -1 -> +1 = net +12
      else
        perform public.adjust_karma(v_creator_id, -12); -- +1 -> -1 = net -12
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
$$;

create trigger on_pin_vote_karma
  after insert or update or delete on public.pin_votes
  for each row execute function public.on_pin_vote_change_karma();

-- Triggers para votos del foro (Upvote +10, Downvote -2)
create or replace function public.on_forum_vote_change_karma()
returns trigger
language plpgsql security definer set search_path = public
as $$
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
$$;

create trigger on_forum_vote_karma
  after insert or update or delete on public.forum_votes
  for each row execute function public.on_forum_vote_change_karma();


-- ── Funciones de concesión de insignias automáticas ──

-- 1. Explorador
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
  else
    delete from public.user_badges where user_id = p_user_id and badge_id = 'explorer';
  end if;
end;
$$;

-- 2. Fotógrafo
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
  else
    delete from public.user_badges where user_id = p_user_id and badge_id = 'photographer';
  end if;
end;
$$;

-- 3. Anfitrión
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
  else
    delete from public.user_badges where user_id = p_user_id and badge_id = 'host';
  end if;
end;
$$;

-- 4. Guardián
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
  else
    delete from public.user_badges where user_id = p_user_id and badge_id = 'guardian';
  end if;
end;
$$;

-- 5. Pionero
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
  else
    delete from public.user_badges where user_id = p_user_id and badge_id = 'pioneer';
  end if;
end;
$$;


-- ── Triggers de Insignias ──

-- Trigger para pines (explorer y host)
create or replace function public.on_pin_badge_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
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
$$;

create trigger on_pin_badge
  after insert or delete on public.pins
  for each row execute function public.on_pin_badge_trigger();

-- Trigger para fotos (photographer)
create or replace function public.on_pin_photo_badge_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
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
$$;

create trigger on_pin_photo_badge
  after insert or delete on public.pin_photos
  for each row execute function public.on_pin_photo_badge_trigger();

-- Trigger para votos en pines (guardian)
create or replace function public.on_pin_vote_badge_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.check_guardian_badge(new.user_id);
  elsif tg_op = 'DELETE' then
    perform public.check_guardian_badge(old.user_id);
  end if;
  return null;
end;
$$;

create trigger on_pin_vote_badge
  after insert or delete on public.pin_votes
  for each row execute function public.on_pin_vote_badge_trigger();

-- Trigger para votos en foro (guardian)
create or replace function public.on_forum_vote_badge_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.check_guardian_badge(new.user_id);
  elsif tg_op = 'DELETE' then
    perform public.check_guardian_badge(old.user_id);
  end if;
  return null;
end;
$$;

create trigger on_forum_vote_badge
  after insert or delete on public.forum_votes
  for each row execute function public.on_forum_vote_badge_trigger();

-- Trigger para karma de perfil (pioneer)
create or replace function public.on_profile_badge_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.karma <> new.karma then
    perform public.check_pioneer_badge(new.id, new.karma);
  end if;
  return null;
end;
$$;

create trigger on_profile_badge
  after update on public.profiles
  for each row execute function public.on_profile_badge_trigger();

-- Concesión retroactiva para usuarios existentes
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
