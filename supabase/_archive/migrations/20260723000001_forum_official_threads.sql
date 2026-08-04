-- Permite que moderadores y administradores publiquen hilos institucionales.
alter table public.forum_threads
  add column if not exists is_official boolean not null default false,
  add column if not exists official_entity_name text null;

drop policy if exists "threads_insert_auth" on public.forum_threads;
create policy "threads_insert_auth" on public.forum_threads for insert
  with check (
    auth.uid() is not null
    and public.user_role() <> 'guest'
    and author_id = auth.uid()
    and (
      (coalesce(is_official, false) = false and official_entity_name is null)
      or (
        coalesce(is_official, false) = true
        and public.user_role() in ('moderator', 'admin')
        and nullif(trim(official_entity_name), '') is not null
      )
    )
  );

drop policy if exists "threads_update_owner_or_mod" on public.forum_threads;
create policy "threads_update_owner_or_mod" on public.forum_threads for update
  using (
    author_id = auth.uid()
    or public.user_role() in ('moderator', 'admin')
  )
  with check (
    public.user_role() in ('moderator', 'admin')
    or (
      author_id = auth.uid()
      and is_pinned = (select old_thread.is_pinned from public.forum_threads old_thread where old_thread.id = forum_threads.id)
      and is_official = (select old_thread.is_official from public.forum_threads old_thread where old_thread.id = forum_threads.id)
      and official_entity_name is not distinct from (select old_thread.official_entity_name from public.forum_threads old_thread where old_thread.id = forum_threads.id)
    )
  );
