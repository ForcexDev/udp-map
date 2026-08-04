-- =============================================================================
-- Cron del recolector de Storage
-- =============================================================================
-- Cada 10 minutos vacía public.storage_cleanup_queue llamando a la Edge
-- Function storage-gc. Reutiliza los dos secretos de Vault que ya usaba el cron
-- de notificaciones push, así que no hay nada nuevo que configurar.
--
-- Aplicar DESPUÉS de desplegar la función:
--   npx --yes supabase functions deploy storage-gc
--
-- Sobre un proyecto nuevo esta migración se aplica sin error aunque los
-- secretos no existan todavía: cron.schedule solo guarda el texto del comando y
-- no lo evalúa hasta la primera ejecución. El trabajo fallará en silencio hasta
-- que se creen (ver el runbook de docs/DATABASE.md).
--
-- cron.schedule con un nombre ya existente reemplaza el trabajo anterior, de
-- modo que volver a ejecutar esto no duplica nada.
-- =============================================================================

select cron.schedule(
  'udp-map-storage-gc',
  '*/10 * * * *',
  $job$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'udp_map_project_url'
    ) || '/functions/v1/storage-gc',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'udp_map_send_push_cron_secret'
      )
    ),
    body := '{}'::jsonb
  ) as request_id;
  $job$
);
