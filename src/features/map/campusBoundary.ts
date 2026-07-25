import type { Map as MapLibreMap, LngLatBoundsLike } from 'maplibre-gl'
import type { Feature, Polygon } from 'geojson'
import { CAMPUSES, FACULTIES } from '@/shared/data/campusData'

// ─────────────────────────────────────────────────────────────────
// Límite RECTANGULAR del mapa: el rectángulo mínimo que contiene TODAS
// las facultades y campus (Ejército, República y Huechuraba) + margen.
// Se usa para:
//   1. maxBounds + minZoom → impedir panear/alejar fuera del rectángulo.
//      MapLibre mantiene el viewport dentro de estos límites, así que
//      nunca solicita tiles fuera del área.
//   2. Una máscara (mundo con un agujero rectangular) que tapa
//      visualmente cualquier resto que quede fuera del rectángulo.
// El rectángulo se calcula a partir de las coordenadas reales, de modo
// que si se agrega/mueve una facultad el límite se ajusta solo.
// ─────────────────────────────────────────────────────────────────

const M_PER_DEG_LAT = 110_540
const mPerDegLng = (lat: number) => 111_320 * Math.cos((lat * Math.PI) / 180)

/** Margen (en metros) que se agrega alrededor del punto más externo. */
const MARGIN_M = 5000

/** Rectángulo mínimo (con margen) que envuelve todas las facultades/campus. */
export const BOUNDARY_RECT = (() => {
  const points = [
    ...FACULTIES.map((f) => ({ lat: f.lat, lng: f.lng })),
    ...CAMPUSES.map((c) => ({ lat: c.lat, lng: c.lng })),
  ]
  let minLat = Infinity
  let maxLat = -Infinity
  let minLng = Infinity
  let maxLng = -Infinity
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  }
  const midLat = (minLat + maxLat) / 2
  const dLat = MARGIN_M / M_PER_DEG_LAT
  const dLng = MARGIN_M / mPerDegLng(midLat)
  return {
    west: minLng - dLng,
    south: minLat - dLat,
    east: maxLng + dLng,
    north: maxLat + dLat,
  }
})()

/**
 * Límites rectangulares para `maxBounds`. Formato [[west, south], [east, north]].
 * Al fijarlo, MapLibre no deja panear ni alejar fuera del rectángulo, por lo que
 * tampoco pide tiles fuera de él.
 */
export const BOUNDARY_MAX_BOUNDS: LngLatBoundsLike = [
  [BOUNDARY_RECT.west, BOUNDARY_RECT.south],
  [BOUNDARY_RECT.east, BOUNDARY_RECT.north],
]

export function isLocationOutOfBounds(lat: number, lng: number): boolean {
  return lat < BOUNDARY_RECT.south || lat > BOUNDARY_RECT.north || lng < BOUNDARY_RECT.west || lng > BOUNDARY_RECT.east
}

/**
 * Zoom mínimo: no permitir alejar más allá de ver el rectángulo completo.
 * `maxBounds` ya impide mostrar el exterior; este valor es un piso de seguridad.
 */
export const BOUNDARY_MIN_ZOOM = 11.0

/** Anillo del rectángulo (lng/lat). `clockwise` para usarlo como agujero. */
function rectRing(clockwise = false): [number, number][] {
  const { west, south, east, north } = BOUNDARY_RECT
  // CCW por defecto (exterior de un polígono); invertido para un agujero.
  const ccw: [number, number][] = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ]
  return clockwise ? [...ccw].reverse() : ccw
}

/** Polígono del rectángulo como Feature (para el borde). */
function boundaryRectGeoJSON(): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [rectRing(false)] },
  }
}

/**
 * Máscara: rectángulo mundial con un agujero rectangular. Rellenar de un color
 * opaco tapa todo lo que quede fuera del área de la U.
 */
function boundaryMaskGeoJSON(): Feature<Polygon> {
  const world: [number, number][] = [
    [-180, -85],
    [180, -85],
    [180, 85],
    [-180, 85],
    [-180, -85],
  ]
  return {
    type: 'Feature',
    properties: {},
    // Anillo exterior CCW (mundo) + agujero CW (rectángulo).
    geometry: { type: 'Polygon', coordinates: [world, rectRing(true)] },
  }
}

const MASK_SOURCE = 'campus-boundary-mask'
const MASK_LAYER = 'campus-boundary-mask-fill'
const LINE_SOURCE = 'campus-boundary-line'
const LINE_LAYER = 'campus-boundary-line-layer'

/**
 * Agrega la máscara rectangular y el borde al estilo cargado. Idempotente:
 * puede re-llamarse tras un cambio de estilo. `dark` ajusta el color del
 * área exterior para que combine con el tema.
 */
export function addBoundaryMask(map: MapLibreMap, dark: boolean) {
  const maskColor = dark ? '#0b0e14' : '#eaeef2'

  if (!map.getSource(MASK_SOURCE)) {
    map.addSource(MASK_SOURCE, { type: 'geojson', data: boundaryMaskGeoJSON() })
  }
  if (!map.getLayer(MASK_LAYER)) {
    map.addLayer({
      id: MASK_LAYER,
      type: 'fill',
      source: MASK_SOURCE,
      paint: { 'fill-color': maskColor, 'fill-opacity': 1 },
    })
  } else {
    map.setPaintProperty(MASK_LAYER, 'fill-color', maskColor)
  }

  if (!map.getSource(LINE_SOURCE)) {
    map.addSource(LINE_SOURCE, { type: 'geojson', data: boundaryRectGeoJSON() })
  }
  if (!map.getLayer(LINE_LAYER)) {
    map.addLayer({
      id: LINE_LAYER,
      type: 'line',
      source: LINE_SOURCE,
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': dark ? '#94a3b8' : '#64748b',
        'line-width': 2,
        'line-dasharray': [3, 2],
        'line-opacity': 0.7,
      },
    })
  } else {
    map.setPaintProperty(LINE_LAYER, 'line-color', dark ? '#94a3b8' : '#64748b')
  }
}
