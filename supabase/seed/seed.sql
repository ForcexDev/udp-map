-- ═══════════════════════════════════════════════════════════════
-- Seed: campus, facultades (→ place pins), carreras, categorías,
-- plano indoor demo y lista de admins.
-- ⚠️ Sincronizado automáticamente desde campusData.ts
-- ═══════════════════════════════════════════════════════════════

insert into campuses (id, name, lat, lng) values
  ('ejercito', 'Campus Ejército', -33.45129, -70.66103),
  ('republica', 'Campus República', -33.44961, -70.66442),
  ('huechuraba', 'Campus Huechuraba', -33.39337, -70.61283)
on conflict (id) do nothing;

insert into faculties (id, name, name_en, campus_id, lat, lng, image) values
  ('ingenieria', 'Facultad de Ingeniería y Ciencias', 'Faculty of Engineering and Sciences', 'ejercito', -33.45276, -70.66105, '/fic.png'),
  ('medicina', 'Facultad de Medicina', 'Faculty of Medicine', 'ejercito', -33.44864, -70.66134, 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&h=200&fit=crop&q=60'),
  ('psicologia', 'Facultad de Psicología', 'Faculty of Psychology', 'ejercito', -33.45066, -70.66232, 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=200&h=200&fit=crop&q=60'),
  ('salud', 'Facultad de Salud y Odontología', 'Faculty of Health and Dentistry', 'ejercito', -33.45021323380484, -70.66032844628639, 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&h=200&fit=crop&q=60'),
  ('derecho', 'Facultad de Derecho', 'Faculty of Law', 'republica', -33.45021136315485, -70.66809868354323, 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=200&h=200&fit=crop&q=60'),
  ('postgrado-derecho', 'Facultad de Postgrado Derecho UDP', 'Postgraduate Law Faculty', 'republica', -33.45005627543808, -70.66777883883336, null),
  ('arquitectura', 'Facultad de Arquitectura, Arte y Diseño', 'Faculty of Architecture, Art and Design', 'republica', -33.449475699743495, -70.66693499798215, 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200&h=200&fit=crop&q=60'),
  ('comunicacion', 'Facultad de Comunicación y Letras', 'Faculty of Communication and Letters', 'republica', -33.4501, -70.66166, 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=200&h=200&fit=crop&q=60'),
  ('ciencias-sociales', 'Facultad de Ciencias Sociales e Historia', 'Faculty of Social Sciences and History', 'ejercito', -33.45119, -70.66088, null),
  ('educacion', 'Facultad de Educación', 'Faculty of Education', 'republica', -33.44991, -70.66186, null),
  ('biblioteca', 'Biblioteca Nicanor Parra', 'Nicanor Parra Library', 'republica', -33.4513, -70.66125, 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=200&h=200&fit=crop&q=60'),
  ('economia', 'Facultad de Economía y Empresa', 'Faculty of Economics and Business', 'huechuraba', -33.39337, -70.61283, 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&h=200&fit=crop&q=60'),
  ('aulario', 'Aulario UDP', 'UDP Classrooms', 'ejercito', -33.451, -70.66037, null),
  ('filosofia', 'Instituto de Filosofía', 'Institute of Philosophy', 'ejercito', -33.45009, -70.6606, null),
  ('deportes', 'UDP Centro de Deportes', 'UDP Sports Center', 'ejercito', -33.45133335303932, -70.65959113362774, null),
  ('dti', 'UDP Oficina DTI', 'UDP IT Office (DTI)', 'ejercito', -33.45093220625878, -70.6597607833481, null),
  ('comercio', 'Facultad de Comercio', 'Faculty of Commerce', 'ejercito', -33.450894923920764, -70.6606009331726, null)
on conflict (id) do nothing;

-- ── Polígonos Reales (exportados de facultyPerimeters.ts) ──
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6615718,-33.4525797],[-70.6614965,-33.452564],[-70.6613632,-33.4525355],[-70.661329,-33.4525282],[-70.6611799,-33.452497],[-70.6607075,-33.4524018],[-70.6606108,-33.4523819],[-70.6605349,-33.4527535],[-70.6606443,-33.4527745],[-70.661092,-33.452862],[-70.6610461,-33.4530498],[-70.6614801,-33.4531345],[-70.6615096,-33.4529593],[-70.6615424,-33.4527626],[-70.6615718,-33.4525797]]]}'::jsonb where id = 'ingenieria';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6615492,-33.4486101],[-70.6615162,-33.448796],[-70.6612569,-33.4487625],[-70.6612899,-33.4485745],[-70.6615492,-33.4486101]]]}'::jsonb where id = 'medicina';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6625259,-33.4509769],[-70.6619878,-33.4508662],[-70.6620683,-33.4503521],[-70.6626388,-33.4504068],[-70.6625258,-33.4509769]]]}'::jsonb where id = 'psicologia';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6607551,-33.4502214],[-70.6604027,-33.4501413],[-70.660448,-33.4499622],[-70.6603207,-33.4499389],[-70.6603782,-33.4497016],[-70.6600502,-33.4496288],[-70.6598111,-33.4504645],[-70.6601217,-33.4505271],[-70.6601758,-33.4503452],[-70.6605859,-33.4504281],[-70.6606156,-33.4503393],[-70.6607307,-33.4503655],[-70.6607551,-33.4502214]]]}'::jsonb where id = 'salud';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6681863,-33.4505432],[-70.6681332,-33.4505282],[-70.668073,-33.4505105],[-70.6681595,-33.4500784],[-70.6688408,-33.4502376],[-70.6688235,-33.4503417],[-70.6687416,-33.4506516],[-70.6681863,-33.4505432]]]}'::jsonb where id = 'derecho';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.66822883883336,-33.45050627543808],[-70.66732883883336,-33.45050627543808],[-70.66732883883336,-33.44960627543808],[-70.66822883883336,-33.44960627543808],[-70.66822883883336,-33.45050627543808]]]}'::jsonb where id = 'postgrado-derecho';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6670801,-33.4496681],[-70.6671163,-33.4494033],[-70.6673897,-33.4494504],[-70.6674262,-33.4493056],[-70.6673925,-33.449301],[-70.6674205,-33.4491518],[-70.6670258,-33.4491292],[-70.6670152,-33.4491989],[-70.6668807,-33.4491955],[-70.6667702,-33.4495942],[-70.6670801,-33.4496681]]]}'::jsonb where id = 'arquitectura';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6618979,-33.4500208],[-70.6618377,-33.4503372],[-70.6617932,-33.4503328],[-70.6616583,-33.4503195],[-70.661344,-33.4502884],[-70.6612149,-33.4502757],[-70.6612297,-33.4501733],[-70.6614232,-33.4501955],[-70.6614478,-33.4499814],[-70.6618591,-33.450018],[-70.6618979,-33.4500208]]]}'::jsonb where id = 'comunicacion';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6608448,-33.4510802],[-70.6617545,-33.4511979],[-70.6616931,-33.4514856],[-70.6611896,-33.4514354],[-70.661207,-33.45133],[-70.6608077,-33.4512771],[-70.6608439,-33.4510801],[-70.6608448,-33.4510802]]]}'::jsonb where id = 'ciencias-sociales';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.661917,-33.4497927],[-70.6618967,-33.4499705],[-70.6614767,-33.4499313],[-70.6615101,-33.4497151],[-70.661917,-33.4497927]]]}'::jsonb where id = 'educacion';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6608448,-33.4510802],[-70.6617545,-33.4511979],[-70.6616931,-33.4514856],[-70.6611896,-33.4514354],[-70.661207,-33.45133],[-70.6608077,-33.4512771],[-70.6608439,-33.4510801],[-70.6608448,-33.4510802]]]}'::jsonb where id = 'biblioteca';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6128535,-33.3943754],[-70.6136567,-33.393674],[-70.6129,-33.3916369],[-70.6118879,-33.3918857],[-70.611865,-33.3928583],[-70.6118726,-33.3930592],[-70.6119834,-33.3932696],[-70.6121744,-33.3935056],[-70.6125448,-33.3939903],[-70.6128045,-33.394408],[-70.6128535,-33.3943754]]]}'::jsonb where id = 'economia';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6606097,-33.4509824],[-70.6605834,-33.4510969],[-70.6601225,-33.4510213],[-70.6601479,-33.4509103],[-70.6606088,-33.4509831]]]}'::jsonb where id = 'aulario';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6604498,-33.4499617],[-70.6604041,-33.4501411],[-70.6607577,-33.4502168],[-70.6607928,-33.4500354],[-70.6604498,-33.4499617]]]}'::jsonb where id = 'filosofia';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6600011,-33.451545],[-70.6600705,-33.451201],[-70.6595486,-33.4511041],[-70.6594465,-33.4514434],[-70.6599981,-33.4515484],[-70.6600011,-33.451545]]]}'::jsonb where id = 'deportes';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6596758,-33.4507993],[-70.6597937,-33.4508217],[-70.6598018,-33.4507937],[-70.6599276,-33.4508182],[-70.6598668,-33.4510417],[-70.6600982,-33.4510858],[-70.6600844,-33.451143],[-70.6600774,-33.4511715],[-70.6600741,-33.4511858],[-70.6600722,-33.451193],[-70.6600701,-33.4512022],[-70.6596611,-33.4511249],[-70.6596787,-33.4510606],[-70.6596069,-33.4510466],[-70.6596758,-33.4507993]]]}'::jsonb where id = 'dti';
update faculties set polygon = '{"type":"Polygon","coordinates":[[[-70.6606104,-33.4509786],[-70.6606413,-33.4508397],[-70.660196,-33.4507652],[-70.6601523,-33.4509041],[-70.6606097,-33.4509785]]]}'::jsonb where id = 'comercio';

