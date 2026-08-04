-- Sprint 4: centro de notificaciones, Web Push y cola de moderación.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null check (type in (
    'achievement', 'forum_reply', 'event_reminder',
    'moderation_report', 'moderation_update'
  )),
  category text not null check (category in ('profile', 'forum', 'events', 'moderation')),
  audience text not null default 'personal' check (audience in ('personal', 'admin')),
  title text not null,
  body text not null,
  url text not null default '/',
  payload jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, category, created_at desc)
  where read_at is null;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

create table if not exists public.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, subscription_id)
);

create index if not exists notification_deliveries_pending_idx
  on public.notification_push_deliveries (next_attempt_at, created_at)
  where status = 'pending';

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in (
    'pin', 'pin_comment', 'forum_thread', 'forum_comment'
  )),
  target_id uuid not null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in (
    'spam', 'harassment', 'misinformation', 'inappropriate', 'other'
  )),
  details text check (details is null or char_length(details) <= 1000),
  snapshot jsonb not null,
  status text not null default 'pending' check (status in (
    'pending', 'reviewing', 'resolved', 'dismissed'
  )),
  assigned_to uuid references public.profiles(id) on delete set null,
  resolution_action text check (resolution_action is null or resolution_action in ('dismiss', 'delete')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index if not exists content_reports_active_reporter_target_uidx
  on public.content_reports (reporter_id, target_type, target_id)
  where status in ('pending', 'reviewing');
create index if not exists content_reports_queue_idx
  on public.content_reports (status, created_at desc);

alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_push_deliveries enable row level security;
alter table public.content_reports enable row level security;

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.user_role() <> 'guest');

drop policy if exists content_reports_read_own_or_admin on public.content_reports;
create policy content_reports_read_own_or_admin on public.content_reports for select
  using (reporter_id = auth.uid() or public.user_role() = 'admin');

revoke all on public.notifications from anon;
revoke insert, delete on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

revoke all on public.push_subscriptions from anon;
revoke insert, update on public.push_subscriptions from authenticated;
grant select, delete on public.push_subscriptions to authenticated;

revoke all on public.notification_push_deliveries from anon, authenticated;

revoke all on public.content_reports from anon;
revoke insert, update, delete on public.content_reports from authenticated;
grant select on public.content_reports to authenticated;

create or replace function public.set_notification_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_notification_updated_at();

create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

drop trigger if exists content_reports_updated_at on public.content_reports;
create trigger content_reports_updated_at
  before update on public.content_reports
  for each row execute function public.set_notification_updated_at();

create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_category text,
  p_title text,
  p_body text,
  p_url text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb,
  p_actor_id uuid default null,
  p_audience text default 'personal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
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
$$;

revoke all on function public.create_notification(uuid, text, text, text, text, text, text, jsonb, uuid, text)
  from public, anon, authenticated;

create or replace function public.queue_notification_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_push_deliveries (notification_id, subscription_id)
  select new.id, subscription.id
  from public.push_subscriptions subscription
  where subscription.user_id = new.user_id
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_notification_queue_push on public.notifications;
create trigger on_notification_queue_push
  after insert on public.notifications
  for each row execute function public.queue_notification_push();

create or replace function public.notify_badge_awarded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_badge public.badges%rowtype;
begin
  select * into v_badge from public.badges where id = new.badge_id;

  perform public.create_notification(
    new.user_id,
    'achievement',
    'profile',
    'Nuevo logro desbloqueado',
    coalesce(v_badge.name, 'Obtuviste una nueva insignia'),
    '/perfil?tab=badges',
    'achievement:' || new.badge_id,
    jsonb_build_object('badgeId', new.badge_id),
    null,
    'personal'
  );
  return new;
end;
$$;

drop trigger if exists on_user_badge_notification on public.user_badges;
create trigger on_user_badge_notification
  after insert on public.user_badges
  for each row execute function public.notify_badge_awarded();

create or replace function public.notify_forum_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_thread_title text;
  v_actor_name text;
