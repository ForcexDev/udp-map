-- SEC-003 + SEC-004: profiles_read exposed every column (including email) to
-- anon/authenticated, and profiles_update_own only pinned `role`, leaving
-- karma/email/created_at/id writable by the owner directly.
--
-- Fix:
-- - profiles_public view exposes only safe columns for any viewer.
-- - profiles_read_own lets a user read their own full row (email included).
-- - profiles_read_admin lets admins read full rows for the admin dashboard.
-- - BEFORE UPDATE trigger blocks changes to server-managed columns unless
--   the caller is admin (mirrors the thread-fields fix in SEC-006).

drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_read_authenticated on public.profiles;

create policy profiles_read_own on public.profiles
  for select
  using (id = auth.uid());

create policy profiles_read_admin on public.profiles
  for select
  using (public.user_role() = 'admin');

create view public.profiles_public
  with (security_invoker = false)
  as
  select id, name, avatar_url, role, karma, faculty_id, career, year, created_at
  from public.profiles;

grant select on public.profiles_public to anon, authenticated;

drop policy if exists profiles_update_own on public.profiles;

create policy profiles_update_own on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.user_role() = 'admin' then
    return new;
  end if;

  if new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.karma is distinct from old.karma
     or new.created_at is distinct from old.created_at
     or new.id is distinct from old.id then
    raise exception 'No autorizado para modificar campos protegidos del perfil.';
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_profile_privileged_fields() from public, anon, authenticated;

drop trigger if exists trg_protect_profile_privileged_fields on public.profiles;
create trigger trg_protect_profile_privileged_fields
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileged_fields();
