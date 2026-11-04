import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { FillExtrusionLayerSpecification } from 'maplibre-gl'
import { add, length, scale, sub, unit, type LocalPlane } from '@/shared/utils/indoor/projection'
import type { Vec2 } from '@/shared/utils/indoor/types'

// ─────────────────────────────────────────────────────────────────────────────
// Formas en metros para `fill-extrusion`.
//
// Todo lo 3D del interior —losa, muro, peldaño, cinta de ruta, figura— es un
// polígono con su `base` y su `height`: MapLibre no levanta otra cosa del suelo
// sin un renderer propio, y basta. Se construye en el plano local y se pasa a
// lng/lat al final, igual que el resto de la navegación.
// ─────────────────────────────────────────────────────────────────────────────

export interface Prism {
  rings: Vec2[][]
  base: number
  height: number
  color: string
  props?: Record<string, string | number>
}

export function circle(center: Vec2, radius: number, segments = 14): Vec2[] {
  const ring: Vec2[] = []
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    ring.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius })
  }
  return ring
}

/** Rectángulo de ancho `width` a lo largo de a→b, alargado `extend` en cada punta. */
export function band(a: Vec2, b: Vec2, width: number, extend = 0): Vec2[] | null {
  const d = sub(b, a)
  if (length(d) < 1e-6) return null
  const u = unit(d)
  const n = { x: -u.y * (width / 2), y: u.x * (width / 2) }
  const start = sub(a, scale(u, extend))
  const end = add(b, scale(u, extend))
  return [add(start, n), add(end, n), sub(end, n), sub(start, n)]
}

/** Triángulo con la punta hacia `heading`: la "nariz" de la figura. */
export function arrowHead(center: Vec2, heading: Vec2, reach: number, halfWidth: number): Vec2[] {
  const u = length(heading) < 1e-6 ? { x: 0, y: -1 } : unit(heading)
  const n = { x: -u.y, y: u.x }
  const back = add(center, scale(u, reach * 0.5))
  return [
    add(center, scale(u, reach)),
    add(back, scale(n, halfWidth)),
    sub(back, scale(n, halfWidth)),
  ]
}

function closed(ring: Vec2[], plane: LocalPlane): [number, number][] {
  const coords = ring.map((p) => plane.toLngLat(p))
  return [...coords, coords[0]]
}

export function prismFeature(prism: Prism, plane: LocalPlane): Feature<Polygon> {
  return {
    type: 'Feature',
    properties: { base: prism.base, height: prism.height, color: prism.color, ...prism.props },
    geometry: { type: 'Polygon', coordinates: prism.rings.map((r) => closed(r, plane)) },
  }
}

export function collection(prisms: Prism[], plane: LocalPlane): FeatureCollection<Polygon> {
  return { type: 'FeatureCollection', features: prisms.map((p) => prismFeature(p, plane)) }
}

export const EMPTY_COLLECTION: FeatureCollection = { type: 'FeatureCollection', features: [] }

/** La pintura común de todas las capas: cada objeto trae su base, altura y color. */
export const PRISM_PAINT: NonNullable<FillExtrusionLayerSpecification['paint']> = {
  'fill-extrusion-color': ['get', 'color'],
  'fill-extrusion-base': ['get', 'base'],
  'fill-extrusion-height': ['get', 'height'],
  'fill-extrusion-vertical-gradient': false,
}

/** Mezcla un color con otro: apaga los tonos de área para que el suelo no grite. */
export function mix(hex: string, with_: string, amount: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const a = parse(hex)
  const b = parse(with_)
  const out = a.map((v, i) => Math.round(v + (b[i] - v) * amount))
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

/** Texto de la base dentro del HTML de una etiqueta. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}
