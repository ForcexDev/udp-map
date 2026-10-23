import type { FilterSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { NavGraph } from '@/shared/utils/indoor/graph'
import { zMeters, type LocalPlane } from '@/shared/utils/indoor/projection'
import type { Pose, ShaftRect } from '@/shared/utils/indoor/track'
import type { Route } from '@/shared/utils/indoor/types'
import { arrowHead, band, circle, collection, EMPTY_COLLECTION, PRISM_PAINT, type Prism } from './shapes'

// ─────────────────────────────────────────────────────────────────────────────
// Capas de la ruta interior: cinta, postes verticales, destino y figura.
//
// Todas llevan el prefijo `indoor-`: así `MapView` no las apaga en modo 2D ni
// las confunde con las cajas de OSM que oculta bajo el edificio.
//
// La figura se actualiza con `setData` en cada frame; es barato porque son
// cuatro polígonos. La cinta solo se recalcula al cambiar la ruta o la
// separación entre pisos.
// ─────────────────────────────────────────────────────────────────────────────

const ROUTE_SOURCE = 'indoor-route'
const TARGET_SOURCE = 'indoor-target'
const FIGURE_SOURCE = 'indoor-figure'
const ROUTE_LAYER = 'indoor-route'
const ROUTE_DIM_LAYER = 'indoor-route-dim'
const TARGET_LAYER = 'indoor-target'
const FIGURE_LAYER = 'indoor-figure'

const RED = '#C22B38'
const RIBBON_WIDTH = 0.55
/** Se alarga la cinta en cada punta para que las esquinas no queden abiertas. */
const RIBBON_EXTEND = 0.27
const POLE_RADIUS = 0.18

/** Cinta y poste de la planta activa enteros; los de otras plantas, al 30 %. */
const onActive = (level: number) =>
  ['any', ['==', ['get', 'level'], level], ['==', ['get', 'part'], 'pole']] as unknown as FilterSpecification

export function ensureRouteLayers(map: MapLibreMap): void {
  for (const id of [ROUTE_SOURCE, TARGET_SOURCE, FIGURE_SOURCE]) {
    if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: EMPTY_COLLECTION })
  }
  if (!map.getLayer(ROUTE_DIM_LAYER)) {
    map.addLayer({
      id: ROUTE_DIM_LAYER,
      type: 'fill-extrusion',
      source: ROUTE_SOURCE,
      paint: { ...PRISM_PAINT, 'fill-extrusion-opacity': 0.3 },
    })
  }
  if (!map.getLayer(ROUTE_LAYER)) {
    map.addLayer({
      id: ROUTE_LAYER,
      type: 'fill-extrusion',
      source: ROUTE_SOURCE,
      paint: { ...PRISM_PAINT, 'fill-extrusion-opacity': 1 },
    })
  }
  for (const [id, source] of [
    [TARGET_LAYER, TARGET_SOURCE],
    [FIGURE_LAYER, FIGURE_SOURCE],
  ]) {
    if (!map.getLayer(id)) {
      map.addLayer({
        id,
        type: 'fill-extrusion',
        source,
        paint: { ...PRISM_PAINT, 'fill-extrusion-opacity': 1 },
      })
    }
  }
}

export function removeRouteLayers(map: MapLibreMap): void {
  for (const id of [FIGURE_LAYER, TARGET_LAYER, ROUTE_LAYER, ROUTE_DIM_LAYER]) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  for (const id of [ROUTE_SOURCE, TARGET_SOURCE, FIGURE_SOURCE]) {
    if (map.getSource(id)) map.removeSource(id)
  }
}

/** La planta activa decide qué tramo se ve entero y cuál atenuado. */
export function setRouteActiveLevel(map: MapLibreMap, level: number): void {
  if (map.getLayer(ROUTE_LAYER)) map.setFilter(ROUTE_LAYER, onActive(level))
  if (map.getLayer(ROUTE_DIM_LAYER)) {
    map.setFilter(ROUTE_DIM_LAYER, ['!', onActive(level)] as unknown as FilterSpecification)
  }
}

