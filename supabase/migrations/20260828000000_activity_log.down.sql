-- ============================================================================
-- Deshace 20260828000000_activity_log.sql.
--
-- OJO: `drop table public.activity_log` BORRA EL REGISTRO ENTERO, y el registro
-- es precisamente lo que no se puede reconstruir — los pines borrados y los
-- cambios de rol no viven en ningún otro sitio. Si hay algo que quieras
-- conservar, sácalo antes:
--
--   select * from public.activity_log order by id;
--
-- Por eso el DROP va al final y comentado el aviso, no porque se pueda deshacer.
-- ============================================================================

drop trigger if exists on_pin_activity_log on public.pins;
drop trigger if exists on_report_activity_log on public.content_reports;
drop trigger if exists on_role_change_activity_log on public.profiles;

drop function if exists public.trg_log_pin_activity();
drop function if exists public.trg_log_report_activity();
drop function if exists public.trg_log_role_change();
drop function if exists public.admin_activity_log(integer);
drop function if exists public.prune_activity_log(integer);
drop function if exists public.log_activity(text, text, text, uuid, jsonb, uuid);

drop table if exists public.activity_log;
