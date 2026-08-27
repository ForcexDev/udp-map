-- Deshace 20260831000100_official_event_notifies_faculty.sql.
-- Si ya se emitió algún aviso 'event_official', el ALTER falla — correctamente.
-- Para pasar: update public.notifications set type = 'event_reminder'
--             where type = 'event_official';

drop trigger if exists on_official_event_notification on public.pins;
drop function if exists public.notify_faculty_official_event();

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in ('achievement', 'forum_reply', 'event_reminder',
             'moderation_report', 'moderation_update', 'announcement',
             'pin_verified', 'pin_comment')
  );
