-- ============================================================================
-- Que cada quien elija qué avisos quiere, y por dónde.
--
-- Hoy es todo o nada: o tienes el push activado y te llega absolutamente todo,
-- o lo apagas y no te enteras de nada — ni de que respondieron tu hilo, ni de
-- que te verificaron un pin. Con ocho tipos de aviso y más por venir, eso
-- termina en gente apagándolo entero por una categoría que no le interesa, que
-- es la peor forma de perder a alguien.
--
-- DOS EJES, no uno. La categoría dice DE QUÉ es el aviso; el canal, POR DÓNDE
-- llega. Alguien puede querer ver en la app que le comentaron un pin sin que le
-- suene el teléfono a las once de la noche. Un solo interruptor por categoría
-- no permite decir eso.
--
-- LA AUSENCIA DE FILA ES "SÍ A TODO". No se siembra nada al crear una cuenta:
-- una tabla con seis filas por usuario que casi siempre valen `true` es
-- almacenamiento y mantenimiento a cambio de nada. Solo existe fila cuando
-- alguien cambia algo, así que la tabla pesa lo que pesan las excepciones.
--
-- APLICAR A MANO desde el SQL Editor. Deshacer:
-- 20260831000000_notification_preferences.down.sql
-- ============================================================================

create table if not exists public.notification_preferences (
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  category    text        not null check (category in ('profile', 'forum', 'events', 'moderation', 'system', 'pins')),
  /** Si se guarda la notificación en la campana. */
  in_app      boolean     not null default true,
  /** Si además sale al teléfono. Requiere in_app: no se puede mandar push de
   *  algo que no existe. Lo impone el CHECK de abajo, no la interfaz. */
  push        boolean     not null default true,
  updated_at  timestamptz not null default now(),
  primary key (user_id, category),
  constraint push_needs_in_app check (in_app or not push)
);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_own on public.notification_preferences;
create policy notification_preferences_own on public.notification_preferences
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.user_role() <> 'guest');

revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;

-- ── Cómo se consulta ────────────────────────────────────────────────────────

/**
 * ¿Quiere esta persona este aviso por este canal?
 *
 * `coalesce(..., true)` es la regla entera: sin fila, sí. Va como función y no
 * como subconsulta suelta para que `create_notification` y
 * `queue_notification_push` no puedan discrepar.
 */
create or replace function public.wants_notification(
  p_user_id  uuid,
  p_category text,
  p_channel  text  -- 'in_app' | 'push'
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select coalesce(
    (select case when p_channel = 'push' then pref.push else pref.in_app end
       from public.notification_preferences pref
      where pref.user_id = p_user_id and pref.category = p_category),
    true
  );
$fn$;

revoke all on function public.wants_notification(uuid, text, text) from anon;
grant execute on function public.wants_notification(uuid, text, text) to authenticated, service_role;

-- ── Dónde se aplica ─────────────────────────────────────────────────────────

-- 1) En la app: si no lo quiere, la fila no se crea.
create or replace function public.create_notification(
  p_user_id    uuid,
  p_type       text,
  p_category   text,
  p_title      text,
  p_body       text,
  p_url        text,
  p_dedupe_key text,
  p_payload    jsonb default '{}'::jsonb,
  p_actor_id   uuid  default null,
  p_audience   text  default 'personal'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  if p_user_id is null then return null; end if;

  -- Los avisos de trabajo del equipo NO son opcionales: quien modera tiene que
  -- enterarse de una denuncia. Silenciarlos sería dejar la cola sin vigilar sin
  -- que nadie decida hacerlo.
  if p_audience = 'personal' and not public.wants_notification(p_user_id, p_category, 'in_app') then
    return null;
  end if;

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

-- 2) En el teléfono: la fila existe, pero no se encola la entrega.
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
