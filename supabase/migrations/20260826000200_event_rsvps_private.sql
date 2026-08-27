-- =============================================================================
-- Quién va a un evento deja de ser público (SEC-007)
-- =============================================================================
-- `event_rsvps_read` era `using (true)`: cualquiera con la clave anon —que viaja
-- en el bundle— podía descargar la tabla entera y saber a qué eventos va cada
-- persona. Es de las pocas cosas del proyecto que son datos personales de
-- verdad: no es una opinión pública como un voto en el foro, es dónde va a estar
-- alguien y a qué hora.
--
-- LA SALIDA NO ES TAPARLO, ES CAMBIAR LO QUE SE EXPONE
--
-- Cerrar la lectura y ya está dejaría la funcionalidad peor de lo que estaba:
-- hoy marcar "Iré" guarda una fila y no cambia nada en pantalla, y quien
-- organiza una feria no se entera de si van 5 o 50 — que es justo lo que
-- necesita saber para prepararla. Así que la tabla se cierra y en su lugar
-- quedan las dos lecturas que sí tienen sentido, cada una con su dueño:
--
--   1. `event_rsvp_counts` — el CONTEO, para todo el mundo. Un número agregado
--      no dice de nadie dónde va a estar.
--   2. `event_attendees` — la LISTA, solo para quien organiza el evento (y para
--      administración). Es el dato que hacía falta y que no veía nadie.
--
-- Las dos son SECURITY DEFINER porque tienen que leer una tabla que ya nadie
-- puede leer directamente. La autorización vive dentro de la función, que es
-- donde se puede escribir la regla completa.
--
-- Lo que NO se toca: `event_rsvps_all_own` sigue como estaba y es `for all`, o
-- sea que incluye el SELECT de las filas propias. Por eso basta con borrar la
-- política de lectura pública: saber a qué eventos vas tú nunca dependió de
-- ella.
--
-- UMBRAL
--
-- El conteo se devuelve exacto y es la interfaz la que decide desde qué número
-- se enseña. La razón es de diseño y no de privacidad: a la escala de la UDP va
-- a haber muchos eventos con números bajos, y "2 personas van" dice "esto no le
-- importa a nadie" mucho más fuerte que no decir nada. A quien organiza se le
-- enseña siempre, porque para preparar algo el 2 también sirve.
-- =============================================================================

-- ── 1. Se cierra la lectura pública ──────────────────────────────────────────
drop policy if exists event_rsvps_read on public.event_rsvps;

-- ── 2. El conteo, para cualquiera ────────────────────────────────────────────
create or replace function public.event_rsvp_counts(p_pin_ids uuid[])
returns table (pin_id uuid, going integer, interested integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  -- Es un endpoint público: la lista viene del navegador y conviene que no
  -- pueda pedir el campus entero de una vez. La página de eventos manda una
  -- pantalla de eventos, nunca cientos.
  if p_pin_ids is null or array_length(p_pin_ids, 1) is null then
    return;
  end if;
  if array_length(p_pin_ids, 1) > 200 then
    raise exception 'Demasiados eventos en una sola consulta (máximo 200).';
  end if;

  return query
    select r.pin_id,
           count(*) filter (where r.status = 'going')::integer,
           count(*) filter (where r.status = 'interested')::integer
      from public.event_rsvps r
     where r.pin_id = any (p_pin_ids)
     group by r.pin_id;
end;
$fn$;

grant execute on function public.event_rsvp_counts(uuid[]) to anon, authenticated, service_role;

-- ── 3. La lista, solo para quien organiza ────────────────────────────────────
create or replace function public.event_attendees(p_pin_id uuid)
returns table (user_id uuid, name text, avatar_url text, status text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $fn$
begin
  -- Moderador no basta a propósito. El eje del rol es "contenido y mapa", y una
  -- lista de asistentes no es contenido: es dónde va a estar un grupo de
  -- personas. Lo ve quien tiene que preparar el evento, y administración.
  if not exists (
    select 1
      from public.pins p
     where p.id = p_pin_id
       and p.type = 'event'
       and (p.creator_id = auth.uid() or public.user_role() = 'admin')
  ) then
    raise exception 'Solo quien organiza el evento puede ver quién va.';
  end if;

  return query
    select r.user_id, pr.name, pr.avatar_url, r.status
      from public.event_rsvps r
      join public.profiles pr on pr.id = r.user_id
     where r.pin_id = p_pin_id
     -- "Iré" antes que "Me interesa": para preparar algo, la confirmación pesa
     -- más que la intención.
     order by (r.status = 'going') desc, pr.name nulls last;
end;
$fn$;

grant execute on function public.event_attendees(uuid) to authenticated, service_role;
