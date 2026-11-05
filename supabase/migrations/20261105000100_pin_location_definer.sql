-- Aplicar a mano en el SQL Editor de cada entorno. La migración histórica y
-- producción ya usan DEFINER; esto corrige bases reconstruidas con el baseline
-- anterior sin cambiar el cuerpo, el dueño ni los triggers existentes.
begin;
alter function public.prevent_occupied_pin_location() security definer;
commit;
