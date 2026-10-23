-- ============================================================================
-- La cola de push sin duplicados, sin atascos y sin perder el rastro.
--
-- Tres problemas de `notification_push_deliveries`, vistos al revisar send-push
-- (docs/historico/2026-10/auditoria-push.md, hallazgos 12, 13 y 14):
--
-- 1. DOS EJECUCIONES ENVÍAN LO MISMO DOS VECES. send-push lee las entregas
--    `pending` con un SELECT y las marca al terminar, y entre una cosa y otra
--    nada dice "esta ya la tiene alguien". Basta con que el cron y el botón del
--    panel coincidan, o con que un lote tarde más de un minuto, para que dos
--    ejecuciones lean las mismas filas y las manden las dos. Hoy lo único que lo
--    amortigua es el `tag` de la notificación en el cliente, que es una cortesía
--    de la pantalla y no una garantía.
--
-- 2. EL CASCADE BORRA EL RASTRO DE LOS FALLOS. Cuando el servicio push contesta
--    410, send-push borra la suscripción, y `on delete cascade` se lleva con ella
--    todas sus entregas —las `failed` y las `sent` también—. Justo cuando un
--    fallo tendría algo que contar, la fila que lo contaba desaparece.
--
-- 3. FALTA UN ÍNDICE en `subscription_id`. register_push_subscription borra por
--    esa columna en cada vuelta a primer plano de la app, y la acción de la clave
--    foránea cuando se borra una suscripción también tiene que encontrar sus
--    filas por ahí.
--
-- POR QUÉ UN LEASE Y NO UN ESTADO `processing`
--
-- Reclamar una fila es empujar su `next_attempt_at` al futuro (el lease) y
-- contar el intento, todo en la misma sentencia que la elige (`for update skip
-- locked`). Mientras dure el lease, nadie más la ve como pendiente. El estado
-- `processing` habría dado lo mismo a primera vista, pero tiene dos problemas: el
-- CHECK actual no lo admite, y sobre todo, sin un recuperador que devuelva a
-- `pending` las filas de una ejecución que murió a mitad (el límite de tiempo de
-- la Edge Function, un despliegue), se quedarían atascadas para siempre.
--
-- El lease se recupera solo: al vencer, la fila vuelve a ser reclamable, con el
-- intento ya contado. Así una fila que mata la función cada vez agota sus
-- intentos y acaba `failed`, en vez de dar vueltas eternamente.
--
-- EL CIERRE LLEVA FENCING. Quien reclama recibe `attempts` y lo devuelve al
-- cerrar; finish_push_deliveries solo escribe si la fila sigue `pending` Y con
-- ese mismo `attempts`. Si el lease venció y otra ejecución la reclamó (ahora
-- con attempts + 1), o el trigger de abajo la pasó a `expired`, el cierre
-- atrasado no hace nada y no pisa el resultado bueno.
--
-- POR QUÉ UN TRIGGER BEFORE DELETE
--
-- `on delete set null` conserva el rastro, pero por sí solo deja huérfanas las
-- entregas `pending` de la suscripción borrada: con `subscription_id` nulo ni el
-- `push_subscriptions!inner` de send-push ni claim_push_deliveries las ven, así
-- que no se enviarían nunca ni se cerrarían nunca. Y el borrado no siempre pasa
-- por el 410: desactivar el push, cerrar sesión, admin_delete_push_subscription,
-- el cascade desde `profiles`. Un trigger sobre la tabla los cubre todos a la vez.
--
-- Tiene que ser BEFORE: en AFTER la acción SET NULL de la clave foránea ya habría
-- vaciado `subscription_id` y el trigger no encontraría qué expirar. Es SECURITY
-- DEFINER porque quien borra es `authenticated` (sus propias suscripciones), y
-- ese rol no tiene ningún permiso sobre la cola.
--
-- EL HOST, NO EL ENDPOINT. `push_host` guarda solo el host del servicio push
-- (web.push.apple.com, fcm.googleapis.com…). El endpoint completo es una URL de
-- capacidad —identifica a un dispositivo concreto y es lo que hace falta para
-- escribirle— y no tiene por qué sobrevivir a la baja de la suscripción. El host
-- basta para la pregunta que sí importa tras un fallo: qué servicio es el que
-- está rechazando.
--
-- COMPATIBILIDAD — la parte delicada
--
-- El send-push desplegado hoy (eba61ee o 4eae308) sigue funcionando con este
-- esquema, sin tocarlo:
--   · su select usa `push_subscriptions!inner`, así que ignora las filas con
--     `subscription_id` nulo, que son justo las que ya no tienen a quién enviar;
--   · su 404/410 borra la suscripción, y el trigger convierte esa baja en
--     entregas `expired` en vez de dejar que el CASCADE las desaparezca;
--   · solo escribe `pending`, `sent` y `failed`, que el CHECK ampliado admite.
-- Lo que NO hace es reclamar con lease, así que la carrera del punto 1 sigue
-- abierta hasta desplegar el send-push nuevo. Por eso el orden es: esta
-- migración primero, la función después. Al revés, la función nueva llamaría a
-- RPC que no existen y cada pasada fallaría.
--
-- REQUIERE 20260831000000 (notification_preferences): queue_notification_push
-- llama a wants_notification.
-- APLICAR A MANO desde el SQL Editor. Deshacer:
-- 20261021000000_push_queue_lease.down.sql
-- ============================================================================

