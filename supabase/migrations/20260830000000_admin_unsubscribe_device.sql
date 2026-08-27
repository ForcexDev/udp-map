-- ============================================================================
-- Que administración pueda dar de baja un dispositivo.
--
-- `push_subscriptions_own` deja que cada quien borre las SUYAS, y nada más. Eso
-- basta mientras el dispositivo esté vivo: la persona entra en Ajustes y pulsa
-- "Desactivar". No basta cuando el dispositivo ya no responde — un teléfono
-- perdido, una sesión de un navegador que nadie va a volver a abrir— porque
-- entonces no queda nadie que pueda pedir la baja, y esa suscripción muerta se
-- queda en la cuenta de "llegará a N dispositivos" mintiendo para siempre.
--
-- La cola de entregas ya limpia sola las que el servicio de push RECHAZA con
-- 404 o 410 (ver send-push), pero eso solo ocurre cuando el endpoint está
-- formalmente caducado. Un endpoint válido de un teléfono que nadie mira nunca
-- da error.
--
-- Se identifica por `endpoint`, que es UNIQUE, y no por (usuario, dispositivo):
-- una persona con el teléfono y el portátil tiene dos filas, y hay que poder
-- quitar una sin llevarse la otra.
--
-- APLICAR A MANO desde el SQL Editor. Deshacer:
-- 20260830000000_admin_unsubscribe_device.down.sql
-- ============================================================================

create or replace function public.admin_delete_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_borradas integer;
  v_dueno    uuid;
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden dar de baja un dispositivo.';
  end if;

  select user_id into v_dueno from public.push_subscriptions where endpoint = p_endpoint;
  if v_dueno is null then
    return false;
  end if;

  delete from public.push_subscriptions where endpoint = p_endpoint;
  get diagnostics v_borradas = row_count;

  -- Dar de baja el aparato de otra persona es una acción de administración
  -- sobre alguien, así que queda registrada como cualquier otra.
  if v_borradas > 0 then
    perform public.log_activity(
      'push_unsubscribed',
      'Dispositivo dado de baja',
      'profile',
      v_dueno,
      '{}'::jsonb
    );
  end if;

  return v_borradas > 0;
end;
$fn$;

grant execute on function public.admin_delete_push_subscription(text) to authenticated, service_role;

-- El registro tiene que aceptar la acción nueva.
alter table public.activity_log drop constraint if exists activity_log_action_check;
alter table public.activity_log
  add constraint activity_log_action_check check (action in (
    'pin_created', 'pin_deleted',
    'pin_verified', 'pin_unverified',
    'report_filed', 'report_claimed',
    'report_resolved', 'report_dismissed',
    'role_changed', 'broadcast_sent',
    'push_unsubscribed'
  ));

-- `admin_push_subscribers` tiene que devolver el endpoint para poder dar de
-- baja uno concreto. Es un identificador opaco, no un dato personal, y solo lo
-- ve administración.
drop function if exists public.admin_push_subscribers();

create or replace function public.admin_push_subscribers()
returns table (
  user_id      uuid,
  name         text,
  role         text,
  endpoint     text,
  user_agent   text,
  created_at   timestamptz,
  updated_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden ver quién recibe los avisos.';
  end if;

  return query
    select s.user_id, p.name, p.role, s.endpoint, s.user_agent, s.created_at, s.updated_at
      from public.push_subscriptions s
      left join public.profiles p on p.id = s.user_id
     order by p.name nulls last, s.created_at desc;
end;
$fn$;

grant execute on function public.admin_push_subscribers() to authenticated, service_role;
