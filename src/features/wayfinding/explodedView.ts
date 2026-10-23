import type { FilterSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import { create } from 'zustand'
import { AREA_STYLES } from '@/features/mapping/areaStyles'
import type { AreaKind } from '@/shared/types/database'
import type { NavGraph } from '@/shared/utils/indoor/graph'
import {
  closestOnSegment,
  dist,
  levelIndex,
  pointInRing,
  ringArea,
  sub,
  zMeters,
  FLOOR_HEIGHT_M,
  type LocalPlane,
} from '@/shared/utils/indoor/projection'
import { rectFromRing, stairsU, type ShaftRect } from '@/shared/utils/indoor/track'
import type { IndoorArea, NavNode, Vec2 } from '@/shared/utils/indoor/types'
import { band, collection, EMPTY_COLLECTION, mix, PRISM_PAINT, type Prism } from './shapes'

// ─────────────────────────────────────────────────────────────────────────────
// El edificio por dentro, planta a planta, en 3D.
//
// Vista explotada = sumar un `gap` a la altura de cada planta: la del piso L
// está a (L − 1) · (3,6 m + gap). Con gap 0 el edificio se ve como es, que es
// lo que usa la navegación; separar los pisos solo anima ese número.
//
// Una capa por planta y no una para todo: `fill-extrusion-opacity` es de la
// capa, no admite expresiones por objeto, y cada planta necesita la suya.
// ─────────────────────────────────────────────────────────────────────────────

export const EXPLODED_GAP_M = 7
export const GAP_ANIMATION_MS = 650

const SOURCE = 'indoor-floors'
const LAYER_PREFIX = 'indoor-floor-'
const layerId = (level: number) => `${LAYER_PREFIX}${level}`

const SLAB_DEPTH = 0.35
const WALL_HEIGHT = 1.3
const WALL_THICKNESS = 0.18
const STEPS_PER_FLIGHT = 10
/** Una puerta a esta distancia de un borde corta ese muro. */
const DOOR_ON_WALL_M = 0.3
/** Un hueco de escalera o ascensor es un recinto chico; un hall no lo es. */
const SHAFT_MAX_M2 = 80

/** Áreas abiertas: sin muros, para que el pasillo se lea como pasillo. */
const OPEN_KINDS = new Set<string>(['corridor', 'hall', 'courtyard', 'sports', 'parking', 'green'])

/**
 * La separación que se está viendo ahora mismo, animada. La leen la escena y la
 * cinta de la ruta: las dos tienen que subir a la vez o la ruta flotaría.
 */
export const useIndoorGap = create<{ gap: number; setGap: (gap: number) => void }>((set) => ({
  gap: 0,
  setGap: (gap) => set({ gap }),
}))

export interface SceneBuilding {
  id: string
  footprint: Vec2[]
  levels: number[]
}

export interface SceneInput {
  buildings: SceneBuilding[]
  areas: IndoorArea[]
  graph: NavGraph | null
  gap: number
  dark: boolean
}

/** El hueco de un núcleo en su planta: el área chica que contiene su nodo. */
export function shaftRectResolver(graph: NavGraph | null, areas: IndoorArea[]) {
  const cache = new Map<string, ShaftRect | null>()
  return (nodeId: string): ShaftRect | null => {
    if (cache.has(nodeId)) return cache.get(nodeId)!
    const node = graph?.nodes.get(nodeId)
    let rect: ShaftRect | null = null
    if (node && node.floor !== null) {
      const shaft = areas
        .filter(
          (a) =>
            a.buildingId === node.buildingId &&
            a.floor === node.floor &&
            pointInRing(node.p, a.ring) &&
            Math.abs(ringArea(a.ring)) <= SHAFT_MAX_M2,
        )
        .sort((a, b) => Math.abs(ringArea(a.ring)) - Math.abs(ringArea(b.ring)))[0]
      rect = shaft ? rectFromRing(shaft.ring) : null
    }
    cache.set(nodeId, rect)
    return rect
  }
}

function palette(dark: boolean) {
  return dark
    ? { base: '#1E222D', slab: '#2B303C', wall: '#3B4150', step: '#4A5163' }
    : { base: '#FAF8F5', slab: '#E4DDD0', wall: '#D2CABB', step: '#BBB2A2' }
}

export function buildFloorPrisms({ buildings, areas, graph, gap, dark }: SceneInput): Prism[] {
  const colors = palette(dark)
  const prisms: Prism[] = []
  const shaftRect = shaftRectResolver(graph, areas)
  const nodes = graph ? [...graph.nodes.values()] : []

  for (const building of buildings) {
    const lowest = Math.min(...building.levels)
    for (const level of building.levels) {
      const z = zMeters(level, gap)
      const props = { level }
      const floorAreas = areas.filter((a) => a.buildingId === building.id && a.floor === level)
      const floorNodes = nodes.filter((n) => n.buildingId === building.id && n.floor === level)

      // Losa. Desde la segunda planta, con agujeros en los núcleos: si no, la
      // losa de arriba tapa los peldaños y no se ve a la figura subir.
      const holes =
        level === lowest
          ? []
          : floorNodes
              .filter((n) => n.kind === 'stairs' || n.kind === 'elevator')
              .map((n) => shaftRect(n.id))
              .filter((r): r is ShaftRect => r !== null)
              .map(rectRing)
      prisms.push({ rings: [building.footprint, ...holes], base: z - SLAB_DEPTH, height: z, color: colors.slab, props })

      for (const area of floorAreas) {
        const style = AREA_STYLES[area.kind as AreaKind] ?? AREA_STYLES.other
        prisms.push({
          rings: [area.ring],
          base: z,
          height: z + 0.05,
          color: mix(style.color, colors.base, dark ? 0.5 : 0.6),
          props,
        })
        if (OPEN_KINDS.has(area.kind)) continue
        const doors = floorNodes.filter((n) => n.kind === 'door' || n.kind === 'entrance')
        for (const wall of wallSegments(area.ring, doors)) {
          const ring = band(wall[0], wall[1], WALL_THICKNESS)
          if (ring) prisms.push({ rings: [ring], base: z + 0.05, height: z + WALL_HEIGHT, color: colors.wall, props })
        }
      }

      // Peldaños hasta la planta siguiente: llegan a (3,6 + gap) para cubrir
      // el hueco también cuando los pisos están separados.
      for (const stairs of floorNodes.filter((n) => n.kind === 'stairs')) {
        if (!graph || !leadsUp(graph, stairs)) continue
        const rect = shaftRect(stairs.id)
        if (rect) prisms.push(...stepPrisms(stairs.p, rect, z, FLOOR_HEIGHT_M + gap, colors.step, props))
      }
    }
  }
  return prisms
}

function rectRing(rect: ShaftRect): Vec2[] {
  const { center: c, u, v, halfLength: l, halfWidth: w } = rect
  const at = (a: number, b: number) => ({ x: c.x + u.x * a + v.x * b, y: c.y + u.y * a + v.y * b })
  return [at(-l, -w), at(l, -w), at(l, w), at(-l, w)]
}

function leadsUp(graph: NavGraph, stairs: NavNode): boolean {
  return graph
    .neighbors(stairs.id)
    .some(({ to, edge }) => edge.kind === 'stairs' && levelIndex(graph.node(to).floor ?? 1) > levelIndex(stairs.floor ?? 1))
}

/** Los bordes de un recinto, con un corte en cada puerta que cae sobre ellos. */
export function wallSegments(ring: Vec2[], doors: NavNode[]): [Vec2, Vec2][] {
  const walls: [Vec2, Vec2][] = []
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const length = dist(a, b)
    if (length < 1e-6) continue
    const cuts: [number, number][] = []
    for (const door of doors) {
      const { point, f } = closestOnSegment(door.p, a, b)
      if (dist(point, door.p) > DOOR_ON_WALL_M) continue
      const half = (door.widthM ?? 0.9) / 2 / length
      cuts.push([Math.max(0, f - half), Math.min(1, f + half)])
    }
    cuts.sort((x, y) => x[0] - y[0])
    let from = 0
    const at = (f: number) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f })
    for (const [start, end] of cuts) {
      if (start > from) walls.push([at(from), at(start)])
      from = Math.max(from, end)
    }
    if (from < 1) walls.push([at(from), at(1)])
  }
  return walls
}

