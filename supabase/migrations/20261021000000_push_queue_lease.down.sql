-- ============================================================================
-- Deshace 20261021000000_push_queue_lease.sql.
--
-- OJO: antes de volver a `not null` + CASCADE y al CHECK estrecho, esto BORRA
-- las entregas con `subscription_id` nulo o en estado `expired`. Antes de la
-- migración esas filas no existían (el CASCADE las borraba junto con su
-- suscripción), así que el esquema viejo no tiene dónde ponerlas: es el rastro
-- de fallos que la migración añadió, y deshacerla lo pierde.
--
-- OJO 2: redesplegar el send-push anterior (eba61ee o 4eae308) ANTES de aplicar
-- esto. El nuevo llama a claim_push_deliveries y finish_push_deliveries, que aquí
-- se eliminan, y cada pasada fallaría.
-- ============================================================================

drop function if exists public.finish_push_deliveries(jsonb);
drop function if exists public.claim_push_deliveries(integer, integer, uuid);

drop trigger if exists push_subscriptions_expire_deliveries on public.push_subscriptions;
drop function if exists public.expire_pending_push_deliveries();

drop index if exists public.notification_deliveries_subscription_idx;

-- Vuelve la versión de 20260831000000, sin `push_host`.
create or replace function public.queue_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  if new.audience = 'personal'
     and not public.wants_notification(new.user_id, new.category, 'push') then
    return new;
  end if;

  insert into public.notification_push_deliveries (notification_id, subscription_id)
  select new.id, subscription.id
  from public.push_subscriptions subscription
  where subscription.user_id = new.user_id
  on conflict do nothing;
  return new;
end;
$fn$;

-- Primero se borra lo que el esquema viejo no admite; si no, el `set not null` y
-- el CHECK fallarían.
delete from public.notification_push_deliveries
 where subscription_id is null or status = 'expired';

alter table public.notification_push_deliveries
  drop constraint if exists notification_push_deliveries_subscription_id_fkey;
alter table public.notification_push_deliveries
  add constraint notification_push_deliveries_subscription_id_fkey
  foreign key (subscription_id) references public.push_subscriptions(id) on delete cascade;
alter table public.notification_push_deliveries
  alter column subscription_id set not null;

alter table public.notification_push_deliveries
  drop constraint if exists notification_push_deliveries_status_check;
alter table public.notification_push_deliveries
  add constraint notification_push_deliveries_status_check
  check (status in ('pending', 'sent', 'failed'));

alter table public.notification_push_deliveries
  drop column if exists push_host;
