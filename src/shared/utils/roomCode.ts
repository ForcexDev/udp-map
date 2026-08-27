// ─────────────────────────────────────────────────────────────────────────────
// Códigos de sala de la UDP.
//
// Los dos edificios principales usan un esquema posicional: `E441.1.S101` es
// Ejército 441, planta 1, sala S101. Pero eso NO es una regla general:
//
//   · hay edificios sin código que igual tienen salas, con esquemas propios
//     (`SMV-03` en el subterráneo de uno de ellos);
//   · un mismo edificio puede hospedar varias familias de código;
//   · las salas de estudio no tienen código en absoluto.
//
// Por eso este módulo NO decide nada. Solo intenta leer la planta para
// preseleccionarla en el formulario, y si no reconoce el formato se calla. El
// edificio se deduce de la geometría, nunca del texto; y el código se guarda
// tal cual se escribió, sin normalizar.
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedRoomCode {
  /** Prefijo del edificio si el formato lo trae. Solo informativo. */
  buildingCode: string | null
  /** Planta deducida, o null si el formato no la expone. */
  floor: number | null
  /** Identificador de la sala dentro del edificio. */
  room: string
}

/** `E441.1.S101` → edificio E441, planta 1, sala S101.
 *
 *  El sufijo de letra del prefijo no está de adorno: hay direcciones con dos
 *  entradas en el mismo número —`E278A` y `E278B`, `M253A` y `M253B`— y son
 *  edificios distintos. La primera versión exigía que el prefijo terminara en
 *  dígito, así que `E278A.4.S402` no parseaba y once salas del catálogo se
 *  quedaban sin planta deducida. */
const POSITIONAL = /^([A-Za-z]+\d+[A-Za-z]*)\.(-?\d+)\.(.+)$/

/** `A-302` → sala 302 de un edificio A; la planta es el primer dígito. */
const DASHED = /^([A-Za-z]+)-(\d{3,4})$/

/**
 * Lee un código de sala. Devuelve null cuando no reconoce el formato, que es un
 * resultado normal y no un error: `SMV-03` o `Sala del fondo` son códigos
 * válidos que simplemente no dicen en qué planta están.
 */
export function parseRoomCode(raw: string): ParsedRoomCode | null {
  const code = raw.trim()
  if (!code) return null

  const positional = POSITIONAL.exec(code)
  if (positional) {
    const floor = Number(positional[2])
    // La planta 0 no existe en este esquema; si aparece, el código no sigue la
    // convención y es mejor no deducir nada que deducir mal.
    return {
      buildingCode: positional[1].toUpperCase(),
      floor: Number.isFinite(floor) && floor !== 0 ? floor : null,
      room: positional[3],
    }
  }

  const dashed = DASHED.exec(code)
  if (dashed) {
    // En `A-302` la planta es el primer dígito: la sala 302 está en el tercero.
    const floor = Number(dashed[2][0])
    return {
      buildingCode: dashed[1].toUpperCase(),
      floor: Number.isFinite(floor) && floor !== 0 ? floor : null,
      room: dashed[2],
    }
  }

  return null
}

/** La planta que sugiere un código, o null si no se puede saber. */
export function floorFromRoomCode(raw: string): number | null {
  return parseRoomCode(raw)?.floor ?? null
}