insert into careers (faculty_id, name, name_en) values
  ('economia', 'Administración Pública', 'Public Administration'),
  ('economia', 'Bachillerato en Administración y Economía', 'Baccalaureate in Administration and Economics'),
  ('economia', 'Contador Auditor - Contador Público', 'Auditing and Public Accounting'),
  ('economia', 'Ingeniería Comercial', 'Business Engineering'),
  ('economia', 'Ingeniería en Control de Gestión', 'Management Control Engineering'),
  ('ciencias-sociales', 'Administración Pública', 'Public Administration'),
  ('ciencias-sociales', 'Antropología', 'Anthropology'),
  ('ciencias-sociales', 'Bachillerato en Ciencias Sociales y Humanidades', 'Baccalaureate in Social Sciences and Humanities'),
  ('ciencias-sociales', 'Ciencia Política', 'Political Science'),
  ('ciencias-sociales', 'Licenciatura en Historia', 'Bachelor in History'),
  ('ciencias-sociales', 'Sociología', 'Sociology'),
  ('arquitectura', 'Arquitectura', 'Architecture'),
  ('arquitectura', 'Artes Visuales', 'Visual Arts'),
  ('arquitectura', 'Diseño', 'Design'),
  ('comunicacion', 'Cine de Animación', 'Animation Cinema'),
  ('comunicacion', 'Cine y Realización Audiovisual', 'Cinema and Audiovisual Production'),
  ('comunicacion', 'Literatura Creativa', 'Creative Literature'),
  ('comunicacion', 'Periodismo', 'Journalism'),
  ('comunicacion', 'Publicidad', 'Advertising'),
  ('derecho', 'Derecho', 'Law'),
  ('salud', 'Enfermería', 'Nursing'),
  ('salud', 'Kinesiología', 'Kinesiology'),
  ('salud', 'Obstetricia y Neonatología', 'Obstetrics and Neonatology'),
  ('salud', 'Odontología', 'Dentistry'),
  ('salud', 'Tecnología Médica', 'Medical Technology'),
  ('ingenieria', 'Ingeniería Civil en Ciencia de Datos e Inteligencia Artificial', 'Data Science and AI Engineering'),
  ('ingenieria', 'Ingeniería Civil en Informática y Telecomunicaciones', 'IT and Telecommunications Engineering'),
  ('ingenieria', 'Ingeniería Civil en Obras Civiles', 'Civil Engineering'),
  ('ingenieria', 'Ingeniería Civil Industrial', 'Industrial Engineering'),
  ('ingenieria', 'Ingeniería Civil Plan Común', 'Common Core Engineering'),
  ('medicina', 'Medicina', 'Medicine'),
  ('educacion', 'Pedagogía en Educación Diferencial con mención en Desarrollo Cognitivo', 'Special Education in Cognitive Development'),
  ('educacion', 'Pedagogía en Educación General Básica', 'Primary Education'),
  ('educacion', 'Pedagogía en Educación Parvularia', 'Early Childhood Education'),
  ('educacion', 'Pedagogía en Historia y Ciencias Sociales', 'History and Social Sciences Education'),
  ('educacion', 'Pedagogía en Inglés', 'English Education'),
  ('educacion', 'Pedagogía en Lengua Castellana y Comunicación', 'Spanish Language and Communication Education'),
  ('educacion', 'Pedagogía Media en Matemática', 'High School Mathematics Education'),
  ('psicologia', 'Psicología', 'Psychology');

