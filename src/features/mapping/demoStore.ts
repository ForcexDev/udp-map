import type { Area, Building, BuildingFloor, NavEdgeRow, NavNodeRow } from '@/shared/types/database'
import { sampleRows } from '@/shared/utils/indoor/sampleBuilding'
import type {
  AreaInput,
  BuildingInput,
  FacultyMapping,
  NavEdgeInput,
  NavGraphRows,
  NavNodeInput,
} from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Almacén en memoria del mapeo para el MODO DEMO (sin Supabase).
//
// El mapeo se dibuja, no se inventa: un juego de datos de relleno fue justo el
// error de DEMO_FLOOR_PLANS, que pintaba un edificio a 694 m del real. La única
// excepción es Vergara 432 del prototipo de navegación (`sampleBuilding.ts`):
// sin un edificio con plantas, áreas y grafo, "Cómo llegar" no se puede probar
// sin base. Está en la georreferencia que usó el prototipo, sus salas S312–S515
// existen pero su posición en la planta es supuesta, y sus ids empiezan por
// `demo-v432-` para que no se confundan con lo dibujado.
//
// Reproduce las cascadas de la base a mano, porque son parte del contrato que
// el editor da por hecho: borrar una planta se lleva sus áreas y sus nodos de
// navegación, borrar un edificio se lleva sus plantas, y borrar un nodo, sus
// aristas.
// ─────────────────────────────────────────────────────────────────────────────

const sample = sampleRows('ingenieria')

const buildings: Building[] = [sample.building]
const floors: BuildingFloor[] = [...sample.floors]
const areas: Area[] = [...sample.areas]
const navNodes: NavNodeRow[] = [...sample.nodes]
const navEdges: NavEdgeRow[] = [...sample.edges]

export const mappingDemoDb = {
  snapshot(facultyId?: string): FacultyMapping {
    const scopedBuildings = facultyId
      ? buildings.filter((b) => b.faculty_id === facultyId)
      : buildings
    const ids = new Set(scopedBuildings.map((b) => b.id))
    return {
      buildings: scopedBuildings.map((b) => ({ ...b })),
      floors: floors.filter((f) => ids.has(f.building_id)).map((f) => ({ ...f })),
      areas: (facultyId ? areas.filter((a) => a.faculty_id === facultyId) : areas).map((a) => ({
        ...a,
      })),
    }
  },

  upsertBuilding(input: BuildingInput): Building {
    const building: Building = { ...input, sort_order: input.sort_order ?? 0 }
    const index = buildings.findIndex((b) => b.id === building.id)
    if (index >= 0) buildings[index] = building
    else buildings.push(building)
    return { ...building }
  },

  deleteBuilding(buildingId: string): void {
    remove(buildings, (b) => b.id === buildingId)
    remove(floors, (f) => f.building_id === buildingId)
    remove(areas, (a) => a.building_id === buildingId)
    removeNavNodes((n) => n.building_id === buildingId)
  },

  addFloor(buildingId: string, level: number, label: string | null): BuildingFloor {
    const existing = floors.find((f) => f.building_id === buildingId && f.level === level)
    if (existing) return { ...existing }
    const floor: BuildingFloor = { building_id: buildingId, level, label }
    floors.push(floor)
    return { ...floor }
  },

  updateFloorLabel(buildingId: string, level: number, label: string | null): void {
    const floor = floors.find((f) => f.building_id === buildingId && f.level === level)
    if (floor) floor.label = label
  },

  deleteFloor(buildingId: string, level: number): void {
    remove(floors, (f) => f.building_id === buildingId && f.level === level)
    remove(areas, (a) => a.building_id === buildingId && a.floor === level)
    removeNavNodes((n) => n.building_id === buildingId && n.floor === level)
  },

  createArea(input: AreaInput): Area {
    const area: Area = { id: crypto.randomUUID(), ...input, sort_order: input.sort_order ?? 0 }
    areas.push(area)
    return { ...area }
  },

  updateArea(id: string, patch: Partial<AreaInput>): Area {
    const area = areas.find((a) => a.id === id)
    if (!area) throw new Error('AREA_NOT_FOUND')
    Object.assign(area, patch)
    return { ...area }
  },

  deleteArea(id: string): void {
    remove(areas, (a) => a.id === id)
    // nav_nodes.area_id es ON DELETE SET NULL: el nodo sobrevive sin sala.
    for (const node of navNodes) if (node.area_id === id) node.area_id = null
  },

  // ── Navegación ──

  navSnapshot(facultyId: string): NavGraphRows {
    return {
      nodes: navNodes.filter((n) => n.faculty_id === facultyId).map((n) => ({ ...n })),
      edges: navEdges.filter((e) => e.faculty_id === facultyId).map((e) => ({ ...e })),
    }
  },

  createNavNode(input: NavNodeInput): NavNodeRow {
    const node: NavNodeRow = { ...input, id: input.id ?? crypto.randomUUID() }
    navNodes.push(node)
    return { ...node }
  },

  updateNavNode(id: string, patch: Partial<NavNodeInput>): NavNodeRow {
    const node = navNodes.find((n) => n.id === id)
    if (!node) throw new Error('NAV_NODE_NOT_FOUND')
    Object.assign(node, patch, { id })
    return { ...node }
  },

  deleteNavNodes(ids: string[]): void {
    const gone = new Set(ids)
    removeNavNodes((n) => gone.has(n.id))
  },

  createNavEdge(input: NavEdgeInput): NavEdgeRow {
    // Lo mismo que nav_edges_pair_uniq y nav_edges_stairs_not_step_free.
    const duplicate = navEdges.some(
      (e) => (e.a === input.a && e.b === input.b) || (e.a === input.b && e.b === input.a),
    )
    if (duplicate || input.a === input.b) throw new Error('NAV_EDGE_DUPLICATE')
    if (input.kind === 'stairs' && input.step_free) throw new Error('NAV_EDGE_STAIRS_STEP_FREE')
    const edge: NavEdgeRow = { ...input, id: input.id ?? crypto.randomUUID() }
    navEdges.push(edge)
    return { ...edge }
  },

  deleteNavEdges(ids: string[]): void {
    const gone = new Set(ids)
    remove(navEdges, (e) => gone.has(e.id))
  },
}

function removeNavNodes(match: (node: NavNodeRow) => boolean): void {
  const gone = new Set(navNodes.filter(match).map((n) => n.id))
  if (gone.size === 0) return
  remove(navNodes, (n) => gone.has(n.id))
  remove(navEdges, (e) => gone.has(e.a) || gone.has(e.b))
}

/** Vacía en el sitio: las listas son constantes de módulo y se comparten. */
function remove<T>(list: T[], match: (item: T) => boolean): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (match(list[i])) list.splice(i, 1)
  }
}
