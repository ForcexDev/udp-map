import { add, closestOnSegment, dist, scale, sub, unit } from './projection'
import type { Vec2 } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Un pasillo a partir de su eje y sus puertas.
//
// Quien mapea dibuja el eje y marca las puertas; el resto se genera. Por cada
// puerta se crea un nodo de pasillo enfrente, y los nodos se encadenan en orden
// a lo largo del eje. Así cada puerta queda naturalmente a la izquierda o a la
// derecha de quien recorre el pasillo, que es lo que necesitan las
// instrucciones ("pasando la Sala 412 a tu derecha").
//
// Vive en `shared/` y no en el editor para que `mapping` no tenga que importar
// de `wayfinding`: ya hay ciclos entre dominios y este no hace falta.
// ─────────────────────────────────────────────────────────────────────────────

/** Proyecciones más cercanas que esto se funden en un solo nodo. */
export const CORRIDOR_MERGE_M = 0.3

/**
 * El nodo de sala va 2,5 m hacia dentro desde la puerta, no en el centroide: en
 * un auditorio de 16 m el centroide hace que la ruta parezca cruzarlo entero.
 */
export const ROOM_DEPTH_M = 2.5

export interface CorridorDoor {
  id: string
  p: Vec2
  /** Crear el nodo de sala detrás de la puerta. */
  room?: boolean
}

export interface CorridorPlan {
  /** Nodos de pasillo en orden a lo largo del eje. */
  walk: { key: string; p: Vec2; along: number }[]
  rooms: { key: string; door: string; p: Vec2 }[]
  /** Aristas entre claves de `walk`, `rooms` e ids de puerta. */
  edges: { a: string; b: string }[]
}

interface Projected {
  point: Vec2
  along: number
  distance: number
}

/** El punto del eje más cercano a `p` y cuánto eje hay recorrido hasta él. */
export function projectOnAxis(axis: Vec2[], p: Vec2): Projected | null {
  if (axis.length < 2) return null
  let best: Projected | null = null
  let walked = 0
  for (let i = 1; i < axis.length; i++) {
    const a = axis[i - 1]
    const b = axis[i]
    const { point, f } = closestOnSegment(p, a, b)
    const distance = dist(p, point)
    if (!best || distance < best.distance) best = { point, along: walked + f * dist(a, b), distance }
    walked += dist(a, b)
  }
  return best
}

export function planCorridor(axis: Vec2[], doors: CorridorDoor[], keyPrefix = 'w'): CorridorPlan {
  if (axis.length < 2) return { walk: [], rooms: [], edges: [] }

  interface Candidate {
    point: Vec2
    along: number
    vertex: boolean
    doors: CorridorDoor[]
  }
  const candidates: Candidate[] = []
  let walked = 0
  axis.forEach((vertex, i) => {
    if (i > 0) walked += dist(axis[i - 1], vertex)
    candidates.push({ point: vertex, along: walked, vertex: true, doors: [] })
  })
  const projections = new Map<string, Projected>()
  for (const door of doors) {
    const projected = projectOnAxis(axis, door.p)
    if (!projected) continue
    projections.set(door.id, projected)
    candidates.push({ point: projected.point, along: projected.along, vertex: false, doors: [door] })
  }
  candidates.sort((a, b) => a.along - b.along)

  // Fusiona lo que cae casi en el mismo punto. Un vértice manda sobre una
  // proyección: el eje dibujado no debe moverse por una puerta cercana.
  const merged: Candidate[] = []
  for (const c of candidates) {
    const last = merged[merged.length - 1]
    if (last && c.along - last.along < CORRIDOR_MERGE_M) {
      last.doors.push(...c.doors)
      if (c.vertex && !last.vertex) {
        last.point = c.point
        last.vertex = true
      }
      continue
    }
    merged.push({ ...c, doors: [...c.doors] })
  }

  const walk = merged.map((c, i) => ({ key: `${keyPrefix}${i}`, p: c.point, along: c.along }))
  const edges: CorridorPlan['edges'] = []
  for (let i = 1; i < walk.length; i++) edges.push({ a: walk[i - 1].key, b: walk[i].key })

  const rooms: CorridorPlan['rooms'] = []
  merged.forEach((c, i) => {
    for (const door of c.doors) {
      edges.push({ a: door.id, b: walk[i].key })
      if (!door.room) continue
      const projected = projections.get(door.id)
      // Una puerta sobre el mismo eje no dice hacia dónde queda la sala.
      if (!projected || projected.distance < 0.05) continue
      const inward = unit(sub(door.p, projected.point))
      const key = `room:${door.id}`
      rooms.push({ key, door: door.id, p: add(door.p, scale(inward, ROOM_DEPTH_M)) })
      edges.push({ a: door.id, b: key })
    }
  })

  return { walk, rooms, edges }
}
