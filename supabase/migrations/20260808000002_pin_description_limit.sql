-- Sube el tope de pins.description de 500 a 1500 caracteres.
--
-- El motivo: la descripción admite enlaces, y una URL real de correo o de Drive
-- mide 300 caracteres o más. Con 500, un evento con dos párrafos y un enlace de
-- inscripción ya no cabía, y el formulario se negaba a guardar sin decir por qué.

alter table public.pins
  drop constraint if exists pins_description_check;

alter table public.pins
  add constraint pins_description_check
  check (char_length(description) <= 1500);