-- ── 1. La tabla: estado `expired`, rastro que sobrevive, host e índice ──────

-- `expired` = "ya no hay a quién enviarla": el servicio push dijo 404/410 o la
-- suscripción se borró antes del envío. No es un fallo (`failed`): reintentar no
-- lo arreglaría, y mezclarlos escondería cuántas entregas fallan de verdad.
alter table public.notification_push_deliveries
  drop constraint if exists notification_push_deliveries_status_check;
alter table public.notification_push_deliveries
  add constraint notification_push_deliveries_status_check
  check (status in ('pending', 'sent', 'failed', 'expired'));

-- SET NULL y no CASCADE: borrar la suscripción deja la entrega, sin dueño. El
-- `unique (notification_id, subscription_id)` no se opone: Postgres trata cada
-- NULL como distinto, así que varias entregas huérfanas de un mismo aviso caben.
alter table public.notification_push_deliveries
  alter column subscription_id drop not null;
alter table public.notification_push_deliveries
  drop constraint if exists notification_push_deliveries_subscription_id_fkey;
alter table public.notification_push_deliveries
  add constraint notification_push_deliveries_subscription_id_fkey
  foreign key (subscription_id) references public.push_subscriptions(id) on delete set null;

alter table public.notification_push_deliveries
  add column if not exists push_host text;

-- Las filas que ya existen conservan su suscripción (con CASCADE no podía haber
-- otras), así que el host se puede sacar de ahí.
update public.notification_push_deliveries d
   set push_host = split_part(s.endpoint, '/', 3)
  from public.push_subscriptions s
 where s.id = d.subscription_id
   and d.push_host is null;

create index if not exists notification_deliveries_subscription_idx
  on public.notification_push_deliveries (subscription_id);

-- Los `drop constraint if exists` de arriba cuentan con los nombres por defecto
-- de los constraints en línea. Si en la base real se llamaran de otra forma, no
-- borrarían nada y la migración seguiría sin error, con la FK CASCADE y el CHECK
-- estrecho vivos al lado de los nuevos: el CASCADE seguiría borrando el rastro y
-- el CHECK viejo haría fallar el trigger de abajo en cada baja de suscripción.
-- Mejor pararla aquí, con todo deshecho (el SQL Editor corre el script entero en
-- una transacción).
do $chk$
begin
  if (select count(*)
        from pg_constraint
       where conrelid = 'public.notification_push_deliveries'::regclass
         and contype = 'f'
         and confrelid = 'public.push_subscriptions'::regclass) <> 1 then
    raise exception 'notification_push_deliveries tiene más de una clave foránea a push_subscriptions: revisa sus nombres en pg_constraint.';
  end if;
  if (select count(*)
        from pg_constraint
       where conrelid = 'public.notification_push_deliveries'::regclass
         and contype = 'c'
         and pg_get_constraintdef(oid) like '%status%') <> 1 then
    raise exception 'notification_push_deliveries tiene más de un CHECK sobre status: revisa sus nombres en pg_constraint.';
  end if;
end;
$chk$;

-- ── 2. Al encolar, se anota el host ─────────────────────────────────────────

-- Igual que la versión de 20260831000000; lo único nuevo es `push_host`.
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

  insert into public.notification_push_deliveries (notification_id, subscription_id, push_host)
  select new.id, subscription.id, split_part(subscription.endpoint, '/', 3)
  from public.push_subscriptions subscription
  where subscription.user_id = new.user_id
  on conflict do nothing;
  return new;
end;
$fn$;

-- ── 3. Borrar una suscripción expira sus entregas pendientes ────────────────

create or replace function public.expire_pending_push_deliveries()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- `coalesce` porque una fila puede haber entrado sin host (insertada a mano, o
  -- encolada por la versión anterior de queue_notification_push mientras se
  -- aplicaba la 20261021000000): es la última oportunidad de apuntarlo, porque en
  -- cuanto la suscripción se borre ya no hay de dónde sacarlo.
  update public.notification_push_deliveries
     set status = 'expired',
         last_error = 'suscripción borrada antes del envío',
         push_host = coalesce(push_host, split_part(old.endpoint, '/', 3))
   where subscription_id = old.id and status = 'pending';
  return old;
end;
$fn$;

-- Un trigger no comprueba EXECUTE al dispararse (notify_forum_reply ya funciona
-- así), de modo que se le puede quitar a todo el mundo sin que deje de correr.
revoke execute on function public.expire_pending_push_deliveries() from public, anon, authenticated;

drop trigger if exists push_subscriptions_expire_deliveries on public.push_subscriptions;
create trigger push_subscriptions_expire_deliveries
  before delete on public.push_subscriptions
  for each row execute function public.expire_pending_push_deliveries();

-- ── 4. Reclamar y cerrar un lote ────────────────────────────────────────────

