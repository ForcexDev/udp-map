-- ═══ MIGRACIÓN 20260717000004: Protección de Campos en Pines Verificados ═══
-- Esta migración complementa la anterior para asegurar que la "infraestructura oficial"
-- no pueda ser alterada estructuralmente por el estudiante que la reportó originalmente.

CREATE OR REPLACE FUNCTION public.protect_pin_sensitive_fields()
RETURNS trigger AS $$
BEGIN
  IF public.user_role() NOT IN ('moderator', 'admin') THEN
    -- Campos que JAMÁS puede tocar un usuario normal (ya cubiertos)
    NEW.is_permanent := OLD.is_permanent;
    NEW.verifier_entity_name := OLD.verifier_entity_name;
    NEW.is_official := OLD.is_official;
    NEW.official_entity_name := OLD.official_entity_name;
    NEW.type := OLD.type;
    NEW.expires_at := OLD.expires_at;

    -- Si el pin ya fue verificado (is_permanent = true), 
    -- congelamos su estructura física y categoría para el creador.
    -- (Solo puede editar título, descripción y fotos).
    IF OLD.is_permanent = true THEN
      NEW.category_id := OLD.category_id;
      NEW.lat := OLD.lat;
      NEW.lng := OLD.lng;
      NEW.faculty_id := OLD.faculty_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
