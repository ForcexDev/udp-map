-- ── Tablas de Foro ──

create table forum_threads (
  id          uuid default gen_random_uuid() primary key,
  faculty_id  text references faculties on delete set null,
  author_id   uuid references profiles on delete cascade not null,
  title       text not null,
  content     text not null,
  tags        text[] default '{}',
  votes_up    integer default 0,
  votes_down  integer default 0,
  is_pinned   boolean default false,
  created_at  timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at  timestamp with time zone default timezone('utc'::text, now()) not null
);

create table forum_comments (
  id                uuid default gen_random_uuid() primary key,
  thread_id         uuid references forum_threads on delete cascade not null,
  parent_comment_id uuid references forum_comments on delete cascade,
  author_id         uuid references profiles on delete cascade not null,
  content           text not null,
  created_at        timestamp with time zone default timezone('utc'::text, now()) not null
);

create table forum_votes (
  thread_id   uuid references forum_threads on delete cascade,
  user_id     uuid references profiles on delete cascade,
  value       integer check (value in (1, -1)),
  primary key (thread_id, user_id)
);

-- ── Índices para optimización de consultas ──
create index idx_forum_threads_faculty on forum_threads(faculty_id);
create index idx_forum_threads_created on forum_threads(created_at desc);
create index idx_forum_comments_thread on forum_comments(thread_id);
create index idx_forum_comments_parent on forum_comments(parent_comment_id);

-- ── Habilitar RLS ──
alter table forum_threads enable row level security;
alter table forum_comments enable row level security;
alter table forum_votes enable row level security;

-- ── Políticas de RLS para forum_threads ──
create policy "threads_read_all" on forum_threads for select using (true);

create policy "threads_insert_auth" on forum_threads for insert
  with check (auth.uid() is not null and public.user_role() <> 'guest' and author_id = auth.uid());

create policy "threads_update_owner_or_mod" on forum_threads for update
  using (
    author_id = auth.uid() 
    or public.user_role() in ('moderator', 'admin')
  )
  with check (
    -- Si no es mod/admin, no puede cambiar is_pinned ni author_id
    (public.user_role() in ('moderator', 'admin'))
    or (
      author_id = auth.uid() 
      and is_pinned = (select is_pinned from forum_threads where id = id)
    )
  );

create policy "threads_delete_owner_or_mod" on forum_threads for delete
  using (author_id = auth.uid() or public.user_role() in ('moderator', 'admin'));

-- ── Políticas de RLS para forum_comments ──
create policy "comments_read_all" on forum_comments for select using (true);

create policy "comments_insert_auth" on forum_comments for insert
  with check (auth.uid() is not null and public.user_role() <> 'guest' and author_id = auth.uid());

create policy "comments_update_owner" on forum_comments for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "comments_delete_owner_or_mod" on forum_comments for delete
  using (author_id = auth.uid() or public.user_role() in ('moderator', 'admin'));

-- ── Políticas de RLS para forum_votes ──
create policy "votes_read_own" on forum_votes for select using (user_id = auth.uid());

create policy "votes_insert_own" on forum_votes for insert
  with check (user_id = auth.uid() and public.user_role() <> 'guest');

create policy "votes_update_own" on forum_votes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.user_role() <> 'guest');

create policy "votes_delete_own" on forum_votes for delete
  using (user_id = auth.uid());

-- ── RPC: Votar por un Hilo ──
create or replace function public.vote_thread(p_thread uuid, p_value integer)
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

  insert into forum_votes (thread_id, user_id, value)
  values (p_thread, auth.uid(), p_value)
  on conflict (thread_id, user_id) do update set value = excluded.value;

  update forum_threads set
    votes_up   = (select count(*) from forum_votes where thread_id = p_thread and value = 1),
    votes_down = (select count(*) from forum_votes where thread_id = p_thread and value = -1)
  where id = p_thread;
end;
$$;
