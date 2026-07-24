-- SEC-005: trg_protect_pin_sensitive_fields protected permanence, officiality,
-- type and expiration, but left votes_up, votes_down, reports and creator_id
-- unprotected against a direct owner update. Location, faculty and category
-- stay owner-editable on non-permanent pins per product decision (home
-- collaboration use case documented in docs/securityDB.md).

create or replace function public.protect_pin_sensitive_fields()
returns trigger
language plpgsql
security definer
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
    new.votes_up := old.votes_up;
    new.votes_down := old.votes_down;
    new.reports := old.reports;
  end if;
  return new;
end;
$function$;
