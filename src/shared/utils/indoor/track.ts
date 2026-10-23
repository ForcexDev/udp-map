import { ELEVATOR_PER_FLOOR_S, STAIRS_DOWN_S, STAIRS_UP_S, WALK_SPEED, type NavGraph } from './graph'
import {
  add,
  dist,
  floorSpan,
  indexFromZ,
  length,
  lerp,
  levelIndex,
  levelOfZ,
  scale,
  sub,
  unit,
  zFromIndex,
} from './projection'
import type { NavEdgeKind, Route, Step, Vec2 } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Línea de tiempo de una ruta: dónde está la figura en cada segundo.
//
// `z` es la planta como número continuo (3,5 = a mitad entre el 3 y el 4). Lo
// usan la altura de la figura, la cámara y el selector de planta, que cambia
// solo cuando `z` redondea a la planta siguiente.
//
// Los tiempos salen de las mismas constantes que el costo de la ruta, salvo la
// espera del ascensor: animar 40 s de figura quieta no enseña nada.
// ─────────────────────────────────────────────────────────────────────────────

/** Puertas del ascensor, al subir y al bajar. */
export const ELEVATOR_DOORS_S = 2.5

export interface Keyframe {
  t: number
  p: Vec2
  z: number
  /** Índice de la arista de la ruta que se está recorriendo al llegar aquí. */
  edge: number
  /** Ascensor: la figura no camina mientras dura. */
  still?: boolean
}

export interface Pose {
  p: Vec2
  z: number
  /** Planta discreta: la que debe enseñar el selector. */
  level: number
  /** Rumbo de la marcha. Se conserva en los tramos de largo cero. */
  heading: Vec2
  edge: number
  kind: NavEdgeKind | null
  still: boolean
}

export interface Track {
  keyframes: Keyframe[]
  /** Segundo en que se llega a cada nodo de la ruta. */
  nodeTimes: number[]
  duration: number
  sample(t: number): Pose
}

/** Rectángulo orientado de un hueco de escalera: centro, eje largo y eje corto. */
export interface ShaftRect {
  center: Vec2
  u: Vec2
  v: Vec2
  halfLength: number
  halfWidth: number
}

export interface TrackOptions {
  /** El hueco de la escalera en la planta de ese nodo, para dibujar la U. */
  shaftRect?: (nodeId: string) => ShaftRect | null
}

/** Rectángulo orientado de un anillo, alineado con su lado más largo. */
export function rectFromRing(ring: Vec2[]): ShaftRect | null {
  if (ring.length < 3) return null
  let axis: Vec2 = { x: 1, y: 0 }
  let longest = 0
  for (let i = 0; i < ring.length; i++) {
    const edge = sub(ring[(i + 1) % ring.length], ring[i])
    if (length(edge) > longest) {
      longest = length(edge)
      axis = unit(edge)
    }
  }
  const normal = { x: -axis.y, y: axis.x }
  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (const p of ring) {
    const pu = p.x * axis.x + p.y * axis.y
    const pv = p.x * normal.x + p.y * normal.y
    minU = Math.min(minU, pu)
    maxU = Math.max(maxU, pu)
    minV = Math.min(minV, pv)
    maxV = Math.max(maxV, pv)
  }
  const cu = (minU + maxU) / 2
  const cv = (minV + maxV) / 2
  let rect: ShaftRect = {
    center: add(scale(axis, cu), scale(normal, cv)),
    u: axis,
    v: normal,
    halfLength: (maxU - minU) / 2,
    halfWidth: (maxV - minV) / 2,
  }
  // El eje largo es el de los tramos: si el lado más largo resultó ser el
  // corto del rectángulo (un anillo con un vértice de más), se intercambian.
  if (rect.halfWidth > rect.halfLength) {
    rect = { ...rect, u: normal, v: { x: -normal.y, y: normal.x }, halfLength: rect.halfWidth, halfWidth: rect.halfLength }
  }
  return rect
}

/**
 * El recorrido en U de un piso de escalera, de abajo arriba: descanso → pie del
 * tramo 1 → tope del tramo 1 → descanso intermedio → pie del tramo 2 → tope
 * del tramo 2 → descanso del piso siguiente. Cada punto lleva su avance en
 * pisos (0 → 1). El primer tramo es el de la izquierda mirando hacia el hueco.
 */
export function stairsU(from: Vec2, to: Vec2, rect: ShaftRect | null): { p: Vec2; rise: number }[] {
  if (!rect) return [{ p: from, rise: 0 }, { p: to, rise: 1 }]
  const { center, u, halfLength: hl, halfWidth: hw } = rect
  const footInset = Math.min(1, hl * 2 * 0.15)
  const landing = Math.min(1.5, hl * 2 * 0.25)
  // El extremo del hueco más cercano al descanso es donde empieza el tramo 1.
  const near = (from.x - center.x) * u.x + (from.y - center.y) * u.y >= 0 ? 1 : -1
  const inward = scale(u, -near)
  const left = { x: inward.y, y: -inward.x }
  const lane1 = add(center, scale(left, hw / 2))
  const lane2 = add(center, scale(left, -hw / 2))
  const nearAt = (lane: Vec2) => add(lane, scale(u, near * (hl - footInset)))
  const farAt = (lane: Vec2) => add(lane, scale(u, -near * (hl - landing)))
  return [
    { p: from, rise: 0 },
    { p: nearAt(lane1), rise: 0 },
    { p: farAt(lane1), rise: 0.5 },
    { p: add(center, scale(u, -near * (hl - landing / 2))), rise: 0.5 },
    { p: farAt(lane2), rise: 0.5 },
    { p: nearAt(lane2), rise: 1 },
    { p: to, rise: 1 },
  ]
}

const smoothstep = (f: number) => f * f * (3 - 2 * f)