function stepPrisms(
  landing: Vec2,
  rect: ShaftRect,
  z: number,
  storey: number,
  color: string,
  props: Record<string, number>,
): Prism[] {
  const u = stairsU(landing, landing, rect)
  // [descanso, pie 1, tope 1, descanso medio, pie 2, tope 2, descanso]
  const flights: [Vec2, Vec2, number][] = [
    [u[1].p, u[2].p, 0],
    [u[4].p, u[5].p, 0.5],
  ]
  const width = rect.halfWidth - 0.1
  const prisms: Prism[] = []
  for (const [from, to, rise] of flights) {
    const run = sub(to, from)
    for (let k = 0; k < STEPS_PER_FLIGHT; k++) {
      const f0 = k / STEPS_PER_FLIGHT
      const f1 = (k + 1) / STEPS_PER_FLIGHT
      const a = { x: from.x + run.x * f0, y: from.y + run.y * f0 }
      const b = { x: from.x + run.x * f1, y: from.y + run.y * f1 }
      const ring = band(a, b, width)
      const top = z + storey * (rise + 0.5 * f1)
      if (ring) prisms.push({ rings: [ring], base: top - 0.22, height: top, color, props })
    }
  }
  // Descanso intermedio, a media altura.
  const mid = u[3].p
  const ring = band(
    { x: mid.x - rect.v.x * rect.halfWidth, y: mid.y - rect.v.y * rect.halfWidth },
    { x: mid.x + rect.v.x * rect.halfWidth, y: mid.y + rect.v.y * rect.halfWidth },
    Math.min(1.5, rect.halfLength * 0.5),
  )
  if (ring) prisms.push({ rings: [ring], base: z + storey * 0.5 - 0.22, height: z + storey * 0.5, color, props })
  return prisms
}

