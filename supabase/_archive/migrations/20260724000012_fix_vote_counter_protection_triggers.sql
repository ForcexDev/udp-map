-- Fix vote counter updates in BEFORE UPDATE triggers when invoked via vote_pin() and vote_thread() RPCs.
-- SEC-005 & SEC-006: protect_pin_sensitive_fields() and protect_thread_privileged_fields()
-- blocked non-moderators/non-admins from updating votes_up and votes_down even when calling
-- authorized RPCs (vote_pin/vote_thread).
-- Solution: check current_setting('udpmap.vote_rpc', true) = 'on' to allow authorized vote counter updates.

create or replace function public.protect_pin_sensitive_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if public.user_role() not in ('moderator', 'admin') then
    new.is_permanent := old.is_permanent;
    new.verifier_entity_name := old.verifier_entity_name;
    new.is_official := old.is_official;
    new.official_entity_name := old.official_entity_name;
    new.type := old.type;
    new.expires_at := old.expires_at;
    new.creator_id := old.creator_id;
    new.reports := old.reports;
    if current_setting('udpmap.vote_rpc', true) is distinct from 'on' then
      new.votes_up := old.votes_up;
      new.votes_down := old.votes_down;
    end if;
  end if;
  return new;
end;
$function$;

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
     or new.author_id is distinct from old.author_id then
    raise exception 'No autorizado para modificar campos protegidos del hilo.';
  end if;

  if (new.votes_up is distinct from old.votes_up or new.votes_down is distinct from old.votes_down)
     and current_setting('udpmap.vote_rpc', true) is distinct from 'on' then
    raise exception 'No autorizado para modificar contadores de votos del hilo fuera de la RPC de votación.';
  end if;

  return new;
end;
$$;
