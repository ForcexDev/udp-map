import type { Pin } from '@/shared/types/database'
import { categoryById, FACULTIES } from '@/shared/data/campusData'

/**
 * Dónde está un pin y de qué es, en una línea.
 *
 * Existe porque el buscador de Difusión listaba solo el título, y con el título
 * no se distingue: hay cuatro "Sala S101" en edificios distintos y varios
 * "Baño" por planta. Elegir el pin equivocado manda a toda la universidad al
 * sitio equivocado, así que la lista tiene que decir cuál es cuál.
 *
 * El orden va de lo más grande a lo más pequeño —facultad, planta, sala— porque
 * es como se ubica uno: primero el edificio, después el piso.
 */
export function pinContext(pin: Pin): string {
  const partes: string[] = []

  const categoria = categoryById(pin.category_id)
  if (categoria) partes.push(categoria.name)

  const facultad = pin.faculty_id ? FACULTIES.find((f) => f.id === pin.faculty_id) : null
  if (facultad) partes.push(facultad.name)

  if (pin.floor !== null) {
    // -1 es subterráneo, no "piso menos uno". La planta 0 no existe: la baja
    // es el 1 (ver el CHECK de `pins.floor` y `pin.floorZero` en i18n).
    partes.push(pin.floor < 0 ? `Subterráneo ${Math.abs(pin.floor)}` : `Piso ${pin.floor}`)
  }

  if (pin.room_code) partes.push(pin.room_code)

  // Sin nada que decir, mejor el tipo que una línea vacía que descuadra la fila.
  return partes.length > 0 ? partes.join(' · ') : pin.type
}
