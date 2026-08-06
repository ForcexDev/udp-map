import type { Feature, FeatureCollection, Polygon } from 'geojson'
import { isPointInPolygon } from '@/shared/utils/geo'

// ─────────────────────────────────────────────────────────────────
// Perímetros reales por facultad. Por ahora SOLO la Facultad de
// Ingeniería y Ciencias (Campus Ejército) tiene perímetro trazado;
// el resto sigue usando la huella aproximada de campusData.
// Fuente: engineering_polygon.json (manzana Vergara / Gorbea /
// Paseo Ejército). Coordenadas GeoJSON [lng, lat].
// ─────────────────────────────────────────────────────────────────

const ENGINEERING_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6615718, -33.4525797],
      [-70.6614965, -33.452564],
      [-70.6613632, -33.4525355],
      [-70.661329, -33.4525282],
      [-70.6611799, -33.452497],
      [-70.6607075, -33.4524018],
      [-70.6606108, -33.4523819],
      [-70.6605349, -33.4527535],
      [-70.6606443, -33.4527745],
      [-70.661092, -33.452862],
      [-70.6610461, -33.4530498],
      [-70.6614801, -33.4531345],
      [-70.6615096, -33.4529593],
      [-70.6615424, -33.4527626],
      [-70.6615718, -33.4525797],
    ],
  ],
}

const BIBLIOTECA_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6617524, -33.4511991],
      [-70.6617027, -33.4514876],
      [-70.6614392, -33.4514596],
      [-70.6611724, -33.4514263],
      [-70.6611883, -33.4513286],
      [-70.6608072, -33.4512795],
      [-70.6608272, -33.4511741],
      [-70.6612107, -33.451225],
      [-70.6612256, -33.4511297],
      [-70.6617524, -33.4511991],
    ],
  ],
}

const CIENCIAS_SOCIALES_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6612107, -33.451225],
      [-70.6608272, -33.4511741],
      [-70.6608437, -33.4510797],
      [-70.6612256, -33.4511297],
      [-70.6612107, -33.451225],
    ],
  ],
}

const PSICOLOGIA_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6625259, -33.4509769],
      [-70.6619878, -33.4508662],
      [-70.6620683, -33.4503521],
      [-70.6626388, -33.4504068],
      [-70.6625258, -33.4509769],
    ],
  ],
}



const COMUNICACION_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6618979, -33.4500208],
      [-70.6618377, -33.4503372],
      [-70.6617932, -33.4503328],
      [-70.6616583, -33.4503195],
      [-70.661344, -33.4502884],
      [-70.6612149, -33.4502757],
      [-70.6612297, -33.4501733],
      [-70.6614232, -33.4501955],
      [-70.6614478, -33.4499814],
      [-70.6618591, -33.450018],
      [-70.6618979, -33.4500208],
    ],
  ],
}

const AULARIO_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6606097, -33.4509824],
      [-70.6605834, -33.4510969],
      [-70.6601225, -33.4510213],
      [-70.6601479, -33.4509103],
      [-70.6606088, -33.4509831],
    ],
  ],
}

const COMERCIO_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6606104, -33.4509786],
      [-70.6606413, -33.4508397],
      [-70.660196, -33.4507652],
      [-70.6601523, -33.4509041],
      [-70.6606097, -33.4509785],
    ],
  ],
}

const SALUD_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6607551, -33.4502214],
      [-70.6604027, -33.4501413],
      [-70.660448, -33.4499622],
      [-70.6603207, -33.4499389],
      [-70.6603782, -33.4497016],
      [-70.6600502, -33.4496288],
      [-70.6598111, -33.4504645],
      [-70.6601217, -33.4505271],
      [-70.6601758, -33.4503452],
      [-70.6605859, -33.4504281],
      [-70.6606156, -33.4503393],
      [-70.6607307, -33.4503655],
      [-70.6607551, -33.4502214],
    ],
  ],
}

const FILOSOFIA_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6604498, -33.4499617],
      [-70.6604041, -33.4501411],
      [-70.6607577, -33.4502168],
      [-70.6607928, -33.4500354],
      [-70.6604498, -33.4499617],
    ],
  ],
}

const EDUCACION_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.661917, -33.4497927],
      [-70.6618967, -33.4499705],
      [-70.6614767, -33.4499313],
      [-70.6615101, -33.4497151],
      [-70.661917, -33.4497927],
    ],
  ],
}

const DEPORTES_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6600011, -33.451545],
      [-70.6600705, -33.451201],
      [-70.6595486, -33.4511041],
      [-70.6594465, -33.4514434],
      [-70.6599981, -33.4515484],
      [-70.6600011, -33.451545],
    ],
  ],
}

