import type { Pin } from '@/shared/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Buscar una sala.
//
// El buscador del mapa cubría facultades, edificios y áreas, pero NO las salas,
// que son pines con `room_code`. Escribir "E441.1.S106" —el código que la
// propia aplicación genera y enseña— devolvía "Sin resultados".
//
// Las tres formas en que la gente busca una sala, y las tres tienen que
// funcionar:
//
//   · por edificio: "E441" → todas las salas de Ejército 441
//   · por número:   "106"  → las S106 de todas las facultades
//   · por código:   "E441.1.S106" → esa
//
// Las tres salen de una sola regla —subcadena sobre el código normalizado—, así
// que aquí no hay tres caminos. Lo que sí hay es un ORDEN, porque "106" casa
// con muchas y la que se busca casi nunca es una cualquiera.
// ─────────────────────────────────────────────────────────────────────────────

/** Sin tildes, en minúscula y sin espacios. Los puntos se conservan: separan. */
export function normalizeRoomQuery(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '')
}

/** La parte de sala de un código posicional: `E441.1.S106` → `s106`. */
function roomPart(code: string): string {
  const normalized = normalizeRoomQuery(code)
  const lastDot = normalized.lastIndexOf('.')
  return lastDot === -1 ? normalized : normalized.slice(lastDot + 1)
}

/**
 * Cuánto encaja un pin con la búsqueda. Menor es mejor; `null` no encaja.
 *
 * El orden no es decorativo. Con "106" casan la S106 de cinco edificios, la
 * S1060 si existiera y cualquier pin cuyo título mencione 106. Quien escribe
 * "106" quiere una sala llamada 106, no un pin que la nombre de pasada.
 */
function rank(pin: Pin, query: string): number | null {
  const code = pin.room_code ? normalizeRoomQuery(pin.room_code) : ''
  const room = pin.room_code ? roomPart(pin.room_code) : ''
  const title = normalizeRoomQuery(pin.title)

  if (code && code === query) return 0                    // el código exacto
  if (room && room === query) return 1                    // "s106" para S106
  if (room && room.replace(/^[a-z]+/, '') === query) return 2  // "106" para S106
  if (code && code.startsWith(query)) return 3            // "e441" o "e441.1"
  if (code && code.includes(query)) return 4
  if (title === query) return 5
  if (title.includes(query)) return 6
  return null
}

/**
 * Las salas que casan con la búsqueda, de la más probable a la menos.
 *
 * Solo mira pines CON `room_code`, o el resultado se llenaría de pines de
 * comida que mencionan un número. Un pin sin código no es una sala.
 */
export function searchRooms(pins: Pin[], rawQuery: string, limit = 8): Pin[] {
  const query = normalizeRoomQuery(rawQuery)
  // Con una sola letra o dígito casaría medio campus.
  if (query.length < 2) return []

  return pins
    .filter((pin) => pin.room_code)
    .map((pin) => ({ pin, score: rank(pin, query) }))
    .filter((entry): entry is { pin: Pin; score: number } => entry.score !== null)
    .sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score
      // A igualdad, por código: agrupa las de un mismo edificio y planta.
      return (a.pin.room_code ?? '').localeCompare(b.pin.room_code ?? '', 'es', { numeric: true })
    })
    .slice(0, limit)
    .map((entry) => entry.pin)
}
