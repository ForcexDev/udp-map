// ─────────────────────────────────────────────────────────────────────────────
// La planta de un pin tiene que existir de verdad.
//
// Espejo exacto del trigger `validate_pin_floor` de la base. La autoridad es el
// servidor —el formulario se puede saltar y la API es pública— pero el modo demo
// no tiene servidor, y sin esto la app sin credenciales dejaría guardar pines en
// plantas que no existen mientras la app con base los rechaza. Un modo demo que
// no se comporta como la base deja de servir para probar nada.
//
// Vive en shared/utils y recibe el mapeo por parámetro, como floorVisibility:
// así se puede probar sin montar el almacén y no ata este módulo a un feature.
// ─────────────────────────────────────────────────────────────────────────────

import type { Building, BuildingFloor } from '@/shared/types/database'

/** `null` significa que la planta vale. El resto son los mismos códigos que
 *  levanta la base, para que el toast sea uno solo en los dos caminos. */
export type FloorRejection =
  | 'FLOOR_ZERO'
  | 'INVALID_FLOOR_FOR_BUILDING'
  | 'FLOOR_NOT_IN_FACULTY'

interface FloorContext {
  buildings: Building[]
  floors: BuildingFloor[]
}

interface PinFloorTarget {
  floor: number | null
  buildingId: string | null
  facultyId: string | null
}

export function validatePinFloor(
  { buildings, floors }: FloorContext,
  { floor, buildingId, facultyId }: PinFloorTarget,
): FloorRejection | null {
  // Sin planta no hay nada que validar: es un pin de exterior.
  if (floor === null) return null

  // El 0 no existe: la baja es el 1 y el primer subterráneo el -1.
  if (floor === 0) return 'FLOOR_ZERO'

  // Dentro de un edificio, la planta tiene que estar declarada en ESE edificio.
  if (buildingId !== null) {
    // Aquí esta función SE APARTA del trigger, y tiene que hacerlo. La base
    // siempre conoce todos los edificios; este snapshot no: empieza vacío hasta
    // que el mapeo carga (ver mappingCache) y además viene acotado a una
    // facultad. Un edificio que no está en el snapshot no es un edificio sin
    // esa planta, es un edificio del que no sabemos nada — y tratar "no sé"
    // como "no existe" rechazaría ediciones perfectamente válidas hechas antes
    // de que cargue el mapeo. Quien manda es el servidor; esto solo evita el
    // viaje cuando la respuesta ya se conoce.
    const known = buildings.some((b) => b.id === buildingId)
      || floors.some((f) => f.building_id === buildingId)
    if (!known) return null

    const exists = floors.some((f) => f.building_id === buildingId && f.level === floor)
    return exists ? null : 'INVALID_FLOOR_FOR_BUILDING'
  }

  // Con planta y sin edificio se exige que el nivel exista en ALGÚN edificio de
  // la facultad, que es el mismo criterio con el que `facultyLevels` decide qué
  // chips pintar. Una planta sin chip es un pin que no se puede ver nunca.
  if (facultyId === null) return null

  const ofFaculty = new Set(
    buildings.filter((b) => b.faculty_id === facultyId).map((b) => b.id),
  )
  // Facultad sin edificios mapeados: no hay contra qué comprobar y no se
  // rechaza. Exigir mapeo para poder decir "piso 2" apagaría la planta en todo
  // el campus que aún no se ha trazado, que es casi todo.
  if (ofFaculty.size === 0) return null

  const exists = floors.some((f) => ofFaculty.has(f.building_id) && f.level === floor)
  return exists ? null : 'FLOOR_NOT_IN_FACULTY'
}

/**
 * La clave de i18n para el mensaje de error de la base, o null si el error no
 * es de planta. El mensaje del servidor y el del modo demo son el mismo texto
 * —el código a secas— así que un solo sitio traduce los dos caminos.
 *
 * La planta 0 la rechaza la base con una frase en español, no con un código,
 * porque también la protege el `check (level <> 0)` de building_floors y ese
 * mensaje ya existía. Se reconoce por el código igualmente para que el toast
 * salga traducido.
 */
export function floorRejectionKey(message: string): string | null {
  if (message.includes('INVALID_FLOOR_FOR_BUILDING')) return 'pin.invalidFloorForBuilding'
  if (message.includes('FLOOR_NOT_IN_FACULTY')) return 'pin.floorNotInFaculty'
  if (message.includes('FLOOR_ZERO') || message.includes('La planta 0 no existe')) return 'pin.floorZero'
  return null
}