insert into categories (id, kind, name, name_en, color, svg_path, ttl_hours) values
  ('sala-libre', 'report', 'Sala Libre', 'Free Room', '#10B981', 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', 6),
  ('estudio', 'report', 'Estudio', 'Study', '#3B82F6', 'M12 3L1 9l11 6 9-4.91V17h2V9L12 3z', 12),
  ('computacion', 'report', 'Computación', 'Computing', '#06B6D4', 'M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z', 12),
  ('ping-pong', 'report', 'Ping Pong', 'Ping Pong', '#D41F2D', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z', 12),
  ('bano', 'report', 'Baño', 'Restroom', '#8B5CF6', 'M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z', 24),
  ('comida', 'report', 'Comida', 'Food', '#F59E0B', 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z', 12),
  ('silencio', 'report', 'Silencio', 'Silence', '#6366F1', 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z', 12),
  ('impresora', 'report', 'Print', 'Print', '#EC4899', 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z', 24),
  ('deporte', 'report', 'Deporte', 'Sports', '#F97316', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z', 12),
  ('casino', 'report', 'Casino', 'Cafeteria', '#D41F2D', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', 12),
  ('food-truck', 'report', 'Food truck', 'Food truck', '#f97316', 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z', 8),
  ('objeto-perdido', 'report', 'Objeto perdido', 'Lost item', '#8b5cf6', 'M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14zm-5-1c.83 0 1.5-.67 1.5-1.5S12.83 15 12 15s-1.5.67-1.5 1.5S11.17 18 12 18z', 72),
  ('objeto-encontrado', 'report', 'Objeto encontrado', 'Found item', '#10b981', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z', 72),
  ('otro', 'report', 'Otro', 'Other', '#ec4899', 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', 24),
  ('entrada', 'report', 'Entrada', 'Entrance', '#D41F2D', 'M4 21v-2h2V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15h2v2H4zm4-2h3V4H8v15zm5 0h3V5.5l-3-.9V19z', null),
  ('bicicletero', 'report', 'Bicicletero', 'Bike Rack', '#059669', 'M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8 .8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1 .2-1.4 .6L7.8 8.4c-.4 .4-.6 .9-.6 1.4 0 .6 .2 1.1 .6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z', 24),
  ('microondas', 'report', 'Microondas', 'Microwave', '#dc2626', 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1 .9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zm-4-9h-2v2h2V9zm0 4h-2v2h2v-2zM6 8h8v8H6V8z', 12),
  ('enchufe', 'report', 'Enchufe', 'Outlet', '#2563eb', 'M7 7h10v3l-4 4v5h-2v-5l-4-4V7zm2-5h2v4H9V2zm4 0h2v4h-2V2z', 12),
  ('agua', 'report', 'Agua', 'Water', '#0ea5e9', 'M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zM7.83 14c.37 0 .67.26.74.62.41 2.22 2.28 2.98 3.64 2.87.43-.02.79.32.79.75s-.35.79-.78.8c-2.02.05-4.64-1.25-5.17-4.11-.08-.42.23-.93.78-.93z', 24),
  ('charla', 'event', 'Charla', 'Talk', '#6366f1', 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z', null),
  ('fiesta', 'event', 'Fiesta', 'Party', '#d946ef', 'M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99l-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12c.01-1.66-1.33-3-2.99-3z', null),
  ('deporte-evento', 'event', 'Competencia', 'Competition', '#16a34a', 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z', null),
  ('ayudantia', 'event', 'Ayudantía', 'Tutoring', '#0ea5e9', 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z', null),
  ('feria', 'event', 'Feria', 'Fair', '#eab308', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', null)
on conflict (id) do nothing;

-- ── Facultades como pines `place` permanentes ──
insert into pins (type, title, faculty_id, lat, lng, is_permanent, is_official)
select 'place', f.name, f.id, f.lat, f.lng, true, true
from faculties f
where not exists (
  select 1 from pins p where p.type = 'place' and p.faculty_id = f.id
);

-- ── Plano indoor demo ──
insert into floor_plans (faculty_id, building, floor, geojson)
select 'ingenieria', 'Edificio FIC', 1, '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Hall central","kind":"hall"},"geometry":{"type":"Polygon","coordinates":[[[-70.65465,-33.45015],[-70.65425,-33.45015],[-70.65425,-33.44985],[-70.65465,-33.44985],[-70.65465,-33.45015]]]}},{"type":"Feature","properties":{"name":"Sala 101","kind":"room"},"geometry":{"type":"Polygon","coordinates":[[[-70.65425,-33.45015],[-70.65405,-33.45015],[-70.65405,-33.45],[-70.65425,-33.45],[-70.65425,-33.45015]]]}},{"type":"Feature","properties":{"name":"Sala 102","kind":"room"},"geometry":{"type":"Polygon","coordinates":[[[-70.65425,-33.45],[-70.65405,-33.45],[-70.65405,-33.44985],[-70.65425,-33.44985],[-70.65425,-33.45]]]}},{"type":"Feature","properties":{"name":"Baños","kind":"service"},"geometry":{"type":"Polygon","coordinates":[[[-70.65465,-33.4502],[-70.65445,-33.4502],[-70.65445,-33.45015],[-70.65465,-33.45015],[-70.65465,-33.4502]]]}}]}'::jsonb
where not exists (select 1 from floor_plans where faculty_id = 'ingenieria' and floor = 1);

insert into floor_plans (faculty_id, building, floor, geojson)
select 'ingenieria', 'Edificio FIC', 2, '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Sala 201","kind":"room"},"geometry":{"type":"Polygon","coordinates":[[[-70.65465,-33.45015],[-70.65445,-33.45015],[-70.65445,-33.45],[-70.65465,-33.45],[-70.65465,-33.45015]]]}},{"type":"Feature","properties":{"name":"Sala 202","kind":"room"},"geometry":{"type":"Polygon","coordinates":[[[-70.65445,-33.45015],[-70.65425,-33.45015],[-70.65425,-33.45],[-70.65445,-33.45],[-70.65445,-33.45015]]]}},{"type":"Feature","properties":{"name":"Laboratorio de Computación","kind":"room"},"geometry":{"type":"Polygon","coordinates":[[[-70.65425,-33.45015],[-70.65405,-33.45015],[-70.65405,-33.44985],[-70.65425,-33.44985],[-70.65425,-33.45015]]]}},{"type":"Feature","properties":{"name":"Sala de estudio","kind":"hall"},"geometry":{"type":"Polygon","coordinates":[[[-70.65465,-33.45],[-70.65425,-33.45],[-70.65425,-33.44985],[-70.65465,-33.44985],[-70.65465,-33.45]]]}}]}'::jsonb
where not exists (select 1 from floor_plans where faculty_id = 'ingenieria' and floor = 2);

-- ── Admins iniciales ──
-- No van aquí: son correos de personas reales y este archivo está en el
-- repositorio. Se insertan a mano tras un reset, y ANTES de que esas personas
-- se registren, porque el rol admin se asigna en el alta y no después:
--
--   insert into admin_emails (email) values ('alguien@mail.udp.cl');
--
-- Ver el runbook en docs/DATABASE.md, sección 10.
