import type { Pin } from '@/shared/types/database'
import { normalizeRoomCode } from '@/shared/utils/roomCatalog'
import { WALK_SPEED } from '@/shared/utils/indoor/graph'
import { dist, pointInRing } from '@/shared/utils/indoor/projection'
import type { NavNode, Route, Vec2 } from '@/shared/utils/indoor/types'
import type { IndoorModel } from './useNavGraph'

// ─────────────────────────────────────────────────────────────────────────────
// De un pin a un nodo del grafo, y de dónde se sale.
// ─────────────────────────────────────────────────────────────────────────────

/** Más lejos que esto, ajustar al nodo más cercano ya no es "la misma sala". */
const SNAP_MAX_M = 30

/**
 * El nodo destino de un pin, o null si no hay ruta interior para él.
 *
 * En orden: el código de sala (la llave natural), el área, y por último el
 * nodo de paso más cercano en su edificio y planta. Lo último vuelve ruteable
 * cualquier pin interior —un baño, una impresora— sin mapearlo como sala.
 */
export function resolveTarget(pin: Pin, model: IndoorModel): string | null {
  const nodes = [...model.graph.nodes.values()]

  if (pin.room_code) {
    const code = normalizeRoomCode(pin.room_code)
    const byCode = nodes.find((n) => n.kind === 'room' && n.roomCode && normalizeRoomCode(n.roomCode) === code)
    if (byCode) return byCode.id
  }

  if (pin.area_id) {
    const byArea = nodes.find((n) => n.kind === 'room' && n.areaId === pin.area_id)
    if (byArea) return byArea.id
  }

  if (pin.building_id && pin.floor !== null) {
    const here = model.plane.toLocal(pin.lng, pin.lat)
    let best: NavNode | null = null
    let bestDistance = SNAP_MAX_M
    for (const node of nodes) {
      if (node.buildingId !== pin.building_id || node.floor !== pin.floor) continue
      if (node.kind !== 'walk' && node.kind !== 'room') continue
      const d = dist(here, node.p)
      if (d < bestDistance) {
        bestDistance = d
        best = node
      }
    }
    if (best) return best.id
  }

  return null
}

/** Las entradas por las que se puede entrar; sin escaleras, solo las aptas. */
export function entranceCandidates(model: IndoorModel, stepFree: boolean): NavNode[] {
  const { graph } = model
  return [...graph.nodes.values()].filter(
    (n) =>
      n.kind === 'entrance' &&
      (!stepFree ||
        graph.neighbors(n.id).some(({ to, edge }) => edge.stepFree && graph.node(to).buildingId !== null)),
  )
}

export interface EntranceChoice {
  entrance: NavNode
  route: Route
}

/**
 * La entrada que minimiza la caminata en línea recta desde la persona más la
 * ruta interior desde esa entrada. La ruta de calle real se pide DESPUÉS y
 * solo para la elegida: ORS tiene cupo diario.
 */
export function chooseEntrance(
  model: IndoorModel,
  targetId: string,
  from: Vec2 | null,
  stepFree: boolean,
): EntranceChoice | null {
  let best: (EntranceChoice & { score: number }) | null = null
  for (const entrance of entranceCandidates(model, stepFree)) {
    const route = model.graph.route(entrance.id, targetId, { stepFree })
    if (!route) continue
    const score = (from ? dist(from, entrance.p) / WALK_SPEED : 0) + route.seconds
    if (!best || score < best.score) best = { entrance, route, score }
  }
  return best ? { entrance: best.entrance, route: best.route } : null
}

/**
 * Los puntos desde los que se ofrece salir cuando no hay ubicación: lo
 * exterior con nombre, las entradas y los halls con nombre de la planta baja.
 */
export function originOptions(model: IndoorModel): NavNode[] {
  const hallAreas = new Set(model.areas.filter((a) => a.kind === 'hall').map((a) => a.id))
  const rank = (n: NavNode) => (n.kind === 'outdoor' ? 0 : n.kind === 'entrance' ? 1 : 2)
  return [...model.graph.nodes.values()]
    .filter(
      (n) =>
        n.landmark !== null &&
        (n.kind === 'outdoor' ||
          n.kind === 'entrance' ||
          (n.kind === 'walk' && (n.areaId ? hallAreas.has(n.areaId) : isInHall(n, model, hallAreas)))),
    )
    .sort((a, b) => rank(a) - rank(b))
}

function isInHall(node: NavNode, model: IndoorModel, hallAreas: Set<string>): boolean {
  return model.areas.some(
    (a) =>
      hallAreas.has(a.id) &&
      a.buildingId === node.buildingId &&
      a.floor === node.floor &&
      pointInRing(node.p, a.ring),
  )
}
