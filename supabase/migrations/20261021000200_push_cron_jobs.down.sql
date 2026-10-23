-- ============================================================================
-- Deshace 20261021000200_push_cron_jobs.sql.
--
-- OJO: tras deshacerla, el send-push desplegado tiene que ser uno que TODAVÍA
-- encole los recordatorios de eventos (20eee7e o anterior). Esta migración
-- desprograma el barrido periódico, que el send-push nuevo ya no ejecuta. Sin
-- reemplazo, las asistencias previas que entren en ventana pierden ese aviso.
-- El trigger de alta/cambio de RSVP sigue separado. Redesplegar primero.
--
-- La purga se pierde con la función: lo ya borrado por edad no vuelve.
--
-- El trabajo de send-push vuelve a ser el del runbook de docs/guias/despliegue.md,
-- con el timeout por defecto de pg_net (5 s).
-- ============================================================================

-- `cron.unschedule` lanza una excepción si el nombre no existe (por ejemplo, si
-- alguien ya lo borró a mano). Para deshacer eso no debe ser un error.
do $undo$
declare
  v_job text;
begin
  foreach v_job in array array['udp-map-event-reminders', 'udp-map-prune-push-history'] loop
    if exists (select 1 from cron.job where jobname = v_job) then
      perform cron.unschedule(v_job);
    end if;
  end loop;
end;
$undo$;

drop function if exists public.prune_push_history();

-- Mismo nombre: reemplaza al de la migración. Sin `timeout_milliseconds`.
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
    body := '{}'::jsonb
  ) as request_id;
  $$
);
