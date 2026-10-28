import { dist, floorSpan, levelIndex } from './projection'
import type { NavEdge, NavNode, Route } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Grafo de navegación y ruta más corta.
//
// El costo es TIEMPO, no distancia. En planta una escalera mide 0 m y ganaría
// siempre; medida en segundos, el ascensor gana cuando de verdad conviene. Con
// estas constantes la escalera gana hasta el tercer piso y al quinto decide la
// distancia: a una sala junto a la escalera se sube a pie y a una junto al
// ascensor, en ascensor. Viven solo aquí para que la animación y la ruta no
// discrepen nunca sobre cuánto tarda algo.
// ─────────────────────────────────────────────────────────────────────────────

/** Metros por segundo caminando. El mismo valor que `walkingSeconds` en geo. */
export const WALK_SPEED = 1.3
export const STAIRS_UP_S = 16
export const STAIRS_DOWN_S = 11
export const ELEVATOR_WAIT_S = 40
export const ELEVATOR_PER_FLOOR_S = 4

export interface RouteOptions {
  /** Sin escaleras ni escalones: silla de ruedas, coche, lesión. */
  stepFree?: boolean
}

interface Adjacent {
  to: string
  edge: NavEdge
}

/** Una puerta que da a un punto de paso, con la sala o el núcleo detrás. */
export interface DoorAt {
  door: NavNode
  room: NavNode | null
  /** La puerta lleva a una escalera o a un ascensor. */
  core: boolean
}

export class NavGraph {
  readonly nodes = new Map<string, NavNode>()
  readonly edges: NavEdge[]
  private readonly adjacency = new Map<string, Adjacent[]>()
  private doorsCache: Map<string, DoorAt[]> | null = null

  constructor(nodes: NavNode[], edges: NavEdge[]) {
    for (const node of nodes) {
      this.nodes.set(node.id, node)
      this.adjacency.set(node.id, [])
    }
    // Las aristas no tienen sentido: entran a la adyacencia por los dos lados.
    // Una arista hacia un nodo que no se cargó se descarta en vez de romper.
    this.edges = edges.filter((e) => this.nodes.has(e.a) && this.nodes.has(e.b))
    for (const edge of this.edges) {
      this.adjacency.get(edge.a)!.push({ to: edge.b, edge })
      this.adjacency.get(edge.b)!.push({ to: edge.a, edge })
    }
  }

  node(id: string): NavNode {
    const node = this.nodes.get(id)
    if (!node) throw new Error(`NAV_NODE_NOT_FOUND:${id}`)
    return node
  }

  neighbors(id: string): Adjacent[] {
    return this.adjacency.get(id) ?? []
  }

  edgeBetween(a: string, b: string): NavEdge | null {
    return this.neighbors(a).find((n) => n.to === b)?.edge ?? null
  }

  /** La puerta de un nodo de escalera o ascensor lleva a un núcleo. */
  isCoreDoor(id: string): boolean {
    const node = this.nodes.get(id)
    if (!node || (node.kind !== 'door' && node.kind !== 'entrance')) return false
    return this.neighbors(id).some(({ to }) => {
      const kind = this.nodes.get(to)?.kind
      return kind === 'stairs' || kind === 'elevator'
    })
  }

  /** La sala que hay detrás de una puerta, si la hay. */
  roomBehind(doorId: string): NavNode | null {
    for (const { to } of this.neighbors(doorId)) {
      const node = this.nodes.get(to)
      if (node?.kind === 'room') return node
    }
    return null
  }

  /**
   * Las puertas que cuelgan de cada punto de paso. Es lo que permite decir
   * "pasando la Sala 412" y contar puertas hasta la de destino.
   */
  doorsAt(id: string): DoorAt[] {
    if (!this.doorsCache) {
      this.doorsCache = new Map()
      for (const node of this.nodes.values()) {
        if (node.kind !== 'door') continue
        const room = this.roomBehind(node.id)
        const core = this.isCoreDoor(node.id)
        for (const { to } of this.neighbors(node.id)) {
          const host = this.nodes.get(to)
          if (!host || host.kind === 'room' || host.kind === 'stairs' || host.kind === 'elevator')
            continue
          const list = this.doorsCache.get(to) ?? []
          list.push({ door: node, room, core })
          this.doorsCache.set(to, list)
        }
      }
    }
    return this.doorsCache.get(id) ?? []
  }

