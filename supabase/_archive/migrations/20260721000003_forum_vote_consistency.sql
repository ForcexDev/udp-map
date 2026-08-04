-- Corrige votos duplicados/desincronizados y asegura un único voto por usuario.
-- La misma operación sirve para votar, cambiar el voto o quitarlo al pulsarlo de nuevo.

DELETE FROM public.forum_votes WHERE value IS NULL;

ALTER TABLE public.forum_votes
  ALTER COLUMN value SET NOT NULL;

-- Los clientes solo leen su voto. Toda escritura pasa por las RPC atómicas.
DROP POLICY IF EXISTS "votes_insert_own" ON public.forum_votes;
DROP POLICY IF EXISTS "votes_update_own" ON public.forum_votes;
DROP POLICY IF EXISTS "votes_delete_own" ON public.forum_votes;
REVOKE INSERT, UPDATE, DELETE ON public.forum_votes FROM anon, authenticated;

DROP POLICY IF EXISTS "votes_upsert" ON public.pin_votes;
DROP POLICY IF EXISTS "votes_update_own" ON public.pin_votes;
REVOKE INSERT, UPDATE, DELETE ON public.pin_votes FROM anon, authenticated;

-- Repara contadores que hayan quedado desfasados antes de instalar esta migración.
UPDATE public.forum_threads AS thread
SET
  votes_up = (
    SELECT count(*)::integer
    FROM public.forum_votes AS vote
    WHERE vote.thread_id = thread.id AND vote.value = 1
  ),
  votes_down = (
    SELECT count(*)::integer
    FROM public.forum_votes AS vote
    WHERE vote.thread_id = thread.id AND vote.value = -1
  );

UPDATE public.pins AS pin
SET
  votes_up = (
    SELECT count(*)::integer
    FROM public.pin_votes AS vote
    WHERE vote.pin_id = pin.id AND vote.value = 1
  ),
  votes_down = (
    SELECT count(*)::integer
    FROM public.pin_votes AS vote
    WHERE vote.pin_id = pin.id AND vote.value = -1
  );

-- Evita que un UPDATE directo falsifique los contadores agregados.
CREATE OR REPLACE FUNCTION public.protect_vote_counters()
RETURNS trigger
LANGUAGE plpgsql
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

DROP TRIGGER IF EXISTS trg_protect_forum_vote_counters ON public.forum_threads;
CREATE TRIGGER trg_protect_forum_vote_counters
BEFORE UPDATE OF votes_up, votes_down ON public.forum_threads
FOR EACH ROW EXECUTE FUNCTION public.protect_vote_counters();

DROP TRIGGER IF EXISTS trg_protect_pin_vote_counters ON public.pins;
CREATE TRIGGER trg_protect_pin_vote_counters
BEFORE UPDATE OF votes_up, votes_down ON public.pins
FOR EACH ROW EXECUTE FUNCTION public.protect_vote_counters();

REVOKE EXECUTE ON FUNCTION public.protect_vote_counters() FROM PUBLIC;

DROP FUNCTION IF EXISTS public.vote_thread(uuid, integer);

CREATE FUNCTION public.vote_thread(p_thread uuid, p_value integer)
RETURNS TABLE(votes_up integer, votes_down integer, user_vote integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_previous integer;
  v_votes_up integer;
  v_votes_down integer;
BEGIN
  IF auth.uid() IS NULL OR public.user_role() = 'guest' THEN
    RAISE EXCEPTION 'Debes iniciar sesión con tu correo UDP para votar';
  END IF;
  IF p_value NOT IN (1, -1) THEN
    RAISE EXCEPTION 'Voto inválido';
  END IF;

  -- Serializa todos los votos sobre el hilo para que el recuento sea consistente.
  PERFORM 1 FROM public.forum_threads WHERE id = p_thread FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Hilo no encontrado';
  END IF;

  SELECT vote.value
  INTO v_previous
  FROM public.forum_votes AS vote
  WHERE vote.thread_id = p_thread AND vote.user_id = auth.uid();

  IF v_previous = p_value THEN
    DELETE FROM public.forum_votes
    WHERE thread_id = p_thread AND user_id = auth.uid();
  ELSE
    INSERT INTO public.forum_votes (thread_id, user_id, value)
    VALUES (p_thread, auth.uid(), p_value)
    ON CONFLICT (thread_id, user_id) DO UPDATE SET value = EXCLUDED.value;
  END IF;

  SELECT
    count(*) FILTER (WHERE vote.value = 1)::integer,
    count(*) FILTER (WHERE vote.value = -1)::integer
  INTO v_votes_up, v_votes_down
  FROM public.forum_votes AS vote
  WHERE vote.thread_id = p_thread;

  PERFORM set_config('udpmap.vote_rpc', 'on', true);
  UPDATE public.forum_threads
  SET votes_up = v_votes_up, votes_down = v_votes_down
  WHERE id = p_thread;

  RETURN QUERY
  SELECT
    v_votes_up,
    v_votes_down,
    (SELECT vote.value FROM public.forum_votes AS vote
     WHERE vote.thread_id = p_thread AND vote.user_id = auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vote_thread(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vote_thread(uuid, integer) TO authenticated;

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
GRANT EXECUTE ON FUNCTION public.vote_pin(uuid, smallint) TO authenticated;
