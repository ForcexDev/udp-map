-- ============================================================================
-- Deshace 20261021000100_push_subscriptions_reminders.sql.
--
-- OJO: se pierden dos cosas que el esquema viejo no sabe guardar.
--   · `event_rsvps.reminded_at`: sin ella, el barrido de cada minuto vuelve a
--     confiar solo en la fila de `notifications`, y borrar un aviso de evento
--     próximo hace que reaparezca y vuelva a sonar.
--   · Las suscripciones que `p_old_endpoint` ya retiró no vuelven, ni lo que se
--     movió de una a otra.
--
-- OJO 2: si ya se aplicó 20261021000200, deshacer ESA primero. Esta no depende
-- de ella, pero el orden inverso del de aplicación es el que deja cada paso
-- comprobable.
--
-- OJO 3: `wants_notification` vuelve a tener EXECUTE para authenticated (como
-- la dejó 20260831000000). Si ya hay un cliente que no la usa, da igual; si lo
-- que se quería era cerrarla, hay que volver a aplicar la migración.
-- ============================================================================

-- ── 5. Estado de las entregas ───────────────────────────────────────────────
drop function if exists public.admin_push_delivery_stats(integer);

-- ── 4. Difusión: vuelve la versión de 20260829000000 ────────────────────────
create or replace function public.admin_broadcast_push_notification(
  p_title text,
  p_body  text,
  p_url   text default '/'
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_sub   record;
  v_count integer := 0;
  v_key   text;
  v_url   text;
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden enviar avisos de difusión.';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'El aviso necesita un título.';
  end if;

  if nullif(trim(p_body), '') is null then
    raise exception 'El aviso necesita un mensaje.';
  end if;

  -- El destino tiene que ser una ruta DE ESTA aplicación. Sin esto, un aviso
  -- podría mandar a toda la universidad a una web ajena con un toque, que es
  -- exactamente la forma de un ataque de phishing servido por nosotros mismos.
  v_url := coalesce(nullif(trim(p_url), ''), '/');
  if v_url !~ '^/[A-Za-z0-9/_?=&%.-]*$' then
    raise exception 'El destino del aviso tiene que ser una ruta interna, y llegó: %', v_url;
  end if;

  v_key := 'announcement_' || extract(epoch from now())::bigint::text;

  for v_sub in select distinct user_id from public.push_subscriptions loop
    perform public.create_notification(
      v_sub.user_id, 'announcement', 'system',
      p_title, p_body, v_url, v_key
    );
    v_count := v_count + 1;
  end loop;

  -- `broadcast_sent` estaba declarado en el CHECK de activity_log desde la
  -- migración anterior y no lo escribía nadie.
  perform public.log_activity(
    'broadcast_sent',
    p_title,
    'broadcast',
    null,
    jsonb_build_object('destinatarios', v_count, 'url', v_url)
  );

  return v_count;
end;
$fn$;

-- ── 3. `wants_notification` vuelve a ser llamable por authenticated ─────────
grant execute on function public.wants_notification(uuid, text, text) to authenticated;

-- ── 2. Sin `reminded_at` ────────────────────────────────────────────────────

-- Primero los permisos: quitar la columna borra sus privilegios, pero los de las
-- otras tres tienen que volver a ser de tabla entera, como estaban.
revoke insert (pin_id, user_id, status), update (pin_id, user_id, status)
  on public.event_rsvps from anon, authenticated;
grant insert, update on public.event_rsvps to anon, authenticated;

-- Las dos funciones vuelven a no mirar la marca. Hay que reemplazarlas ANTES de
-- borrar la columna: plpgsql no valida las referencias al crear, pero sí fallarían
-- en la siguiente pasada del barrido si aún apuntaran a ella.
create or replace function public.enqueue_event_reminder(p_user_id uuid, p_pin_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_event           public.pins%rowtype;
  v_notification_id uuid;
begin
  select * into v_event
  from public.pins
  where id = p_pin_id
    and type = 'event'
    and starts_at > now()
    and starts_at <= now() + interval '20 days';

  if not found then return false; end if;

  v_notification_id := public.create_notification(
    p_user_id,
    'event_reminder',
    'events',
    'Evento próximo',
    '“' || left(v_event.title, 100) || '” comienza el ' ||
      to_char(v_event.starts_at at time zone 'America/Santiago', 'DD/MM a las HH24:MI'),
    '/eventos?event=' || v_event.id::text,
    'event_reminder:' || v_event.id::text,
    jsonb_build_object('pinId', v_event.id, 'startsAt', v_event.starts_at),
    v_event.creator_id,
    'personal'
  );

  return v_notification_id is not null;
end;
$fn$;

create or replace function public.enqueue_upcoming_event_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_row     record;
  v_created integer := 0;
begin
  if auth.role() <> 'service_role' and public.user_role() <> 'admin' then
    raise exception 'Solo el servicio o un administrador puede generar recordatorios';
  end if;

  for v_row in
    select rsvp.user_id, rsvp.pin_id
    from public.event_rsvps rsvp
    join public.pins event on event.id = rsvp.pin_id
    where event.type = 'event'
      and event.starts_at > now()
      and event.starts_at <= now() + interval '20 days'
  loop
    if public.enqueue_event_reminder(v_row.user_id, v_row.pin_id) then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$fn$;

alter table public.event_rsvps
  drop column if exists reminded_at;

-- ── 1. register_push_subscription de cuatro argumentos ──────────────────────

drop function if exists public.register_push_subscription(text, text, text, text, text);

create or replace function public.register_push_subscription(
  p_endpoint   text,
  p_p256dh     text,
  p_auth       text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  if auth.uid() is null or public.user_role() = 'guest' then
    raise exception 'Debes iniciar sesión para activar notificaciones';
  end if;
  if nullif(trim(p_endpoint), '') is null
    or nullif(trim(p_p256dh), '') is null
    or nullif(trim(p_auth), '') is null then
    raise exception 'Suscripción Web Push inválida';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update set
    user_id = auth.uid(),
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    updated_at = now()
  returning id into v_id;

  -- Si el mismo navegador cambia de usuario, elimina entregas del dueño anterior
  -- antes de que puedan enviarse al usuario nuevo.
  delete from public.notification_push_deliveries delivery
  using public.notifications notification
  where delivery.subscription_id = v_id
    and notification.id = delivery.notification_id
    and notification.user_id <> auth.uid();

  return v_id;
end;
$fn$;

revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated, service_role;