  /** Segundos de recorrer una arista desde `from`, sabiendo si ya se iba en ascensor. */
  edgeSeconds(edge: NavEdge, from: string, insideElevator: boolean): number {
    const a = this.node(from)
    const b = this.node(edge.a === from ? edge.b : edge.a)
    if (edge.kind === 'walk') return dist(a.p, b.p) / WALK_SPEED

    const fa = a.floor ?? 1
    const fb = b.floor ?? 1
    const floors = floorSpan(fa, fb)
    if (edge.kind === 'stairs') {
      const up = levelIndex(fb) > levelIndex(fa)
      return floors * (up ? STAIRS_UP_S : STAIRS_DOWN_S)
    }
    // La espera se paga una sola vez por viaje: sin el estado "dentro del
    // ascensor", subir cuatro pisos costaría cuatro esperas y nunca ganaría.
    return floors * ELEVATOR_PER_FLOOR_S + (insideElevator ? 0 : ELEVATOR_WAIT_S)
  }

  /**
   * Ruta más rápida. Dijkstra sobre el estado (nodo, dentro del ascensor).
   * Devuelve null si no hay camino (o no lo hay sin escaleras).
   */
  route(fromId: string, toId: string, options: RouteOptions = {}): Route | null {
    if (!this.nodes.has(fromId) || !this.nodes.has(toId)) return null
    if (fromId === toId) return { nodes: [fromId], kinds: [], seconds: 0, meters: 0 }

    const key = (id: string, inside: boolean) => `${id}|${inside ? 1 : 0}`
    const best = new Map<string, number>()
    const previous = new Map<string, { key: string; id: string; edge: NavEdge }>()
    const heap = new MinHeap<{ key: string; id: string; inside: boolean; cost: number }>(
      (x) => x.cost,
    )

    best.set(key(fromId, false), 0)
    heap.push({ key: key(fromId, false), id: fromId, inside: false, cost: 0 })

    while (heap.size > 0) {
      const current = heap.pop()!
      if (current.cost > (best.get(current.key) ?? Infinity)) continue

      if (current.id === toId) {
        return this.rebuild(current.key, previous, current.cost)
      }

      for (const { to, edge } of this.neighbors(current.id)) {
        if (options.stepFree && !edge.stepFree) continue
        const cost = current.cost + this.edgeSeconds(edge, current.id, current.inside)
        const inside = edge.kind === 'elevator'
        const nextKey = key(to, inside)
        if (cost < (best.get(nextKey) ?? Infinity)) {
          best.set(nextKey, cost)
          previous.set(nextKey, { key: current.key, id: current.id, edge })
          heap.push({ key: nextKey, id: to, inside, cost })
        }
      }
    }
    return null
  }

  private rebuild(
    lastKey: string,
    previous: Map<string, { key: string; id: string; edge: NavEdge }>,
    seconds: number,
  ): Route {
    const nodes: string[] = [lastKey.slice(0, lastKey.lastIndexOf('|'))]
    const kinds: NavEdge['kind'][] = []
    let meters = 0
    let cursor = previous.get(lastKey)
    while (cursor) {
      const after = nodes[0]
      nodes.unshift(cursor.id)
      kinds.unshift(cursor.edge.kind)
      if (cursor.edge.kind === 'walk') meters += dist(this.node(cursor.id).p, this.node(after).p)
      cursor = previous.get(cursor.key)
    }
    return { nodes, kinds, seconds, meters }
  }

  /** Nodos alcanzables desde `fromIds`, sin mirar costos. Lo usa la validación. */
  reachable(fromIds: string[], options: RouteOptions = {}): Set<string> {
    const seen = new Set<string>(fromIds.filter((id) => this.nodes.has(id)))
    const stack = [...seen]
    while (stack.length > 0) {
      const id = stack.pop()!
      for (const { to, edge } of this.neighbors(id)) {
        if (options.stepFree && !edge.stepFree) continue
        if (seen.has(to)) continue
        seen.add(to)
        stack.push(to)
      }
    }
    return seen
  }
}

/**
 * Montículo binario mínimo. Una facultad tiene pocos cientos de nodos y una cola
 * ordenada a mano bastaría, pero el cálculo tiene que caber en pocos
 * milisegundos en un teléfono y esto son treinta líneas.
 */
class MinHeap<T> {
  private items: T[] = []
  constructor(private readonly score: (item: T) => number) {}

  get size(): number {
    return this.items.length
  }

  push(item: T): void {
    const items = this.items
    items.push(item)
    let i = items.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (this.score(items[parent]) <= this.score(items[i])) break
      ;[items[parent], items[i]] = [items[i], items[parent]]
      i = parent
    }
  }

  pop(): T | undefined {
    const items = this.items
    if (items.length === 0) return undefined
    const top = items[0]
    const last = items.pop()!
    if (items.length > 0) {
      items[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let smallest = i
        if (l < items.length && this.score(items[l]) < this.score(items[smallest])) smallest = l
        if (r < items.length && this.score(items[r]) < this.score(items[smallest])) smallest = r
        if (smallest === i) break
        ;[items[smallest], items[i]] = [items[i], items[smallest]]
        i = smallest
      }
    }
    return top
  }
}
