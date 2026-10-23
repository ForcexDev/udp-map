import type { Polygon } from 'geojson'
import { supabase } from '@/shared/lib/supabase'
import type { Area, AreaKind, Building, BuildingFloor, NavEdgeRow, NavNodeRow } from '@/shared/types/database'
import { mappingDemoDb } from './demoStore'

// ─────────────────────────────────────────────────────────────────────────────
// Capa de datos del mapeo interior.
//
// Igual que el resto de features: contra Supabase si hay credenciales, contra un
// almacén en memoria si no (MODO DEMO). Así el editor se puede probar sin base.
//
// Escribir requiere rol moderador o admin; lo impone RLS, no este archivo.
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildingInput {
  id: string
  faculty_id: string
  name: string
  short_name: string | null
  aliases: string[]
  footprint: Polygon
  default_floor: number
  height_m: number | null
  color: string | null
  sort_order?: number
}

export interface AreaInput {
  faculty_id: string
  building_id: string | null
  floor: number | null
  kind: AreaKind
  custom_kind: string | null
  name: string
  polygon: Polygon
  color: string | null
  sort_order?: number
}

/** Todo el mapeo de una facultad en una sola pasada. */
export interface FacultyMapping {
  buildings: Building[]
  floors: BuildingFloor[]
  areas: Area[]
}

export async function fetchFacultyMapping(facultyId: string): Promise<FacultyMapping> {
  if (!supabase) return mappingDemoDb.snapshot(facultyId)

  const [buildingsRes, areasRes] = await Promise.all([
    supabase.from('buildings').select('*').eq('faculty_id', facultyId).order('sort_order'),
    supabase.from('areas').select('*').eq('faculty_id', facultyId).order('sort_order'),
  ])
  if (buildingsRes.error) throw buildingsRes.error
  if (areasRes.error) throw areasRes.error

  const buildings = (buildingsRes.data ?? []) as Building[]

  // Las plantas se piden aparte y solo si hay edificios: un `in` con la lista
  // vacía es un error de sintaxis en PostgREST, no una consulta que devuelve
  // cero filas.
  let floors: BuildingFloor[] = []
  if (buildings.length > 0) {
    const floorsRes = await supabase
      .from('building_floors')
      .select('*')
      .in('building_id', buildings.map((b) => b.id))
      .order('level')
    if (floorsRes.error) throw floorsRes.error
    floors = (floorsRes.data ?? []) as BuildingFloor[]
  }

  return { buildings, floors, areas: (areasRes.data ?? []) as Area[] }
}

/** El mapeo de todas las facultades, para pintarlo en el mapa público. */
export async function fetchAllMapping(): Promise<FacultyMapping> {
  if (!supabase) return mappingDemoDb.snapshot()

  const [buildingsRes, floorsRes, areasRes] = await Promise.all([
    supabase.from('buildings').select('*').order('sort_order'),
    supabase.from('building_floors').select('*').order('level'),
    supabase.from('areas').select('*').order('sort_order'),
  ])
  if (buildingsRes.error) throw buildingsRes.error
  if (floorsRes.error) throw floorsRes.error
  if (areasRes.error) throw areasRes.error

  return {
    buildings: (buildingsRes.data ?? []) as Building[],
    floors: (floorsRes.data ?? []) as BuildingFloor[],
    areas: (areasRes.data ?? []) as Area[],
  }
}

// ── Edificios ───────────────────────────────────────────────────────────────

export async function upsertBuilding(input: BuildingInput): Promise<Building> {
  if (!supabase) return mappingDemoDb.upsertBuilding(input)

  const { data, error } = await supabase
    .from('buildings')
    .upsert({ ...input, sort_order: input.sort_order ?? 0 })
    .select()
    .single()
  if (error) throw error
  return data as Building
}

/** Borra el edificio y, en cascada, sus plantas y las áreas de esas plantas. */
export async function deleteBuilding(buildingId: string): Promise<void> {
  if (!supabase) return mappingDemoDb.deleteBuilding(buildingId)

  const { error } = await supabase.from('buildings').delete().eq('id', buildingId)
  if (error) throw error
}

// ── Plantas ─────────────────────────────────────────────────────────────────

export async function addFloor(
  buildingId: string,
  level: number,
  label: string | null = null,
): Promise<BuildingFloor> {
  if (!supabase) return mappingDemoDb.addFloor(buildingId, level, label)

  const { data, error } = await supabase
    .from('building_floors')
    .insert({ building_id: buildingId, level, label })
    .select()
    .single()
  if (error) throw error
  return data as BuildingFloor
}

export async function updateFloorLabel(
  buildingId: string,
  level: number,
  label: string | null,
): Promise<void> {
  if (!supabase) return mappingDemoDb.updateFloorLabel(buildingId, level, label)

  const { error } = await supabase
    .from('building_floors')
    .update({ label })
    .eq('building_id', buildingId)
    .eq('level', level)
  if (error) throw error
}

