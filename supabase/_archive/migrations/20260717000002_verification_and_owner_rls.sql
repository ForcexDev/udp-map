-- ═══ MIGRACIÓN 20260717000002: Verificación de Pines, RLS para Dueño y Extensión de TTL ═══

-- 1. Añadir columna verifier_entity_name a public.pins
ALTER TABLE public.pins 
ADD COLUMN IF NOT EXISTS verifier_entity_name TEXT NULL;

-- 2. Trigger para proteger campos críticos (permanencia, oficialidad y verificación) 
-- contra modificaciones no autorizadas por usuarios regulares, evitando recursividad RLS.
CREATE OR REPLACE FUNCTION public.protect_pin_sensitive_fields()
RETURNS trigger AS $$
BEGIN
  IF public.user_role() NOT IN ('moderator', 'admin') THEN
    NEW.is_permanent := OLD.is_permanent;
    NEW.verifier_entity_name := OLD.verifier_entity_name;
    NEW.is_official := OLD.is_official;
    NEW.official_entity_name := OLD.official_entity_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_pin_sensitive_fields ON public.pins;
CREATE TRIGGER trg_protect_pin_sensitive_fields
  BEFORE UPDATE ON public.pins
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_pin_sensitive_fields();

-- Política RLS simple para el dueño del pin (sin subconsultas recursivas)
DROP POLICY IF EXISTS "pins_owner_update" ON public.pins;

CREATE POLICY "pins_owner_update" ON public.pins FOR UPDATE
  USING (creator_id = auth.uid())
  WITH CHECK (creator_id = auth.uid());

-- 3. RPC para verificar un reporte y hacerlo permanente (+25 Karma y Badge Cartógrafo)
CREATE OR REPLACE FUNCTION public.verify_and_make_permanent(
  p_pin uuid,
  p_verifier_name text DEFAULT 'Centro de Alumnos UDP'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_creator_id uuid;
  v_verified_count integer;
BEGIN
  IF public.user_role() NOT IN ('moderator', 'admin') THEN
    RAISE EXCEPTION 'Solo moderadores y administradores pueden verificar pines.';
  END IF;

  UPDATE public.pins 
  SET is_permanent = true, 
      type = 'place',
      expires_at = null,
      verifier_entity_name = COALESCE(p_verifier_name, 'Centro de Alumnos UDP')
  WHERE id = p_pin
  RETURNING creator_id INTO v_creator_id;

  IF v_creator_id IS NOT NULL THEN
    -- Otorga +25 de Karma al estudiante autor
    PERFORM public.adjust_karma(v_creator_id, 25);

    -- Contar cuántos pines verificados tiene el estudiante
    SELECT count(*) INTO v_verified_count
    FROM public.pins
    WHERE creator_id = v_creator_id AND verifier_entity_name IS NOT NULL;

    -- Si alcanza 2 reportes verificados, otorgar insignia 'verified_creator' (Cartógrafo)
    IF v_verified_count >= 2 THEN
      INSERT INTO public.user_badges (user_id, badge_id)
      VALUES (v_creator_id, 'verified_creator')
      ON CONFLICT (user_id, badge_id) DO NOTHING;
    END IF;
  END IF;
END;
$$;

-- 4. RPC para extender el tiempo (TTL) de un reporte efímero (+24 horas por defecto)
CREATE OR REPLACE FUNCTION public.extend_pin_ttl(
  p_pin uuid,
  p_hours integer DEFAULT 24
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF public.user_role() NOT IN ('moderator', 'admin') THEN
    RAISE EXCEPTION 'Solo moderadores y administradores pueden extender tiempo a los reportes.';
  END IF;

  UPDATE public.pins 
  SET expires_at = GREATEST(COALESCE(expires_at, now()), now()) + (p_hours || ' hours')::interval
  WHERE id = p_pin AND is_permanent = false;
END;
$$;

-- 5. Semilla de Insignia en la tabla de badges si existe
INSERT INTO public.badges (id, name, name_en, description, description_en)
VALUES ('verified_creator', 'Cartógrafo', 'Cartographer', 'Logra que 2 de tus aportes sean verificados oficialmente.', 'Have 2 of your reports officially verified.')
ON CONFLICT (id) DO NOTHING;