const DTI_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6596758, -33.4507993],
      [-70.6597937, -33.4508217],
      [-70.6598018, -33.4507937],
      [-70.6599276, -33.4508182],
      [-70.6598668, -33.4510417],
      [-70.6600982, -33.4510858],
      [-70.6600844, -33.451143],
      [-70.6600774, -33.4511715],
      [-70.6600741, -33.4511858],
      [-70.6600722, -33.451193],
      [-70.6600701, -33.4512022],
      [-70.6596611, -33.4511249],
      [-70.6596787, -33.4510606],
      [-70.6596069, -33.4510466],
      [-70.6596758, -33.4507993],
    ],
  ],
}

const MEDICINA_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6615492, -33.4486101],
      [-70.6615162, -33.448796],
      [-70.6612569, -33.4487625],
      [-70.6612899, -33.4485745],
      [-70.6615492, -33.4486101],
    ],
  ],
}

const HUECHURABA_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6128535, -33.3943754],
      [-70.6136567, -33.393674],
      [-70.6129, -33.3916369],
      [-70.6118879, -33.3918857],
      [-70.611865, -33.3928583],
      [-70.6118726, -33.3930592],
      [-70.6119834, -33.3932696],
      [-70.6121744, -33.3935056],
      [-70.6125448, -33.3939903],
      [-70.6128045, -33.394408],
      [-70.6128535, -33.3943754],
    ],
  ],
}

const DERECHO_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6681863, -33.4505432],
      [-70.6681332, -33.4505282],
      [-70.668073, -33.4505105],
      [-70.6681595, -33.4500784],
      [-70.6688408, -33.4502376],
      [-70.6688235, -33.4503417],
      [-70.6687416, -33.4506516],
      [-70.6681863, -33.4505432],
    ],
  ],
}

const ARQUITECTURA_PERIMETER: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-70.6670801, -33.4496681],
      [-70.6671163, -33.4494033],
      [-70.6673897, -33.4494504],
      [-70.6674262, -33.4493056],
      [-70.6673925, -33.449301],
      [-70.6674205, -33.4491518],
      [-70.6670258, -33.4491292],
      [-70.6670152, -33.4491989],
      [-70.6668807, -33.4491955],
      [-70.6667702, -33.4495942],
      [-70.6670801, -33.4496681],
    ],
  ],
}

/** faculty_id → perímetro real. Agregar aquí las demás facultades cuando se tracen. */
export const FACULTY_PERIMETERS: Record<string, Polygon> = {
  ingenieria: ENGINEERING_PERIMETER,
  biblioteca: BIBLIOTECA_PERIMETER,
  'ciencias-sociales': CIENCIAS_SOCIALES_PERIMETER,
  psicologia: PSICOLOGIA_PERIMETER,
  comunicacion: COMUNICACION_PERIMETER,
  aulario: AULARIO_PERIMETER,
  comercio: COMERCIO_PERIMETER,
  salud: SALUD_PERIMETER,
  filosofia: FILOSOFIA_PERIMETER,
  educacion: EDUCACION_PERIMETER,
  deportes: DEPORTES_PERIMETER,
  dti: DTI_PERIMETER,
  medicina: MEDICINA_PERIMETER,
  derecho: DERECHO_PERIMETER,
  arquitectura: ARQUITECTURA_PERIMETER,
  economia: HUECHURABA_PERIMETER,
}

import { FACULTIES } from './campusData'

/**
 * Distancia Euclidiana simple (aprox) para desempatar cuando un punto cae
 * dentro de múltiples polígonos que se solapan (como Biblioteca y Ciencias Sociales).
 */
function distance(lat1: number, lng1: number, lat2: number, lng2: number) {
  return Math.hypot(lat1 - lat2, lng1 - lng2)
}

/**
 * Cluster automático: devuelve el faculty_id cuyo perímetro contiene el punto.
 * Si hay múltiples, elige el cuyo "centro" (marcador) esté más cerca.
 */
export function facultyIdAt(lat: number, lng: number): string | null {
  const matches: string[] = []
  
  for (const [facultyId, polygon] of Object.entries(FACULTY_PERIMETERS)) {
    if (isPointInPolygon({ lat, lng }, polygon)) {
      matches.push(facultyId)
    }
  }

  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]

  // Si cae en una zona donde varios polígonos se solapan accidentalmente,
  // buscamos la facultad que tenga su chincheta oficial más cerca de ese punto.
  let bestMatch = matches[0]
  let minDistance = Infinity

  for (const id of matches) {
    const faculty = FACULTIES.find(f => f.id === id)
    if (faculty) {
      const d = distance(lat, lng, faculty.lat, faculty.lng)
      if (d < minDistance) {
        minDistance = d
        bestMatch = id
      }
    }
  }

  return bestMatch
}

/** Los perímetros como FeatureCollection para pintarlos en MapLibre. */
export function facultyPerimetersGeoJSON(): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = Object.entries(FACULTY_PERIMETERS).map(
    ([facultyId, polygon]) => ({
      type: 'Feature',
      properties: { faculty_id: facultyId },
      geometry: polygon,
    }),
  )
  return { type: 'FeatureCollection', features }
}
