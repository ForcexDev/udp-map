-- Deshace 20260831000000_notification_preferences.sql.
-- Restaura las dos funciones a su forma sin filtro y borra la tabla. Perder las
-- preferencias significa que todo el mundo vuelve a recibirlo todo.

create or replace function public.create_notification(
  p_user_id uuid, p_type text, p_category text, p_title text, p_body text,
  p_url text, p_dedupe_key text, p_payload jsonb default '{}'::jsonb,
  p_actor_id uuid default null, p_audience text default 'personal'
)
returns uuid language plpgsql security definer set search_path = public as $fn$
declare v_id uuid;
begin
  if p_user_id is null then return null; end if;
  insert into public.notifications (
    user_id, actor_id, type, category, audience, title, body, url, payload, dedupe_key
  ) values (
    p_user_id, p_actor_id, p_type, p_category, p_audience,
    p_title, p_body, coalesce(p_url, '/'), coalesce(p_payload, '{}'::jsonb), p_dedupe_key
  )
  on conflict (user_id, dedupe_key) do nothing
  returning id into v_id;
  return v_id;
end;
$fn$;

create or replace function public.queue_notification_push()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.notification_push_deliveries (notification_id, subscription_id)
  select new.id, subscription.id
  from public.push_subscriptions subscription
  where subscription.user_id = new.user_id
  on conflict do nothing;
  return new;
end;
$fn$;

drop function if exists public.wants_notification(uuid, text, text);
drop table if exists public.notification_preferences;
