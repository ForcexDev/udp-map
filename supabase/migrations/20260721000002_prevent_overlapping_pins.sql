-- Impide que dos pines vigentes ocupen exactamente las mismas coordenadas.
-- Los advisory locks serializan intentos concurrentes sobre el mismo punto.

CREATE OR REPLACE FUNCTION public.prevent_occupied_pin_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.lat IS NOT DISTINCT FROM OLD.lat
    AND NEW.lng IS NOT DISTINCT FROM OLD.lng THEN
    RETURN NEW;
  END IF;

  -- Un pin ya expirado no reserva una ubicación.
  IF NOT (NEW.is_permanent OR NEW.expires_at IS NULL OR NEW.expires_at > now()) THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(NEW.lat::text || ':' || NEW.lng::text));

  IF EXISTS (
    SELECT 1
    FROM public.pins AS existing
    WHERE existing.id IS DISTINCT FROM NEW.id
      AND existing.lat = NEW.lat
      AND existing.lng = NEW.lng
      AND (
        existing.is_permanent
        OR existing.expires_at IS NULL
        OR existing.expires_at > now()
      )
  ) THEN
    RAISE EXCEPTION 'PIN_LOCATION_OCCUPIED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_occupied_pin_location_insert ON public.pins;
CREATE TRIGGER trg_prevent_occupied_pin_location_insert
BEFORE INSERT ON public.pins
FOR EACH ROW EXECUTE FUNCTION public.prevent_occupied_pin_location();

DROP TRIGGER IF EXISTS trg_prevent_occupied_pin_location_update ON public.pins;
CREATE TRIGGER trg_prevent_occupied_pin_location_update
BEFORE UPDATE OF lat, lng ON public.pins
FOR EACH ROW EXECUTE FUNCTION public.prevent_occupied_pin_location();

REVOKE EXECUTE ON FUNCTION public.prevent_occupied_pin_location() FROM PUBLIC;
