import type { Polygon, Position } from 'geojson'

export interface LatLng {
  lat: number
  lng: number
}

export type Bounds = { west: number; south: number; east: number; north: number }

const EARTH_RADIUS_M = 6371000

/** Distancia haversine en metros. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

export function isInBounds(p: LatLng, b: Bounds): boolean {
  return p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east
}

/** Expande los bounds un factor (para no refetchear en cada pequeño paneo). */
export function padBounds(b: Bounds, factor = 0.5): Bounds {
  const dLat = (b.north - b.south) * factor
  const dLng = (b.east - b.west) * factor
  return {
    west: b.west - dLng,
    south: b.south - dLat,
    east: b.east + dLng,
    north: b.north + dLat,
  }
}

/** Ray casting sobre un anillo GeoJSON ([lng, lat]). */
function isInRing(p: LatLng, ring: Position[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const cruza =
      yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi
    if (cruza) inside = !inside
  }
  return inside
}

/** Punto dentro de un Polygon GeoJSON (anillo exterior menos agujeros). */
export function isPointInPolygon(p: LatLng, polygon: Polygon): boolean {
  const [outer, ...holes] = polygon.coordinates
  if (!outer || !isInRing(p, outer)) return false
  return !holes.some((hole) => isInRing(p, hole))
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

const WALKING_SPEED_M_S = 1.3

/** Duración caminando estimada, en segundos. */
export function walkingSeconds(meters: number): number {
  return meters / WALKING_SPEED_M_S
}
