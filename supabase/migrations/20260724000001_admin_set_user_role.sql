-- ═══════════════════════════════════════════════════════════════
-- Sprint 4 — Panel de Administración: RPC para Cambio de Rol de Usuarios
-- Reglas jerárquicas y de seguridad strictly:
-- 1. Solo la función pública user_role() = 'admin' puede invocar esta función.
-- 2. El usuario no puede modificar su propio rol (prevención de auto-degradación o elevación).
-- 3. Promoción: Se puede promover hasta el nivel del ejecutante (máximo 'admin').
-- 4. Democión: Solo se puede degradar a usuarios cuyos roles sean inferiores al ejecutante y
--    degradar al nivel inmediatamente inferior (step-by-step).
-- ═══════════════════════════════════════════════════════════════

create or replace function public.admin_set_user_role(
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  caller_role text;
  caller_rank integer;
  target_curr_role text;
  target_curr_rank integer;
  new_rank integer;
begin
  -- 1. Obtener rol y rango del ejecutante
  caller_role := public.user_role();
  if caller_role <> 'admin' then
    raise exception 'Acceso denegado: solo administradores pueden cambiar roles.';
  end if;

  -- 2. No permitir auto-modificación
  if target_user_id = auth.uid() then
    raise exception 'No puedes modificar tu propio rol desde el panel.';
  end if;

  -- 3. Mapeo de rangos: guest=0, student=1, moderator=2, admin=3
  case caller_role
    when 'guest' then caller_rank := 0;
    when 'student' then caller_rank := 1;
    when 'moderator' then caller_rank := 2;
    when 'admin' then caller_rank := 3;
    else caller_rank := 0;
  end case;

  case new_role
    when 'student' then new_rank := 1;
    when 'moderator' then new_rank := 2;
    when 'admin' then new_rank := 3;
    else raise exception 'Rol inválido especificado: %', new_role;
  end case;

  -- 4. Obtener rol actual del usuario objetivo
  select role into target_curr_role
  from public.profiles
  where id = target_user_id;

  if not found then
    raise exception 'Usuario no encontrado con ID: %', target_user_id;
  end if;

  case target_curr_role
    when 'guest' then target_curr_rank := 0;
    when 'student' then target_curr_rank := 1;
    when 'moderator' then target_curr_rank := 2;
    when 'admin' then target_curr_rank := 3;
    else target_curr_rank := 1;
  end case;

  -- 5. Regla de Promoción: no se puede promover por encima del rango del ejecutante
  if new_rank > target_curr_rank then
    if new_rank > caller_rank then
      raise exception 'No puedes promover a un usuario por encima de tu propio nivel de rol.';
    end if;
  end if;

  -- 6. Regla de Democión: solo se puede degradar a usuarios con rol inferior al ejecutante y al nivel inmediatamente inferior
  if new_rank < target_curr_rank then
    if target_curr_rank >= caller_rank then
      raise exception 'No puedes degradar a un usuario de igual o mayor nivel jerárquico.';
    end if;

    if new_rank <> (target_curr_rank - 1) then
      raise exception 'La degradación debe realizarse al nivel inmediatamente inferior.';
    end if;
  end if;

  -- 7. Aplicar actualización
  update public.profiles
  set role = new_role
  where id = target_user_id;
end;
$$;


-- ═══════════════════════════════════════════════════════════════
-- RPC para emitir notificaciones push de prueba a los suscriptores
-- ═══════════════════════════════════════════════════════════════

create or replace function public.admin_broadcast_push_notification(
  p_title text,
  p_body text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sub record;
  v_count integer := 0;
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden enviar notificaciones de prueba.';
  end if;

  if nullif(trim(p_title), '') is null then
    p_title := 'Notificación de prueba UDP Map';
  end if;

  if nullif(trim(p_body), '') is null then
    p_body := 'Mensaje de prueba enviado desde el panel de administración.';
  end if;

  -- Crear notificaciones y encolar entregas push para cada suscriptor activo
  -- Usa tipo 'achievement' para cumplir con el CHECK constraint notifications_type_check
  for v_sub in select distinct user_id from public.push_subscriptions loop
    perform public.create_notification(
      v_sub.user_id,
      'achievement',
      'profile',
      p_title,
      p_body,
      '/admin',
      'admin_test_' || extract(epoch from now())::text || '_' || v_sub.user_id::text
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;
