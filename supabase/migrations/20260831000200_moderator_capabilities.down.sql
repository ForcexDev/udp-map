-- Deshace 20260831000200_moderator_capabilities.sql.
--
-- Las políticas vuelven a mirar el rol a secas, así que TODOS los moderadores
-- recuperan todo el paquete. Es lo que había antes, pero conviene saberlo: si
-- se recortó a alguien desde el panel, ese recorte desaparece aquí.

drop policy if exists floor_plans_admin on public.floor_plans;
create policy floor_plans_admin on public.floor_plans
  for all using (public.user_role() = any (array['moderator', 'admin']));

drop policy if exists buildings_write on public.buildings;
create policy buildings_write on public.buildings
  for all using (public.user_role() = any (array['moderator', 'admin']))
  with check (public.user_role() = any (array['moderator', 'admin']));

drop policy if exists building_floors_write on public.building_floors;
create policy building_floors_write on public.building_floors
  for all using (public.user_role() = any (array['moderator', 'admin']))
  with check (public.user_role() = any (array['moderator', 'admin']));

drop policy if exists areas_write on public.areas;
create policy areas_write on public.areas
  for all using (public.user_role() = any (array['moderator', 'admin']))
  with check (public.user_role() = any (array['moderator', 'admin']));

drop policy if exists content_reports_read_own_or_admin on public.content_reports;
create policy content_reports_read_own_or_admin on public.content_reports
  for select using (reporter_id = auth.uid() or public.user_role() = 'admin');

drop function if exists public.admin_user_capabilities(uuid);
drop function if exists public.admin_set_capability(uuid, text, boolean);
drop function if exists public.has_capability(text);
drop table if exists public.moderator_capabilities;

alter table public.activity_log drop constraint if exists activity_log_action_check;
alter table public.activity_log
  add constraint activity_log_action_check check (action in (
    'pin_created', 'pin_deleted', 'pin_verified', 'pin_unverified',
    'report_filed', 'report_claimed', 'report_resolved', 'report_dismissed',
    'role_changed', 'broadcast_sent', 'push_unsubscribed'
  ));
