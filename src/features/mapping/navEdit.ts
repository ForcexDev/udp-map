import { closestOnSegment, dist, pointInRing, ringArea } from '@/shared/utils/indoor/projection'
import type { IndoorArea, Vec2 } from '@/shared/utils/indoor/types'
import type { NavEdgeInput } from './api'

// Ayudas puras de la herramienta de navegación del editor.

/** Un clic a más de esto de cualquier borde no es una puerta. */
export const DOOR_SNAP_M = 1.5
/** Áreas de paso: no tienen puertas propias ni sala detrás. */
export const OPEN_KINDS = new Set(['corridor', 'hall'])

/** Quita las aristas que ya existen en cualquier sentido o que se repiten. */
export function dedupeEdges(
  inputs: NavEdgeInput[],
  existing: { a: string; b: string }[],
): NavEdgeInput[] {
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)
  const seen = new Set(existing.map((e) => key(e.a, e.b)))
  return inputs.filter((e) => {
    if (e.a === e.b) return false
    const k = key(e.a, e.b)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * El borde más cercano de las áreas de la planta. Entre dos bordes casi igual
 * de cerca —la pared que comparten una sala y el pasillo— gana la sala: la
 * puerta es suya, el pasillo no tiene puertas propias.
 */
export function snapToWall(
  areas: IndoorArea[],
  p: Vec2,
): { p: Vec2; areaId: string | null } | null {
  let best: { p: Vec2; areaId: string | null; d: number; open: boolean } | null = null
  for (const area of areas) {
    for (let i = 0; i < area.ring.length; i++) {
      const { point } = closestOnSegment(p, area.ring[i], area.ring[(i + 1) % area.ring.length])
      const d = dist(point, p)
      if (d > DOOR_SNAP_M) continue
      const open = OPEN_KINDS.has(area.kind)
      const better =
        !best || d < best.d - 0.2 || (Math.abs(d - best.d) <= 0.2 && best.open && !open)
      if (better) best = { p: point, areaId: open ? null : area.id, d, open }
    }
  }
  return best ? { p: best.p, areaId: best.areaId } : null
}

export function areaAt(areas: IndoorArea[], p: Vec2): IndoorArea | null {
  return (
    areas
      .filter((a) => pointInRing(p, a.ring))
      .sort((a, b) => Math.abs(ringArea(a.ring)) - Math.abs(ringArea(b.ring)))[0] ?? null
  )
}