/** Se lleva por delante las áreas de esa planta (cascada de la clave foránea). */
export async function deleteFloor(buildingId: string, level: number): Promise<void> {
  if (!supabase) return mappingDemoDb.deleteFloor(buildingId, level)

  const { error } = await supabase
    .from('building_floors')
    .delete()
    .eq('building_id', buildingId)
    .eq('level', level)
  if (error) throw error
}

// ── Áreas ───────────────────────────────────────────────────────────────────

export async function createArea(input: AreaInput): Promise<Area> {
  if (!supabase) return mappingDemoDb.createArea(input)

  const { data, error } = await supabase
    .from('areas')
    .insert({ ...input, sort_order: input.sort_order ?? 0 })
    .select()
    .single()
  if (error) throw error
  return data as Area
}

/** Crea varias de golpe: es lo que hacen "dividir en N" y "copiar planta". */
export async function createAreas(inputs: AreaInput[]): Promise<Area[]> {
  if (inputs.length === 0) return []
  if (!supabase) return inputs.map((input) => mappingDemoDb.createArea(input))

  const { data, error } = await supabase
    .from('areas')
    .insert(inputs.map((input) => ({ ...input, sort_order: input.sort_order ?? 0 })))
    .select()
  if (error) throw error
  return (data ?? []) as Area[]
}

export async function updateArea(id: string, patch: Partial<AreaInput>): Promise<Area> {
  if (!supabase) return mappingDemoDb.updateArea(id, patch)

  const { data, error } = await supabase.from('areas').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as Area
}

export async function deleteArea(id: string): Promise<void> {
  if (!supabase) return mappingDemoDb.deleteArea(id)

  const { error } = await supabase.from('areas').delete().eq('id', id)
  if (error) throw error
}

// ── Navegación interior ─────────────────────────────────────────────────────
//
// El grafo vive aquí y no en `wayfinding`: lo escribe el editor de este mismo
// dominio, y el demo tiene que reproducir las cascadas de plantas y edificios
// que ya reproduce para las áreas. `wayfinding` solo lo lee.

export interface NavGraphRows {
  nodes: NavNodeRow[]
  edges: NavEdgeRow[]
}

/** El id se puede fijar en el cliente: el editor crea nodos y aristas de una pasada. */
export type NavNodeInput = Omit<NavNodeRow, 'id'> & { id?: string }
export type NavEdgeInput = Omit<NavEdgeRow, 'id'> & { id?: string }

export async function fetchNavGraph(facultyId: string): Promise<NavGraphRows> {
  if (!supabase) return mappingDemoDb.navSnapshot(facultyId)

  const [nodesRes, edgesRes] = await Promise.all([
    supabase.from('nav_nodes').select('*').eq('faculty_id', facultyId),
    supabase.from('nav_edges').select('*').eq('faculty_id', facultyId),
  ])
  if (nodesRes.error) throw nodesRes.error
  if (edgesRes.error) throw edgesRes.error
  return { nodes: (nodesRes.data ?? []) as NavNodeRow[], edges: (edgesRes.data ?? []) as NavEdgeRow[] }
}

export async function createNavNodes(inputs: NavNodeInput[]): Promise<NavNodeRow[]> {
  if (inputs.length === 0) return []
  if (!supabase) return inputs.map((input) => mappingDemoDb.createNavNode(input))

  const { data, error } = await supabase.from('nav_nodes').insert(inputs).select()
  if (error) throw error
  return (data ?? []) as NavNodeRow[]
}

export async function updateNavNode(id: string, patch: Partial<NavNodeInput>): Promise<NavNodeRow> {
  if (!supabase) return mappingDemoDb.updateNavNode(id, patch)

  const { data, error } = await supabase.from('nav_nodes').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data as NavNodeRow
}

/** Se lleva por delante sus aristas (cascada de la clave foránea). */
export async function deleteNavNodes(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  if (!supabase) return mappingDemoDb.deleteNavNodes(ids)

  const { error } = await supabase.from('nav_nodes').delete().in('id', ids)
  if (error) throw error
}

/**
 * Una arista repetida en cualquier sentido choca con `nav_edges_pair_uniq`, que
 * es un índice sobre expresiones y no admite `on conflict`. Quien llama filtra
 * las que ya existen.
 */
export async function createNavEdges(inputs: NavEdgeInput[]): Promise<NavEdgeRow[]> {
  if (inputs.length === 0) return []
  if (!supabase) return inputs.map((input) => mappingDemoDb.createNavEdge(input))

  const { data, error } = await supabase.from('nav_edges').insert(inputs).select()
  if (error) throw error
  return (data ?? []) as NavEdgeRow[]
}

export async function deleteNavEdges(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  if (!supabase) return mappingDemoDb.deleteNavEdges(ids)

  const { error } = await supabase.from('nav_edges').delete().in('id', ids)
  if (error) throw error
}
