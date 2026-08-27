-- ============================================================================
-- Quiénes reciben las notificaciones push, no solo cuántos.
--
-- `admin_count_push_subscribers()` devuelve un `count(*)` y nada más, así que
-- Difusión solo podía decir "llegará a 7 dispositivos". Con eso no se puede
-- responder a lo único que importa antes de mandar un aviso a toda la
-- universidad: a QUIÉN le llega, y si esos dispositivos siguen vivos.
--
-- La tabla ya guardaba todo lo necesario (`user_id`, `user_agent`,
-- `created_at`, `updated_at`); solo faltaba una forma de leerlo.
--
-- PRIVACIDAD: esto es una lista de personas con sus dispositivos, y por eso
-- solo la ve `admin` —comprobado DENTRO de la función, no solo por el GRANT—.
-- Se devuelve el `user_agent` crudo porque resumirlo aquí obligaría a tocar la
-- base cada vez que salga un navegador nuevo; el resumen lo hace la interfaz.
-- El correo NO se devuelve: para identificar a alguien basta el nombre, y el
-- correo es el dato que convierte una lista en un directorio.
--
-- APLICAR A MANO desde el SQL Editor. Deshacer:
-- 20260829000100_push_subscribers_list.down.sql
-- ============================================================================

create or replace function public.admin_push_subscribers()
returns table (
  user_id      uuid,
  name         text,
  role         text,
  user_agent   text,
  created_at   timestamptz,
  updated_at   timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  if public.user_role() <> 'admin' then
    raise exception 'Solo los administradores pueden ver quién recibe los avisos.';
  end if;

  return query
    select s.user_id, p.name, p.role, s.user_agent, s.created_at, s.updated_at
      from public.push_subscriptions s
      left join public.profiles p on p.id = s.user_id
     -- Por persona y luego por dispositivo: alguien con el teléfono y el
     -- portátil aparece dos veces, y esas dos veces tienen que salir juntas.
     order by p.name nulls last, s.created_at desc;
end;
$fn$;

grant execute on function public.admin_push_subscribers() to authenticated, service_role;
