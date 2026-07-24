-- Fix: Permite la degradación/modificación de roles de cualquier usuario (incluidos administradores)
-- tanto desde consultas SQL directas en la base de datos como desde el panel de administración,
-- y resuelve la advertencia de Supabase Linter sobre SECURITY DEFINER en views (security_definer_view).

-- 1. Actualizar el trigger de protección de columnas del perfil para permitir actualizaciones
--    cuando la consulta proviene de un administrador de la App, un cliente service_role o
--    un superusuario/rol administrativo de PostgreSQL (por ejemplo, Supabase SQL Editor o psql).
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
     or new.karma is distinct from old.karma
     or new.created_at is distinct from old.created_at
     or new.id is distinct from old.id then
    raise exception 'No autorizado para modificar campos protegidos del perfil.';
  end if;

  return new;
end;
$$;

-- 2. Permite a los administradores actualizar el rol de cualquier otro usuario desde el panel
--    (incluyendo degradar a otros administradores o moderadores), manteniendo únicamente la
--    restricción de que un admin no puede modificar su propio rol desde la UI.
create or replace function public.admin_set_user_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  caller_role text;
begin
  caller_role := public.user_role();
  if caller_role <> 'admin' then
    raise exception 'Acceso denegado: solo administradores pueden cambiar roles.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'No puedes modificar tu propio rol desde el panel.';
  end if;

  if new_role not in ('student', 'moderator', 'admin') then
    raise exception 'Rol inválido especificado: %', new_role;
  end if;

  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'Usuario no encontrado con ID: %', target_user_id;
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;
end;
$$;

-- 3. Solución a la advertencia del Supabase Linter (security_definer_view):
--    Convertir la vista public.profiles_public a SECURITY INVOKER (security_invoker = true)
--    y asegurar que RLS evalúe con los permisos del usuario que realiza la consulta.
alter view if exists public.profiles_public set (security_invoker = true);

drop policy if exists profiles_read_public on public.profiles;
create policy profiles_read_public on public.profiles
  for select
  using (true);

revoke select on public.profiles from anon, authenticated;
grant select (id, name, avatar_url, role, karma, faculty_id, career, year, created_at, email) on public.profiles to authenticated;
grant select (id, name, avatar_url, role, karma, faculty_id, career, year, created_at) on public.profiles to anon;
