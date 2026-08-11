import type { Pin, PinComment, PinPhoto, PinScheduleDraft, PinScheduleItem, PinType } from '@/shared/types/database'
import { FACULTIES } from '@/shared/data/campusData'

// ─────────────────────────────────────────────────────────────────
// MODO DEMO: base de datos en memoria para desarrollar/mostrar la UI
// sin Supabase. La API pública espeja features/pins/api.ts.
// ─────────────────────────────────────────────────────────────────

const hours = (n: number) => new Date(Date.now() + n * 3600_000).toISOString()
const ago = (n: number) => new Date(Date.now() - n * 3600_000).toISOString()

function placeFromFaculty(f: (typeof FACULTIES)[number]): Pin {
  return {
    id: `place-${f.id}`,
    type: 'place',
    title: f.name,
    description: null,
    category_id: null,
    faculty_id: f.id,
    lat: f.lat,
    lng: f.lng,
    floor: null,
    building_id: null,
    area_id: null,
    room_code: null,
    building: null,
    creator_id: null,
    votes_up: 0,
    votes_down: 0,
    reports: 0,
    is_permanent: true,
    expires_at: null,
    starts_at: null,
    ends_at: null,
    is_official: true,
    created_at: ago(24 * 30),
    pin_photos: [],
  }
}

const demoReport = (
  id: string,
  title: string,
  category_id: string,
  lat: number,
  lng: number,
  expiresInHours: number,
  description?: string,
): Pin => ({
  id,
  type: 'report',
  title,
  description: description ?? null,
  category_id,
  faculty_id: null,
  lat,
  lng,
  floor: null,
  building_id: null,
  area_id: null,
  room_code: null,
  building: null,
  creator_id: 'demo-otro',
  votes_up: Math.floor(Math.random() * 8),
  votes_down: 0,
  reports: 0,
  is_permanent: false,
  expires_at: hours(expiresInHours),
  starts_at: null,
  ends_at: null,
  is_official: false,
  created_at: ago(1),
  pin_photos: [],
})


/**
 * Pin interior con piso y facultad. Para probar la vista por plantas y la
 * cercanía entre pines (agrupamiento visual y tamaño).
 */
const demoIndoorPin = (
  id: string,
  title: string,
  category_id: string,
  lat: number,
  lng: number,
  floor: number | null,
  expiresInHours: number,
  opts?: {
    description?: string
    room_code?: string
    permanent?: boolean
    type?: PinType
    startsInHours?: number
    endsInHours?: number
  },
): Pin => ({
  id,
  type: opts?.type ?? (opts?.permanent ? 'place' : 'report'),
  title,
  description: opts?.description ?? null,
  category_id,
  faculty_id: 'ingenieria',
  lat,
  lng,
  floor,
  building_id: null,
  area_id: null,
  room_code: opts?.room_code ?? null,
  building: null,
  creator_id: 'demo-otro',
  votes_up: Math.floor(Math.random() * 15),
  votes_down: Math.floor(Math.random() * 2),
  reports: 0,
  is_permanent: opts?.permanent ?? false,
  expires_at: opts?.permanent ? null : hours(expiresInHours),
  starts_at: opts?.startsInHours !== undefined ? hours(opts.startsInHours) : null,
  ends_at: opts?.endsInHours !== undefined ? hours(opts.endsInHours) : null,
  is_official: false,
  created_at: ago(Math.random() * 48),
  pin_photos: [],
})

// ── Coordenadas base de la Fac. de Ingeniería ──────────────────────────────
// lat: -33.45276, lng: -70.66105. Los offsets son de ~5-20 m para que algunos
// queden prácticamente encima de otros y se pueda probar el tamaño de pines.
const FIC_LAT = -33.45276
const FIC_LNG = -70.66105

