// ─────────────────────────────────────────────────────────────────────────────
// Qué se ve cuando hay una planta activa.
//
// La planta es un contexto de FACULTAD, no de edificio. Elegir "piso 2" quiere
// decir "enséñame el segundo piso de esta facultad": el de todos sus edificios
// a la vez, no el de uno solo. Un edificio que no tenga ese piso simplemente no
// aporta nada, que es distinto de esconderse.
//
// La primera versión ataba la planta al edificio bajo el centro del mapa. Con
// eso, cruzar de un edificio a otro cambiaba de piso sola, y el resto de la
// facultad seguía enseñando TODOS sus pisos a la vez: con cuarenta salas
// mapeadas eso son cuarenta marcadores encimados.
//
// Estas dos funciones son la única fuente de esa regla, y viven aquí porque las
// necesitan dos capas que no se conocen: los marcadores (DOM, en MapView) y los
// polígonos del mapeo (GeoJSON, en mappingLayers).
// ─────────────────────────────────────────────────────────────────────────────

/** La planta baja. El 0 no existe: la baja es el 1 y el primer subterráneo, -1. */
export const GROUND_LEVEL = 1

interface FloorScoped {
  faculty_id: string | null
  floor: number | null
}

/**
 * ¿Se ve este pin con la planta activa puesta?
 *
 * Un pin sin planta es de exterior —una entrada, un food truck, el bicicletero—
 * y cuenta como planta baja: a ras de suelo se ve junto con los del piso 1, y
 * desde el segundo hacia arriba desaparece, porque desde el segundo piso el
 * patio no es contexto, es ruido.
 *
 * Los pines de OTRAS facultades no se tocan: la planta activa describe una
 * facultad concreta y no tiene por qué vaciar el resto del mapa.
 */
export function pinVisibleOnFloor(
  pin: FloorScoped,
  activeFacultyId: string | null,
  activeFloor: number | null,
): boolean {
  if (activeFloor === null || activeFacultyId === null) return true
  if (pin.faculty_id !== activeFacultyId) return true
  if (pin.floor === null) return activeFloor === GROUND_LEVEL
  return pin.floor === activeFloor
}

interface AreaScoped {
  faculty_id: string
  building_id: string | null
  floor: number | null
}

/**
 * ¿Se ve esta área?
 *
 * Las áreas exteriores —patio, cancha, bicicletero— se ven SIEMPRE, en todas
 * las plantas y a todos los zooms. Son suelo, no una planta: si el patio se
 * apaga al subir al segundo piso, el mapa pierde la referencia de dónde está
 * parado el edificio.
 *
 * Sin planta activa, cada edificio enseña la suya por defecto. Enseñarlas todas
 * superpuestas dibujaría el interior de cuatro pisos uno encima de otro.
 */
export function areaVisibleOnFloor(
  area: AreaScoped,
  activeFacultyId: string | null,
  activeFloor: number | null,
  defaultFloorOf: (buildingId: string) => number | undefined,
): boolean {
  if (area.building_id === null) return true
  if (activeFloor === null || area.faculty_id !== activeFacultyId) {
    return area.floor === defaultFloorOf(area.building_id)
  }
  return area.floor === activeFloor
}
