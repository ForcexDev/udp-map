import type { Area, Building, BuildingFloor } from '@/shared/types/database'
import type { AreaInput, BuildingInput, FacultyMapping } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Almacén en memoria del mapeo para el MODO DEMO (sin Supabase).
//
// Arranca vacío a propósito: el mapeo se dibuja, no se inventa. Un juego de
// datos de relleno sería justo el error que ya cometió DEMO_FLOOR_PLANS, que
// pintaba un edificio a 694 m del real.
//
// Reproduce las cascadas de la base a mano, porque son parte del contrato que
// el editor da por hecho: borrar una planta se lleva sus áreas, y borrar un
// edificio se lleva sus plantas.
// ─────────────────────────────────────────────────────────────────────────────

const buildings: Building[] = []
const floors: BuildingFloor[] = []
const areas: Area[] = []

export const mappingDemoDb = {
  snapshot(facultyId?: string): FacultyMapping {
    const scopedBuildings = facultyId ? buildings.filter((b) => b.faculty_id === facultyId) : buildings
    const ids = new Set(scopedBuildings.map((b) => b.id))
    return {
      buildings: scopedBuildings.map((b) => ({ ...b })),
      floors: floors.filter((f) => ids.has(f.building_id)).map((f) => ({ ...f })),
      areas: (facultyId ? areas.filter((a) => a.faculty_id === facultyId) : areas).map((a) => ({ ...a })),
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
  },
}

/** Vacía en el sitio: las listas son constantes de módulo y se comparten. */
function remove<T>(list: T[], match: (item: T) => boolean): void {
  for (let i = list.length - 1; i >= 0; i--) {
    if (match(list[i])) list.splice(i, 1)
  }
}
