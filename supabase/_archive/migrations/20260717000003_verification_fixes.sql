-- ═══ MIGRACIÓN 20260717000003: Correcciones de Lógica de Verificación y Seguridad ═══
-- Esta migración parchea dos problemas lógicos detectados:
-- 1. Un estudiante podía cambiar el `type` y `expires_at` de un pin suyo (incluso después de verificado) a través de la API.
-- 2. Un moderador podía otorgar +25 de Karma infinitas veces verificando repetidamente el mismo pin.

-- 1. Fix the trigger to protect 'type' and 'expires_at' from non-moderators
CREATE OR REPLACE FUNCTION public.protect_pin_sensitive_fields()
RETURNS trigger AS $$
BEGIN
  IF public.user_role() NOT IN ('moderator', 'admin') THEN
    NEW.is_permanent := OLD.is_permanent;
    NEW.verifier_entity_name := OLD.verifier_entity_name;
    NEW.is_official := OLD.is_official;
    NEW.official_entity_name := OLD.official_entity_name;
    -- Previene que un estudiante modifique el tipo (ej: de report a place) 
    -- o cambie maliciosamente la fecha de expiración calculada.
    NEW.type := OLD.type;
    NEW.expires_at := OLD.expires_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Fix verify_and_make_permanent to only work if NOT already verified
-- This prevents Karma farming and double-counting verified pins
CREATE OR REPLACE FUNCTION public.verify_and_make_permanent(
  p_pin uuid,
  p_verifier_name text DEFAULT 'Centro de Alumnos FIC'
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

  -- Solo actualizamos y premiamos si NO era permanente antes
  UPDATE public.pins 
  SET is_permanent = true, 
      type = 'place',
      expires_at = null,
      verifier_entity_name = COALESCE(p_verifier_name, 'Centro de Alumnos UDP')
  WHERE id = p_pin AND is_permanent = false
  RETURNING creator_id INTO v_creator_id;

  -- v_creator_id será NULL si el pin ya era permanente o no se encontró
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
