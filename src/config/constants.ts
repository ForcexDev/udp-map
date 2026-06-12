
import { Category, Campus, Faculty, User } from './types';

export const UDP_RED = '#D41F2D';

export const ANONYMOUS_USER: User = {
  id: '__anonymous__',
  email: '',
  name: 'Visitante',
  isAdmin: false,
  role: 'guest',
};

export const CAMPUSES: Campus[] = [
  { id: 'ejercito', name: 'Campus Ejército', coords: [-33.4535, -70.6625] },
  { id: 'republica', name: 'Campus República', coords: [-33.4518, -70.6672] },
  { id: 'huechuraba', name: 'Campus Huechuraba', coords: [-33.3658, -70.6394] }
];

export const FACULTIES: Faculty[] = [
  { id: 'global', name: 'Todos', nameEn: 'All', coords: [0, 0], campusId: 'all', image: 'https://images.unsplash.com/photo-1562774053-701939374585?w=200&h=200&fit=crop&q=60' },
  {
    id: 'bnp',
    name: 'Biblio. Nicanor Parra',
    nameEn: 'Nicanor Parra Library',
    coords: [-33.4515, -70.6652],
    campusId: 'republica',
    image: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=200&h=200&fit=crop&q=60',
    polygon: [
      [-33.4512, -70.6655], [-33.4512, -70.6648],
      [-33.4518, -70.6648], [-33.4518, -70.6655]
    ],
    careers: [
      { name: 'Recursos de Información y Documentación', nameEn: 'Library & Information Science' },
    ]
  },
  {
    id: 'fee',
    name: 'Economía y Empresa',
    nameEn: 'Economics & Business',
    coords: [-33.3658, -70.6394],
    campusId: 'huechuraba',
    image: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=200&h=200&fit=crop&q=60',
    polygon: [
      [-33.3650, -70.6405], [-33.3650, -70.6385],
      [-33.3665, -70.6385], [-33.3665, -70.6405]
    ],
    careers: [
      { name: 'Ingeniería Comercial', nameEn: 'Commercial Engineering' },
      { name: 'Economía', nameEn: 'Economics' },
      { name: 'Administración de Empresas', nameEn: 'Business Administration' },
      { name: 'Contador Auditor', nameEn: 'Accounting & Auditing' },
      { name: 'Gestión Comercial y Marketing', nameEn: 'Business Management & Marketing' },
    ]
  },
  {
    id: 'derecho',
    name: 'Derecho',
    nameEn: 'Law',
    coords: [-33.4508, -70.6672],
    campusId: 'republica',
    image: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=200&h=200&fit=crop&q=60',
    polygon: [
      [-33.4505, -70.6675], [-33.4505, -70.6668],
      [-33.4511, -70.6668], [-33.4511, -70.6675]
    ],
    careers: [
      { name: 'Derecho', nameEn: 'Law' },
    ]
  },
  {
    id: 'faad',
    name: 'Arq, Arte y Diseño',
    nameEn: 'Arch, Art & Design',
    coords: [-33.4528, -70.6675],
    campusId: 'republica',
    image: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=200&h=200&fit=crop&q=60',
    polygon: [
      [-33.4525, -70.6678], [-33.4525, -70.6670],
      [-33.4532, -70.6670], [-33.4532, -70.6678]
    ],
    careers: [
      { name: 'Arquitectura', nameEn: 'Architecture' },
      { name: 'Arte', nameEn: 'Fine Arts' },
      { name: 'Diseño', nameEn: 'Design' },
      { name: 'Diseño Gráfico', nameEn: 'Graphic Design' },
    ]
  },
  {
    id: 'psico',
    name: 'Psicología',
    nameEn: 'Psychology',
    coords: [-33.450624941549556, -70.66233618135517],
    campusId: 'ejercito',
    image: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=200&h=200&fit=crop&q=60',
    polygon: [
      [-33.4504, -70.6626], [-33.4504, -70.6620],
      [-33.4509, -70.6620], [-33.4509, -70.6626]
    ],
    careers: [
      { name: 'Psicología', nameEn: 'Psychology' },
    ]
  },
  {
    id: 'ing',
    name: 'Ingeniería',
    nameEn: 'Engineering',
    coords: [-33.45262994875504, -70.6610748268222],
    campusId: 'ejercito',
    image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=200&h=200&fit=crop&q=60',
    polygon: [
      [-33.4523, -70.6614], [-33.4523, -70.6607],
      [-33.4530, -70.6607], [-33.4530, -70.6614]
    ],
    careers: [
      { name: 'Ingeniería Civil', nameEn: 'Civil Engineering' },
      { name: 'Ingeniería Civil Informática', nameEn: 'Computer Science Engineering' },
      { name: 'Ingeniería Civil Industrial', nameEn: 'Industrial Engineering' },
      { name: 'Construcción Civil', nameEn: 'Civil Construction' },
      { name: 'Ingeniería en Computación e Informática', nameEn: 'Computing & IT Engineering' },
    ]
  },
  {
    id: 'med',
    name: 'Medicina / Salud',
    nameEn: 'Medicine / Health',
    coords: [-33.448782895330204, -70.66154421223384],
    campusId: 'ejercito',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&h=200&fit=crop&q=60',
    polygon: [
      [-33.4485, -70.6618], [-33.4485, -70.6612],
      [-33.4491, -70.6612], [-33.4491, -70.6618]
    ],
    careers: [
      { name: 'Medicina', nameEn: 'Medicine' },
      { name: 'Enfermería', nameEn: 'Nursing' },
      { name: 'Obstetricia y Puericultura', nameEn: 'Obstetrics & Midwifery' },
      { name: 'Fonoaudiología', nameEn: 'Speech Therapy' },
      { name: 'Terapia Ocupacional', nameEn: 'Occupational Therapy' },
    ]
  },
  {
    id: 'com',
    name: 'Comunicación y Letras',
    nameEn: 'Communications & Letters',
    coords: [-33.45016201545047, -70.66176359891506],
    campusId: 'ejercito',
    image: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=200&h=200&fit=crop&q=60',
    polygon: [
      [-33.4500, -70.6620], [-33.4500, -70.6615],
      [-33.4504, -70.6615], [-33.4504, -70.6620]
    ],
    careers: [
      { name: 'Periodismo', nameEn: 'Journalism' },
      { name: 'Publicidad', nameEn: 'Advertising' },
      { name: 'Cine', nameEn: 'Film Studies' },
      { name: 'Literatura Creativa', nameEn: 'Creative Writing' },
      { name: 'Comunicación Audiovisual', nameEn: 'Audiovisual Communication' },
    ]
  },
  {
    id: 'odo',
    name: 'Salud y Odontología',
    nameEn: 'Health & Dentistry',
    coords: [-33.450197852021255, -70.66026860711142],
    campusId: 'ejercito',
    image: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=200&h=200&fit=crop&q=60',
    polygon: [
      [-33.4500, -70.6605], [-33.4500, -70.6600],
      [-33.4504, -70.6600], [-33.4504, -70.6605]
    ],
    careers: [
      { name: 'Odontología', nameEn: 'Dentistry' },
      { name: 'Kinesiología', nameEn: 'Physical Therapy' },
      { name: 'Nutrición y Dietética', nameEn: 'Nutrition & Dietetics' },
      { name: 'Tecnología Médica', nameEn: 'Medical Technology' },
    ]
  }

];