export const demoDb = {
  pins: [
    ...FACULTIES.map(placeFromFaculty),
    demoReport('r-monster', 'Camión de Monster regalando latas', 'food-truck', -33.4494, -70.6551, 5, 'Está en la entrada de Ejército, ¡corran!'),
    demoReport('r-empanadas', 'Empanadas a $1.000 afuera de Derecho', 'comida', -33.4461, -70.6621, 3),
    demoReport('r-mochila', 'Mochila azul encontrada en el patio', 'objeto-encontrado', -33.4479, -70.6606, 48, 'La dejé en portería de República.'),
    demoReport('r-estudio', 'Buscamos gente para estudiar Cálculo II', 'estudio', -33.4497, -70.6539, 1.5, 'Estamos en el 3er piso de la biblioteca.'),

    // ── 56 PINES DUMMY EN FACULTAD DE INGENIERÍA Y CIENCIAS (FIC) ─────────────
    // Cobertura completa: Pisos 1-5 y Subterráneos -1 a -3.
    // Esparcidos a 15-35 metros, salvo 1 par cercano a 2m para test de solapamiento.
    // Incluye 2 eventos EN VIVO AHORA (uno de 2h y otro de 24h).

    // 📍 PISO 1 (8 pines)
    demoIndoorPin('fic-101', 'Sala 101 - Ocupada', 'sala', FIC_LAT - 0.00002, FIC_LNG - 0.00003, 1, 720, { room_code: 'E441.1.S101', description: 'Clase de Física General II en curso.' }),
    demoIndoorPin('fic-bano-d-1', 'Baño Damas Piso 1', 'bano', FIC_LAT - 0.000018, FIC_LNG - 0.000028, 1, 24, { description: 'Par a 2m de sala 101 para test de solapamiento.' }),
    demoIndoorPin('fic-102', 'Sala 102 - Disponible', 'sala-libre', FIC_LAT + 0.00014, FIC_LNG + 0.00015, 1, 6, { room_code: 'E441.1.S102', description: 'Libre con proyector HDMI.' }),
    demoIndoorPin('fic-bano-v-1', 'Baño Varones Piso 1', 'bano', FIC_LAT - 0.00016, FIC_LNG - 0.00015, 1, 12, { description: 'Dispensador secamanos agotado.' }),
    demoIndoorPin('fic-entrada-1', 'Entrada Principal FIC', 'entrada', FIC_LAT - 0.00026, FIC_LNG + 0.00025, 1, 720, { description: 'Acceso con credencial UDP.' }),
    demoIndoorPin('fic-rampa-1', 'Rampa Inclusiva Acceso', 'rampa', FIC_LAT - 0.00024, FIC_LNG + 0.00027, 1, 720, { description: 'Rampa despejada.' }),
    demoIndoorPin('fic-enchufe-1', 'Enchufes Hall Entrada', 'enchufe', FIC_LAT + 0.00019, FIC_LNG - 0.00020, 1, 12, { description: '4 tomas en sillones.' }),
    // 🔴 EVENTO EN VIVO (2 horas de duración: comenzó hace 30 min, termina en 1.5 horas)
    demoIndoorPin('fic-evento-1', 'Ayudantía Intensiva de Programación (EN VIVO)', 'ayudantia', FIC_LAT - 0.00006, FIC_LNG + 0.00005, 1, 1.5, { type: 'event', room_code: 'Auditorio 1', startsInHours: -0.5, endsInHours: 1.5, description: 'Repaso certamen 2 en curso.' }),

    // 📍 PISO 2 (8 pines - Esparcidos por las distintas alas)
    demoIndoorPin('fic-lab-201', 'Laboratorio de Computación 201', 'computacion', FIC_LAT - 0.00021, FIC_LNG - 0.00010, 2, 12, { room_code: '201', description: '30 PCs Linux.' }),
    demoIndoorPin('fic-lab-202', 'Lab 202 - Redes y Telecom', 'computacion', FIC_LAT + 0.00009, FIC_LNG + 0.00020, 2, 12, { room_code: '202', description: 'Lab reservado.' }),
    demoIndoorPin('fic-impresora-2', 'Impresora Láser B/N Pasillo 2', 'impresora', FIC_LAT + 0.00016, FIC_LNG - 0.00017, 2, 24, { room_code: '205', description: 'Requiere saldo alumno.' }),
    demoIndoorPin('fic-enchufe-2', 'Enchufes Mesa de Estudio Pasillo', 'enchufe', FIC_LAT - 0.00014, FIC_LNG + 0.00013, 2, 12, { description: '8 enchufes libres.' }),
    demoIndoorPin('fic-sala-204', 'Sala 204 - Ocupada', 'sala', FIC_LAT - 0.00028, FIC_LNG + 0.00000, 2, 720, { room_code: 'E441.2.S204', description: 'Clase de Cálculo I.' }),
    demoIndoorPin('fic-bano-2', 'Baño Mixto Piso 2', 'bano', FIC_LAT + 0.00022, FIC_LNG - 0.00003, 2, 24, { description: 'Operativo.' }),
    // 🔴 EVENTO EN VIVO (24 HORAS / 1 DÍA: comenzó hace 4 horas, termina en 20 horas)
    demoIndoorPin('fic-evento-2', 'Feria de Innovación y Prototipos 2026 (EN VIVO - 24H)', 'feria', FIC_LAT - 0.00001, FIC_LNG - 0.00010, 2, 20, { type: 'event', room_code: 'Patio Piso 2', startsInHours: -4, endsInHours: 20, description: 'Stands interactivos y maquetas 3D todo el día.' }),
    demoIndoorPin('fic-mochila-2', 'Mochila Azul Olvidada en Lab', 'objeto-perdido', FIC_LAT - 0.000205, FIC_LNG - 0.000095, 2, 72, { room_code: '201', description: 'Mochila azul entregada al profe.' }),

    // 📍 PISO 3 (8 pines - Esparcidos 20-30m)
    demoIndoorPin('fic-sala-301', 'Sala 301 Libre', 'sala-libre', FIC_LAT - 0.00024, FIC_LNG + 0.00017, 3, 6, { room_code: 'E441.3.S302', description: 'Desocupada la tarde.' }),
    demoIndoorPin('fic-sala-302', 'Sala 302 Libre con Pizarra', 'sala-libre', FIC_LAT + 0.00012, FIC_LNG - 0.00023, 3, 6, { room_code: 'E441.3.S303', description: 'Pizarra limpia.' }),
    demoIndoorPin('fic-sala-305', 'Sala 305 en Clase de Química', 'sala', FIC_LAT - 0.00011, FIC_LNG + 0.00030, 3, 720, { room_code: 'E441.3.S304', description: 'Ocupada hasta 17:30.' }),
    demoIndoorPin('fic-silencio-3', 'Zona Silencio para Estudio', 'silencio', FIC_LAT + 0.00019, FIC_LNG + 0.00010, 3, 12, { description: 'Bajo volumen de voz.' }),
    demoIndoorPin('fic-enchufe-3', 'Enchufes Ventanal Piso 3', 'enchufe', FIC_LAT - 0.00031, FIC_LNG - 0.00013, 3, 12, { description: '3 enchufes junto a vista.' }),
    demoIndoorPin('fic-totem-3', 'Totém de Carga Celulares', 'enchufe', FIC_LAT + 0.00002, FIC_LNG + 0.00023, 3, 12, { description: 'USB-C y Lightning.' }),
    demoIndoorPin('fic-evento-3', 'Workshop: Robótica e IoT (Próximo)', 'charla', FIC_LAT - 0.00016, FIC_LNG + 0.00000, 3, 6, { type: 'event', room_code: '308', startsInHours: 2, endsInHours: 6, description: 'Prototipos Arduino/ESP32.' }),
    demoIndoorPin('fic-poleron-3', 'Polerón UDP Encontrado', 'objeto-encontrado', FIC_LAT + 0.00014, FIC_LNG - 0.00010, 3, 72, { description: 'Polerón negro talla L.' }),

    // 📍 PISO 4 (7 pines - Bien repartidos)
    demoIndoorPin('fic-microondas-4a', 'Microondas 1 Kitchenette', 'microondas', FIC_LAT - 0.00018, FIC_LNG + 0.00023, 4, 12, { description: 'Funcionando impecable.' }),
    demoIndoorPin('fic-microondas-4b', 'Microondas 2 Kitchenette', 'microondas', FIC_LAT - 0.000175, FIC_LNG + 0.000235, 4, 12, { description: 'Listo para almuerzos.' }),
    demoIndoorPin('fic-bano-4', 'Baño Piso 4', 'bano', FIC_LAT + 0.00016, FIC_LNG - 0.00017, 4, 24, { description: 'Higiene impecable.' }),
    demoIndoorPin('fic-agua-4', 'Dispensador Agua Filtrada', 'agua', FIC_LAT - 0.00034, FIC_LNG - 0.00003, 4, 24, { description: 'Agua helada.' }),
    demoIndoorPin('fic-estudio-4', 'Grupo Estudio Cálculo III', 'estudio', FIC_LAT - 0.00001, FIC_LNG + 0.00027, 4, 4, { room_code: '402', description: 'Preparando guía 4.' }),
    demoIndoorPin('fic-sala-403', 'Sala 403 Libre', 'sala-libre', FIC_LAT + 0.00006, FIC_LNG - 0.00027, 4, 6, { room_code: 'E441.4.S403', description: 'Estudio en grupo.' }),
    demoIndoorPin('fic-cuaderno-4', 'Cuaderno de Apuntes Perdido', 'objeto-perdido', FIC_LAT + 0.000065, FIC_LNG - 0.000265, 4, 72, { room_code: 'E441.4.S403', description: 'Cuaderno azul olvidado.' }),

    // 📍 PISO 5 (7 pines - Esparcidos)
    demoIndoorPin('fic-estudio-5a', 'Grupo Estudio Física Moderna', 'estudio', FIC_LAT - 0.00028, FIC_LNG + 0.00017, 5, 3, { room_code: '501', description: 'Repaso certamen cuántica.' }),
    demoIndoorPin('fic-sala-502', 'Sala 502 - Reunión Proyectos', 'sala', FIC_LAT + 0.00016, FIC_LNG + 0.00013, 5, 720, { room_code: 'V432.5.S512', description: 'Proyectos de título.' }),
    demoIndoorPin('fic-terraza-5', 'Terraza Vista Santiago', 'otro', FIC_LAT - 0.00008, FIC_LNG - 0.00027, 5, 720, { description: 'Zona descanso al aire libre.' }),
    demoIndoorPin('fic-enchufe-5', 'Enchufes Sofá Terraza', 'enchufe', FIC_LAT - 0.000075, FIC_LNG - 0.000265, 5, 12, { description: 'Enchufes junto a sillones.' }),
    demoIndoorPin('fic-impresora-5', 'Impresora Color Piso 5', 'impresora', FIC_LAT + 0.00009, FIC_LNG - 0.00013, 5, 24, { description: 'Multifuncional color.' }),
    demoIndoorPin('fic-bano-5', 'Baño Piso 5', 'bano', FIC_LAT - 0.00034, FIC_LNG - 0.00010, 5, 24, { description: 'Operativo.' }),
    demoIndoorPin('fic-evento-5', 'Conferencia: Futuro del Software', 'charla', FIC_LAT - 0.00004, FIC_LNG + 0.00027, 5, 8, { type: 'event', room_code: 'Auditorio 5', startsInHours: 3, endsInHours: 8, description: 'Panel expertos industria.' }),

    // 📍 SUBTERRÁNEO -1 (6 pines)
    demoIndoorPin('fic-ascensor-s1', 'Ascensor Principal Sub -1', 'ascensor', FIC_LAT - 0.00021, FIC_LNG + 0.00010, -1, 720, { description: 'Conecta del -3 al 5.' }),
    demoIndoorPin('fic-agua-s1', 'Dispensador de Agua Fría Sub -1', 'agua', FIC_LAT - 0.000208, FIC_LNG + 0.000102, -1, 24, { description: 'Frente a ascensores.' }),
    demoIndoorPin('fic-carga-s1', 'Estación Carga Baterías Sub -1', 'enchufe', FIC_LAT + 0.00012, FIC_LNG - 0.00020, -1, 12, { description: 'Multiconector USB/laptops.' }),
    demoIndoorPin('fic-lab-quimica-s1', 'Laboratorio Química Sub -1', 'computacion', FIC_LAT + 0.00016, FIC_LNG + 0.00023, -1, 720, { room_code: 'S104', description: 'Ingreso con bata.' }),
    demoIndoorPin('fic-bano-s1', 'Baño Inclusivo Sub -1', 'bano', FIC_LAT - 0.00034, FIC_LNG - 0.00013, -1, 24, { description: 'Barras de apoyo y alarma.' }),
    demoIndoorPin('fic-rampa-s1', 'Rampa Subterráneo -1', 'rampa', FIC_LAT - 0.00004, FIC_LNG + 0.00033, -1, 720, { description: 'Acceso directo patio.' }),

    // 📍 SUBTERRÁNEO -2 (6 pines - Deporte y Bicicleteros)
    demoIndoorPin('fic-bici-n-s2', 'Bicicletero Sector Norte', 'bicicletero', FIC_LAT - 0.00026, FIC_LNG - 0.00020, -2, 24, { description: 'U-Lock recomendado.' }),
    demoIndoorPin('fic-bici-s-s2', 'Bicicletero Sector Sur', 'bicicletero', FIC_LAT + 0.00019, FIC_LNG + 0.00020, -2, 24, { description: '15 cupos libres.' }),
    demoIndoorPin('fic-lockers-s2', 'Casilleros Alumnos Sub -2', 'otro', FIC_LAT - 0.00004, FIC_LNG - 0.00030, -2, 720, { description: 'Traer candado propio.' }),
    demoIndoorPin('fic-pingpong-s2', 'Mesa de Ping Pong Sub -2', 'ping-pong', FIC_LAT + 0.00006, FIC_LNG + 0.00010, -2, 12, { description: 'Mesa en gran estado.' }),
    demoIndoorPin('fic-evento-s2', 'Torneo Relámpago Ping Pong', 'deporte-evento', FIC_LAT + 0.000062, FIC_LNG + 0.000102, -2, 5, { type: 'event', startsInHours: 1, endsInHours: 5, description: 'Premios a los primeros lugares.' }),
    demoIndoorPin('fic-bano-s2', 'Baño Subterráneo -2', 'bano', FIC_LAT - 0.00031, FIC_LNG + 0.00027, -2, 24, { description: 'Disponible.' }),

    // 📍 SUBTERRÁNEO -3 (6 pines - Casino y Comida)
    demoIndoorPin('fic-casino-s3', 'Casino Principal FIC', 'casino', FIC_LAT - 0.00001, FIC_LNG + 0.00000, -3, 12, { description: 'Menú completo $2.500.' }),
    demoIndoorPin('fic-empanadas-s3', 'Stand Empanadas y Snacks', 'food-truck', FIC_LAT - 0.00024, FIC_LNG - 0.00023, -3, 8, { description: 'Empanadas recién horneadas.' }),
    demoIndoorPin('fic-microondas-s3', 'Batería Microondas Casino', 'microondas', FIC_LAT + 0.00016, FIC_LNG + 0.00023, -3, 12, { description: '4 microondas listos.' }),
    demoIndoorPin('fic-cafe-s3', 'Venta de Café Express y Donas', 'comida', FIC_LAT - 0.00014, FIC_LNG + 0.00030, -3, 8, { description: 'Café de grano.' }),
    demoIndoorPin('fic-mesas-s3', 'Mesas Comedor Casino Sub -3', 'estudio', FIC_LAT + 0.00012, FIC_LNG - 0.00027, -3, 12, { description: 'Capacidad 100+ personas.' }),
    demoIndoorPin('fic-deporte-s3', 'Cancha de Deporte Multiuso', 'deporte', FIC_LAT - 0.00034, FIC_LNG + 0.00010, -3, 12, { description: 'Fútbol y básquetbol.' }),

  ] as Pin[],
  comments: new Map<string, PinComment[]>([
    [
      'r-monster',
      [
        {
          id: 'c1',
          pin_id: 'r-monster',
          author_id: 'demo-otro',
          author_name: 'Cata M.',
          body: 'Confirmo, quedan pocas 🥤',
          created_at: ago(0.5),
        },
      ],
    ],
    [
      'place-ingenieria',
      [
        {
          id: 'c2',
          pin_id: 'place-ingenieria',
          author_id: 'demo-otro',
          author_name: 'Seba R.',
          body: 'El 3er piso tiene enchufes al lado de las ventanas 🔌',
          created_at: ago(20),
        },
      ],
    ],
  ]),
  votes: new Map<string, Map<string, 1 | -1>>(), // pinId → (userId → value)
  favorites: new Set<string>(), // `${userId}:${pinId}`
}

