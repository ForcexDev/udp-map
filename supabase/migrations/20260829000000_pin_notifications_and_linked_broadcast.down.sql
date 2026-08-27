-- ============================================================================
-- Deshace 20260829000000_pin_notifications_and_linked_broadcast.sql.
--
-- OJO: los CHECK vuelven a su forma estrecha. Si ya se emitió algún aviso de
-- tipo 'pin_verified' o 'pin_comment', o de categoría 'pins', el ALTER falla —
-- y eso es lo correcto: deshacer una migración no puede borrar avisos de nadie.
-- Para reclasificarlos antes, aceptando que se lean como otra cosa:
--
--   update public.notifications
--      set type = 'achievement', category = 'profile'
--    where type in ('pin_verified', 'pin_comment') or category = 'pins';
-- ============================================================================

drop trigger if exists on_pin_verified_notification on public.pins;
drop trigger if exists on_pin_comment_notification on public.pin_comments;
drop function if exists public.notify_pin_verified();
drop function if exists public.notify_pin_comment();

drop function if exists public.admin_broadcast_push_notification(text, text, text);

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

  v_key := 'announcement_' || extract(epoch from now())::bigint::text;

  for v_sub in select distinct user_id from public.push_subscriptions loop
    perform public.create_notification(
      v_sub.user_id, 'announcement', 'system', p_title, p_body, '/', v_key
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

grant execute on function public.admin_broadcast_push_notification(text, text) to authenticated, service_role;

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications
  add constraint notifications_category_check check (
    category in ('profile', 'forum', 'events', 'moderation', 'system')
  );

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in ('achievement', 'forum_reply', 'event_reminder',
             'moderation_report', 'moderation_update', 'announcement')
  );
