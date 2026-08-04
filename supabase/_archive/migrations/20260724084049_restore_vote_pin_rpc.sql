-- ═══════════════════════════════════════════════════════════════
-- RESTORE VOTE PIN RPC AND VOTE COUNTER PROTECTION TRIGGER
-- ═══════════════════════════════════════════════════════════════
-- Se ha detectado un drift en la base de datos de producción:
--   1. El trigger trg_protect_pin_vote_counters fue eliminado
--   2. La función protect_vote_counters fue eliminada
--   3. La función vote_pin regresó a su versión antigua (void)
-- Esta migración restaura estas funciones vitales para el correcto
-- funcionamiento de los votos y la gamificación en los pines,
-- incluyendo el paso correcto de la variable udpmap.vote_rpc.

CREATE OR REPLACE FUNCTION public.protect_vote_counters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (
    NEW.votes_up IS DISTINCT FROM OLD.votes_up
    OR NEW.votes_down IS DISTINCT FROM OLD.votes_down
  ) AND current_setting('udpmap.vote_rpc', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'Los contadores de votos solo pueden modificarse mediante la RPC de votación';
  END IF;
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.vote_pin(uuid, smallint);

CREATE FUNCTION public.vote_pin(p_pin uuid, p_value smallint)
RETURNS TABLE(votes_up integer, votes_down integer, user_vote smallint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_previous smallint;
  v_votes_up integer;
  v_votes_down integer;
BEGIN
  IF auth.uid() IS NULL OR public.user_role() = 'guest' THEN
    RAISE EXCEPTION 'Debes iniciar sesión con tu correo UDP para votar';
  END IF;
  IF p_value NOT IN (1, -1) THEN
    RAISE EXCEPTION 'Voto inválido';
  END IF;

  PERFORM 1 FROM public.pins WHERE id = p_pin FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pin no encontrado';
  END IF;

  SELECT vote.value
  INTO v_previous
  FROM public.pin_votes AS vote
  WHERE vote.pin_id = p_pin AND vote.user_id = auth.uid();

  IF v_previous = p_value THEN
    DELETE FROM public.pin_votes
    WHERE pin_id = p_pin AND user_id = auth.uid();
  ELSE
    INSERT INTO public.pin_votes (pin_id, user_id, value)
    VALUES (p_pin, auth.uid(), p_value)
    ON CONFLICT (pin_id, user_id) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  SELECT
    count(*) FILTER (WHERE vote.value = 1)::integer,
    count(*) FILTER (WHERE vote.value = -1)::integer
  INTO v_votes_up, v_votes_down
  FROM public.pin_votes AS vote
  WHERE vote.pin_id = p_pin;

  PERFORM set_config('udpmap.vote_rpc', 'on', true);
  UPDATE public.pins
  SET votes_up = v_votes_up, votes_down = v_votes_down
  WHERE id = p_pin;

  RETURN QUERY
  SELECT
    v_votes_up,
    v_votes_down,
    (SELECT vote.value FROM public.pin_votes AS vote
     WHERE vote.pin_id = p_pin AND vote.user_id = auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vote_pin(uuid, smallint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vote_pin(uuid, smallint) FROM anon;
GRANT EXECUTE ON FUNCTION public.vote_pin(uuid, smallint) TO authenticated;

-- Restaurar el trigger de protección en pines
DROP TRIGGER IF EXISTS trg_protect_pin_vote_counters ON public.pins;
CREATE TRIGGER trg_protect_pin_vote_counters
BEFORE UPDATE OF votes_up, votes_down ON public.pins
FOR EACH ROW EXECUTE FUNCTION public.protect_vote_counters();
