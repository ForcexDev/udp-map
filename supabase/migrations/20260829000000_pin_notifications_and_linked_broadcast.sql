-- ============================================================================
-- Tres huecos de notificación, y una difusión que por fin lleva a algún sitio.
--
-- Del inventario de lo que la aplicación avisa hoy salieron tres cosas que no
-- avisa y debería:
--
--  1. VERIFICAR UN PIN NO AVISABA A NADIE. `verify_and_make_permanent` da +25
--     de karma al autor y ahí se acaba: la persona se entera solo si vuelve a
--     mirar su pin. Es el momento en que alguien recibe algo por lo que hizo, y
--     era justo el que pasaba en silencio.
--
--  2. COMENTAR UN PIN TAMPOCO. El foro sí avisa (`notify_forum_reply`), los
--     pines no. Alguien publica "Sala libre en la FIC", otro comenta "ya no
--     está", y el autor nunca lo sabe — que es la conversación que más importa
--     de las dos, porque corrige el mapa.
--
--  3. LA DIFUSIÓN NO LLEVABA A NINGUNA PARTE. Su `url` era '/' fija, así que
--     tocar el aviso te dejaba en el mapa preguntándote qué había pasado. Ahora
--     acepta un pin: "corte de agua en Ejército 441" puede abrir el pin del
--     corte de agua.
--
-- Y de paso se emite `broadcast_sent` al registro de actividad, que estaba
-- declarado en el CHECK de `activity_log` y no lo escribía nadie.
--
-- CATEGORÍA NUEVA: `pins`. Los dos avisos nuevos son sobre TU contenido en el
-- mapa, que no es tu perfil ni el foro ni un evento. Meterlos en 'profile'
-- habría repetido el error que ya se arregló con los avisos de difusión, que
-- llegaban disfrazados de logro.
--
-- REQUIERE la migración 20260828000000 (activity_log) aplicada antes.
-- APLICAR A MANO desde el SQL Editor. Deshacer:
-- 20260829000000_pin_notifications_and_linked_broadcast.down.sql
-- ============================================================================

-- ── 1. Los tipos y la categoría nuevos ──────────────────────────────────────

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (
    type in (
      'achievement', 'forum_reply', 'event_reminder',
      'moderation_report', 'moderation_update', 'announcement',
      'pin_verified', 'pin_comment'
    )
  );

alter table public.notifications drop constraint if exists notifications_category_check;
alter table public.notifications
  add constraint notifications_category_check check (
    category in ('profile', 'forum', 'events', 'moderation', 'system', 'pins')
  );

-- ── 2. Te verificaron el pin ────────────────────────────────────────────────

create or replace function public.notify_pin_verified()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if new.is_permanent is not distinct from old.is_permanent then return new; end if;
  if not new.is_permanent then return new; end if;
  if new.creator_id is null then return new; end if;
  -- Verificarse el propio pin no es noticia para uno mismo.
  if new.creator_id = auth.uid() then return new; end if;

  perform public.create_notification(
    new.creator_id,
    'pin_verified',
    'pins',
    'Tu publicación fue verificada',
    '“' || left(new.title, 80) || '” ya es permanente. Ganaste 25 de karma.',
    '/mapa?pin=' || new.id::text,
    'pin_verified:' || new.id::text,
    jsonb_build_object('pinId', new.id),
    auth.uid()
  );
  return new;
end;
$fn$;

drop trigger if exists on_pin_verified_notification on public.pins;
create trigger on_pin_verified_notification
  after update of is_permanent on public.pins
  for each row execute function public.notify_pin_verified();

-- ── 3. Comentaron tu pin ────────────────────────────────────────────────────

create or replace function public.notify_pin_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_pin    record;
  v_actor  text;
begin
  select creator_id, title into v_pin from public.pins where id = new.pin_id;
  if v_pin.creator_id is null then return new; end if;
  -- Comentar lo tuyo no se notifica a ti mismo.
  if v_pin.creator_id = new.author_id then return new; end if;

  select coalesce(name, 'Alguien') into v_actor from public.profiles where id = new.author_id;

  -- El dedupe lleva el id del comentario: dos comentarios distintos en el mismo
  -- pin son dos avisos. Agruparlos por pin silenciaría el segundo, que suele
  -- ser el que corrige al primero.
  perform public.create_notification(
    v_pin.creator_id,
    'pin_comment',
    'pins',
    'Nuevo comentario en tu publicación',
    coalesce(v_actor, 'Alguien') || ' comentó en “' || left(v_pin.title, 60) || '”',
    '/mapa?pin=' || new.pin_id::text,
    'pin_comment:' || new.id::text,
    jsonb_build_object('pinId', new.pin_id, 'commentId', new.id),
    new.author_id
  );
  return new;
end;
$fn$;

drop trigger if exists on_pin_comment_notification on public.pin_comments;
create trigger on_pin_comment_notification
  after insert on public.pin_comments
  for each row execute function public.notify_pin_comment();

-- ── 4. La difusión, con destino ─────────────────────────────────────────────

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

grant execute on function public.admin_broadcast_push_notification(text, text, text) to authenticated, service_role;

-- La firma vieja de dos argumentos se retira para que no queden dos versiones
-- conviviendo: PostgREST elegiría por los argumentos que le manden y acabaría
-- llamándose la que no lleva destino sin que nadie se entere.
drop function if exists public.admin_broadcast_push_notification(text, text);
