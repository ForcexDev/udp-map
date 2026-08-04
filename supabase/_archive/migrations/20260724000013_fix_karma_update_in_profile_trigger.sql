-- Fix: Allow karma updates by internal trigger functions (e.g. adjust_karma) for non-admin users (students & moderators).
-- Problem: protect_profile_privileged_fields() raised exception 'No autorizado para modificar campos protegidos del perfil'
-- when a non-admin user voted, created a pin, or commented, because the action triggered adjust_karma() which updates
-- profiles.karma. Since public.user_role() is 'student', the trigger aborted the entire vote/pin/comment transaction.
-- Solution: adjust_karma sets session variable 'udpmap.internal_karma_update' = 'on', and protect_profile_privileged_fields()
-- allows karma updates when this session variable is 'on'.

create or replace function public.adjust_karma(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is not null then
    perform set_config('udpmap.internal_karma_update', 'on', true);
    update public.profiles
    set karma = greatest(0, karma + p_amount)
    where id = p_user_id;
  end if;
end;
$$;

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
$$;
