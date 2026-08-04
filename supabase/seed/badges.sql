-- =============================================================================
-- UDP Map — INSIGNIAS
-- =============================================================================
-- Este archivo se escribe a mano, a diferencia de seed.sql, que lo regenera
-- scripts/gen_seed_full.ts desde src/shared/data/campusData.ts y por tanto se
-- sobrescribe entero cada vez que se ejecuta.
--
-- Las insignias llegaron a producción por migración y nunca entraron al seed,
-- así que una base reconstruida desde cero se quedaba con la tabla vacía. Eso
-- no es cosmético: el trigger on_pin_badge concede 'explorer' al quinto pin de
-- un usuario, la clave foránea contra badges falla, y la excepción revierte el
-- INSERT del pin. O sea que sin estas filas, crear el quinto pin es imposible.
--
-- Orden de ejecución sobre un proyecto nuevo:
--   1. supabase/schema/baseline.sql
--   2. supabase/seed/badges.sql   (este archivo)
--   3. supabase/seed/seed.sql
--
-- Los umbrales de cada insignia no están aquí: viven en las funciones
-- check_*_badge del baseline. Esta tabla solo guarda cómo se llaman y cómo se
-- describen en las dos lenguas de la interfaz.
-- =============================================================================

insert into public.badges (id, name, name_en, description, description_en) values
  ('explorer',         'Explorador', 'Explorer',
   'Crea 5 o más pines en el mapa',
   'Create 5 or more pins on the map'),

  ('guardian',         'Guardián',   'Guardian',
   'Vota en 10 o más publicaciones',
   'Vote 10 or more times on posts'),

  ('host',             'Anfitrión',  'Host',
   'Organiza 2 o más eventos',
   'Host 2 or more events'),

  ('photographer',     'Fotógrafo',  'Photographer',
   'Sube 3 o más fotos a tus pines',
   'Upload 3 or more photos to your pins'),

  ('pioneer',          'Pionero',    'Pioneer',
   'Alcanza 100 o más puntos de Karma',
   'Reach 100 or more Karma points'),

  ('verified_creator', 'Cartógrafo', 'Cartographer',
   'Logra que 2 de tus aportes sean verificados oficialmente.',
   'Have 2 of your reports officially verified.')
on conflict (id) do nothing;
