-- Aplicar a mano en el SQL Editor de cada entorno.
-- SECURITY INVOKER evita que el dueño de este trigger habilite la excepción
-- para todo UPDATE. La ACL limita al cliente aun si se altera el trigger.
begin;

-- INVOKER conserva el rol que ejecuta el UPDATE, también dentro de una RPC DEFINER.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $fn$
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
$fn$;


-- Un permiso de tabla o de columna previo anularía la restricción por columnas.
revoke update on public.profiles from public, anon, authenticated;
do $profile_update_acl$
declare
  v_columns text;
begin
  select string_agg(quote_ident(attname), ', ' order by attnum) into v_columns
  from pg_attribute
  where attrelid = 'public.profiles'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke update (%s) on public.profiles from public, anon, authenticated', v_columns);
end;
$profile_update_acl$;
grant update (name, avatar_url, faculty_id, career, year) on public.profiles to authenticated;

commit;
