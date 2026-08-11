-- ─────────────────────────────────────────────────────────────────────────────
-- SCRIPT DE DATOS DUMMY (56 PINES CON EVENTOS EN VIVO + PROGRAMAS)
-- Coordenadas base FIC: lat = -33.45276, lng = -70.66105
-- Cobertura: Pisos 1 a 5 y Subterráneos -1 a -3 (Esparcidos a 15-35 metros)
-- Admin ID: 9ea3f0ad-f7ed-4d42-bdd0-ce3284453112
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.pins (
  id,
  type,
  title,
  description,
  category_id,
  faculty_id,
  lat,
  lng,
  floor,
  room_code,
  creator_id,
  is_permanent,
  expires_at,
  starts_at,
  ends_at,
  votes_up,
  votes_down
) VALUES
  -- 📍 PISO 1 (8 pines - Esparcidos 15-30m, salvo 1 par a 2m para test de solapamiento)
  (
    'a1000000-0000-0000-0000-000000000101', 'report', 'Sala 101 - Ocupada',
    'Clase de Física General II en curso hasta las 13:00.',
    'sala', 'ingenieria', -33.452740, -70.661020, 1, 'E441.1.S101',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '720 hours', NULL, NULL, 5, 0
  ),
  (
    -- ⚠️ Par a ~2m de la Sala 101 para probar solapamiento
    'a1000000-0000-0000-0000-000000000102', 'report', 'Baño Damas Piso 1',
    'Baño limpio con jabón y agua caliente.',
    'bano', 'ingenieria', -33.452742, -70.661022, 1, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 4, 0
  ),
  (
    'a1000000-0000-0000-0000-000000000103', 'report', 'Sala 102 - Disponible',
    'Libre por la mañana. Cuenta con proyector HDMI funcional.',
    'sala-libre', 'ingenieria', -33.452900, -70.661200, 1, 'E441.1.S102',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '6 hours', NULL, NULL, 8, 1
  ),
  (
    'a1000000-0000-0000-0000-000000000104', 'report', 'Baño Varones Piso 1',
    'Atención: dispensador de toalla secamanos agotado.',
    'bano', 'ingenieria', -33.452600, -70.660900, 1, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 2, 2
  ),
  (
    'a1000000-0000-0000-0000-000000000105', 'report', 'Entrada Principal FIC',
    'Acceso controlado por guardia. Mostrar credencial UDP.',
    'entrada', 'ingenieria', -33.452500, -70.661300, 1, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '720 hours', NULL, NULL, 12, 0
  ),
  (
    'a1000000-0000-0000-0000-000000000106', 'report', 'Rampa Inclusiva Acceso',
    'Rampa despejada para sillas de ruedas y cochecitos.',
    'rampa', 'ingenieria', -33.452520, -70.661320, 1, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '720 hours', NULL, NULL, 15, 0
  ),
  (
    'a1000000-0000-0000-0000-000000000107', 'report', 'Enchufes Hall Entrada',
    'Zapatilla con 4 tomas de corriente en los sillones de espera.',
    'enchufe', 'ingenieria', -33.452950, -70.660850, 1, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 7, 0
  ),
  (
    -- 🔴 EVENTO EN VIVO (Duración total: 2 horas. Empezó hace 30 min, termina en 90 min)
    'a1000000-0000-0000-0000-000000000108', 'event', 'Ayudantía Intensiva de Programación (EN VIVO)',
    'Repaso presencial para el certamen 2. Resolviendo ejercicios en Python y estructura de datos.',
    'ayudantia', 'ingenieria', -33.452700, -70.661100, 1, 'Auditorio 1',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '90 minutes',
    now() - interval '30 minutes', now() + interval '90 minutes', 24, 0
  ),

  -- 📍 PISO 2 (8 pines - Esparcidos por las distintas alas)
  (
    'a2000000-0000-0000-0000-000000000201', 'report', 'Laboratorio de Computación 201',
    '30 estaciones informáticas con Debian Linux y Matlab.',
    'computacion', 'ingenieria', -33.452550, -70.660950, 2, '201',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 11, 0
  ),
  (
    'a2000000-0000-0000-0000-000000000202', 'report', 'Lab 202 - Redes y Telecom',
    'Laboratorio reservado para la clase de Redes de Datos.',
    'computacion', 'ingenieria', -33.452850, -70.661250, 2, '202',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 4, 0
  ),
  (
    'a2000000-0000-0000-0000-000000000203', 'report', 'Impresora Láser B/N Pasillo 2',
    'Impresora conectada a la red UDP. Requiere saldo alumno.',
    'impresora', 'ingenieria', -33.452920, -70.660880, 2, '205',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 9, 1
  ),
  (
    'a2000000-0000-0000-0000-000000000204', 'report', 'Enchufes Mesa de Estudio Pasillo',
    '8 tomas de corriente en la mesa larga frente al lab 201.',
    'enchufe', 'ingenieria', -33.452620, -70.661180, 2, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 14, 0
  ),
  (
    'a2000000-0000-0000-0000-000000000205', 'report', 'Sala 204 - Ocupada',
    'Cátedra de Cálculo I en progreso.',
    'sala', 'ingenieria', -33.452480, -70.661050, 2, 'E441.2.S204',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '720 hours', NULL, NULL, 3, 0
  ),
  (
    'a2000000-0000-0000-0000-000000000206', 'report', 'Baño Mixto Piso 2',
    'Funcionando normalmente.',
    'bano', 'ingenieria', -33.452980, -70.661020, 2, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 6, 0
  ),
  (
    -- 🔴 EVENTO EN VIVO (Duración total: 1 DÍA completo. Empezó hace 4 horas, termina en 20 horas)
    'a2000000-0000-0000-0000-000000000207', 'event', 'Feria de Innovación y Prototipos 2026 (EN VIVO - 24H)',
    'Feria anual de ingeniería: stands interactivos, proyectos de título, maquetas e impresoras 3D en vivo todo el día.',
    'feria', 'ingenieria', -33.452750, -70.660950, 2, 'Patio Piso 2',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '20 hours',
    now() - interval '4 hours', now() + interval '20 hours', 45, 1
  ),
  (
    'a2000000-0000-0000-0000-000000000208', 'report', 'Mochila Azul Olvidada en Lab',
    'Dejada sobre la mesa 4 del Lab 201. Entregada al profesor.',
    'objeto-perdido', 'ingenieria', -33.452555, -70.660955, 2, '201',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '72 hours', NULL, NULL, 5, 0
  ),

  -- 📍 PISO 3 (8 pines - Esparcidos 20-30m)
  (
    'a3000000-0000-0000-0000-000000000301', 'report', 'Sala 301 Libre',
    'Desocupada por el resto de la tarde.',
    'sala-libre', 'ingenieria', -33.452520, -70.661220, 3, 'E441.3.S302',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '6 hours', NULL, NULL, 10, 0
  ),
  (
    'a3000000-0000-0000-0000-000000000302', 'report', 'Sala 302 Libre con Pizarra',
    'Pizarra acrílica limpia, ideal para trabajos grupales.',
    'sala-libre', 'ingenieria', -33.452880, -70.660820, 3, 'E441.3.S303',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '6 hours', NULL, NULL, 12, 0
  ),
  (
    'a3000000-0000-0000-0000-000000000303', 'report', 'Sala 305 en Clase de Química',
    'Ocupada hasta las 17:30.',
    'sala', 'ingenieria', -33.452650, -70.661350, 3, 'E441.3.S304',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '720 hours', NULL, NULL, 2, 0
  ),
  (
    'a3000000-0000-0000-0000-000000000304', 'report', 'Zona Silencio para Estudio',
    'Se solicita mantener bajo volumen de voz en este pasillo.',
    'silencio', 'ingenieria', -33.452950, -70.661150, 3, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 8, 0
  ),
  (
    'a3000000-0000-0000-0000-000000000305', 'report', 'Enchufes Ventanal Piso 3',
    '3 enchufes funcionando junto a la vista al patio.',
    'enchufe', 'ingenieria', -33.452450, -70.660920, 3, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 6, 0
  ),
  (
    'a3000000-0000-0000-0000-000000000306', 'report', 'Totém de Carga Celulares',
    'Estación de carga rápida USB-C y Lightning libre.',
    'enchufe', 'ingenieria', -33.452780, -70.661280, 3, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 11, 0
  ),
  (
    -- 🟡 EVENTO PRÓXIMO (Empieza en 2 horas)
    'a3000000-0000-0000-0000-000000000307', 'event', 'Workshop: Robótica Interactiva e IoT (Próximo)',
    'Demostración de prototipos creados con Arduino y ESP32.',
    'charla', 'ingenieria', -33.452600, -70.661050, 3, '308',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '6 hours',
    now() + interval '2 hours', now() + interval '6 hours', 25, 0
  ),
  (
    'a3000000-0000-0000-0000-000000000308', 'report', 'Polerón UDP Encontrado',
    'Polerón negro talla L dejado en la mesa del piso 3.',
    'objeto-encontrado', 'ingenieria', -33.452900, -70.660950, 3, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '72 hours', NULL, NULL, 7, 0
  ),

  -- 📍 PISO 4 (7 pines - Bien repartidos)
  (
    'a4000000-0000-0000-0000-000000000401', 'report', 'Microondas 1 Kitchenette',
    'Microondas funcionando a la perfección.',
    'microondas', 'ingenieria', -33.452580, -70.661280, 4, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 15, 0
  ),
  (
    'a4000000-0000-0000-0000-000000000402', 'report', 'Microondas 2 Kitchenette',
    'Microondas listo para usar en el horario de almuerzo.',
    'microondas', 'ingenieria', -33.452585, -70.661285, 4, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 9, 0
  ),
  (
    'a4000000-0000-0000-0000-000000000403', 'report', 'Baño Piso 4',
    'Higiene impecable.',
    'bano', 'ingenieria', -33.452920, -70.660880, 4, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 5, 0
  ),
  (
    'a4000000-0000-0000-0000-000000000404', 'report', 'Dispensador Agua Filtrada',
    'Purificador de agua helada disponible.',
    'agua', 'ingenieria', -33.452420, -70.661020, 4, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 13, 0
  ),
  (
    'a4000000-0000-0000-0000-000000000405', 'report', 'Grupo Estudio Cálculo III',
    'Buscamos compañero para preparar la guía 4.',
    'estudio', 'ingenieria', -33.452750, -70.661320, 4, '402',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '4 hours', NULL, NULL, 6, 0
  ),
  (
    'a4000000-0000-0000-0000-000000000406', 'report', 'Sala 403 Libre',
    'Disponible para estudiar en grupo.',
    'sala-libre', 'ingenieria', -33.452820, -70.660780, 4, 'E441.4.S403',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '6 hours', NULL, NULL, 8, 0
  ),
  (
    'a4000000-0000-0000-0000-000000000407', 'report', 'Cuaderno de Apuntes Perdido',
    'Cuaderno universitario azul olvidado en la sala 403.',
    'objeto-perdido', 'ingenieria', -33.452825, -70.660785, 4, 'E441.4.S403',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '72 hours', NULL, NULL, 4, 0
  ),

  -- 📍 PISO 5 (7 pines - Esparcidos)
  (
    'a5000000-0000-0000-0000-000000000501', 'report', 'Grupo Estudio Física Moderna',
    'Repaso de relatividad y cuántica para el certamen.',
    'estudio', 'ingenieria', -33.452480, -70.661220, 5, '501',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '3 hours', NULL, NULL, 7, 0
  ),
  (
    'a5000000-0000-0000-0000-000000000502', 'report', 'Sala 502 - Reunión de Proyectos',
    'Espacio reservado para proyectos de título.',
    'sala', 'ingenieria', -33.452920, -70.661180, 5, 'V432.5.S512',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '720 hours', NULL, NULL, 3, 0
  ),
  (
    'a5000000-0000-0000-0000-000000000503', 'report', 'Terraza Vista Santiago',
    'Zona al aire libre perfecta para descansar entre clases.',
    'otro', 'ingenieria', -33.452680, -70.660780, 5, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '720 hours', NULL, NULL, 22, 0
  ),
  (
    'a5000000-0000-0000-0000-000000000504', 'report', 'Enchufes Sofá Terraza',
    'Enchufes de pared junto a los sillones.',
    'enchufe', 'ingenieria', -33.452685, -70.660785, 5, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 12, 0
  ),
  (
    'a5000000-0000-0000-0000-000000000505', 'report', 'Impresora Color Piso 5',
    'Impresora multifuncional para planos y trabajos a color.',
    'impresora', 'ingenieria', -33.452850, -70.660920, 5, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 16, 1
  ),
  (
    'a5000000-0000-0000-0000-000000000506', 'report', 'Baño Piso 5',
    'Operativo.',
    'bano', 'ingenieria', -33.452420, -70.660950, 5, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 5, 0
  ),
  (
    'a5000000-0000-0000-0000-000000000507', 'event', 'Conferencia: Futuro del Software en Chile',
    'Panel con expertos de la industria sobre tendencias en desarrollo.',
    'charla', 'ingenieria', -33.452720, -70.661320, 5, 'Auditorio Piso 5',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '8 hours',
    now() + interval '3 hours', now() + interval '8 hours', 30, 0
  ),

  -- 📍 SUBTERRÁNEO -1 (6 pines)
  (
    'b1000000-0000-0000-0000-000000000101', 'report', 'Ascensor Principal Sub -1',
    'Ascensor conectando subterráneos y pisos superiores.',
    'ascensor', 'ingenieria', -33.452550, -70.661150, -1, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '720 hours', NULL, NULL, 14, 0
  ),
  (
    'b1000000-0000-0000-0000-000000000102', 'report', 'Dispensador de Agua Fría Sub -1',
    'Frente a los ascensores.',
    'agua', 'ingenieria', -33.452552, -70.661152, -1, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 11, 0
  ),
  (
    'b1000000-0000-0000-0000-000000000103', 'report', 'Estación de Carga de Baterías',
    'Cargadores multiconector para celulares y laptops.',
    'enchufe', 'ingenieria', -33.452880, -70.660850, -1, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 9, 0
  ),
  (
    'b1000000-0000-0000-0000-000000000104', 'report', 'Laboratorio de Química Sub -1',
    'Acceso controlado solo para alumnos con bata.',
    'computacion', 'ingenieria', -33.452920, -70.661280, -1, 'V432.-1.SIM',
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '720 hours', NULL, NULL, 4, 0
  ),
  (
    'b1000000-0000-0000-0000-000000000105', 'report', 'Baño Inclusivo Sub -1',
    'Baño adaptado con barras de apoyo y alarma de emergencia.',
    'bano', 'ingenieria', -33.452420, -70.660920, -1, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 8, 0
  ),
  (
    'b1000000-0000-0000-0000-000000000106', 'report', 'Rampa Subterráneo -1',
    'Acceso directo desde el patio interior.',
    'rampa', 'ingenieria', -33.452720, -70.661380, -1, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '720 hours', NULL, NULL, 6, 0
  ),

  -- 📍 SUBTERRÁNEO -2 (6 pines - Deporte y Bicicleteros)
  (
    'b2000000-0000-0000-0000-000000000201', 'report', 'Bicicletero Sector Norte',
    'Espacio iluminado para amarrar bicicletas con candado U-Lock.',
    'bicicletero', 'ingenieria', -33.452500, -70.660850, -2, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 18, 0
  ),
  (
    'b2000000-0000-0000-0000-000000000202', 'report', 'Bicicletero Sector Sur',
    'Capacidad para 15 bicicletas adicionales.',
    'bicicletero', 'ingenieria', -33.452950, -70.661250, -2, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 12, 0
  ),
  (
    'b2000000-0000-0000-0000-000000000203', 'report', 'Casilleros de Alumnos Sub -2',
    'Lockers de uso diario. Traer candado propio.',
    'otro', 'ingenieria', -33.452720, -70.660750, -2, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '720 hours', NULL, NULL, 10, 0
  ),
  (
    'b2000000-0000-0000-0000-000000000204', 'report', 'Mesa de Ping Pong Sub -2',
    'Mesa en excelente estado. Traer paletas y pelotas.',
    'ping-pong', 'ingenieria', -33.452820, -70.661150, -2, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 25, 1
  ),
  (
    'b2000000-0000-0000-0000-000000000205', 'event', 'Torneo Relámpago de Ping Pong FIC',
    'Inscripciones abiertas en el lugar. Premios para los 3 primeros lugares.',
    'deporte-evento', 'ingenieria', -33.452822, -70.661152, -2, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '5 hours',
    now() + interval '1 hour', now() + interval '5 hours', 35, 0
  ),
  (
    'b2000000-0000-0000-0000-000000000206', 'report', 'Baño Subterráneo -2',
    'Disponible.',
    'bano', 'ingenieria', -33.452450, -70.661320, -2, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '24 hours', NULL, NULL, 4, 0
  ),

  -- 📍 SUBTERRÁNEO -3 (6 pines - Casino y Comida)
  (
    'b3000000-0000-0000-0000-000000000301', 'report', 'Casino Principal FIC',
    'Menú completo del día a $2.500 con opción vegetariana.',
    'casino', 'ingenieria', -33.452750, -70.661050, -3, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 40, 2
  ),
  (
    'b3000000-0000-0000-0000-000000000302', 'report', 'Stand de Empanadas y Snacks',
    'Empanadas de pino y queso recién horneadas.',
    'food-truck', 'ingenieria', -33.452520, -70.660820, -3, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '8 hours', NULL, NULL, 28, 0
  ),
  (
    'b3000000-0000-0000-0000-000000000303', 'report', 'Batería de Microondas Casino',
    '4 microondas listos para calentar almuerzo.',
    'microondas', 'ingenieria', -33.452920, -70.661280, -3, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 19, 0
  ),
  (
    'b3000000-0000-0000-0000-000000000304', 'report', 'Venta de Café express y Donas',
    'Café de grano recién preparado.',
    'comida', 'ingenieria', -33.452620, -70.661350, -3, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '8 hours', NULL, NULL, 15, 0
  ),
  (
    'b3000000-0000-0000-0000-000000000305', 'report', 'Mesas Comedor Casino Sub -3',
    'Capacidad para 100+ personas sentadas.',
    'estudio', 'ingenieria', -33.452880, -70.660780, -3, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 8, 0
  ),
  (
    'b3000000-0000-0000-0000-000000000306', 'report', 'Cancha de Deporte Multiuso',
    'Espacio habilitado para baby fútbol y básquetbol.',
    'deporte', 'ingenieria', -33.452420, -70.661150, -3, NULL,
    '9ea3f0ad-f7ed-4d42-bdd0-ce3284453112', false, now() + interval '12 hours', NULL, NULL, 21, 0
  );