begin
  select title into v_thread_title
  from public.forum_threads
  where id = new.thread_id;

  if new.parent_comment_id is null then
    select author_id into v_recipient
    from public.forum_threads
    where id = new.thread_id;
  else
    select author_id into v_recipient
    from public.forum_comments
    where id = new.parent_comment_id;
  end if;

  if v_recipient is null or v_recipient = new.author_id then return new; end if;

  select coalesce(name, 'Alguien') into v_actor_name
  from public.profiles
  where id = new.author_id;

  perform public.create_notification(
    v_recipient,
    'forum_reply',
    'forum',
    'Nueva respuesta en el foro',
    v_actor_name || ' respondió en “' || left(coalesce(v_thread_title, 'tu hilo'), 80) || '”',
    '/foro?thread=' || new.thread_id::text,
    'forum_reply:' || new.id::text,
    jsonb_build_object(
      'threadId', new.thread_id,
      'commentId', new.id,
      'parentCommentId', new.parent_comment_id
    ),
    new.author_id,
    'personal'
  );
  return new;
end;
$$;

drop trigger if exists on_forum_comment_notification on public.forum_comments;
create trigger on_forum_comment_notification
  after insert on public.forum_comments
  for each row execute function public.notify_forum_reply();

create or replace function public.enqueue_event_reminder(p_user_id uuid, p_pin_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.pins%rowtype;
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
$$;

revoke all on function public.enqueue_event_reminder(uuid, uuid) from public, anon, authenticated;

create or replace function public.notify_event_rsvp_in_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.enqueue_event_reminder(new.user_id, new.pin_id);
  return new;
end;
$$;

drop trigger if exists on_event_rsvp_notification on public.event_rsvps;
create trigger on_event_rsvp_notification
  after insert or update of status on public.event_rsvps
  for each row execute function public.notify_event_rsvp_in_window();

create or replace function public.enqueue_upcoming_event_notifications()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
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
$$;

revoke all on function public.enqueue_upcoming_event_notifications() from public, anon, authenticated;
grant execute on function public.enqueue_upcoming_event_notifications() to service_role;

create or replace function public.create_content_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reporter uuid := auth.uid();
  v_snapshot jsonb;
  v_author_id uuid;
  v_existing_id uuid;
  v_report_id uuid;
begin
  if v_reporter is null or public.user_role() = 'guest' then
    raise exception 'Debes iniciar sesión para reportar contenido';
  end if;
  if p_target_type not in ('pin', 'pin_comment', 'forum_thread', 'forum_comment') then
    raise exception 'Tipo de contenido inválido';
  end if;
  if p_reason not in ('spam', 'harassment', 'misinformation', 'inappropriate', 'other') then
    raise exception 'Motivo inválido';
  end if;
  if char_length(coalesce(p_details, '')) > 1000 then
    raise exception 'El detalle no puede superar 1000 caracteres';
  end if;

  select id into v_existing_id
  from public.content_reports
  where reporter_id = v_reporter
    and target_type = p_target_type
    and target_id = p_target_id
    and status in ('pending', 'reviewing')
  limit 1;
  if v_existing_id is not null then return v_existing_id; end if;

  case p_target_type
    when 'pin' then
      select creator_id,
        jsonb_build_object('title', title, 'content', description, 'type', type, 'categoryId', category_id)
      into v_author_id, v_snapshot
      from public.pins where id = p_target_id;
    when 'pin_comment' then
      select author_id,
        jsonb_build_object('content', body, 'pinId', pin_id)
      into v_author_id, v_snapshot
      from public.pin_comments where id = p_target_id;
    when 'forum_thread' then
      select author_id,
        jsonb_build_object('title', title, 'content', content, 'facultyId', faculty_id)
      into v_author_id, v_snapshot
      from public.forum_threads where id = p_target_id;
    when 'forum_comment' then
      select author_id,
        jsonb_build_object('content', content, 'threadId', thread_id, 'parentCommentId', parent_comment_id)
      into v_author_id, v_snapshot
      from public.forum_comments where id = p_target_id;
  end case;

  if v_snapshot is null then raise exception 'El contenido ya no existe'; end if;
  if v_author_id = v_reporter then raise exception 'No puedes reportar tu propio contenido'; end if;

  insert into public.content_reports (
    target_type, target_id, reporter_id, reason, details, snapshot
  ) values (
    p_target_type, p_target_id, v_reporter, p_reason, nullif(trim(p_details), ''), v_snapshot
  ) returning id into v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.create_content_report(text, uuid, text, text) from public, anon;
grant execute on function public.create_content_report(text, uuid, text, text) to authenticated;

create or replace function public.notify_admins_about_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin record;
begin
  for v_admin in select id from public.profiles where role = 'admin' loop
    perform public.create_notification(
      v_admin.id,
      'moderation_report',
      'moderation',
      'Nuevo contenido reportado',
      'Hay un reporte de ' || replace(new.target_type, '_', ' ') || ' esperando revisión.',
      '/moderacion?report=' || new.id::text,
      'moderation_report:' || new.id::text,
      jsonb_build_object('reportId', new.id, 'targetType', new.target_type, 'reason', new.reason),
      new.reporter_id,
      'admin'
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists on_content_report_notification on public.content_reports;
create trigger on_content_report_notification
  after insert on public.content_reports
  for each row execute function public.notify_admins_about_report();

create or replace function public.claim_moderation_report(p_report_id uuid)
returns public.content_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.content_reports;
begin
  if public.user_role() <> 'admin' then raise exception 'Acceso exclusivo para administradores'; end if;

  update public.content_reports
  set status = 'reviewing', assigned_to = auth.uid()
  where id = p_report_id and status in ('pending', 'reviewing')
    and (assigned_to is null or assigned_to = auth.uid())
  returning * into v_report;

  if v_report.id is null then raise exception 'El reporte ya está asignado o resuelto'; end if;
  return v_report;
end;
$$;

revoke all on function public.claim_moderation_report(uuid) from public, anon;
grant execute on function public.claim_moderation_report(uuid) to authenticated;

create or replace function public.resolve_moderation_report(
  p_report_id uuid,
  p_action text,
  p_note text default null
)
returns public.content_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.content_reports;
begin
  if public.user_role() <> 'admin' then raise exception 'Acceso exclusivo para administradores'; end if;
  if p_action not in ('dismiss', 'delete') then raise exception 'Acción inválida'; end if;
  if char_length(coalesce(p_note, '')) > 1000 then raise exception 'La nota no puede superar 1000 caracteres'; end if;

  select * into v_report from public.content_reports where id = p_report_id for update;
  if v_report.id is null then raise exception 'Reporte inexistente'; end if;
  if v_report.status in ('resolved', 'dismissed') then raise exception 'El reporte ya fue resuelto'; end if;

  if p_action = 'delete' then
    case v_report.target_type
      when 'pin' then delete from public.pins where id = v_report.target_id;
      when 'pin_comment' then delete from public.pin_comments where id = v_report.target_id;
      when 'forum_thread' then delete from public.forum_threads where id = v_report.target_id;
      when 'forum_comment' then delete from public.forum_comments where id = v_report.target_id;
    end case;
  end if;

  update public.content_reports
  set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end,
      assigned_to = auth.uid(),
      resolution_action = p_action,
      resolution_note = nullif(trim(p_note), ''),
      resolved_at = now()
  where id = p_report_id
  returning * into v_report;

  perform public.create_notification(
    v_report.reporter_id,
    'moderation_update',
    'profile',
    'Revisión de reporte completada',
    case when p_action = 'delete'
      then 'El contenido reportado fue eliminado.'
      else 'El reporte fue revisado y descartado.'
    end,
    '/perfil',
    'moderation_update:' || v_report.id::text,
    jsonb_build_object('reportId', v_report.id, 'action', p_action),
    auth.uid(),
    'personal'
  );

  return v_report;
end;
$$;

revoke all on function public.resolve_moderation_report(uuid, text, text) from public, anon;
grant execute on function public.resolve_moderation_report(uuid, text, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
    alter publication supabase_realtime add table public.content_reports;
  end if;
exception
  when duplicate_object then null;
end;
$$;
