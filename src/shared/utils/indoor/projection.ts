import { localProjection } from '@/shared/utils/geometry'
import type { Vec2 } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Plano local y plantas.
//
// x = ESTE, y = SUR: el eje y crece hacia abajo, como en la pantalla. Es la
// convención con la que se validaron las instrucciones del prototipo, y el signo
// de `turnAngle` depende de ella. `geometry.localProjection` usa y = norte; aquí
// se invierte una sola vez para no repartir el cambio de signo por el código.
//
// Un plano por facultad basta: con distancias de cientos de metros el error de
// la proyección equirectangular es de milímetros, y la FIC tiene dos edificios
// unidos por un patio que la ruta cruza.
// ─────────────────────────────────────────────────────────────────────────────

export interface LocalPlane {
  toLocal(lng: number, lat: number): Vec2
  toLngLat(p: Vec2): [number, number]
}

export function makeProjection(origin: { lng: number; lat: number }): LocalPlane {
  const base = localProjection(origin.lat, origin.lng)
  return {
    toLocal: (lng, lat) => {
      const { x, y } = base.toXY([lng, lat])
      return { x, y: -y }
    },
    toLngLat: (p) => {
      const [lng, lat] = base.toPosition({ x: p.x, y: -p.y })
      return [lng, lat]
    },
  }
}

/** Plano centrado en el centroide de unos puntos (los nodos de una facultad). */
export function projectionAround(points: { lng: number; lat: number }[]): LocalPlane {
  if (points.length === 0) return makeProjection({ lng: 0, lat: 0 })
  const sum = points.reduce((acc, p) => ({ lng: acc.lng + p.lng, lat: acc.lat + p.lat }), {
    lng: 0,
    lat: 0,
  })
  return makeProjection({ lng: sum.lng / points.length, lat: sum.lat / points.length })
}

// ── Vectores ────────────────────────────────────────────────────────────────

export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k })
export const length = (a: Vec2): number => Math.hypot(a.x, a.y)
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)
export const lerp = (a: Vec2, b: Vec2, f: number): Vec2 => ({
  x: a.x + (b.x - a.x) * f,
  y: a.y + (b.y - a.y) * f,
})

export function unit(a: Vec2): Vec2 {
  const l = length(a)
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l }
}

/** Rumbo geográfico (0 = norte, sentido horario) de un vector local. Lo usa la cámara. */
export const bearingOf = (v: Vec2): number => ((Math.atan2(v.x, -v.y) * 180) / Math.PI + 360) % 360

/**
 * Giro firmado de h1 a h2, en grados. POSITIVO = A LA DERECHA.
 *
 * Con y hacia abajo, el producto cruz positivo es sentido horario, que para
 * quien camina es la derecha. Si cambia la convención de ejes cambia el signo:
 * es el error más fácil de cometer aquí y da todas las instrucciones al revés.
 */
export function turnAngle(h1: Vec2, h2: Vec2): number {
  const cross = h1.x * h2.y - h1.y * h2.x
  const dot = h1.x * h2.x + h1.y * h2.y
  return (Math.atan2(cross, dot) * 180) / Math.PI
}

export type Cardinal = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
const CARDINALS: Cardinal[] = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']

/** El más cercano de los ocho rumbos. */
export function cardinalOf(v: Vec2): Cardinal {
  return CARDINALS[Math.round(bearingOf(v) / 45) % 8]
}

// ── Plantas ─────────────────────────────────────────────────────────────────
//
// La planta 0 no existe: la baja es el 1 y el primer subterráneo el -1. Para
// medir alturas y tramos se pasa a un ÍNDICE continuo sin hueco (1 → 0, 2 → 1,
// -1 → -1). Sin esto, bajar del 1 al -1 contaría dos pisos de escalera.

export const FLOOR_HEIGHT_M = 3.6

export const levelIndex = (level: number): number => (level > 0 ? level - 1 : level)
export const indexLevel = (index: number): number => (index >= 0 ? index + 1 : index)

/** Pisos que se suben o bajan entre dos plantas. */
export const floorSpan = (a: number, b: number): number => Math.abs(levelIndex(a) - levelIndex(b))

/**
 * La planta como número continuo, `z`: 3,5 está a mitad entre el 3 y el 4.
 * Entre el -1 y el 1 se estira sobre el hueco del 0 para seguir siendo monótona.
 */
export function zFromIndex(index: number): number {
  if (index >= 0) return index + 1
  if (index <= -1) return index
  return 2 * index + 1
}

export function indexFromZ(z: number): number {
  if (z >= 1) return z - 1
  if (z <= -1) return z
  return (z - 1) / 2
}

/** La planta discreta en la que se está a una altura `z`. */
export const levelOfZ = (z: number): number => indexLevel(Math.round(indexFromZ(z)))

/** Altura en metros de la planta continua `z`, con `gap` de vista explotada. */
export const zMeters = (z: number, gap = 0): number => indexFromZ(z) * (FLOOR_HEIGHT_M + gap)

// ── Polígonos en el plano ───────────────────────────────────────────────────

export function pointInRing(p: Vec2, ring: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside
  }
  return inside
}

/** Área firmada (shoelace). El signo depende del sentido del anillo. */
export function ringArea(ring: Vec2[]): number {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++)
    sum += ring[j].x * ring[i].y - ring[i].x * ring[j].y
  return sum / 2
}

export function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): { point: Vec2; f: number } {
  const d = sub(b, a)
  const lenSq = d.x * d.x + d.y * d.y
  if (lenSq === 0) return { point: a, f: 0 }
  const f = Math.max(0, Math.min(1, ((p.x - a.x) * d.x + (p.y - a.y) * d.y) / lenSq))
  return { point: { x: a.x + f * d.x, y: a.y + f * d.y }, f }
}

/** Distancia de un punto al borde de un anillo (abierto o cerrado). */
export function distanceToRing(p: Vec2, ring: Vec2[]): number {
  let best = Infinity
  for (let i = 0; i < ring.length; i++) {
    const { point } = closestOnSegment(p, ring[i], ring[(i + 1) % ring.length])
    best = Math.min(best, dist(p, point))
  }
  return best
}
