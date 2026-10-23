import type { Area, NavEdgeRow, NavNodeRow } from '@/shared/types/database'
import { openRing } from '@/shared/utils/geometry'
import { NavGraph } from './graph'
import { projectionAround, type LocalPlane } from './projection'
import type { IndoorArea, NavNode } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// De las filas de la base al grafo en metros.
//
// La base guarda lng/lat; la lógica trabaja en un plano local. Aquí se cruza esa
// frontera una sola vez, al cargar, y se resuelve lo que la base no guarda: el
// nombre visible de cada sala, que sale del área, del pin o del código.
// ─────────────────────────────────────────────────────────────────────────────

export interface LoadOptions {
  /** Plano a usar; por defecto, centrado en los nodos de la facultad. */
  plane?: LocalPlane
  /** Áreas del mapeo: dan nombre a las salas y marcan baños y servicios. */
  areas?: Area[]
  /** Nombre por código de sala cuando el área no lo da (el título del pin). */
  nameByRoomCode?: (code: string) => string | null
}

export interface LoadedGraph {
  graph: NavGraph
  plane: LocalPlane
}

/** "V432.4.S413" → "Sala 413"; lo que no reconoce lo deja como venía. */
export function roomNameFromCode(code: string): string {
  const room = code.split('.').slice(2).join('.') || code
  const numbered = /^S(\d+)$/i.exec(room.trim())
  return numbered ? `Sala ${numbered[1]}` : room.trim()
}

export function graphFromRows(nodes: NavNodeRow[], edges: NavEdgeRow[], options: LoadOptions = {}): LoadedGraph {
  const plane = options.plane ?? projectionAround(nodes)
  const areaById = new Map((options.areas ?? []).map((a) => [a.id, a]))

  const navNodes: NavNode[] = nodes.map((row) => {
    const area = row.area_id ? areaById.get(row.area_id) : undefined
    let name: string | null = null
    if (row.kind === 'room') {
      name =
        area?.name ??
        (row.room_code ? (options.nameByRoomCode?.(row.room_code) ?? roomNameFromCode(row.room_code)) : null) ??
        row.landmark
    }
    return {
      id: row.id,
      kind: row.kind,
      p: plane.toLocal(row.lng, row.lat),
      buildingId: row.building_id,
      floor: row.floor,
      landmark: row.landmark,
      via: row.via,
      areaId: row.area_id,
      roomCode: row.room_code,
      shaft: row.shaft,
      widthM: row.width_m === null ? null : Number(row.width_m),
      name,
      service: area?.kind === 'service',
    }
  })

  const navEdges = edges.map((e) => ({ id: e.id, a: e.a, b: e.b, kind: e.kind, stepFree: e.step_free }))
  return { graph: new NavGraph(navNodes, navEdges), plane }
}

/** Áreas del mapeo en el plano local, para la vista explotada y la validación. */
export function areasToLocal(areas: Area[], plane: LocalPlane): IndoorArea[] {
  return areas.map((area) => ({
    id: area.id,
    buildingId: area.building_id,
    floor: area.floor,
    kind: area.kind,
    name: area.name,
    ring: openRing(area.polygon.coordinates[0] ?? []).map(([lng, lat]) => plane.toLocal(lng, lat)),
  }))
}
