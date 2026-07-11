import type { Polygon } from 'geojson'
import type { Campus, Category, Faculty, FloorPlan } from '@/shared/types/database'
import { FACULTY_PERIMETERS } from './facultyPerimeters'

// ⚠️ Coordenadas aproximadas de los campus/edificios UDP (Santiago).
// Ajustar en supabase/seed/seed.sql al validar en terreno; este archivo alimenta
// el MODO DEMO (sin Supabase) y sirve de fuente para el seed.

export const CAMPUSES: Campus[] = [
  { id: 'ejercito', name: 'Campus Centro', lat: -33.45129, lng: -70.66103 },
  { id: 'republica', name: 'Campus República', lat: -33.449695, lng: -70.667732 },
  { id: 'huechuraba', name: 'Campus Huechuraba', lat: -33.39337, lng: -70.61283 },
]

/** Cuadrado GeoJSON de ~2·d grados alrededor de un punto (huella aproximada). */
export function squareAround(lat: number, lng: number, d = 0.00045): Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ],
    ],
  }
}

const f = (
  id: string,
  name: string,
  name_en: string,
  campus_id: string,
  lat: number,
  lng: number,
  image: string | null = null,
): Faculty => ({
  id,
  name,
  name_en,
  campus_id,
  lat,
  lng,
  // Perímetro real si está trazado (hoy solo 'ingenieria'); si no, huella aproximada.
  polygon: FACULTY_PERIMETERS[id] ?? squareAround(lat, lng),
  image,
})

