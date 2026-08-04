-- =============================================================================
-- Verificar, extender y deshacer
-- =============================================================================
-- Tres cambios sobre el mismo bloque de funciones.
--
-- 1. Fallos silenciosos. Las dos filtraban por `is_permanent = false` dentro
--    del WHERE del UPDATE: si el pin ya era permanente no actualizaban nada, no
--    lanzaban error, y la interfaz daba la operación por buena. Ahora
--    comprueban primero y explican qué pasó.
--
-- 2. search_path. Las dos eran SECURITY DEFINER sin fijarlo, que es la única
--    excepción que quedaba en todo el esquema. Sin él, quien llama puede
--    anteponer un esquema propio y hacer que la función use su versión de una
--    tabla.
--
-- 3. unverify_pin, que no existía. Verificar es un juicio humano sobre cada pin
--    concreto —la misma categoría puede describir un sitio fijo o algo que está
--    pasando ahora—, así que va a haber errores. Hasta ahora un moderador que
--    se equivocaba solo podía borrar el pin, y con él el aporte del estudiante.
--
-- Sobre el karma: verificar regala 25 puntos al autor, así que deshacer los
-- resta. La insignia de Cartógrafo NO se retira: en este proyecto los badges
-- son permanentes una vez obtenidos, y todas las funciones check_*_badge
-- insertan sin borrar nunca. No se rompe esa regla por un caso raro.
-- =============================================================================

-- ── Extender el plazo ───────────────────────────────────────────────────────

create or replace function public.extend_pin_ttl(p_pin uuid, p_hours integer default 24)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_pin public.pins;
begin
  if public.user_role() not in ('moderator', 'admin') then
    raise exception 'Solo moderadores y administradores pueden extender el plazo de un pin.';
  end if;

  if p_hours is null or p_hours <= 0 or p_hours > 720 then
    raise exception 'El plazo a extender debe estar entre 1 y 720 horas.';
  end if;

  select * into v_pin from public.pins where id = p_pin for update;
  if not found then
    raise exception 'Pin no encontrado.';
  end if;

  if v_pin.is_permanent then
    raise exception 'Este pin es permanente: no tiene plazo que extender.';
  end if;

  update public.pins
  set expires_at = greatest(coalesce(expires_at, now()), now()) + make_interval(hours => p_hours)
  where id = p_pin;
end;
$fn$;


-- ── Verificar: graduar un reporte a lugar permanente ────────────────────────

create or replace function public.verify_and_make_permanent(
  p_pin uuid,
  p_verifier_name text default 'Centro de Alumnos FIC'
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_pin            public.pins;
  v_verified_count integer;
begin
  if public.user_role() not in ('moderator', 'admin') then
    raise exception 'Solo moderadores y administradores pueden verificar pines.';
  end if;

  select * into v_pin from public.pins where id = p_pin for update;
  if not found then
    raise exception 'Pin no encontrado.';
  end if;

  if v_pin.is_permanent then
    raise exception 'Este pin ya está verificado.';
  end if;

  if v_pin.type <> 'report' then
    raise exception 'Solo se pueden verificar reportes.';
  end if;

  update public.pins
  set is_permanent = true,
      type = 'place',
      expires_at = null,
      verifier_entity_name = coalesce(nullif(trim(p_verifier_name), ''), 'Centro de Alumnos UDP')
  where id = p_pin;

  if v_pin.creator_id is not null then
    perform public.adjust_karma(v_pin.creator_id, 25);

    select count(*) into v_verified_count
    from public.pins
    where creator_id = v_pin.creator_id and verifier_entity_name is not null;

    if v_verified_count >= 2 then
      insert into public.user_badges (user_id, badge_id)
      values (v_pin.creator_id, 'verified_creator')
      on conflict (user_id, badge_id) do nothing;
    end if;
  end if;
end;
$fn$;


-- ── Deshacer una verificación ───────────────────────────────────────────────

create or replace function public.unverify_pin(p_pin uuid, p_hours integer default 24)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_pin public.pins;
begin
  if public.user_role() not in ('moderator', 'admin') then
    raise exception 'Solo moderadores y administradores pueden quitar la verificación de un pin.';
  end if;

  if p_hours is null or p_hours <= 0 or p_hours > 720 then
    raise exception 'El nuevo plazo debe estar entre 1 y 720 horas.';
  end if;

  select * into v_pin from public.pins where id = p_pin for update;
  if not found then
    raise exception 'Pin no encontrado.';
  end if;

  if not v_pin.is_permanent then
    raise exception 'Este pin no está verificado.';
  end if;

  -- Un lugar que creó directamente un moderador nunca fue un reporte, así que
  -- no hay verificación que deshacer: convertirlo en reporte sería inventar un
  -- pasado que no tuvo. Solo se revierte lo que salió de verify_and_make_permanent,
  -- y eso se reconoce por el verificador.
  if v_pin.verifier_entity_name is null then
    raise exception 'Este lugar no proviene de una verificación; no hay nada que deshacer.';
  end if;

  update public.pins
  set is_permanent = false,
      type = 'report',
      verifier_entity_name = null,
      expires_at = now() + make_interval(hours => p_hours)
  where id = p_pin;

  -- Se devuelven los 25 puntos que dio la verificación. adjust_karma nunca baja
  -- de cero, así que no puede dejar el karma en negativo.
  if v_pin.creator_id is not null then
    perform public.adjust_karma(v_pin.creator_id, -25);
  end if;
end;
$fn$;

revoke execute on function public.unverify_pin(uuid, integer) from public, anon;
grant execute on function public.unverify_pin(uuid, integer) to authenticated, service_role;


-- ── Código muerto ───────────────────────────────────────────────────────────
-- set_pin_permanent no la llamaba nadie, y hacía permanente un pin sin
-- verificador, sin karma y sin insignia: justo el pin permanente huérfano que
-- verify_and_make_permanent existe para evitar.

drop function if exists public.set_pin_permanent(uuid);
