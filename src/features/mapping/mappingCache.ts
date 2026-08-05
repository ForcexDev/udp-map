import type { Area, Building } from '@/shared/types/database'
import { smallestContaining } from '@/shared/utils/geometry'
import type { FacultyMapping } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Copia del mapeo accesible sin React.
//
// `features/pins/api.ts` tiene que resolver edificio y área al crear o mover un
// pin, y es un módulo de datos: no puede usar un hook. Este es el mismo patrón
// que `publishBounds` en usePins — el componente que ya tiene los datos los
// deja aquí, y la capa de servicios los lee de forma síncrona.
//
// Empieza vacío, y eso es correcto: si el mapeo todavía no cargó, un pin nuevo
// se guarda sin edificio ni área. Se recalculan al moverlo, y de todos modos el
// dato importante —dónde está— vive en lat/lng.
// ─────────────────────────────────────────────────────────────────────────────

let cache: FacultyMapping = { buildings: [], floors: [], areas: [] }

export function publishMapping(mapping: FacultyMapping): void {
  cache = mapping
}

export function mappingSnapshot(): FacultyMapping {
  return cache
}

export interface IndoorLocation {
  buildingId: string | null
  areaId: string | null
}

/**
 * Edificio y área que corresponden a un punto en una planta dada.
 *
 * `floor` es obligatorio para resolver el área, no un extra: dos áreas de
 * plantas distintas ocupan el mismo sitio visto desde arriba, así que sin saber
 * la planta cualquiera de las dos "contiene" el punto. Con `floor` null se
 * buscan solo las áreas exteriores, que es lo correcto para un pin de patio.
 */
export function indoorLocationAt(
  lat: number,
  lng: number,
  floor: number | null,
): IndoorLocation {
  const { buildings, areas } = cache

  const building = smallestContaining(
    buildings.map((b: Building) => ({ id: b.id, polygon: b.footprint })),
    lng,
    lat,
  )

  const area = smallestContaining(
    areas.filter((a: Area) => a.floor === floor),
    lng,
    lat,
  )

  return { buildingId: building?.id ?? null, areaId: area?.id ?? null }
}