/** Historial separado para que borrar un pin no permita eludir el límite diario. */
export const demoPinCreationEvents = demoDb.pins
  .filter((pin) => pin.creator_id !== null)
  .map((pin) => ({ creator_id: pin.creator_id as string, created_at: pin.created_at }))

export function demoAddPhotos(pinId: string, files: File[]): PinPhoto[] {
  const pin = demoDb.pins.find((p) => p.id === pinId)
  if (!pin) return []
  const photos: PinPhoto[] = files.map((f) => ({
    id: crypto.randomUUID(),
    pin_id: pinId,
    url: URL.createObjectURL(f),
    width: null,
    height: null,
    created_at: new Date().toISOString(),
  }))
  pin.pin_photos = [...(pin.pin_photos ?? []), ...photos]
  return photos
}

/** Programa por pin. Espeja pin_schedule_items: sin update, se reemplaza entero. */
export const demoSchedules = new Map<string, PinScheduleItem[]>([
  [
    'fic-evento-1',
    [
      {
        id: 'sch-fic-1-1',
        pin_id: 'fic-evento-1',
        starts_at: hours(-0.5),
        ends_at: hours(0.25),
        title: 'Módulo 1: Arreglos y Listas Enlazadas (En curso)',
        subtitle: 'Explicación teórica y complejidad O(n)',
        sort_order: 0,
      },
      {
        id: 'sch-fic-1-2',
        pin_id: 'fic-evento-1',
        starts_at: hours(0.25),
        ends_at: hours(0.85),
        title: 'Módulo 2: POO Avanzado',
        subtitle: 'Herencia y Polimorfismo en Python',
        sort_order: 1,
      },
      {
        id: 'sch-fic-1-3',
        pin_id: 'fic-evento-1',
        starts_at: hours(0.85),
        ends_at: hours(1.5),
        title: 'Resolución de Certamen Anterior',
        subtitle: 'Ejercicios tipo prueba resueltos en vivo',
        sort_order: 2,
      },
    ],
  ],
  [
    'fic-evento-2',
    [
      {
        id: 'sch-fic-2-1',
        pin_id: 'fic-evento-2',
        starts_at: hours(-4),
        ends_at: hours(-1),
        title: 'Inauguración y Bienvenida',
        subtitle: 'Palabras del decano e inicio de exhibición',
        sort_order: 0,
      },
      {
        id: 'sch-fic-2-2',
        pin_id: 'fic-evento-2',
        starts_at: hours(-1),
        ends_at: hours(8),
        title: 'Exhibición de Stands e Impresión 3D (En curso)',
        subtitle: 'Demostraciones tecnológicas en vivo todo el día',
        sort_order: 1,
      },
      {
        id: 'sch-fic-2-3',
        pin_id: 'fic-evento-2',
        starts_at: hours(8),
        ends_at: hours(20),
        title: 'Premiación y Cierre de la Feria',
        subtitle: 'Entrega de reconocimientos a mejores proyectos',
        sort_order: 2,
      },
    ],
  ],
  [
    'fic-evento-3',
    [
      {
        id: 'sch-fic-3-1',
        pin_id: 'fic-evento-3',
        starts_at: hours(2),
        ends_at: hours(3),
        title: 'Apertura e Introducción a Microcontroladores',
        subtitle: 'Arduino Uno vs ESP32 vs Raspberry Pi',
        sort_order: 0,
      },
      {
        id: 'sch-fic-3-2',
        pin_id: 'fic-evento-3',
        starts_at: hours(3),
        ends_at: hours(5),
        title: 'Hands-on: Sensores y Conectividad WiFi',
        subtitle: 'Servidor web embebido para telemetría',
        sort_order: 1,
      },
      {
        id: 'sch-fic-3-3',
        pin_id: 'fic-evento-3',
        starts_at: hours(5),
        ends_at: hours(6),
        title: 'Muestra de Prototipos de Alumnos',
        subtitle: 'Demostración seguidores de línea y brazos robóticos',
        sort_order: 2,
      },
    ],
  ],
])