/**
 * Reclama hasta `p_limit` entregas listas y las reserva `p_lease_seconds`.
 *
 * Devuelve lo que hace falta para enviar, incluidas las claves de la suscripción
 * (`p256dh`, `auth`): por eso solo `service_role` puede llamarla, y por eso la
 * comprobación de dentro no se fía del GRANT.
 *
 * `attempts` es el número de ESTE intento, ya incrementado. Si quien reclama
 * muere a mitad, la fila vuelve a ser reclamable al vencer el lease con el
 * intento contado, y el fencing de finish_push_deliveries impide que un cierre
 * atrasado pise a la ejecución que la reclamó después.
 *
 * `p_notification_id` limita el reclamo a los envíos de un aviso concreto.
 */
create or replace function public.claim_push_deliveries(
  p_limit           integer default 50,
  p_lease_seconds   integer default 120,
  p_notification_id uuid    default null
)
returns table (
  delivery_id     uuid,
  attempts        integer,
  notification_id uuid,
  title           text,
  body            text,
  url             text,
  type            text,
  category        text,
  payload         jsonb,
  subscription_id uuid,
  endpoint        text,
  p256dh          text,
  auth            text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_column
begin
  -- `is distinct from` y no `<>`: con `<>` un auth.role() nulo daría null, el
  -- `if` no se cumpliría y la función dejaría pasar a cualquiera.
  if auth.role() is distinct from 'service_role' then
    raise exception 'Solo el servicio puede reclamar entregas de push.';
  end if;

  -- Los topes también protegen: un lease de segundos devolvería las filas a la
  -- cola con el lote a medias, y uno de horas atascaría las de una ejecución
  -- muerta.
  if p_limit is null or p_limit < 1 or p_limit > 200 then
    raise exception 'p_limit tiene que estar entre 1 y 200, y llegó: %', p_limit;
  end if;
  if p_lease_seconds is null or p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'p_lease_seconds tiene que estar entre 30 y 900, y llegó: %', p_lease_seconds;
  end if;

  return query
  with candidatas as (
    select d.id
      from public.notification_push_deliveries d
     where d.status = 'pending'
       and d.next_attempt_at <= now()
       and d.subscription_id is not null
       and (p_notification_id is null or d.notification_id = p_notification_id)
     order by d.created_at
     limit p_limit
       for update skip locked
  )
  update public.notification_push_deliveries d
     set next_attempt_at = now() + make_interval(secs => p_lease_seconds),
         attempts = d.attempts + 1
    from candidatas c, public.notifications n, public.push_subscriptions s
   where d.id = c.id
     and n.id = d.notification_id
     and s.id = d.subscription_id
  returning d.id, d.attempts, n.id, n.title, n.body, n.url, n.type, n.category,
            n.payload, s.id, s.endpoint, s.p256dh, s.auth;
end;
$fn$;

revoke execute on function public.claim_push_deliveries(integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer, integer, uuid) to service_role;

/**
 * Cierra un lote de una vez.
 *
 * `p_results` es un array de { id, attempts, status, next_attempt_at, last_error }
 * con `status` en sent | failed | expired | pending (pending = reintento, y
 * entonces `next_attempt_at` es obligatorio).
 *
 * Devuelve los ids que SÍ cerró. Los que faltan en la respuesta es que otra
 * ejecución los reclamó después, o que el trigger los expiró: no hay nada que
 * hacer con ellos y no es un error.
 *
 * `attempts` no se toca: ya se contó al reclamar.
 */
create or replace function public.finish_push_deliveries(p_results jsonb)
returns table (delivery_id uuid)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_column
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Solo el servicio puede cerrar entregas de push.';
  end if;

  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    raise exception 'p_results tiene que ser un array JSON de resultados.';
  end if;

  -- Todo o nada: un estado desconocido aborta el lote entero en vez de cerrar la
  -- mitad. Quien llama es send-push, y un estado así es un error suyo que tiene
  -- que verse, no una fila que se cierra mal en silencio.
  if exists (
    select 1
      from jsonb_to_recordset(p_results)
        as r(id uuid, attempts integer, status text, next_attempt_at timestamptz, last_error text)
     where r.status is null
        or r.status not in ('sent', 'failed', 'expired', 'pending')
        or (r.status = 'pending' and r.next_attempt_at is null)
  ) then
    raise exception 'Resultado de entrega inválido: estado desconocido, o reintento sin next_attempt_at.';
  end if;

  return query
  update public.notification_push_deliveries d
     set status = r.status,
         next_attempt_at = case when r.status = 'pending' then r.next_attempt_at else d.next_attempt_at end,
         last_error = case when r.status = 'sent' then null else left(r.last_error, 1000) end,
         sent_at = case when r.status = 'sent' then now() else d.sent_at end
    from jsonb_to_recordset(p_results)
      as r(id uuid, attempts integer, status text, next_attempt_at timestamptz, last_error text)
   where d.id = r.id
     and d.attempts = r.attempts
     and d.status = 'pending'
  returning d.id;
end;
$fn$;

revoke execute on function public.finish_push_deliveries(jsonb) from public, anon, authenticated;
grant execute on function public.finish_push_deliveries(jsonb) to service_role;