/** La fracción de tiempo en la que el ascensor suavizado alcanza `target` (0–1). */
function smoothstepInverse(target: number): number {
  let lo = 0
  let hi = 1
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2
    if (smoothstep(mid) < target) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function buildTrack(route: Route, graph: NavGraph, options: TrackOptions = {}): Track {
  const node = (i: number) => graph.node(route.nodes[i])
  const zi = (i: number) => levelIndex(node(i).floor ?? 1)
  const keyframes: Keyframe[] = [{ t: 0, p: node(0).p, z: zFromIndex(zi(0)), edge: 0 }]
  const nodeTimes: number[] = [0]
  let t = 0

  const push = (p: Vec2, index: number, edge: number, still = false) =>
    keyframes.push({ t, p, z: zFromIndex(index), edge, ...(still ? { still: true } : {}) })

  let i = 0
  while (i < route.kinds.length) {
    const kind = route.kinds[i]

    if (kind === 'walk') {
      t += dist(node(i).p, node(i + 1).p) / WALK_SPEED
      push(node(i + 1).p, zi(i + 1), i)
      nodeTimes.push(t)
      i += 1
      continue
    }

    if (kind === 'stairs') {
      const a = zi(i)
      const b = zi(i + 1)
      const up = b > a
      const floors = Math.max(1, Math.abs(b - a))
      // Al bajar se recorre la U de la planta de abajo, al revés.
      const lower = up ? i : i + 1
      const rect = options.shaftRect?.(route.nodes[lower]) ?? null
      const base = up ? stairsU(node(i).p, node(i + 1).p, rect) : stairsU(node(i + 1).p, node(i).p, rect).reverse()
      const path = base.map((s) => ({ p: s.p, rise: up ? s.rise : 1 - s.rise }))
      const seconds = floors * (up ? STAIRS_UP_S : STAIRS_DOWN_S)
      let total = 0
      for (let k = 1; k < path.length; k++) total += dist(path[k - 1].p, path[k].p)
      for (let k = 1; k < path.length; k++) {
        const share = total > 1e-6 ? dist(path[k - 1].p, path[k].p) / total : k === path.length - 1 ? 1 : 0
        t += seconds * share
        push(path[k].p, a + (b - a) * path[k].rise, i)
      }
      nodeTimes.push(t)
      i += 1
      continue
    }

    // Ascensor: un viaje entero, aunque cruce varias plantas, con una sola
    // apertura de puertas al principio y otra al final.
    let j = i
    while (j < route.kinds.length && route.kinds[j] === 'elevator') j += 1
    const z0 = zi(i)
    const z1 = zi(j)
    const span = Math.max(1, floorSpan(node(i).floor ?? 1, node(j).floor ?? 1))
    const travel = span * ELEVATOR_PER_FLOOR_S
    t += ELEVATOR_DOORS_S
    push(node(i).p, z0, i, true)
    const t0 = t
    const samples = Math.max(6, span * 6)
    for (let s = 1; s <= samples; s++) {
      const f = s / samples
      const e = smoothstep(f)
      t = t0 + f * travel
      const leg = Math.min(j - 1, i + Math.floor(e * (j - i)))
      push(lerp(node(i).p, node(j).p, e), z0 + (z1 - z0) * e, leg, true)
    }
    for (let k = i + 1; k <= j; k++) {
      const target = z1 === z0 ? 1 : (zi(k) - z0) / (z1 - z0)
      nodeTimes.push(t0 + smoothstepInverse(Math.max(0, Math.min(1, target))) * travel)
    }
    t = t0 + travel + ELEVATOR_DOORS_S
    push(node(j).p, z1, j - 1, true)
    i = j
  }

  // Rumbo por intervalo, arrastrando el último conocido sobre los de largo cero.
  const headings: Vec2[] = []
  let lastHeading: Vec2 | null = null
  for (let k = 1; k < keyframes.length; k++) {
    const h = sub(keyframes[k].p, keyframes[k - 1].p)
    if (length(h) > 1e-6) lastHeading = h
    headings.push(lastHeading ?? { x: 0, y: 0 })
  }
  const firstReal = headings.find((h) => length(h) > 1e-6) ?? { x: 0, y: -1 }
  for (let k = 0; k < headings.length && length(headings[k]) <= 1e-6; k++) headings[k] = firstReal

  const duration = t

  const sample = (time: number): Pose => {
    const clamped = Math.max(0, Math.min(duration, time))
    let lo = 0
    let hi = keyframes.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (keyframes[mid].t <= clamped) lo = mid
      else hi = mid - 1
    }
    const k0 = keyframes[lo]
    const k1 = keyframes[Math.min(lo + 1, keyframes.length - 1)]
    const span = k1.t - k0.t
    const f = span > 1e-9 ? (clamped - k0.t) / span : 1
    const z = zFromIndex(indexFromZ(k0.z) + (indexFromZ(k1.z) - indexFromZ(k0.z)) * f)
    const heading = headings[Math.min(lo, headings.length - 1)] ?? firstReal
    const edge = k1.edge
    return {
      p: lerp(k0.p, k1.p, f),
      z,
      level: levelOfZ(z),
      heading,
      edge,
      kind: route.kinds[edge] ?? null,
      still: Boolean(k1.still) && lo < keyframes.length - 1,
    }
  }

  return { keyframes, nodeTimes, duration, sample }
}

/** El paso activo: el último cuyo primer nodo ya se alcanzó. */
export function activeStepIndex(steps: Pick<Step, 'from'>[], nodeTimes: number[], t: number): number {
  let active = 0
  for (let i = 0; i < steps.length; i++) {
    if ((nodeTimes[steps[i].from] ?? Infinity) <= t + 1e-6) active = i
  }
  return active
}
