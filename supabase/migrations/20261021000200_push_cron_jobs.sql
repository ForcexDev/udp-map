-- ============================================================================
-- Las tareas programadas del push, versionadas.
--
-- Tres cosas de la revisión de send-push (docs/PUSH_REWORK_REVIEW.md, hallazgos
-- 15, 17 y 18):
--
-- 1. LOS RECORDATORIOS DE EVENTOS SALEN DE send-push. La Edge Function llamaba a
--    enqueue_upcoming_event_notifications() en cada pasada, o sea cada minuto,
--    y esa función recorre todas las asistencias a eventos de los próximos 20
--    días. Es SQL puro sobre tablas de la base: no necesita una función que
--    espere un `net.http_post` ni gastar el presupuesto de tiempo de send-push.
--    Pasa a su propio trabajo de pg_cron.
--
-- 2. NADA SE PURGA. Ni las entregas ni los avisos se borraron nunca, y la cola
--    es la tabla que más crece del esquema: una fila por aviso y por
--    dispositivo. prune_push_history() los borra por edad, una vez al día.
--
-- 3. EL CRON DE send-push SOLO VIVÍA EN EL RUNBOOK. Si alguien rehacía la base
--    o tocaba el trabajo a mano en el dashboard, no quedaba rastro de cómo era.
--    Además usaba el timeout por defecto de pg_net, 5 s: send-push contesta 202
--    en seguida, pero un arranque en frío o un servicio lento a la hora punta lo
--    pasa, y `net._http_response` se llena de timeouts que no son un fallo real.
--    Aquí se fija en 10 s.
--
-- POR QUÉ LA POLÍTICA DE EDAD ES ESTA
--
-- · `sent` y `expired` a los 30 días: ya no cuentan nada que importe. `failed` a
--   los 90, porque es lo único que alguien va a querer mirar con calma
--   (admin_push_delivery_stats mira hasta 90 días) y el mes y medio extra cuesta
--   poco: son pocas filas.
-- · Los avisos leídos a los 180 días y los no leídos al año. Un aviso sin leer es
--   una cuenta que no se ha abierto en meses; no hay a quién enseñárselo, pero
--   se le da más margen que al leído por si vuelve. La edad se mide por
--   `created_at` en los dos casos.
-- · Las entregas de un aviso que se borra se van con él (`on delete cascade`) y
--   NO entran en la cuenta de `deliveries`: esa cuenta es solo lo que se borró
--   por edad propia.
-- · Es segura gracias a 20261021000100: borrar un aviso de un evento todavía
--   próximo ya no resucita el recordatorio, porque la idempotencia vive en
--   `event_rsvps.reminded_at` y no en la fila que la poda se lleva.
--
-- POR QUÉ SE NIEGA A authenticated SI EL EXECUTE YA ESTÁ REVOCADO
--
-- Porque en una función SECURITY DEFINER el GRANT no es control de acceso: un
-- GRANT masivo posterior la reabriría. La comprobación acepta `auth.role()` nulo
-- porque pg_cron corre sin JWT (ni claims ni rol), y a `service_role`; todo lo
-- demás —un estudiante, un administrador, un visitante— se niega.
--
-- NOMBRE DEL TRABAJO DE send-push: es el mismo que el del runbook, a propósito.
-- `cron.schedule` con un nombre que ya existe lo REEMPLAZA, de modo que el
-- trabajo creado a mano queda sustituido por este, con el timeout. No hay que
-- desprogramar nada antes.
--
-- COMPATIBILIDAD con lo desplegado
--
-- · El send-push anterior (20eee7e o anterior) sigue encolando recordatorios por
--   su cuenta; mientras convivan con este cron no se duplica nada, porque la
--   idempotencia está en `reminded_at`.
-- · El send-push NUEVO (el que ya no encola recordatorios) solo debe
--   desplegarse DESPUÉS de esta migración. Al revés, entre el despliegue y la
--   migración nadie avisa de ningún evento.
--
-- REQUIERE 20261021000100 (reminded_at) y las extensiones pg_cron y pg_net
-- activas, más los secretos de Vault udp_map_project_url y
-- udp_map_send_push_cron_secret (el trabajo de send-push los lee al ejecutarse,
-- no al programarse).
-- APLICAR A MANO desde el SQL Editor. Deshacer:
-- 20261021000200_push_cron_jobs.down.sql
-- ============================================================================

-- Mejor parar aquí con un mensaje que programar un trabajo que fallaría cada
-- minuto sin que nadie lo vea. El SQL Editor corre el script entero en una
-- transacción, así que no queda nada a medias.
do $chk$
begin
  if to_regnamespace('cron') is null then
    raise exception 'pg_cron no está activada: actívala en Database → Extensions y vuelve a aplicar esta migración.';
  end if;
  if to_regnamespace('net') is null then
    raise exception 'pg_net no está activada: actívala en Database → Extensions y vuelve a aplicar esta migración.';
  end if;
end;
$chk$;

-- ── 1. La purga ─────────────────────────────────────────────────────────────

/**
 * Borra por edad lo que ya no sirve de la cola de push y de los avisos.
 * Devuelve cuántas filas se llevó cada cosa: { "deliveries": n, "notifications": m }.
 *
 * Solo la llama pg_cron (o service_role). Ver la cabecera sobre la comprobación.
 */
create or replace function public.prune_push_history()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_deliveries    integer;
  v_notifications integer;
begin
  -- pg_cron corre sin JWT: auth.role() es null. Cualquier otro rol que no sea el
  -- del servicio se niega.
  if auth.role() is not null and auth.role() <> 'service_role' then
    raise exception 'Solo el servicio puede purgar el historial de push.';
  end if;

  delete from public.notification_push_deliveries
   where (status in ('sent', 'expired') and created_at < now() - interval '30 days')
      or (status = 'failed' and created_at < now() - interval '90 days');
  get diagnostics v_deliveries = row_count;

  delete from public.notifications
   where (read_at is not null and created_at < now() - interval '180 days')
      or (read_at is null and created_at < now() - interval '365 days');
  get diagnostics v_notifications = row_count;

  return jsonb_build_object('deliveries', v_deliveries, 'notifications', v_notifications);
end;
$fn$;

revoke execute on function public.prune_push_history() from public, anon, authenticated;
grant execute on function public.prune_push_history() to service_role;

-- ── 2. Los trabajos ─────────────────────────────────────────────────────────

-- Cada minuto, como el barrido que hacía send-push. Corre sin JWT: la
-- comprobación de rol de la función deja pasar al cron (ver 20261021000100).
select cron.schedule(
  'udp-map-event-reminders',
  '* * * * *',
  'select public.enqueue_upcoming_event_notifications()'
);

-- De madrugada (04:17 UTC), fuera de la hora punta y de los minutos redondos.
select cron.schedule(
  'udp-map-prune-push-history',
  '17 4 * * *',
  'select public.prune_push_history()'
);

-- Mismo nombre que el del runbook: lo reemplaza. Lo único nuevo es el timeout.
select cron.schedule(
  'udp-map-send-push-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'udp_map_project_url')
           || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'udp_map_send_push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
  $$
);