export function demoReplaceSchedule(pinId: string, items: PinScheduleDraft[]): PinScheduleItem[] {
  if (items.length === 0) {
    demoSchedules.delete(pinId)
    return []
  }
  const rows: PinScheduleItem[] = items.map((item, i) => ({
    ...item,
    id: crypto.randomUUID(),
    pin_id: pinId,
    sort_order: item.sort_order ?? i,
    created_at: new Date().toISOString(),
  }))
  demoSchedules.set(pinId, rows)
  return rows
}

export function demoRemovePhotos(pinId: string, photoIds: string[]): void {
  const pin = demoDb.pins.find((p) => p.id === pinId)
  if (!pin || !pin.pin_photos) return
  pin.pin_photos = pin.pin_photos.filter((ph) => !photoIds.includes(ph.id))
}

export function demoVerifyPin(pinId: string, verifierName: string = 'Centro de Alumnos FIC'): void {
  const pin = demoDb.pins.find((p) => p.id === pinId)
  if (!pin || pin.is_permanent) return
  pin.is_permanent = true
  pin.type = 'place'
  pin.expires_at = null
  pin.verifier_entity_name = verifierName
}

export function demoUnverifyPin(pinId: string, hours: number = 24): void {
  const pin = demoDb.pins.find((p) => p.id === pinId)
  if (!pin || !pin.is_permanent || !pin.verifier_entity_name) return
  pin.is_permanent = false
  pin.type = 'report'
  pin.verifier_entity_name = null
  pin.expires_at = new Date(Date.now() + hours * 3600 * 1000).toISOString()
}

export function demoExtendPinTTL(pinId: string, hours: number = 24): void {
  const pin = demoDb.pins.find((p) => p.id === pinId)
  if (!pin) return
  const currentExp = pin.expires_at ? new Date(pin.expires_at).getTime() : Date.now()
  const baseTime = Math.max(currentExp, Date.now())
  pin.expires_at = new Date(baseTime + hours * 3600 * 1000).toISOString()
}