-- Insertar Bloques Horarios (Programas) para los Eventos
INSERT INTO public.pin_schedule_items (
  id,
  pin_id,
  starts_at,
  ends_at,
  title,
  subtitle,
  sort_order
) VALUES
  -- 📅 Programa para "Ayudantía Intensiva de Programación (EN VIVO - 2H)"
  (
    gen_random_uuid(), 'a1000000-0000-0000-0000-000000000108',
    now() - interval '30 minutes', now() + interval '15 minutes',
    'Módulo 1: Arreglos y Listas Enlazadas (En curso)', 'Explicación teórica y complejidad O(n)', 0
  ),
  (
    gen_random_uuid(), 'a1000000-0000-0000-0000-000000000108',
    now() + interval '15 minutes', now() + interval '50 minutes',
    'Módulo 2: Programación Orientada a Objetos', 'Herencia, Polimorfismo y Abstracción en Python', 1
  ),
  (
    gen_random_uuid(), 'a1000000-0000-0000-0000-000000000108',
    now() + interval '50 minutes', now() + interval '90 minutes',
    'Resolución de Certamen Anterior', 'Ejercicios tipo prueba resueltos en vivo', 2
  ),

  -- 📅 Programa para "Feria de Innovación y Prototipos 2026 (EN VIVO - 24H)"
  (
    gen_random_uuid(), 'a2000000-0000-0000-0000-000000000207',
    now() - interval '4 hours', now() - interval '1 hour',
    'Inauguración y Bienvenida', 'Palabras del decano e inicio de exhibición de proyectos', 0
  ),
  (
    gen_random_uuid(), 'a2000000-0000-0000-0000-000000000207',
    now() - interval '1 hour', now() + interval '8 hours',
    'Exhibición de Stands e Impresión 3D (En curso)', 'Demostraciones tecnológicas en vivo todo el día', 1
  ),
  (
    gen_random_uuid(), 'a2000000-0000-0000-0000-000000000207',
    now() + interval '8 hours', now() + interval '20 hours',
    'Premiación y Cierre de la Feria', 'Entrega de reconocimientos a los mejores proyectos estudiantiles', 2
  ),

  -- 📅 Programa para "Workshop: Robótica Interactiva e IoT"
  (
    gen_random_uuid(), 'a3000000-0000-0000-0000-000000000307',
    now() + interval '2 hours', now() + interval '3 hours',
    'Apertura e Introducción a Microcontroladores', 'Diferencias entre Arduino Uno, ESP32 y Raspberry Pi', 0
  ),
  (
    gen_random_uuid(), 'a3000000-0000-0000-0000-000000000307',
    now() + interval '3 hours', now() + interval '5 hours',
    'Hands-on: Sensores y Conectividad WiFi', 'Creando un servidor web embebido para telemetría', 1
  ),
  (
    gen_random_uuid(), 'a3000000-0000-0000-0000-000000000307',
    now() + interval '5 hours', now() + interval '6 hours',
    'Muestra de Prototipos de Alumnos', 'Demostración de carritos seguidores de línea y brazos robóticos', 2
  );
