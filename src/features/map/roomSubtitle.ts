import { localizedName } from '@/shared/utils/localized'
import type { Faculty, Pin } from '@/shared/types/database'

/**
 * Dónde está una sala, para la fila del buscador.
 *
 * Buscar "106" trae la S106 de varios edificios, así que el título solo no
 * sirve para elegir: lo que las distingue es su código y su facultad. El código
 * va primero porque es lo que la persona acaba de escribir.
 */
export function roomSubtitle(pin: Pin, faculties: Faculty[], language = 'es'): string {
  const partes: string[] = []
  if (pin.room_code) partes.push(pin.room_code)

  const faculty = pin.faculty_id ? faculties.find((f) => f.id === pin.faculty_id) : null
  if (faculty) partes.push(localizedName(faculty, language))

  return partes.join(' · ') || 'Sala'
}
