-- Límite atómico de 10 pines creados por usuario cada día (UTC).
-- La creación pasa por una RPC para que el cliente no pueda saltarse el conteo
-- usando un INSERT directo.

ALTER TABLE public.pins
ADD COLUMN IF NOT EXISTS official_entity_name text NULL;

CREATE TABLE IF NOT EXISTS public.pin_creation_events (
  id         uuid primary key default gen_random_uuid(),
  pin_id     uuid NULL references public.pins(id) on delete set null,
  creator_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now()
);

ALTER TABLE public.pin_creation_events
ADD COLUMN IF NOT EXISTS pin_id uuid NULL references public.pins(id) on delete set null;

CREATE INDEX IF NOT EXISTS pin_creation_events_creator_day_idx
  ON public.pin_creation_events (creator_id, created_at desc);

CREATE UNIQUE INDEX IF NOT EXISTS pin_creation_events_pin_uidx
  ON public.pin_creation_events (pin_id)
  WHERE pin_id IS NOT NULL;

ALTER TABLE public.pin_creation_events ENABLE ROW LEVEL SECURITY;

-- La tabla es un registro interno: ningún cliente debe leerla ni escribirla.
-- La RPC SECURITY DEFINER es la única vía de inserción.
REVOKE ALL ON TABLE public.pin_creation_events FROM anon, authenticated;

-- Conserva el historial existente al activar el límite.
INSERT INTO public.pin_creation_events (pin_id, creator_id, created_at)
SELECT p.id, p.creator_id, p.created_at
FROM public.pins p
WHERE p.creator_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.pin_creation_events e
    WHERE e.pin_id = p.id
  );

CREATE OR REPLACE FUNCTION public.create_pin_with_daily_limit(
  p_type public.pin_type,
  p_title text,
  p_description text,
  p_category_id text,
  p_faculty_id text,
  p_lat double precision,
  p_lng double precision,
  p_is_official boolean,
  p_official_entity_name text,
  p_expires_at timestamptz,
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS SETOF public.pins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
  v_created_today integer;
  v_day_start timestamptz;
  v_pin public.pins;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para crear un pin';
  END IF;

  v_role := public.user_role();
  IF v_role = 'guest' THEN
    RAISE EXCEPTION 'Los invitados no pueden crear pines';
  END IF;

  -- Moderadores y administradores no tienen rate limit. Para el resto,
  -- serializa las creaciones del mismo usuario para evitar superar el límite
  -- con solicitudes simultáneas.
  IF v_role NOT IN ('moderator', 'admin') THEN
    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text));

    -- El límite se calcula siempre con días UTC, independientemente de la
    -- zona horaria configurada en la sesión de Postgres.
    v_day_start := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

    SELECT count(*)::integer
    INTO v_created_today
    FROM public.pin_creation_events
    WHERE creator_id = auth.uid()
      AND created_at >= v_day_start
      AND created_at < v_day_start + interval '1 day';

    IF v_created_today >= 10 THEN
      RAISE EXCEPTION 'DAILY_PIN_LIMIT_REACHED';
    END IF;
  END IF;

  IF p_type = 'place' AND v_role NOT IN ('moderator', 'admin') THEN
    RAISE EXCEPTION 'Solo moderadores y administradores pueden crear lugares';
  END IF;

  IF COALESCE(p_is_official, false) AND v_role NOT IN ('moderator', 'admin') THEN
    RAISE EXCEPTION 'Solo moderadores y administradores pueden crear contenido oficial';
  END IF;

  IF p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Coordenadas del pin inválidas';
  END IF;

  INSERT INTO public.pins (
    type,
    title,
    description,
    category_id,
    faculty_id,
    lat,
    lng,
    creator_id,
    is_permanent,
    expires_at,
    starts_at,
    ends_at,
    is_official,
    official_entity_name
  ) VALUES (
    p_type,
    p_title,
    p_description,
    p_category_id,
    p_faculty_id,
    p_lat,
    p_lng,
    auth.uid(),
    p_type = 'place',
    CASE WHEN p_type = 'place' THEN NULL ELSE p_expires_at END,
    p_starts_at,
    p_ends_at,
    COALESCE(p_is_official, false),
    CASE WHEN COALESCE(p_is_official, false) THEN p_official_entity_name ELSE NULL END
  )
  RETURNING * INTO v_pin;

  INSERT INTO public.pin_creation_events (pin_id, creator_id)
  VALUES (v_pin.id, auth.uid());

  RETURN NEXT v_pin;
END;
$$;

-- No se permiten INSERT directos: todas las creaciones deben pasar por la RPC.
DROP POLICY IF EXISTS "pins_insert" ON public.pins;
DROP POLICY IF EXISTS "pins_insert_admin" ON public.pins;

REVOKE EXECUTE ON FUNCTION public.create_pin_with_daily_limit(
  public.pin_type,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  boolean,
  text,
  timestamptz,
  timestamptz,
  timestamptz
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_pin_with_daily_limit(
  public.pin_type,
  text,
  text,
  text,
  text,
  double precision,
  double precision,
  boolean,
  text,
  timestamptz,
  timestamptz,
  timestamptz
) TO authenticated;
