-- ============================================================================
-- Avisos de difusión con identidad propia, y una prueba de push que no molesta
-- a nadie más.
--
-- Dos problemas que venían del mismo sitio: `admin_broadcast_push_notification`
-- se escribió reutilizando lo que ya cabía en los CHECK de `notifications`.
--
--  1. Un aviso de difusión se guardaba como type='achievement',
--     category='profile' y url='/admin'. O sea que un corte de agua le llegaba
--     a cada estudiante disfrazado de LOGRO, se le mezclaba entre sus insignias
--     al filtrar por "Perfil", y al tocarlo lo mandaba a `/admin` — una pantalla
--     que un estudiante no puede abrir y de la que rebota al mapa. En la lista
--     de avisos de un usuario real se ven hoy varias "Notificación de prueba UDP
--     Map" exactamente así.
--
--  2. Probar el push era imposible sin despertar a todo el mundo: la única vía
--     recorría TODAS las suscripciones. "A ver si me llega a mí" le sonaba el
--     teléfono a la universidad entera, así que en la práctica no se probaba.
--
-- Se arregla dando a los avisos su propio `type`/`category` y añadiendo un
-- envío dirigido solo a quien lo pide.
--
-- APLICAR A MANO desde el SQL Editor de Supabase. Para deshacer:
-- 20260827000000_announcements_and_self_push_test.down.sql
-- ============================================================================

-- ── 1. Los avisos de difusión dejan de disfrazarse de logro ─────────────────

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'achievement',
      'forum_reply',
      'event_reminder',
      'moderation_report',
      'moderation_update',
      'announcement'
    )
  );

alter table public.notifications
  drop constraint if exists notifications_category_check;
alter table public.notifications
  add constraint notifications_category_check check (
    category in ('profile', 'forum', 'events', 'moderation', 'system')
  );

-- ── 2. La difusión usa la categoría nueva ───────────────────────────────────

create or replace function public.admin_broadcast_push_notification(p_title text, p_body text)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_sub   record;
  v_count integer := 0;
  v_key   text;
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

  -- Una sola marca para toda la difusión: así los avisos de un mismo envío
  -- comparten identidad y se pueden rastrear juntos. El unique de la tabla es
  -- (user_id, dedupe_key), de modo que compartirla entre usuarios no colisiona.
  v_key := 'announcement_' || extract(epoch from now())::bigint::text;

  for v_sub in select distinct user_id from public.push_subscriptions loop
    perform public.create_notification(
      v_sub.user_id,
      'announcement',
      'system',
      p_title,
      p_body,
      '/',              -- al mapa: '/admin' rebotaba a cualquiera que no fuera admin
      v_key
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

-- ── 3. Probar el push sin despertar a nadie más ─────────────────────────────

create or replace function public.admin_send_test_push_to_self()
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden lanzar una prueba de push.';
  end if;

  -- La marca lleva el instante: repetir la prueba tiene que volver a sonar, y
  -- el unique (user_id, dedupe_key) descartaría en silencio un duplicado.
  select public.create_notification(
    auth.uid(),
    'announcement',
    'system',
    'Prueba de notificación',
    'Si ves esto en tu pantalla de bloqueo, el push funciona en este dispositivo.',
    '/',
    'self_push_test_' || extract(epoch from now())::bigint::text
  ) into v_id;

  return v_id;
end;
$fn$;

grant execute on function public.admin_send_test_push_to_self() to authenticated, service_role;
