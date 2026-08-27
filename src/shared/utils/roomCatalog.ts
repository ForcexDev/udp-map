import { parseRoomCode } from './roomCode'

// ─────────────────────────────────────────────────────────────────────────────
// El catálogo de salas, derivado del horario de la FIC.
//
// La fuente es `salas.docencia-eit.cl/data.json` (ver `docs/SALAS.md` §1): una
// fila por BLOQUE DE HORARIO, no por sala. Una sala con doce clases a la semana
// aparece doce veces. Aquí se pasa de esa lista a un catálogo de salas.
//
// Esta parte es pura y recibe solo los `place` ya extraídos: la descarga y su
// caché viven en `features/mapping/salasEit.ts`, para que la regla se pueda
// probar sin red delante.
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogRoom {
  /** El código completo tal como venía: `E441.1.S101`. */
  code: string
  /** Prefijo del edificio: `E441`, `E278A`. Es su dirección postal (§3). */
  buildingCode: string
  floor: number
  /** El identificador dentro del edificio: `S101`, `L.D`, `LAB INF`. */
  room: string
  /** Cuántos bloques del horario la mencionan. Ordena por uso, no por nombre. */
  blocks: number
}

/**
 * Agrupa una lista de `place` en el catálogo de salas.
 *
 * Se descarta en silencio lo que no siga el esquema posicional, y no es un
 * caso raro: en el corte del 2026-08-26 hay diez filas con `LOC` o con el campo
 * vacío. Un bloque sin sala reconocible no es un error del que avisar — es una
 * fila que no sirve para mapear —, y hacerlo fallar dejaría el importador sin
 * catálogo por diez filas de mil trescientas.
 *
 * Sale ordenado por edificio, planta y sala para que la lista del importador no
 * baile entre recargas.
 */
export function buildRoomCatalog(places: readonly string[]): CatalogRoom[] {
  const byCode = new Map<string, CatalogRoom>()

  for (const place of places) {
    const parsed = parseRoomCode(place ?? '')
    // Sin planta no hay dónde poner el pin: `trg_validate_pin_floor` lo
    // rechazaría, y el importador ofrecería algo que no se puede crear.
    if (!parsed || parsed.buildingCode === null || parsed.floor === null) continue

    const code = place.trim()
    const existing = byCode.get(code)
    if (existing) {
      existing.blocks += 1
      continue
    }
    byCode.set(code, {
      code,
      buildingCode: parsed.buildingCode,
      floor: parsed.floor,
      room: parsed.room,
      blocks: 1,
    })
  }

  return [...byCode.values()].sort(
    (a, b) =>
      a.buildingCode.localeCompare(b.buildingCode) ||
      a.floor - b.floor ||
      a.room.localeCompare(b.room, 'es', { numeric: true }),
  )
}

/** Las plantas que el catálogo conoce de un edificio, de abajo arriba. */
export function catalogFloorsOf(catalog: readonly CatalogRoom[], buildingCode: string): number[] {
  const levels = new Set<number>()
  for (const room of catalog) {
    if (room.buildingCode === buildingCode) levels.add(room.floor)
  }
  return [...levels].sort((a, b) => a - b)
}

/** Las salas de un edificio, opcionalmente acotadas a una planta. */
export function catalogRoomsOf(
  catalog: readonly CatalogRoom[],
  buildingCode: string,
  floor?: number | null,
): CatalogRoom[] {
  return catalog.filter(
    (room) =>
      room.buildingCode === buildingCode &&
      (floor === undefined || floor === null || room.floor === floor),
  )
}

/**
 * Qué salas del catálogo todavía no existen como pin.
 *
 * La comparación es por código normalizado —sin espacios alrededor y en
 * mayúsculas— porque `pins.room_code` se guarda TAL CUAL lo escribió quien
 * publicó el pin, sin normalizar (es una decisión deliberada de `roomCode.ts`).
 * Comparar en crudo haría que `e441.1.s101` escrito a mano se ofreciera como si
 * faltara, y acabaríamos con la sala duplicada.
 */
export function missingRooms(
  catalog: readonly CatalogRoom[],
  existingRoomCodes: readonly (string | null)[],
): CatalogRoom[] {
  const taken = new Set(
    existingRoomCodes.filter((code): code is string => Boolean(code)).map(normalizeRoomCode),
  )
  return catalog.filter((room) => !taken.has(normalizeRoomCode(room.code)))
}

export function normalizeRoomCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, ' ')
}

/**
 * Si un edificio del mapeo corresponde a un prefijo del catálogo.
 *
 * El prefijo del catálogo (`E441`) **es la dirección postal** del edificio
 * (`docs/SALAS.md` §3), y en el mapeo eso vive en `short_name` o entre los
 * `aliases`. Se comparan los dos porque ninguno es obligatorio: un edificio
 * puede tener su código en el nombre corto, en un alias, o en ninguno — y en
 * ese último caso el importador simplemente no tiene salas que ofrecerle.
 */
export function buildingMatchesCode(
  candidates: readonly (string | null | undefined)[],
  buildingCode: string,
): boolean {
  const target = buildingCode.trim().toUpperCase()
  return candidates.some((candidate) => (candidate ?? '').trim().toUpperCase() === target)
}
