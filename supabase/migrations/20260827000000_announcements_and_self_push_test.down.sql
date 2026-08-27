-- ============================================================================
-- Deshace 20260827000000_announcements_and_self_push_test.sql.
--
-- OJO: los CHECK vuelven a su forma estrecha, así que si ya se emitió algún
-- aviso con type='announcement' o category='system', el ALTER falla. Ese es el
-- comportamiento correcto —no se borran avisos de nadie por deshacer una
-- migración—, pero significa que hay que decidir a mano qué hacer con ellos.
-- Para reclasificarlos antes de deshacer, y solo si se acepta que un aviso de
-- difusión vuelva a leerse como un logro:
--
--   update public.notifications
--      set type = 'achievement', category = 'profile'
--    where type = 'announcement' or category = 'system';
-- ============================================================================

drop function if exists public.admin_send_test_push_to_self();

create or replace function public.admin_broadcast_push_notification(p_title text, p_body text)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_sub   record;
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
$fn$;

alter table public.notifications
  drop constraint if exists notifications_category_check;
alter table public.notifications
  add constraint notifications_category_check check (
    category in ('profile', 'forum', 'events', 'moderation')
  );

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'achievement',
      'forum_reply',
      'event_reminder',
      'moderation_report',
      'moderation_update'
    )
  );