// ── Capas ───────────────────────────────────────────────────────────────────

export function setFloorData(map: MapLibreMap, prisms: Prism[], plane: LocalPlane, levels: number[]): void {
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: EMPTY_COLLECTION })
  // Se dibujan de abajo arriba: con opacidades parciales el orden de capa
  // decide qué se ve a través de qué.
  const wanted = new Set(levels.map(layerId))
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.id.startsWith(LAYER_PREFIX) && !wanted.has(layer.id)) map.removeLayer(layer.id)
  }
  for (const level of [...levels].sort((a, b) => levelIndex(a) - levelIndex(b))) {
    if (map.getLayer(layerId(level))) continue
    map.addLayer({
      id: layerId(level),
      type: 'fill-extrusion',
      source: SOURCE,
      filter: ['==', ['get', 'level'], level] as unknown as FilterSpecification,
      paint: { ...PRISM_PAINT, 'fill-extrusion-opacity': 1 },
    })
  }
  ;(map.getSource(SOURCE) as GeoJSONSource).setData(collection(prisms, plane))
}

/**
 * La planta activa entera; las de abajo, a media luz; las de arriba casi
 * transparentes para no tapar. Navegando se apagan más: lo que importa es la
 * planta por la que va la figura.
 */
export function floorOpacity(level: number, active: number, navigating: boolean, separated: boolean): number {
  if (level === active) return 1
  if (levelIndex(level) < levelIndex(active)) return navigating ? 0.22 : 0.4
  if (navigating) return 0.05
  return separated ? 0.28 : 0.12
}

export function setFloorOpacities(map: MapLibreMap, levels: number[], active: number, navigating: boolean, separated: boolean) {
  for (const level of levels) {
    if (!map.getLayer(layerId(level))) continue
    map.setPaintProperty(layerId(level), 'fill-extrusion-opacity', floorOpacity(level, active, navigating, separated))
  }
}

export function removeFloorLayers(map: MapLibreMap): void {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.id.startsWith(LAYER_PREFIX)) map.removeLayer(layer.id)
  }
  if (map.getSource(SOURCE)) map.removeSource(SOURCE)
}
