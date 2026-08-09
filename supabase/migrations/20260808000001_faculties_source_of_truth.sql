-- ═══════════════════════════════════════════════════════════════
-- Fase 7B: la tabla `faculties` pasa a ser la fuente del catálogo.
--
-- Hasta ahora el cliente NUNCA la consultaba: las facultades salían de
-- `FACULTIES`, un array estático de `campusData.ts`, y crear una facultad en
-- la base no la hacía aparecer en ninguna parte de la app. Desde esta
-- migración el catálogo se lee de aquí y el array es solo la semilla con la
-- que arranca la caché.
--
-- Esto NO cambia el esquema: no hay DDL. Lo que cambia es de quién es la
-- verdad, y por eso hay que igualar los datos ANTES de cambiar la fuente.
-- La base venía desalineada del archivo en tres sitios, y sin este volcado
-- el mapa habría cambiado solo al desplegar:
--
--   · `biblioteca` y `ciencias-sociales` tenían las dos el mismo polígono
--     grande, de una versión vieja en la que compartían manzana.
--   · `postgrado-derecho` tenía un cuadrado inventado que el generador del
--     seed produjo a partir de la huella aproximada. No es un perímetro
--     trazado, así que pasa a null: con él, un pin en esa manzana se
--     asignaba a una facultad por un contorno que nadie dibujó.
--   · Varias facultades estaban en el campus equivocado y sin imagen.
--
-- Se aplica a mano desde el SQL Editor de Supabase.
-- Generada por `scripts/gen_faculties_migration.ts`.
-- ═══════════════════════════════════════════════════════════════