export const FACULTIES: Faculty[] = [
  f('ingenieria', 'Facultad de Ingeniería y Ciencias', 'Faculty of Engineering and Sciences', 'ejercito', -33.45276, -70.66105, '/fic.png'),
  f('medicina', 'Facultad de Medicina', 'Faculty of Medicine', 'ejercito', -33.44864, -70.66134, 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&h=200&fit=crop&q=60'),
  f('psicologia', 'Facultad de Psicología', 'Faculty of Psychology', 'ejercito', -33.45066, -70.66232, 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=200&h=200&fit=crop&q=60'),
  f('salud', 'Facultad de Salud y Odontología', 'Faculty of Health and Dentistry', 'ejercito', -33.4502132338048, -70.6603284462864, 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&h=200&fit=crop&q=60'),
  f('derecho', 'Facultad de Derecho', 'Faculty of Law', 'republica', -33.4502188787352, -70.6681844018121, 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=200&h=200&fit=crop&q=60'),
  f('postgrado-derecho', 'Facultad de Postgrado Derecho UDP', 'Postgraduate Law Faculty', 'republica', -33.4500562754381, -70.6677788388334),
  f('arquitectura', 'Facultad de Arquitectura, Arte y Diseño', 'Faculty of Architecture, Art and Design', 'republica', -33.4494756997435, -70.6669349979822, 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200&h=200&fit=crop&q=60'),
  f('comunicacion', 'Facultad de Comunicación y Letras', 'Faculty of Communication and Letters', 'ejercito', -33.4501, -70.66166, 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=200&h=200&fit=crop&q=60'),
  f('ciencias-sociales', 'Facultad de Ciencias Sociales e Historia', 'Faculty of Social Sciences and History', 'ejercito', -33.4511241180899, -70.6608646153093),
  f('educacion', 'Facultad de Educación', 'Faculty of Education', 'ejercito', -33.44991, -70.66186),
  f('biblioteca', 'Biblioteca Nicanor Parra', 'Nicanor Parra Library', 'ejercito', -33.4512852716982, -70.6617168264727, 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=200&h=200&fit=crop&q=60'),
  f('economia', 'Facultad de Economía y Empresa', 'Faculty of Economics and Business', 'huechuraba', -33.39337, -70.61283, 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&h=200&fit=crop&q=60'),
  f('aulario', 'Aulario UDP', 'UDP Classrooms', 'ejercito', -33.451, -70.66037),
  f('filosofia', 'Instituto de Filosofía', 'Institute of Philosophy', 'ejercito', -33.45009, -70.6606),
  f('deportes', 'UDP Centro de Deportes', 'UDP Sports Center', 'ejercito', -33.4513333530393, -70.6595911336277),
  f('dti', 'UDP Oficina DTI', 'UDP IT Office (DTI)', 'ejercito', -33.4509322062588, -70.6597607833481),
  f('comercio', 'Facultad de Comercio', 'Faculty of Commerce', 'ejercito', -33.4508949239208, -70.6606009331726),
]

export const CAREERS: { faculty_id: string; name: string; name_en: string }[] = [
  // Administración y Economía (ID: economia)
  { faculty_id: 'economia', name: 'Administración Pública', name_en: 'Public Administration' },
  { faculty_id: 'economia', name: 'Bachillerato en Administración y Economía', name_en: 'Baccalaureate in Administration and Economics' },
  { faculty_id: 'economia', name: 'Contador Auditor - Contador Público', name_en: 'Auditing and Public Accounting' },
  { faculty_id: 'economia', name: 'Ingeniería Comercial', name_en: 'Business Engineering' },
  { faculty_id: 'economia', name: 'Ingeniería en Control de Gestión', name_en: 'Management Control Engineering' },

  // Ciencias Sociales y Humanidades (ID: ciencias-sociales)
  { faculty_id: 'ciencias-sociales', name: 'Administración Pública', name_en: 'Public Administration' },
  { faculty_id: 'ciencias-sociales', name: 'Antropología', name_en: 'Anthropology' },
  { faculty_id: 'ciencias-sociales', name: 'Bachillerato en Ciencias Sociales y Humanidades', name_en: 'Baccalaureate in Social Sciences and Humanities' },
  { faculty_id: 'ciencias-sociales', name: 'Ciencia Política', name_en: 'Political Science' },
  { faculty_id: 'ciencias-sociales', name: 'Licenciatura en Historia', name_en: 'Bachelor in History' },
  { faculty_id: 'ciencias-sociales', name: 'Sociología', name_en: 'Sociology' },

  // Arquitectura, Arte y Diseño (ID: arquitectura)
  { faculty_id: 'arquitectura', name: 'Arquitectura', name_en: 'Architecture' },
  { faculty_id: 'arquitectura', name: 'Artes Visuales', name_en: 'Visual Arts' },
  { faculty_id: 'arquitectura', name: 'Diseño', name_en: 'Design' },

  // Comunicación y Letras (ID: comunicacion)
  { faculty_id: 'comunicacion', name: 'Cine de Animación', name_en: 'Animation Cinema' },
  { faculty_id: 'comunicacion', name: 'Cine y Realización Audiovisual', name_en: 'Cinema and Audiovisual Production' },
  { faculty_id: 'comunicacion', name: 'Literatura Creativa', name_en: 'Creative Literature' },
  { faculty_id: 'comunicacion', name: 'Periodismo', name_en: 'Journalism' },
  { faculty_id: 'comunicacion', name: 'Publicidad', name_en: 'Advertising' },

  // Derecho (ID: derecho)
  { faculty_id: 'derecho', name: 'Derecho', name_en: 'Law' },

  // Salud y Odontología (ID: salud)
  { faculty_id: 'salud', name: 'Enfermería', name_en: 'Nursing' },
  { faculty_id: 'salud', name: 'Kinesiología', name_en: 'Kinesiology' },
  { faculty_id: 'salud', name: 'Obstetricia y Neonatología', name_en: 'Obstetrics and Neonatology' },
  { faculty_id: 'salud', name: 'Odontología', name_en: 'Dentistry' },
  { faculty_id: 'salud', name: 'Tecnología Médica', name_en: 'Medical Technology' },

  // Ingeniería y Ciencias (ID: ingenieria)
  { faculty_id: 'ingenieria', name: 'Ingeniería Civil en Ciencia de Datos e Inteligencia Artificial', name_en: 'Data Science and AI Engineering' },
  { faculty_id: 'ingenieria', name: 'Ingeniería Civil en Informática y Telecomunicaciones', name_en: 'IT and Telecommunications Engineering' },
  { faculty_id: 'ingenieria', name: 'Ingeniería Civil en Obras Civiles', name_en: 'Civil Engineering' },
  { faculty_id: 'ingenieria', name: 'Ingeniería Civil Industrial', name_en: 'Industrial Engineering' },
  { faculty_id: 'ingenieria', name: 'Ingeniería Civil Plan Común', name_en: 'Common Core Engineering' },

  // Medicina (ID: medicina)
  { faculty_id: 'medicina', name: 'Medicina', name_en: 'Medicine' },

  // Educación (ID: educacion)
  { faculty_id: 'educacion', name: 'Pedagogía en Educación Diferencial con mención en Desarrollo Cognitivo', name_en: 'Special Education in Cognitive Development' },
  { faculty_id: 'educacion', name: 'Pedagogía en Educación General Básica', name_en: 'Primary Education' },
  { faculty_id: 'educacion', name: 'Pedagogía en Educación Parvularia', name_en: 'Early Childhood Education' },
  { faculty_id: 'educacion', name: 'Pedagogía en Historia y Ciencias Sociales', name_en: 'History and Social Sciences Education' },
  { faculty_id: 'educacion', name: 'Pedagogía en Inglés', name_en: 'English Education' },
  { faculty_id: 'educacion', name: 'Pedagogía en Lengua Castellana y Comunicación', name_en: 'Spanish Language and Communication Education' },
  { faculty_id: 'educacion', name: 'Pedagogía Media en Matemática', name_en: 'High School Mathematics Education' },

  // Psicología (ID: psicologia)
  { faculty_id: 'psicologia', name: 'Psicología', name_en: 'Psychology' },
]

export const PLACE_COLOR = '#9d2235'
export const EVENT_COLOR = '#6366f1'

// TTL por categoría (horas) según el plan: efímero por defecto.
export const CATEGORIES: Category[] = [
  // Estudio y Trabajo
  { id: 'sala-libre', kind: 'report', name: 'Sala Libre', name_en: 'Free Room', emoji: '🟩', color: '#10B981', svgPath: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', ttl_hours: 6 },
  { id: 'estudio', kind: 'report', name: 'Estudio', name_en: 'Study', emoji: '🎓', color: '#3B82F6', svgPath: 'M12 3L1 9l11 6 9-4.91V17h2V9L12 3z', ttl_hours: 12 },
  { id: 'computacion', kind: 'report', name: 'Computación', name_en: 'Computing', emoji: '💻', color: '#06B6D4', svgPath: 'M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z', ttl_hours: 12 },
  { id: 'silencio', kind: 'report', name: 'Silencio', name_en: 'Silence', emoji: '🎵', color: '#6366F1', svgPath: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z', ttl_hours: 12 },
  { id: 'impresora', kind: 'report', name: 'Print', name_en: 'Print', emoji: '🖨️', color: '#EC4899', svgPath: 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z', ttl_hours: 24 },
  { id: 'enchufe', kind: 'report', name: 'Enchufe', name_en: 'Outlet', emoji: '🔌', color: '#2563eb', svgPath: 'M7 7h10v3l-4 4v5h-2v-5l-4-4V7zm2-5h2v4H9V2zm4 0h2v4h-2V2z', ttl_hours: 12 },

  // Alimentación e Hidratación
  { id: 'comida', kind: 'report', name: 'Comida', name_en: 'Food', emoji: '🍕', color: '#F59E0B', svgPath: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z', ttl_hours: 12 },
  { id: 'casino', kind: 'report', name: 'Casino', name_en: 'Cafeteria', emoji: '🏥', color: '#D41F2D', svgPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', ttl_hours: 12 },
  { id: 'food-truck', kind: 'report', name: 'Food truck', name_en: 'Food truck', emoji: '🚚', color: '#f97316', svgPath: 'M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z', ttl_hours: 8 },
  { id: 'microondas', kind: 'report', name: 'Microondas', name_en: 'Microwave', emoji: '🍱', color: '#dc2626', svgPath: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1 .9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zm-4-9h-2v2h2V9zm0 4h-2v2h2v-2zM6 8h8v8H6V8z', ttl_hours: 12 },
  { id: 'agua', kind: 'report', name: 'Agua', name_en: 'Water', emoji: '💧', color: '#0ea5e9', svgPath: 'M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zM7.83 14c.37 0 .67.26.74.62.41 2.22 2.28 2.98 3.64 2.87.43-.02.79.32.79.75s-.35.79-.78.8c-2.02.05-4.64-1.25-5.17-4.11-.08-.42.23-.93.78-.93z', ttl_hours: 24 },

  // Infraestructura y Utilidades
  { id: 'bano', kind: 'report', name: 'Baño', name_en: 'Restroom', emoji: '🚻', color: '#8B5CF6', svgPath: 'M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z', ttl_hours: 24 },
  { id: 'bicicletero', kind: 'report', name: 'Bicicletero', name_en: 'Bike Rack', emoji: '🚲', color: '#059669', svgPath: 'M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-10l2.4-2.4.8 .8c1.3 1.3 3 2.1 5.1 2.1V9c-1.5 0-2.7-.6-3.6-1.5l-1.9-1.9c-.5-.4-1-.6-1.6-.6s-1.1 .2-1.4 .6L7.8 8.4c-.4 .4-.6 .9-.6 1.4 0 .6 .2 1.1 .6 1.4L11 14v5h2v-6.2l-2.2-2.3zM19 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z', ttl_hours: 24 },

  // Recreación
  { id: 'ping-pong', kind: 'report', name: 'Ping Pong', name_en: 'Ping Pong', emoji: '🏓', color: '#D41F2D', svgPath: 'M 14.5 4 C 11.46 4 9 6.46 9 9.5 C 9 11.51 10.09 13.25 11.75 14.23 L 10 18.5 L 12 19 L 13.62 14.83 C 13.91 14.94 14.2 15 14.5 15 C 17.54 15 20 12.54 20 9.5 C 20 6.46 17.54 4 14.5 4 Z M 5.5 16 C 4.12 16 3 17.12 3 18.5 C 3 19.88 4.12 21 5.5 21 C 6.88 21 8 19.88 8 18.5 C 8 17.12 6.88 16 5.5 16 Z', ttl_hours: 12 },
  { id: 'deporte', kind: 'report', name: 'Deporte', name_en: 'Sports', emoji: '⚽', color: '#F97316', svgPath: 'M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 19.86l-1.43-1.43L19.14 17l1.43-2.14z', ttl_hours: 12 },

  // Otros / Objetos
  { id: 'objeto-perdido', kind: 'report', name: 'Objeto perdido', name_en: 'Lost item', emoji: '🎒', color: '#8b5cf6', svgPath: 'M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14zm-5-1c.83 0 1.5-.67 1.5-1.5S12.83 15 12 15s-1.5.67-1.5 1.5S11.17 18 12 18z', ttl_hours: 72 },
  { id: 'objeto-encontrado', kind: 'report', name: 'Objeto encontrado', name_en: 'Found item', emoji: '🧢', color: '#10b981', svgPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z', ttl_hours: 72 },
  { id: 'otro', kind: 'report', name: 'Otro', name_en: 'Other', emoji: '✨', color: '#ec4899', svgPath: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z', ttl_hours: 24 },
  // Categorías de eventos (Sprint 3, ya en la taxonomía)
  { id: 'charla', kind: 'event', name: 'Charla', name_en: 'Talk', emoji: '🎤', color: '#6366f1', svgPath: 'M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z', ttl_hours: null },
  { id: 'fiesta', kind: 'event', name: 'Fiesta', name_en: 'Party', emoji: '🎉', color: '#d946ef', svgPath: 'M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99l-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12c.01-1.66-1.33-3-2.99-3z', ttl_hours: null },
  { id: 'deporte-evento', kind: 'event', name: 'Deportivo', name_en: 'Sports', emoji: '🏆', color: '#16a34a', svgPath: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z', ttl_hours: null },
  { id: 'ayudantia', kind: 'event', name: 'Ayudantía', name_en: 'Tutoring', emoji: '🧑‍🏫', color: '#0ea5e9', svgPath: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z', ttl_hours: null },
  { id: 'feria', kind: 'event', name: 'Feria', name_en: 'Fair', emoji: '🎪', color: '#eab308', svgPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z', ttl_hours: null },
]

export function categoryById(id: string | null): Category | undefined {
  return CATEGORIES.find((c) => c.id === id)
}

// Plano indoor demo: Facultad de Ingeniería, pisos 1 y 2 (rectángulos aproximados).
const room = (
  name: string,
  kind: 'room' | 'hall' | 'service',
  [w, s, e, n]: [number, number, number, number],
) => ({
  type: 'Feature' as const,
  properties: { name, kind },
  geometry: {
    type: 'Polygon' as const,
    coordinates: [
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
    ],
  },
})

export const DEMO_FLOOR_PLANS: FloorPlan[] = [
  {
    id: 'fp-ing-1',
    place_pin_id: null,
    faculty_id: 'ingenieria',
    building: 'Edificio FIC',
    floor: 1,
    geojson: {
      type: 'FeatureCollection',
      features: [
        room('Hall central', 'hall', [-70.65465, -33.45015, -70.65425, -33.44985]),
        room('Sala 101', 'room', [-70.65425, -33.45015, -70.65405, -33.45000]),
        room('Sala 102', 'room', [-70.65425, -33.45000, -70.65405, -33.44985]),
        room('Baños', 'service', [-70.65465, -33.45020, -70.65445, -33.45015]),
      ],
    },
    bounds: null,
    image_overlay: null,
  },
  {
    id: 'fp-ing-2',
    place_pin_id: null,
    faculty_id: 'ingenieria',
    building: 'Edificio FIC',
    floor: 2,
    geojson: {
      type: 'FeatureCollection',
      features: [
        room('Sala 201', 'room', [-70.65465, -33.45015, -70.65445, -33.45000]),
        room('Sala 202', 'room', [-70.65445, -33.45015, -70.65425, -33.45000]),
        room('Laboratorio de Computación', 'room', [-70.65425, -33.45015, -70.65405, -33.44985]),
        room('Sala de estudio', 'hall', [-70.65465, -33.45000, -70.65425, -33.44985]),
      ],
    },
    bounds: null,
    image_overlay: null,
  },
]
