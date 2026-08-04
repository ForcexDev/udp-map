-- Colapsa los 3 bloques case/when duplicados de admin_set_user_role en un solo lookup.
create or replace function public.admin_set_user_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  ranks text[] := array['guest', 'student', 'moderator', 'admin'];
  caller_role text;
  caller_rank integer;
  target_curr_role text;
  target_curr_rank integer;
  new_rank integer;
begin
  caller_role := public.user_role();
  if caller_role <> 'admin' then
    raise exception 'Acceso denegado: solo administradores pueden cambiar roles.';
  end if;

  if target_user_id = auth.uid() then
    raise exception 'No puedes modificar tu propio rol desde el panel.';
  end if;

  caller_rank := coalesce(array_position(ranks, caller_role), 1) - 1;
  new_rank := array_position(ranks, new_role) - 1;
  if new_rank is null then
    raise exception 'Rol inválido especificado: %', new_role;
  end if;

  select role into target_curr_role
  from public.profiles
  where id = target_user_id;

  if not found then
    raise exception 'Usuario no encontrado con ID: %', target_user_id;
  end if;

  target_curr_rank := coalesce(array_position(ranks, target_curr_role), 2) - 1;

  if new_rank > target_curr_rank and new_rank > caller_rank then
    raise exception 'No puedes promover a un usuario por encima de tu propio nivel de rol.';
  end if;

  if new_rank < target_curr_rank then
    if target_curr_rank >= caller_rank then
      raise exception 'No puedes degradar a un usuario de igual o mayor nivel jerárquico.';
    end if;
    if new_rank <> (target_curr_rank - 1) then
      raise exception 'La degradación debe realizarse al nivel inmediatamente inferior.';
    end if;
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;
end;
$$;
