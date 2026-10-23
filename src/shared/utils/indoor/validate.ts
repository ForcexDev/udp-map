import { normalizeRoomCode } from '@/shared/utils/roomCatalog'
import type { NavGraph } from './graph'
import { distanceToRing, levelIndex } from './projection'
import type { IndoorArea, NavNode } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Qué le falta a un grafo para que las rutas salgan bien.
//
// Lo usa el editor para dejar el mapeo "en verde". Distingue errores (una sala
// a la que no se llega) de avisos (una sala a la que no se llega sin
// escaleras, que puede ser la realidad del edificio y hay que saberlo).
// ─────────────────────────────────────────────────────────────────────────────

export type NavIssueCode =
  | 'isolated-node'
  | 'no-entrance'
  | 'room-without-node'
  | 'room-unreachable'
  | 'room-unreachable-step-free'
  | 'shaft-gap'
  | 'shaft-unlinked'
  | 'door-off-wall'

export interface NavIssue {
  severity: 'error' | 'warning'
  code: NavIssueCode
  nodeIds: string[]
  /** Dato para el mensaje: el código de sala, el núcleo o la distancia. */
  detail?: string
}

export interface NavValidationInput {
  graph: NavGraph
  areas?: IndoorArea[]
  /** Códigos de sala que deberían tener nodo (pines publicados, catálogo). */
  roomCodes?: string[]
}

/** Una puerta más lejos que esto del borde de su sala está mal colocada. */
export const DOOR_WALL_TOLERANCE_M = 0.3

export function validateNavGraph({ graph, areas = [], roomCodes = [] }: NavValidationInput): NavIssue[] {
  const issues: NavIssue[] = []
  const nodes = [...graph.nodes.values()]

  for (const node of nodes) {
    if (graph.neighbors(node.id).length === 0) {
      issues.push({ severity: 'error', code: 'isolated-node', nodeIds: [node.id] })
    }
  }

  const rooms = nodes.filter((n) => n.kind === 'room')
  const entrances = nodes.filter((n) => n.kind === 'entrance').map((n) => n.id)
  if (rooms.length > 0 && entrances.length === 0) {
    issues.push({ severity: 'error', code: 'no-entrance', nodeIds: [] })
  }

  const mapped = new Set(rooms.filter((r) => r.roomCode).map((r) => normalizeRoomCode(r.roomCode!)))
  for (const code of new Set(roomCodes.map(normalizeRoomCode))) {
    if (!mapped.has(code)) issues.push({ severity: 'warning', code: 'room-without-node', nodeIds: [], detail: code })
  }

  if (entrances.length > 0) {
    const reachable = graph.reachable(entrances)
    const stepFree = graph.reachable(entrances, { stepFree: true })
    for (const room of rooms) {
      if (!reachable.has(room.id)) {
        issues.push({ severity: 'error', code: 'room-unreachable', nodeIds: [room.id], detail: label(room) })
      } else if (!stepFree.has(room.id)) {
        issues.push({ severity: 'warning', code: 'room-unreachable-step-free', nodeIds: [room.id], detail: label(room) })
      }
    }
  }

  issues.push(...shaftIssues(graph, nodes))

  for (const door of nodes) {
    if (door.kind !== 'door' || !door.areaId) continue
    const area = areas.find((a) => a.id === door.areaId)
    if (!area) continue
    const distance = distanceToRing(door.p, area.ring)
    if (distance > DOOR_WALL_TOLERANCE_M) {
      issues.push({ severity: 'warning', code: 'door-off-wall', nodeIds: [door.id], detail: distance.toFixed(1) })
    }
  }

  return issues
}

function label(node: NavNode): string {
  return node.roomCode ?? node.name ?? node.id
}

/**
 * Un núcleo vertical es el mismo `shaft` en plantas consecutivas. Si salta una
 * planta, o una planta no está unida con la siguiente, la ruta no puede pasar.
 * Puede ser real —un ascensor que no para en el 3—, por eso es aviso.
 */
function shaftIssues(graph: NavGraph, nodes: NavNode[]): NavIssue[] {
  const issues: NavIssue[] = []
  const groups = new Map<string, NavNode[]>()
  for (const node of nodes) {
    if ((node.kind !== 'stairs' && node.kind !== 'elevator') || !node.shaft || node.floor === null) continue
    const key = `${node.buildingId}|${node.kind}|${node.shaft}`
    groups.set(key, [...(groups.get(key) ?? []), node])
  }

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => levelIndex(a.floor!) - levelIndex(b.floor!))
    for (let i = 1; i < sorted.length; i++) {
      const below = sorted[i - 1]
      const above = sorted[i]
      const gap = levelIndex(above.floor!) - levelIndex(below.floor!)
      if (gap > 1) {
        issues.push({ severity: 'warning', code: 'shaft-gap', nodeIds: [below.id, above.id], detail: above.shaft ?? '' })
      }
      const vertical = graph.edgeBetween(below.id, above.id)
      if (!vertical || vertical.kind === 'walk') {
        issues.push({
          severity: 'warning',
          code: 'shaft-unlinked',
          nodeIds: [below.id, above.id],
          detail: above.shaft ?? '',
        })
      }
    }
  }
  return issues
}
