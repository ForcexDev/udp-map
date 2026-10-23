import type { NavGraph } from './graph'
import { cardinalWord, fallbackTranslate, planSteps, sideWord, turnContinuation } from './instructions'
import { cardinalOf, dist, pointInRing, ringArea, sub } from './projection'
import type { IndoorArea, NavNode, Translate } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Microdirección de una sala.
//
//   Vergara 432 · Piso 4 · Pasillo central, lado sur
//   Saliendo de la escalera, a la derecha: 1.ª puerta a tu izquierda
//
// Se DERIVA del grafo, no se escribe: la segunda línea es una ruta corta desde
// la puerta de la escalera de esa planta, pasada por el mismo planificador que
// las instrucciones. Si alguien mueve una puerta en el editor, se corrige sola.
// ─────────────────────────────────────────────────────────────────────────────

export interface Microaddress {
  line1: string
  /** null si la planta no tiene escalera mapeada o la ruta no es toda a pie. */
  line2: string | null
}

export interface MicroaddressContext {
  graph: NavGraph
  areas: IndoorArea[]
  buildingName: (buildingId: string) => string | null
  /** "Piso 4", o la etiqueta propia de la planta ("Zócalo"). */
  floorLabel?: (buildingId: string, level: number) => string
  t?: Translate
}

/** Por debajo de esto la puerta está sobre el eje y no tiene "lado". */
const SIDE_MIN_M = 0.3

export function microaddress(roomId: string, ctx: MicroaddressContext): Microaddress | null {
  const { graph } = ctx
  const t = ctx.t ?? fallbackTranslate
  const room = graph.nodes.get(roomId)
  if (!room || room.kind !== 'room' || room.buildingId === null || room.floor === null) return null

  const door = graph.neighbors(room.id).map(({ to }) => graph.node(to)).find((n) => n.kind === 'door') ?? null
  const hall = door
    ? (graph
        .neighbors(door.id)
        .map(({ to }) => graph.node(to))
        .find((n) => n.id !== room.id && (n.kind === 'walk' || n.kind === 'entrance')) ?? null)
    : null

  const parts: string[] = []
  const building = ctx.buildingName(room.buildingId)
  if (building) parts.push(building)
  parts.push(
    ctx.floorLabel?.(room.buildingId, room.floor) ?? t('wayfinder.micro.floor', 'Piso {{n}}', { n: room.floor }),
  )

  if (door && hall) {
    const area = circulationArea(hall, ctx.areas)
    const offset = sub(door.p, hall.p)
    const dir = dist(door.p, hall.p) >= SIDE_MIN_M ? cardinalWord(cardinalOf(offset), t) : null
    if (area && dir) parts.push(t('wayfinder.micro.areaSide', '{{area}}, lado {{dir}}', { area: area.name, dir }))
    else if (area) parts.push(area.name)
    else if (dir) parts.push(t('wayfinder.micro.side', 'lado {{dir}}', { dir }))
  }

  return { line1: parts.join(' · '), line2: fromStairs(room, ctx, t) }
}

/** El área de paso donde está el punto frente a la puerta: su id o su geometría. */
function circulationArea(hall: NavNode, areas: IndoorArea[]): IndoorArea | null {
  if (hall.areaId) {
    const byId = areas.find((a) => a.id === hall.areaId)
    if (byId) return byId
  }
  let best: IndoorArea | null = null
  let bestSize = Infinity
  for (const area of areas) {
    if (area.buildingId !== hall.buildingId || area.floor !== hall.floor) continue
    if (!pointInRing(hall.p, area.ring)) continue
    const size = Math.abs(ringArea(area.ring))
    if (size < bestSize) {
      bestSize = size
      best = area
    }
  }
  return best
}

function fromStairs(room: NavNode, ctx: MicroaddressContext, t: Translate): string | null {
  const { graph } = ctx
  const stairsDoors = [...graph.nodes.values()].filter(
    (n) =>
      n.kind === 'door' &&
      n.buildingId === room.buildingId &&
      n.floor === room.floor &&
      graph.neighbors(n.id).some(({ to }) => graph.node(to).kind === 'stairs'),
  )

  let best: { seconds: number; route: NonNullable<ReturnType<NavGraph['route']>> } | null = null
  for (const door of stairsDoors) {
    const route = graph.route(door.id, room.id)
    if (!route || route.kinds.some((k) => k !== 'walk')) continue
    if (!best || route.seconds < best.seconds) best = { seconds: route.seconds, route }
  }
  if (!best) return null

  const steps = planSteps(best.route, graph)
  const arrive = steps.find((s) => s.kind === 'arrive')?.arrive
  if (!arrive) return null
  const firstTurn = steps.find((s) => s.kind === 'turn')?.turn
  const turn = firstTurn ? turnContinuation(firstTurn, t) : null

  if (arrive.side === 'ahead') {
    return turn
      ? t('wayfinder.micro.fromStairsAhead', 'Saliendo de la escalera, {{turn}}: la puerta de enfrente', { turn })
      : t('wayfinder.micro.fromStairsAheadStraight', 'Saliendo de la escalera: la puerta de enfrente')
  }
  const side = sideWord(arrive.side, t)
  return turn
    ? t('wayfinder.micro.fromStairs', 'Saliendo de la escalera, {{turn}}: {{n}}.ª puerta a tu {{side}}', {
        turn,
        n: arrive.ordinal,
        side,
      })
    : t('wayfinder.micro.fromStairsStraight', 'Saliendo de la escalera: {{n}}.ª puerta a tu {{side}}', {
        n: arrive.ordinal,
        side,
      })
}
