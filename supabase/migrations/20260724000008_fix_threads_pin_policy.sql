-- SEC-006: threads_update_owner_or_mod used a subquery `old_thread.is_pinned`
-- that reads the ALREADY-updated row within the same UPDATE, making the
-- check `is_pinned = is_pinned` (tautology). Same bug affected is_official
-- and official_entity_name. It also never restricted author_id, votes_up
-- or votes_down, so an owner update could reassign the thread or forge vote
-- counts directly.
--
-- Fix: policy only gates row access (owner or mod/admin); a BEFORE UPDATE
-- trigger compares OLD vs NEW and rejects changes to server-managed columns
-- unless the caller is moderator/admin.

drop policy if exists threads_update_owner_or_mod on public.forum_threads;

create policy threads_update_owner_or_mod on public.forum_threads
  for update
  using (author_id = auth.uid() or public.user_role() = any (array['moderator', 'admin']))
  with check (author_id = auth.uid() or public.user_role() = any (array['moderator', 'admin']));

create or replace function public.protect_thread_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.user_role() = any (array['moderator', 'admin']) then
    return new;
  end if;

  if new.is_pinned is distinct from old.is_pinned
     or new.is_official is distinct from old.is_official
     or new.official_entity_name is distinct from old.official_entity_name
     or new.author_id is distinct from old.author_id
     or new.votes_up is distinct from old.votes_up
     or new.votes_down is distinct from old.votes_down then
    raise exception 'No autorizado para modificar campos protegidos del hilo.';
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_thread_privileged_fields() from public, anon, authenticated;

drop trigger if exists trg_protect_thread_privileged_fields on public.forum_threads;
create trigger trg_protect_thread_privileged_fields
  before update on public.forum_threads
  for each row
  execute function public.protect_thread_privileged_fields();