export interface RouteDrawing {
  route: Route
  graph: NavGraph
  plane: LocalPlane
  gap: number
  shaftRect: (nodeId: string) => ShaftRect | null
}

export function setRouteData(map: MapLibreMap, { route, graph, plane, gap, shaftRect }: RouteDrawing): void {
  const prisms: Prism[] = []
  const node = (i: number) => graph.node(route.nodes[i])

  let i = 0
  while (i < route.kinds.length) {
    const kind = route.kinds[i]
    if (kind === 'walk') {
      const a = node(i)
      const b = node(i + 1)
      const level = a.floor ?? 1
      const ring = band(a.p, b.p, RIBBON_WIDTH, RIBBON_EXTEND)
      if (ring) {
        const z = zMeters(level, gap)
        prisms.push({ rings: [ring], base: z + 0.14, height: z + 0.2, color: RED, props: { level, part: 'ribbon' } })
      }
      i += 1
      continue
    }
    // Un tramo vertical es un poste delgado en el eje del núcleo. Una caja del
    // tamaño del hueco tapaba la escalera justo cuando la cámara se acercaba.
    let j = i
    while (j < route.kinds.length && route.kinds[j] === kind) j += 1
    const from = node(i)
    const to = node(j)
    const low = Math.min(zMeters(from.floor ?? 1, gap), zMeters(to.floor ?? 1, gap))
    const high = Math.max(zMeters(from.floor ?? 1, gap), zMeters(to.floor ?? 1, gap))
    const axis = shaftRect(from.id)?.center ?? from.p
    prisms.push({
      rings: [circle(axis, POLE_RADIUS, 10)],
      base: low + 0.14,
      height: high + 0.2,
      color: RED,
      props: { level: from.floor ?? 1, part: 'pole' },
    })
    i = j
  }

  ;(map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined)?.setData(collection(prisms, plane))

  const target = node(route.nodes.length - 1)
  const zt = zMeters(target.floor ?? 1, gap)
  ;(map.getSource(TARGET_SOURCE) as GeoJSONSource | undefined)?.setData(
    collection(
      [
        { rings: [circle(target.p, 0.5)], base: zt, height: zt + 2.4, color: RED },
        { rings: [circle(target.p, 0.85)], base: zt + 2.4, height: zt + 2.55, color: '#FAF8F5' },
      ],
      plane,
    ),
  )
}

/**
 * La figura: halo en el suelo, "nariz" hacia el rumbo, cuerpo y cabeza. En el
 * ascensor, además, la cabina: una losa amarilla que sube con ella.
 */
export function setFigure(map: MapLibreMap, pose: Pose, plane: LocalPlane, gap: number): void {
  const z = zMeters(pose.z, gap)
  const prisms: Prism[] = [
    { rings: [circle(pose.p, 0.85, 18)], base: z + 0.02, height: z + 0.06, color: '#F4C2C6' },
    { rings: [arrowHead(pose.p, pose.heading, 1.25, 0.38)], base: z + 0.02, height: z + 0.09, color: RED },
    { rings: [circle(pose.p, 0.3)], base: z + 0.08, height: z + 1.1, color: RED },
    { rings: [circle(pose.p, 0.22)], base: z + 1.15, height: z + 1.55, color: '#FAF8F5' },
  ]
  if (pose.kind === 'elevator') {
    const half = 0.8
    prisms.push({
      rings: [
        [
          { x: pose.p.x - half, y: pose.p.y - half },
          { x: pose.p.x + half, y: pose.p.y - half },
          { x: pose.p.x + half, y: pose.p.y + half },
          { x: pose.p.x - half, y: pose.p.y + half },
        ],
      ],
      base: z - 0.12,
      height: z,
      color: '#F5C542',
    })
  }
  ;(map.getSource(FIGURE_SOURCE) as GeoJSONSource | undefined)?.setData(collection(prisms, plane))
}
