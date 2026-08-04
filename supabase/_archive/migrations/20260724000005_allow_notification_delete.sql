-- 20260722000001 revocó DELETE de public.notifications para "authenticated" sin
-- agregar una policy ni una RPC de reemplazo, así que el botón de papelera del
-- centro de notificaciones nunca pudo borrar nada (el DELETE fallaba por falta de
-- privilegio antes de llegar a evaluar RLS). No hay filas huérfanas que limpiar:
-- como el DELETE jamás tuvo éxito, no quedó ningún borrado a medias que remediar.
drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications for delete
  using (user_id = auth.uid());

grant delete on public.notifications to authenticated;
