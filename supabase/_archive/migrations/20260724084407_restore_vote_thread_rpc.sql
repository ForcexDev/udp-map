-- ═══════════════════════════════════════════════════════════════
-- RESTORE VOTE THREAD RPC AND VOTE COUNTER PROTECTION TRIGGER
-- ═══════════════════════════════════════════════════════════════
-- Continuando con la recuperación del código en la DB (drift),
-- el RPC de votación en hilos del foro también había retornado
-- a la versión anterior que no informaba de la variable 
-- udpmap.vote_rpc, dejando bloqueada la actualización de contadores
-- y previniendo que los estudiantes pudiesen votar en el foro.

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
REVOKE EXECUTE ON FUNCTION public.vote_thread(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.vote_thread(uuid, integer) TO authenticated;

-- Restaurar el trigger de protección de contadores en los hilos (si fue borrado)
DROP TRIGGER IF EXISTS trg_protect_forum_vote_counters ON public.forum_threads;
CREATE TRIGGER trg_protect_forum_vote_counters
BEFORE UPDATE OF votes_up, votes_down ON public.forum_threads
FOR EACH ROW EXECUTE FUNCTION public.protect_vote_counters();
