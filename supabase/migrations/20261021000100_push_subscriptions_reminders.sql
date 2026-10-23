-- ============================================================================
-- Suscripciones que se mudan, recordatorios que no vuelven y avisos que se
-- cuentan bien.
--
-- Cinco problemas vistos al revisar send-push (docs/historico/2026-10/auditoria-push.md,
-- hallazgos A.1, 11, 15, 16 y 19):
--
-- 1. UNA SUSCRIPCIÓN QUE CAMBIA DE ENDPOINT DEJA LA ANTERIOR VIVA. Cuando el
--    navegador entrega un endpoint nuevo (reinstalar la PWA en el iPhone, borrar
--    los datos del sitio), register_push_subscription crea una fila y la vieja
--    se queda: infla el "llegará a N dispositivos" de Difusión y arrastra
--    entregas pendientes que irán a un endpoint que ya no existe. El cliente
--    sabe cuál fue el último endpoint que el servidor confirmó, así que ahora
--    puede decírselo (`p_old_endpoint`) y la base mueve lo pendiente y retira la
--    vieja en el mismo acto.
--
-- 2. EL RECORDATORIO DE UN EVENTO VUELVE A SONAR EN MENOS DE UN MINUTO SI
--    BORRAS EL AVISO. La única barrera contra repetirlo era la fila de
--    `notifications` (su `unique (user_id, dedupe_key)`), y esa fila la puede
--    borrar su dueño (`notifications_delete_own`): el siguiente barrido de
--    enqueue_upcoming_event_notifications, que corre cada minuto, la recrea y
--    vuelve a mandar el push. La idempotencia no puede vivir en algo que el
--    usuario puede vaciar, así que pasa a la propia asistencia:
--    `event_rsvps.reminded_at`. La poda de avisos viejos (20261021000200)
--    tampoco podría existir sin esto: borraría el aviso de un evento todavía
--    próximo y el barrido lo resucitaría.
--
-- 3. `wants_notification` DEJA LEER LAS PREFERENCIAS DE CUALQUIERA. Es SECURITY
--    DEFINER, no mira auth.uid() y tenía EXECUTE para authenticated: cualquier
--    sesión podía preguntar si un tercero silenció los avisos de foro. Nadie
--    la llama desde fuera (ni una política RLS, ni el cliente, ni send-push):
--    la usan create_notification y queue_notification_push, que son definer y
--    se ejecutan con los permisos de su dueño, no de quien las dispara.
--
-- 4. LA DIFUSIÓN CUENTA DESTINATARIOS A LOS QUE NO LES CREÓ EL AVISO, Y DOS
--    DIFUSIONES EN EL MISMO SEGUNDO CHOCAN. El contador subía por cada
--    suscriptor aunque create_notification devolviera null (preferencias, o el
--    dedupe), así que Difusión prometía más gente de la real. Y la clave de
--    dedupe era 'announcement_' + el segundo de la época: la segunda difusión
--    del mismo segundo caía en el `on conflict do nothing` de todos y no llegaba
--    a nadie. Además la función no acotaba la longitud: el panel pone
--    maxLength 60 y 180, pero un RPC directo no, y el payload cifrado tiene un
--    tope de 3993 B (el híbrido duplica el texto).
--
-- 5. NO HAY FORMA DE VER QUÉ SERVICIO PUSH ESTÁ RECHAZANDO. Los `failed` se
--    quedan en la cola sin que nadie los mire. admin_push_delivery_stats los
--    agrupa por host y estado para el panel.
--
-- DECISIONES
--
-- · Se BORRA la firma de cuatro argumentos antes de crear la de cinco. Un
--   `create or replace` con otra lista de argumentos crea una segunda función, y
--   PostgREST no sabe elegir entre dos candidatas ("could not choose the best
--   candidate function"). Es lo que ya se hizo con admin_broadcast_push_
--   notification en 20260829000000. Al final hay una guarda que para la
--   migración si queda más de una firma de cualquiera de las dos.
--
-- · `p_old_endpoint` solo busca entre las suscripciones DE QUIEN LLAMA. El
--   endpoint viejo es un dato que manda el cliente: sin ese filtro, cualquiera
--   podría retirar el dispositivo de otra persona con solo conocer su endpoint.
--   Y solo se mueven las entregas cuyo aviso es de quien llama, por la misma
--   razón que la función ya borra las de un dueño anterior cuando un endpoint
--   cambia de usuario.
--
-- · Lo que se mueve es lo `pending`, con su `attempts` y su lease intactos: el
--   fencing de finish_push_deliveries se apoya en esos dos campos, y una
--   ejecución de send-push que ya la tenga reclamada tiene que poder cerrarla.
--   Lo ya cerrado (`sent`, `failed`, `expired`) se queda con la suscripción
--   vieja, que al borrarse lo deja sin dueño (SET NULL) como rastro. Si la
--   suscripción nueva ya tenía una entrega del mismo aviso, la de la vieja no
--   se mueve (el unique no lo permite) y la expira el trigger al borrarla.
--
-- · `reminded_at` se marca cuando el recordatorio EXISTE: recién creado o ya
--   estaba. Si las preferencias lo silencian no se marca, para que el barrido
--   vuelva a intentarlo cuando la persona los reactive mientras el evento siga
--   en los 20 días. Distinguir "ya estaba" de "silenciado" exige mirar
--   `notifications` cuando create_notification devuelve null, porque devuelve
--   null en los dos casos.
--
-- · EL BACKFILL no marca a todos: marca a quien el barrido ya atendió, que es
--   quien tiene el aviso (aunque lo haya borrado) o no lo tiene silenciado. Quien
--   tiene los avisos de eventos apagados y no tiene el aviso se queda sin marcar;
--   marcarlo le quitaría el recordatorio para siempre si los reactiva.
--
-- · `reminded_at` lo escribe la base y nadie más. event_rsvps tenía `grant all`
--   para authenticated, y un UPDATE de tabla entera deja a cualquiera poner o
--   borrar su propia marca (borrarla reabre el recordatorio; ponerla lo apaga).
--   Se pasa INSERT y UPDATE a columnas (pin_id, user_id, status): son las tres
--   que escribe el upsert del cliente. Las políticas RLS no cambian.
--
-- · enqueue_upcoming_event_notifications conserva su comprobación de rol tal
--   como está, con el `<>` que ahí SÍ importa: pg_cron corre sin JWT,
--   auth.role() es null, la condición da null (no true) y el `if` no se cumple,
--   así que el cron pasa. Cambiarlo a `is distinct from` —como en
--   claim_push_deliveries— lo dejaría fuera. Un estudiante (rol 'authenticated')
--   y un visitante ('anon') sí caen en la excepción.
--
-- COMPATIBILIDAD con lo que está desplegado
--
-- · El frontend actual llama a register_push_subscription con cuatro argumentos
--   con nombre (p_endpoint, p_p256dh, p_auth, p_user_agent). `p_old_endpoint`
--   tiene valor por defecto, así que esa llamada resuelve a la función nueva sin
--   cambios.
-- · El send-push desplegado (20eee7e o anterior) llama a
--   enqueue_upcoming_event_notifications en cada pasada: misma firma, mismo
--   retorno, y ahora no repite. No usa nada más de lo que cambia aquí.
-- · admin_broadcast_push_notification conserva firma y retorno. Lo único que un
--   cliente puede notar es que rechaza lo que pase de 60 y 180 caracteres, que
--   es lo que el panel ya impide.
--
-- REQUIERE 20261021000000 (push_queue_lease): `push_host` y el trigger de
-- borrado de suscripciones. La sección 0 comprueba `push_host` y para la
-- migración si falta: plpgsql no valida las columnas al crear una función, así
-- que sin la guarda pasaría entera y fallarían después register_push_subscription
-- (con `p_old_endpoint`) y admin_push_delivery_stats.
-- ORDEN: esta, después 20261021000200 (cron), después `npm run deploy:push`. El
-- send-push nuevo deja de encolar recordatorios y los pasa al cron de esa
-- migración.
-- APLICAR A MANO desde el SQL Editor. Deshacer:
-- 20261021000100_push_subscriptions_reminders.down.sql
-- ============================================================================

-- ── 0. Guarda: la migración anterior tiene que estar aplicada ──────────────

-- plpgsql no valida las columnas cuando se CREA una función, solo cuando se
-- ejecuta: sin 20261021000000 esta migración pasaría entera, y
-- register_push_subscription (con `p_old_endpoint`) y admin_push_delivery_stats
-- fallarían después con "column push_host does not exist", ya en producción.
-- Va la primera, antes de cambiar nada, y el SQL Editor corre el script entero
-- en una transacción: parar aquí no deja nada a medias. El baseline no necesita
-- esta guarda, porque allí la columna ya existe.
do $req$
begin
  if not exists (
    select 1
      from pg_attribute
     where attrelid = to_regclass('public.notification_push_deliveries')
       and attname = 'push_host'
       and not attisdropped
  ) then
    raise exception 'Falta notification_push_deliveries.push_host. Aplica antes 20261021000000_push_queue_lease y vuelve a aplicar esta migración.';
  end if;
end;
$req$;

-- ── 1. register_push_subscription con `p_old_endpoint` ─────────────────────

drop function if exists public.register_push_subscription(text, text, text, text);

create or replace function public.register_push_subscription(
  p_endpoint     text,
  p_p256dh       text,
  p_auth         text,
  p_user_agent   text default null,
  p_old_endpoint text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id     uuid;
  v_old_id uuid;
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

  -- El navegador entregó un endpoint nuevo y el cliente recuerda el anterior: la
  -- suscripción vieja ya no sirve, pero lo que le quedaba por enviar sí. Solo la
  -- de quien llama: el endpoint viejo lo manda el cliente.
  if nullif(trim(p_old_endpoint), '') is not null and p_old_endpoint <> p_endpoint then
    select id into v_old_id
      from public.push_subscriptions
     where endpoint = p_old_endpoint
       and user_id = auth.uid();

    if v_old_id is not null then
      update public.notification_push_deliveries delivery
         set subscription_id = v_id,
             push_host = split_part(p_endpoint, '/', 3)
       where delivery.subscription_id = v_old_id
         and delivery.status = 'pending'
         and exists (
           select 1 from public.notifications notification
            where notification.id = delivery.notification_id
              and notification.user_id = auth.uid()
         )
         and not exists (
           select 1 from public.notification_push_deliveries ya
            where ya.notification_id = delivery.notification_id
              and ya.subscription_id = v_id
         );

      -- El trigger BEFORE DELETE expira las pendientes que no se pudieron mover.
      delete from public.push_subscriptions where id = v_old_id;
    end if;
  end if;

  return v_id;
end;
$fn$;

-- Una función nueva nace con EXECUTE para PUBLIC (y, en Supabase, para anon por
-- los privilegios por defecto): hay que quitárselo explícitamente.
revoke execute on function public.register_push_subscription(text, text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text, text) to authenticated, service_role;

-- ── 2. `reminded_at`: el recordatorio se manda una vez por asistencia ──────

alter table public.event_rsvps
  add column if not exists reminded_at timestamptz;

-- Hasta hoy, el barrido de cada minuto ya avisó a toda asistencia a un evento
-- de los próximos 20 días. Sin esto, la primera pasada tras la migración
-- recrearía y reenviaría los avisos que alguien borró. No se marca a quien tiene
-- apagados los avisos de eventos y no tiene el aviso: el barrido no le avisó, y
-- se lo debe si los reactiva (ver la cabecera).
update public.event_rsvps rsvp
   set reminded_at = now()
  from public.pins event
 where event.id = rsvp.pin_id
   and event.type = 'event'
   and event.starts_at > now()
   and event.starts_at <= now() + interval '20 days'
   and rsvp.reminded_at is null
   and (
     exists (
       select 1 from public.notifications notification
        where notification.user_id = rsvp.user_id
          and notification.dedupe_key = 'event_reminder:' || event.id::text
     )
     or public.wants_notification(rsvp.user_id, 'events', 'in_app')
   );

-- Solo avisa si el evento cae dentro de los próximos 20 días, y una vez por
-- asistencia. Mismo cuerpo que antes salvo la marca.
create or replace function public.enqueue_event_reminder(p_user_id uuid, p_pin_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_event           public.pins%rowtype;
  v_notification_id uuid;
  v_dedupe          text;
begin
  -- Ya se avisó de esta asistencia, aunque la persona haya borrado el aviso.
  if exists (
    select 1 from public.event_rsvps
     where user_id = p_user_id and pin_id = p_pin_id and reminded_at is not null
  ) then
    return false;
  end if;

  select * into v_event
  from public.pins
  where id = p_pin_id
    and type = 'event'
    and starts_at > now()
    and starts_at <= now() + interval '20 days';

  if not found then return false; end if;

  v_dedupe := 'event_reminder:' || v_event.id::text;

  v_notification_id := public.create_notification(
    p_user_id,
    'event_reminder',
    'events',
    'Evento próximo',
    '“' || left(v_event.title, 100) || '” comienza el ' ||
      to_char(v_event.starts_at at time zone 'America/Santiago', 'DD/MM a las HH24:MI'),
    '/eventos?event=' || v_event.id::text,
    v_dedupe,
    jsonb_build_object('pinId', v_event.id, 'startsAt', v_event.starts_at),
    v_event.creator_id,
    'personal'
  );

  -- create_notification devuelve null tanto si el aviso ya existía (dedupe) como
  -- si las preferencias lo silencian. Solo el primer caso cuenta como avisado.
  if v_notification_id is not null
     or exists (
       select 1 from public.notifications
        where user_id = p_user_id and dedupe_key = v_dedupe
     ) then
    update public.event_rsvps
       set reminded_at = now()
     where user_id = p_user_id and pin_id = p_pin_id and reminded_at is null;
  end if;

  -- Sigue contando solo los avisos RECIÉN creados, como antes.
  return v_notification_id is not null;
end;
$fn$;

-- La llama el cron (20261021000200) y, mientras no se despliegue el send-push
-- nuevo, también el send-push anterior. Mismo cuerpo que antes salvo el filtro
-- `reminded_at is null`; la comprobación de rol NO se toca (ver la cabecera).
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
      and rsvp.reminded_at is null
  loop
    if public.enqueue_event_reminder(v_row.user_id, v_row.pin_id) then
      v_created := v_created + 1;
    end if;
  end loop;

  return v_created;
end;
$fn$;

-- Ver la cabecera: la marca la escribe la base y nadie más.
revoke insert, update on public.event_rsvps from anon, authenticated;
grant insert (pin_id, user_id, status), update (pin_id, user_id, status)
  on public.event_rsvps to anon, authenticated;

-- ── 3. `wants_notification`: solo para el servicio ──────────────────────────

-- `public` también: la migración que la creó solo le quitó anon, y una función
-- nueva nace con EXECUTE para PUBLIC, que incluye a authenticated.
revoke execute on function public.wants_notification(uuid, text, text) from public, anon, authenticated;
grant execute on function public.wants_notification(uuid, text, text) to service_role;

-- ── 4. Difusión: cuenta lo que creó, con clave propia y con límites ─────────

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
  v_id    uuid;
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

  -- Los mismos topes que el panel (maxLength 60 y 180). El payload cifrado no
  -- puede pasar de 3993 B y el híbrido repite el texto; un RPC directo no pasa
  -- por el panel.
  if char_length(p_title) > 60 then
    raise exception 'El título del aviso no puede pasar de 60 caracteres, y llegó con %.', char_length(p_title);
  end if;

  if char_length(p_body) > 180 then
    raise exception 'El mensaje del aviso no puede pasar de 180 caracteres, y llegó con %.', char_length(p_body);
  end if;

  -- El destino tiene que ser una ruta DE ESTA aplicación. Sin esto, un aviso
  -- podría mandar a toda la universidad a una web ajena con un toque, que es
  -- exactamente la forma de un ataque de phishing servido por nosotros mismos.
  v_url := coalesce(nullif(trim(p_url), ''), '/');
  if v_url !~ '^/[A-Za-z0-9/_?=&%.-]*$' then
    raise exception 'El destino del aviso tiene que ser una ruta interna, y llegó: %', v_url;
  end if;

  -- Una clave por difusión. Con el segundo de la época, dos difusiones en el
  -- mismo segundo compartían clave y la segunda no llegaba a nadie. El unique es
  -- (user_id, dedupe_key), así que la misma clave para todos los destinatarios
  -- de ESTA difusión no choca entre sí.
  v_key := 'announcement_' || gen_random_uuid()::text;

  for v_sub in select distinct user_id from public.push_subscriptions loop
    v_id := public.create_notification(
      v_sub.user_id, 'announcement', 'system',
      p_title, p_body, v_url, v_key
    );
    -- null = no se creó (la persona silenció los avisos del sistema): no cuenta.
    if v_id is not null then
      v_count := v_count + 1;
    end if;
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

-- ── 5. Estado de las entregas, por servicio push ────────────────────────────

/**
 * Cuántas entregas de los últimos `p_days` días hay en cada estado, una fila por
 * host del servicio push y los que más fallan primero. Para ver de un vistazo qué
 * servicio es el que rechaza. Se agrupa aquí y no en el cliente: así la pantalla
 * pinta las filas tal cual llegan.
 *
 * `last_at` es la creación de la entrega más reciente del host, y `last_error`
 * el último error no nulo. El error se devuelve con cualquier URL recortada a su
 * host: las entregas anteriores a 4eae308 podían guardar el endpoint entero, que
 * es una URL de capacidad que identifica un dispositivo.
 *
 * LA VENTANA NO ES SIMÉTRICA CON LA PURGA. `p_days` admite hasta 90, pero
 * prune_push_history (20261021000200) borra las entregas `sent` y `expired` a
 * los 30 días y las `failed` a los 90. Con `p_days` mayor que 30 la consulta
 * todavía ve todos los fallos y ya no ve los envíos ni las caducidades de más de
 * 30 días, así que las proporciones entre estados se inclinan hacia `failed`.
 * Para comparar estados, 30 días o menos; de 31 a 90 solo sirve para rastrear
 * fallos. Las `pending` no se purgan por edad. No se acota `p_days` a 30
 * porque los `failed` se guardan 90 días justamente para poder mirarlos.
 *
 * Solo admin, comprobado dentro: el GRANT no es control de acceso.
 */
create or replace function public.admin_push_delivery_stats(p_days integer default 7)
returns table (
  host       text,
  sent       integer,
  failed     integer,
  expired    integer,
  pending    integer,
  last_at    timestamptz,
  last_error text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
#variable_conflict use_column
declare
  v_days integer;
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden ver el estado de las entregas push.';
  end if;

  v_days := least(greatest(coalesce(p_days, 7), 1), 90);

  return query
    select coalesce(d.push_host, '(sin host)'),
           (count(*) filter (where d.status = 'sent'))::integer,
           (count(*) filter (where d.status = 'failed'))::integer,
           (count(*) filter (where d.status = 'expired'))::integer,
           (count(*) filter (where d.status = 'pending'))::integer,
           max(d.created_at),
           regexp_replace(
             (array_agg(d.last_error order by d.created_at desc)
                filter (where d.last_error is not null))[1],
             '(https?://[^/[:space:]]+)/[^[:space:]]*', '\1/…', 'g')
      from public.notification_push_deliveries d
     where d.created_at >= now() - make_interval(days => v_days)
     group by 1
     order by 3 desc, count(*) desc, 1;
end;
$fn$;

revoke execute on function public.admin_push_delivery_stats(integer) from public, anon;
grant execute on function public.admin_push_delivery_stats(integer) to authenticated, service_role;

-- ── 6. Autotest: clave propia por envío ─────────────────────────────────────

-- La clave llevaba el segundo de la época: dos pruebas en el mismo segundo (dos
-- pestañas, dos dispositivos) compartían clave, la segunda no se creaba y el
-- panel le echaba la culpa a las preferencias. Es el mismo choque que la
-- difusión ya resolvió con un uuid.
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

  select public.create_notification(
    auth.uid(),
    'announcement',
    'system',
    'Prueba de notificación',
    'Si ves esto en tu pantalla de bloqueo, el push funciona en este dispositivo.',
    '/',
    'self_push_test_' || gen_random_uuid()::text
  ) into v_id;

  return v_id;
end;
$fn$;

-- ── Guarda: una sola firma de cada una ──────────────────────────────────────

-- Si en la base real hubiera otra sobrecarga con otros argumentos, el `drop`
-- de arriba no la tocaría y PostgREST no sabría elegir. Mejor parar aquí, con
-- todo deshecho (el SQL Editor corre el script entero en una transacción).
do $chk$
declare
  v_name text;
begin
  foreach v_name in array array['register_push_subscription', 'admin_broadcast_push_notification'] loop
    if (select count(*)
          from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname = v_name) <> 1 then
      raise exception '% tiene más de una firma: PostgREST no sabría cuál elegir. Revisa pg_proc y bórrala a mano.', v_name;
    end if;
  end loop;
end;
$chk$;