insert into public.faculties (id, name, name_en, campus_id, lat, lng, image) values
  ('ingenieria', 'Facultad de Ingeniería y Ciencias', 'Faculty of Engineering and Sciences', 'ejercito', -33.45276, -70.66105, '/fic.png'),
  ('medicina', 'Facultad de Medicina', 'Faculty of Medicine', 'ejercito', -33.44864, -70.66134, 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&h=200&fit=crop&q=60'),
  ('psicologia', 'Facultad de Psicología', 'Faculty of Psychology', 'ejercito', -33.45066, -70.66232, 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=200&h=200&fit=crop&q=60'),
  ('salud', 'Facultad de Salud y Odontología', 'Faculty of Health and Dentistry', 'ejercito', -33.4502132338048, -70.6603284462864, 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&h=200&fit=crop&q=60'),
  ('derecho', 'Facultad de Derecho', 'Faculty of Law', 'republica', -33.4502188787352, -70.6681844018121, 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=200&h=200&fit=crop&q=60'),
  ('postgrado-derecho', 'Facultad de Postgrado Derecho UDP', 'Postgraduate Law Faculty', 'republica', -33.4500562754381, -70.6677788388334, 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=200&h=200&fit=crop&q=60'),
  ('arquitectura', 'Facultad de Arquitectura, Arte y Diseño', 'Faculty of Architecture, Art and Design', 'republica', -33.4494756997435, -70.6669349979822, 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200&h=200&fit=crop&q=60'),
  ('comunicacion', 'Facultad de Comunicación y Letras', 'Faculty of Communication and Letters', 'ejercito', -33.4501, -70.66166, 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=200&h=200&fit=crop&q=60'),
  ('ciencias-sociales', 'Facultad de Ciencias Sociales e Historia', 'Faculty of Social Sciences and History', 'ejercito', -33.4511241180899, -70.6608646153093, 'https://images.unsplash.com/photo-1531548731165-c6ae86ff6491?w=200&h=200&fit=crop&q=60'),
  ('educacion', 'Facultad de Educación', 'Faculty of Education', 'ejercito', -33.44991, -70.66186, 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=200&h=200&fit=crop&q=60'),
  ('biblioteca', 'Biblioteca Nicanor Parra', 'Nicanor Parra Library', 'ejercito', -33.4512852716982, -70.6617168264727, 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=200&h=200&fit=crop&q=60'),
  ('economia', 'Facultad de Economía y Empresa', 'Faculty of Economics and Business', 'huechuraba', -33.39337, -70.61283, 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&h=200&fit=crop&q=60'),
  ('aulario', 'Aulario UDP', 'UDP Classrooms', 'ejercito', -33.451, -70.66037, 'https://images.unsplash.com/photo-1577896851231-70ef18881754?w=200&h=200&fit=crop&q=60'),
  ('filosofia', 'Instituto de Filosofía', 'Institute of Philosophy', 'ejercito', -33.45009, -70.6606, 'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=200&h=200&fit=crop&q=60'),
  ('deportes', 'UDP Centro de Deportes', 'UDP Sports Center', 'ejercito', -33.4513333530393, -70.6595911336277, 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=200&h=200&fit=crop&q=60'),
  ('dti', 'UDP Oficina DTI', 'UDP IT Office (DTI)', 'ejercito', -33.4509322062588, -70.6597607833481, 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=200&h=200&fit=crop&q=60'),
  ('comercio', 'Facultad de Comercio', 'Faculty of Commerce', 'ejercito', -33.4508949239208, -70.6606009331726, 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=200&h=200&fit=crop&q=60')
on conflict (id) do update set
  name      = excluded.name,
  name_en   = excluded.name_en,
  campus_id = excluded.campus_id,
  lat       = excluded.lat,
  lng       = excluded.lng,
  image     = excluded.image;

-- ── Perímetros trazados ──
-- Los mismos que hasta hoy pintaba `facultyPerimeters.ts` en el cliente, para
-- que el contorno del mapa no se mueva ni un metro al cambiar de fuente.
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6615718,-33.4525797],[-70.6614965,-33.452564],[-70.6613632,-33.4525355],[-70.661329,-33.4525282],[-70.6611799,-33.452497],[-70.6607075,-33.4524018],[-70.6606108,-33.4523819],[-70.6605349,-33.4527535],[-70.6606443,-33.4527745],[-70.661092,-33.452862],[-70.6610461,-33.4530498],[-70.6614801,-33.4531345],[-70.6615096,-33.4529593],[-70.6615424,-33.4527626],[-70.6615718,-33.4525797]]]}'::jsonb where id = 'ingenieria';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6615492,-33.4486101],[-70.6615162,-33.448796],[-70.6612569,-33.4487625],[-70.6612899,-33.4485745],[-70.6615492,-33.4486101]]]}'::jsonb where id = 'medicina';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6625259,-33.4509769],[-70.6619878,-33.4508662],[-70.6620683,-33.4503521],[-70.6626388,-33.4504068],[-70.6625258,-33.4509769]]]}'::jsonb where id = 'psicologia';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6607551,-33.4502214],[-70.6604027,-33.4501413],[-70.660448,-33.4499622],[-70.6603207,-33.4499389],[-70.6603782,-33.4497016],[-70.6600502,-33.4496288],[-70.6598111,-33.4504645],[-70.6601217,-33.4505271],[-70.6601758,-33.4503452],[-70.6605859,-33.4504281],[-70.6606156,-33.4503393],[-70.6607307,-33.4503655],[-70.6607551,-33.4502214]]]}'::jsonb where id = 'salud';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6681863,-33.4505432],[-70.6681332,-33.4505282],[-70.668073,-33.4505105],[-70.6681595,-33.4500784],[-70.6688408,-33.4502376],[-70.6688235,-33.4503417],[-70.6687416,-33.4506516],[-70.6681863,-33.4505432]]]}'::jsonb where id = 'derecho';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6670801,-33.4496681],[-70.6671163,-33.4494033],[-70.6673897,-33.4494504],[-70.6674262,-33.4493056],[-70.6673925,-33.449301],[-70.6674205,-33.4491518],[-70.6670258,-33.4491292],[-70.6670152,-33.4491989],[-70.6668807,-33.4491955],[-70.6667702,-33.4495942],[-70.6670801,-33.4496681]]]}'::jsonb where id = 'arquitectura';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6618979,-33.4500208],[-70.6618377,-33.4503372],[-70.6617932,-33.4503328],[-70.6616583,-33.4503195],[-70.661344,-33.4502884],[-70.6612149,-33.4502757],[-70.6612297,-33.4501733],[-70.6614232,-33.4501955],[-70.6614478,-33.4499814],[-70.6618591,-33.450018],[-70.6618979,-33.4500208]]]}'::jsonb where id = 'comunicacion';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6612107,-33.451225],[-70.6608272,-33.4511741],[-70.6608437,-33.4510797],[-70.6612256,-33.4511297],[-70.6612107,-33.451225]]]}'::jsonb where id = 'ciencias-sociales';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.661917,-33.4497927],[-70.6618967,-33.4499705],[-70.6614767,-33.4499313],[-70.6615101,-33.4497151],[-70.661917,-33.4497927]]]}'::jsonb where id = 'educacion';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6617524,-33.4511991],[-70.6617027,-33.4514876],[-70.6614392,-33.4514596],[-70.6611724,-33.4514263],[-70.6611883,-33.4513286],[-70.6608072,-33.4512795],[-70.6608272,-33.4511741],[-70.6612107,-33.451225],[-70.6612256,-33.4511297],[-70.6617524,-33.4511991]]]}'::jsonb where id = 'biblioteca';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6128535,-33.3943754],[-70.6136567,-33.393674],[-70.6129,-33.3916369],[-70.6118879,-33.3918857],[-70.611865,-33.3928583],[-70.6118726,-33.3930592],[-70.6119834,-33.3932696],[-70.6121744,-33.3935056],[-70.6125448,-33.3939903],[-70.6128045,-33.394408],[-70.6128535,-33.3943754]]]}'::jsonb where id = 'economia';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6606097,-33.4509824],[-70.6605834,-33.4510969],[-70.6601225,-33.4510213],[-70.6601479,-33.4509103],[-70.6606088,-33.4509831]]]}'::jsonb where id = 'aulario';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6604498,-33.4499617],[-70.6604041,-33.4501411],[-70.6607577,-33.4502168],[-70.6607928,-33.4500354],[-70.6604498,-33.4499617]]]}'::jsonb where id = 'filosofia';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6600011,-33.451545],[-70.6600705,-33.451201],[-70.6595486,-33.4511041],[-70.6594465,-33.4514434],[-70.6599981,-33.4515484],[-70.6600011,-33.451545]]]}'::jsonb where id = 'deportes';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6596758,-33.4507993],[-70.6597937,-33.4508217],[-70.6598018,-33.4507937],[-70.6599276,-33.4508182],[-70.6598668,-33.4510417],[-70.6600982,-33.4510858],[-70.6600844,-33.451143],[-70.6600774,-33.4511715],[-70.6600741,-33.4511858],[-70.6600722,-33.451193],[-70.6600701,-33.4512022],[-70.6596611,-33.4511249],[-70.6596787,-33.4510606],[-70.6596069,-33.4510466],[-70.6596758,-33.4507993]]]}'::jsonb where id = 'dti';
update public.faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6606104,-33.4509786],[-70.6606413,-33.4508397],[-70.660196,-33.4507652],[-70.6601523,-33.4509041],[-70.6606097,-33.4509785]]]}'::jsonb where id = 'comercio';

-- Sin trazo: null y no un cuadrado. "No tiene perímetro" y "tiene uno de 100 m
-- de lado centrado en la chincheta" son cosas distintas, y la segunda le asigna
-- facultad a pines que están en la calle.
update public.faculties set polygon = null where id in ('postgrado-derecho');

-- ── La política, dicha entera ──
-- Ya dejaba escribir a un admin: una policy FOR ALL sin WITH CHECK reutiliza su
-- USING para comprobar las filas nuevas. Pero hasta hoy nadie escribía esta
-- tabla desde la app, y ahora sí: se deja explícito, como `buildings_write`,
-- para que no dependa de conocer esa regla de Postgres.
drop policy if exists faculties_admin on public.faculties;
create policy faculties_admin on public.faculties
  for all using (public.user_role() = 'admin')
  with check (public.user_role() = 'admin');
