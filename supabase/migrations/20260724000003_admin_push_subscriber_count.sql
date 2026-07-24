-- fetchDashboardStats contaba push_subscriptions vía select directo del cliente,
-- que RLS (push_subscriptions_own) filtra a user_id = auth.uid(). El admin solo veía
-- sus propios dispositivos, no el total real de suscriptores (que sí recibe el broadcast,
-- porque ese corre server-side con security definer / service role y evade RLS).
create or replace function public.admin_count_push_subscribers()
returns integer
language plpgsql security definer set search_path = public
as $$
begin
  if public.user_role() <> 'admin' then
    raise exception 'Acceso denegado: solo administradores pueden ver este conteo.';
  end if;

  return (select count(*)::integer from public.push_subscriptions);
end;
$$;
