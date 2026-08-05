import { useQuery } from '@tanstack/react-query'
import type { Area, Building, BuildingFloor } from '@/shared/types/database'
import { smallestContaining } from '@/shared/utils/geometry'
import { fetchAllMapping, type FacultyMapping } from './api'
import { publishMapping } from './mappingCache'

// ─────────────────────────────────────────────────────────────────────────────
// El mapeo interior, para el mapa público.
//
// Se trae ENTERO y una sola vez: son unas decenas de polígonos para todo el
// campus, mucho menos que un tile del mapa. Pedirlo por facultad obligaría a
// refetchear cada vez que alguien cruza la calle.
//
// `staleTime` alto porque esto cambia cuando alguien mapea, no cuando alguien
// publica: revalidarlo cada minuto sería preguntar por algo que casi nunca se
// mueve.
// ─────────────────────────────────────────────────────────────────────────────

const EMPTY: FacultyMapping = { buildings: [], floors: [], areas: [] }

export function useMapping() {
  const query = useQuery({
    queryKey: ['mapping', 'all'],
    queryFn: async () => {
      const data = await fetchAllMapping()
      // La capa de servicios de pines lo necesita sin pasar por React, para
      // deducir edificio y área al crear o mover un pin.
      publishMapping(data)
      return data
    },
    staleTime: 5 * 60_000,
    // Si falla, el mapa tiene que seguir funcionando sin el interior. Un error
    // aquí no puede tumbar la pantalla principal.
    retry: 1,
  })

  return {
    mapping: query.data ?? EMPTY,
    isLoading: query.isLoading,
    error: query.error,
  }
}

/** El edificio cuya huella contiene el punto, o null si está al aire libre. */
export function buildingAt(buildings: Building[], lng: number, lat: number): Building | null {
  return smallestContaining(
    buildings.map((b) => ({ ...b, polygon: b.footprint })),
    lng,
    lat,
  )
}

/**
 * El área que contiene el punto EN esa planta.
 *
 * Se filtra por planta antes de comparar: sin eso, un punto del piso 3 caería
 * en el área que está debajo en el piso 1, porque desde arriba ocupan el mismo
 * sitio. `floor` null busca entre las áreas exteriores.
 */
export function areaAt(
  areas: Area[],
  lng: number,
  lat: number,
  floor: number | null,
): Area | null {
  return smallestContaining(
    areas.filter((a) => a.floor === floor),
    lng,
    lat,
  )
}

/** Las plantas de un edificio, de arriba abajo, como se leen en un ascensor. */
export function floorsOf(floors: BuildingFloor[], buildingId: string): BuildingFloor[] {
  return floors.filter((f) => f.building_id === buildingId).sort((a, b) => b.level - a.level)
}

export interface FacultyLevel {
  level: number
  /** La etiqueta del primer edificio que le puso una ("Zócalo", "Entrepiso"). */
  label: string | null
  /** Cuántos edificios de la facultad llegan a esta planta. */
  buildings: number
}

/**
 * Las plantas de una FACULTAD: la unión de las de sus edificios, de arriba
 * abajo y sin repetir.
 *
 * Es lo que alimenta el selector, porque la planta es un contexto de facultad y
 * no de edificio. Si el Vergara 432 tiene dos subterráneos y los demás ninguno,
 * el selector ofrece S1 y S2 igualmente: elegirlos enseña el subterráneo del
 * único edificio que lo tiene, que es exactamente la respuesta correcta a
 * "¿qué hay en el subterráneo de esta facultad?".
 */
export function facultyLevels(mapping: FacultyMapping, facultyId: string): FacultyLevel[] {
  const ofFaculty = new Set(
    mapping.buildings.filter((b) => b.faculty_id === facultyId).map((b) => b.id),
  )

  const byLevel = new Map<number, FacultyLevel>()
  for (const floor of mapping.floors) {
    if (!ofFaculty.has(floor.building_id)) continue
    const existing = byLevel.get(floor.level)
    if (existing) {
      existing.buildings += 1
      existing.label = existing.label ?? floor.label
    } else {
      byLevel.set(floor.level, { level: floor.level, label: floor.label, buildings: 1 })
    }
  }

  return [...byLevel.values()].sort((a, b) => b.level - a.level)
}

/**
 * Dónde está un pin, en palabras: `Edificio de Salas · Piso 3 · Sala 301`.
 * Va degradando conforme falten datos, hasta desaparecer del todo si el pin
 * está al aire libre y no hay nada mapeado.
 */
export function locationBreadcrumb(
  mapping: FacultyMapping,
  pin: { building_id?: string | null; area_id?: string | null; floor: number | null },
  floorLabel: (level: number, label: string | null) => string,
): string[] {
  const parts: string[] = []

  const building = pin.building_id
    ? mapping.buildings.find((b) => b.id === pin.building_id)
    : undefined
  if (building) parts.push(building.short_name || building.name)

  if (pin.floor !== null && pin.floor !== undefined) {
    const floor = mapping.floors.find(
      (f) => f.building_id === pin.building_id && f.level === pin.floor,
    )
    parts.push(floorLabel(pin.floor, floor?.label ?? null))
  }

  const area = pin.area_id ? mapping.areas.find((a) => a.id === pin.area_id) : undefined
  if (area) parts.push(area.name)

  return parts
}