export const CATEGORIES: Category[] = [
  { id: 'sala-disponible', label: 'Sala Libre', labelEn: 'Free Room', color: '#10B981', svgPath: 'M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z' },
  { id: 'sala-estudio', label: 'Estudio', labelEn: 'Study Room', color: '#3B82F6', svgPath: 'M12 3L1 9l11 6 9-4.91V17h2V9L12 3z' },
  { id: 'sala-computacion', label: 'Computación', labelEn: 'Computer Lab', color: '#06B6D4', svgPath: 'M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z' },
  { id: 'pingpong', label: 'Ping Pong', labelEn: 'Ping Pong', color: '#D41F2D', svgPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z' },
  { id: 'baño', label: 'Baño', labelEn: 'Restroom', color: '#8B5CF6', svgPath: 'M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z' },
  { id: 'comida', label: 'Comida', labelEn: 'Food', color: '#F59E0B', svgPath: 'M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z' },
  { id: 'tranquilo', label: 'Silencio', labelEn: 'Quiet Zone', color: '#6366F1', svgPath: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z' },
  { id: 'impresora', label: 'Print', labelEn: 'Print', color: '#EC4899', svgPath: 'M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z' },
  { id: 'deporte', label: 'Deporte', labelEn: 'Sports', color: '#F97316', svgPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z' },
  { id: 'casino', label: 'Casino', labelEn: 'Cafeteria', color: '#D41F2D', svgPath: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z' },
  { id: 'custom', label: 'Pin', labelEn: 'Pin', color: '#6B7280', svgPath: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z' }
];

export const APP_CONFIG = {
  FADE_DAYS: 7,
  MAX_REPORTS: 5,
  GEMINI_MODEL: 'gemini-3-flash-preview'
};

export const ADMIN_EMAILS = [
  'ezequiel.morales@mail.udp.cl',
  // Add admin emails here
];
