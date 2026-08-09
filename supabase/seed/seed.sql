-- ═══════════════════════════════════════════════════════════════
-- Seed: campus, facultades (→ place pins), carreras, categorías,
-- plano indoor demo y lista de admins.
-- ⚠️ Sincronizado automáticamente desde campusData.ts
-- ═══════════════════════════════════════════════════════════════

insert into campuses (id, name, lat, lng) values
  ('ejercito', 'Campus Centro', -33.45129, -70.66103),
  ('republica', 'Campus República', -33.449695, -70.667732),
  ('huechuraba', 'Campus Huechuraba', -33.39337, -70.61283)
on conflict (id) do nothing;

insert into faculties (id, name, name_en, campus_id, lat, lng, image) values
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
on conflict (id) do nothing;

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
  ('entrada', 'report', 'Entrada', 'Entrance', '#D41F2D', 'M19 3h-4v2h4v14h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM10.08 15.58 11.5 17l5-5-5-5-1.42 1.41L12.67 11H3v2h9.67l-2.59 2.58z', null),
  ('sala', 'report', 'Sala', 'Room', '#0EA5E9', 'M19 19V5c0-1.1-.9-2-2-2H7c-1.1 0-2 .9-2 2v14H3v2h18v-2h-2zm-4-6h-2v-2h2v2z', 720),
  ('ascensor', 'report', 'Ascensor', 'Elevator', '#6366F1', 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h10V4H7zm5 2.5l3.5 4h-7l3.5-4zm0 11.5l-3.5-4h7l-3.5 4z', 720),
  ('rampa', 'report', 'Rampa', 'Ramp', '#0D9488', 'M9.08 5.88c.86-.08 1.53-.82 1.53-1.69C10.61 3.26 9.85 2.5 8.92 2.5s-1.69.76-1.69 1.69c0 .28.08.58.21.82l.6 8.49h6.22l2.55 5.97 3.35-1.31-.52-1.23-1.87.68-2.47-5.69-5.78.04-.08-1.08h4.18v-1.59h-4.34L9.08 5.88zM15.33 18.06c-1.05 2.07-3.24 3.44-5.59 3.44C6.31 21.5 3.5 18.69 3.5 15.25c0-2.42 1.46-4.66 3.65-5.65l.14 1.84c-1.29.81-2.09 2.28-2.09 3.82 0 2.5 2.04 4.53 4.53 4.53 2.28 0 4.23-1.75 4.5-4l1.1 2.27z', 720),
  ('sala-libre', 'report', 'Sala Libre', 'Free Room', '#10B981', 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', 6),
  ('estudio', 'report', 'Estudio', 'Study', '#3B82F6', 'M12 3L1 9l11 6 9-4.91V17h2V9L12 3z', 12),
  ('computacion', 'report', 'Computación', 'Computing', '#06B6D4', 'M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z', 12),
  ('silencio', 'report', 'Silencio', 'Silence', '#6366F1', 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z', 12),
  ('impresora', 'report', 'Print', 'Print', '#EC4899', 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z', 24),
  ('enchufe', 'report', 'Enchufe', 'Outlet', '#2563eb', 'M7 7h10v3l-4 4v5h-2v-5l-4-4V7zm2-5h2v4H9V2zm4 0h2v4h-2V2z', 12),
  ('comida', 'report', 'Comida', 'Food', '#F59E0B', 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z', 12),
  ('casino', 'report', 'Casino', 'Cafeteria', '#D41F2D', 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z', 12),
  ('food-truck', 'report', 'Food truck', 'Food truck', '#f97316', 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z', 8),
  ('microondas', 'report', 'Microondas', 'Microwave', '#dc2626', 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1 .9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zm-4-9h-2v2h2V9zm0 4h-2v2h2v-2zM6 8h8v8H6V8z', 12),
  ('agua', 'report', 'Agua', 'Water', '#0ea5e9', 'M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zM7.83 14c.37 0 .67.26.74.62.41 2.22 2.28 2.98 3.64 2.87.43-.02.79.32.79.75s-.35.79-.78.8c-2.02.05-4.64-1.25-5.17-4.11-.08-.42.23-.93.78-.93z', 24),
  ('bano', 'report', 'Baño', 'Restroom', '#8B5CF6', 'M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z', 24),
  ('bicicletero', 'report', 'Bicicletero', 'Bike Rack', '#059669', 'M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8 .8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1 .2-1.4 .6L7.8 8.4c-.4 .4-.6 .9-.6 1.4 0 .6 .2 1.1 .6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z', 24),
  ('ping-pong', 'report', 'Ping Pong', 'Ping Pong', '#D41F2D', 'M 14.5 4 C 11.46 4 9 6.46 9 9.5 C 9 11.51 10.09 13.25 11.75 14.23 L 10 18.5 L 12 19 L 13.62 14.83 C 13.91 14.94 14.2 15 14.5 15 C 17.54 15 20 12.54 20 9.5 C 20 6.46 17.54 4 14.5 4 Z M 5.5 16 C 4.12 16 3 17.12 3 18.5 C 3 19.88 4.12 21 5.5 21 C 6.88 21 8 19.88 8 18.5 C 8 17.12 6.88 16 5.5 16 Z', 12),
  ('deporte', 'report', 'Deporte', 'Sports', '#F97316', 'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 19.86l-1.43-1.43L19.14 17l1.43-2.14z', 12),
  ('objeto-perdido', 'report', 'Objeto perdido', 'Lost item', '#8b5cf6', 'M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14zm-5-1c.83 0 1.5-.67 1.5-1.5S12.83 15 12 15s-1.5.67-1.5 1.5S11.17 18 12 18z', 72),
  ('objeto-encontrado', 'report', 'Objeto encontrado', 'Found item', '#10b981', 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z', 72),
  ('easter-egg', 'report', 'Easter Egg', 'Easter Egg', '#a855f7', 'M12 2C8 2 5 6 5 12c0 5 3 10 7 10s7-5 7-10c0-6-3-10-7-10z', null),
  ('otro', 'report', 'Otro', 'Other', '#ec4899', 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', 24),
  ('charla', 'event', 'Charla', 'Talk', '#6366f1', 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z', null),
  ('fiesta', 'event', 'Fiesta', 'Party', '#d946ef', 'M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99l-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12c.01-1.66-1.33-3-2.99-3z', null),
  ('deporte-evento', 'event', 'Competencia', 'Competition', '#16a34a', 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z', null),
  ('ayudantia', 'event', 'Ayudantía', 'Tutoring', '#0ea5e9', 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z', null),
  ('feria', 'event', 'Feria', 'Fair', '#eab308', 'M12 2 3 7v2h18V7l-9-5zm-7 9v9h4v-6h6v6h4v-9H5zm7 3h-2v3h2v-3z', null)
on conflict (id) do nothing;

-- ── Facultades como pines `place` permanentes ──
insert into pins (type, title, faculty_id, lat, lng, is_permanent, is_official)
select 'place', f.name, f.id, f.lat, f.lng, true, true
from faculties f
where not exists (
  select 1 from pins p where p.type = 'place' and p.faculty_id = f.id
);

-- ── Admins iniciales ──
-- No van aquí: son correos de personas reales y este archivo está en el
-- repositorio. Se insertan a mano tras un reset, y ANTES de que esas personas
-- se registren, porque el rol admin se asigna en el alta y no después:
--
--   insert into admin_emails (email) values ('alguien@mail.udp.cl');
--
-- Ver el runbook en docs/DATABASE.md, sección 10.
