-- Deshace 20260830000000_admin_unsubscribe_device.sql.
--
-- OJO: el CHECK vuelve a su forma estrecha. Si ya se dio de baja algún
-- dispositivo, habrá filas con action='push_unsubscribed' y el ALTER fallará —
-- correctamente: deshacer no puede borrar registro de auditoría. Para pasar:
--   delete from public.activity_log where action = 'push_unsubscribed';

drop function if exists public.admin_delete_push_subscription(text);
drop function if exists public.admin_push_subscribers();

create or replace function public.admin_push_subscribers()
returns table (
  user_id uuid, name text, role text,
  user_agent text, created_at timestamptz, updated_at timestamptz
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
    select s.user_id, p.name, p.role, s.user_agent, s.created_at, s.updated_at
      from public.push_subscriptions s
      left join public.profiles p on p.id = s.user_id
     order by p.name nulls last, s.created_at desc;
end;
$fn$;

grant execute on function public.admin_push_subscribers() to authenticated, service_role;

alter table public.activity_log drop constraint if exists activity_log_action_check;
alter table public.activity_log
  add constraint activity_log_action_check check (action in (
    'pin_created', 'pin_deleted', 'pin_verified', 'pin_unverified',
    'report_filed', 'report_claimed', 'report_resolved', 'report_dismissed',
    'role_changed', 'broadcast_sent'
  ));
