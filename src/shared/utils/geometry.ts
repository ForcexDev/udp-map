import type { Polygon, Position } from 'geojson'

// ─────────────────────────────────────────────────────────────────────────────
// Geometría para el editor de mapeo.
//
// Todo el trabajo fino —áreas, distancias, imanes, ángulos rectos— se hace en
// METROS, no en grados. Un grado de longitud mide ~93 km en Santiago y uno de
// latitud ~111 km, así que operar en grados deforma cualquier ángulo y hace que
// un "cuadrado" salga rectangular. La solución es proyectar a un plano local
// centrado en la zona de trabajo, operar ahí, y volver.
//
// La proyección es equirectangular: a escala de campus (cientos de metros) el
// error es de milímetros, y a cambio es invertible exactamente y no arrastra
// dependencias.
// ─────────────────────────────────────────────────────────────────────────────

const M_PER_DEG_LAT = 111_320

export interface XY {
  x: number
  y: number
}

export interface Projection {
  toXY(position: Position): XY
  toPosition(p: XY): Position
}

/** Plano local en metros con origen en (lat, lng). */
export function localProjection(lat: number, lng: number): Projection {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180)
  return {
    toXY: ([lo, la]) => ({ x: (lo - lng) * mPerDegLng, y: (la - lat) * M_PER_DEG_LAT }),
    toPosition: ({ x, y }) => [lng + x / mPerDegLng, lat + y / M_PER_DEG_LAT],
  }
}

/** Proyección centrada en el primer vértice del anillo exterior. */
export function projectionForPolygon(polygon: Polygon): Projection {
  const [first] = polygon.coordinates[0] ?? [[0, 0]]
  return localProjection(first[1], first[0])
}

/**
 * Un anillo GeoJSON se cierra repitiendo el primer punto al final. Para
 * calcular sobre él conviene la lista SIN ese duplicado; para guardarlo, CON él.
 * Estas dos funciones son el puente entre ambas formas.
 */
export function openRing(ring: Position[]): Position[] {
  if (ring.length < 2) return [...ring]
  const [first] = ring
  const last = ring[ring.length - 1]
  const closed = first[0] === last[0] && first[1] === last[1]
  return closed ? ring.slice(0, -1) : [...ring]
}

export function closeRing(ring: Position[]): Position[] {
  if (ring.length < 3) return [...ring]
  const [first] = ring
  const last = ring[ring.length - 1]
  if (first[0] === last[0] && first[1] === last[1]) return [...ring]
  return [...ring, [first[0], first[1]]]
}

/** Polígono GeoJSON de un anillo abierto, cerrándolo. */
export function polygonFromRing(ring: Position[]): Polygon {
  return { type: 'Polygon', coordinates: [closeRing(ring)] }
}

// ── Medidas ─────────────────────────────────────────────────────────────────

function shoelace(points: XY[]): number {
  let sum = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j].x * points[i].y - points[i].x * points[j].y
  }
  return sum / 2
}

/**
 * Superficie en m². Los agujeros del polígono restan.
 * El valor absoluto de la fórmula del zapatero no depende del sentido de giro.
 */
export function polygonAreaM2(polygon: Polygon): number {
  const proj = projectionForPolygon(polygon)
  const [outer, ...holes] = polygon.coordinates
  if (!outer) return 0
  const area = Math.abs(shoelace(openRing(outer).map(proj.toXY)))
  return holes.reduce((acc, hole) => acc - Math.abs(shoelace(openRing(hole).map(proj.toXY))), area)
}

/** Perímetro del anillo exterior en metros. */
export function polygonPerimeterM(polygon: Polygon): number {
  const proj = projectionForPolygon(polygon)
  const ring = openRing(polygon.coordinates[0] ?? []).map(proj.toXY)
  let total = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    total += Math.hypot(b.x - a.x, b.y - a.y)
  }
  return total
}

/** Distancia en metros entre dos coordenadas, para tolerancias cortas. */
export function metersBetween(a: Position, b: Position): number {
  const proj = localProjection(a[1], a[0])
  const p = proj.toXY(b)
  return Math.hypot(p.x, p.y)
}

/** Centroide por área del anillo exterior; cae al promedio si el área es nula. */
export function polygonCentroid(polygon: Polygon): Position {
  const proj = projectionForPolygon(polygon)
  const ring = openRing(polygon.coordinates[0] ?? []).map(proj.toXY)
  if (ring.length === 0) return [0, 0]

  const area = shoelace(ring)
  if (Math.abs(area) < 1e-9) {
    const sum = ring.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 })
    return proj.toPosition({ x: sum.x / ring.length, y: sum.y / ring.length })
  }

  let cx = 0
  let cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j].x * ring[i].y - ring[i].x * ring[j].y
    cx += (ring[j].x + ring[i].x) * cross
    cy += (ring[j].y + ring[i].y) * cross
  }
  return proj.toPosition({ x: cx / (6 * area), y: cy / (6 * area) })
}

// ── Segmentos ───────────────────────────────────────────────────────────────

function closestOnSegmentXY(p: XY, a: XY, b: XY): XY {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return a
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  return { x: a.x + t * dx, y: a.y + t * dy }
}

export interface EdgeHit {
  /** Punto más cercano sobre la arista. */
  position: Position
  distanceM: number
  /** Índice del vértice donde empieza la arista, en el anillo abierto. */
  edgeIndex: number
}

/** Punto más cercano del contorno de un polígono, con la arista donde cayó. */
export function closestPointOnPolygon(polygon: Polygon, target: Position): EdgeHit | null {
  const proj = localProjection(target[1], target[0])
  const ring = openRing(polygon.coordinates[0] ?? [])
  if (ring.length < 2) return null

  const t = proj.toXY(target)
  let best: EdgeHit | null = null

  for (let i = 0; i < ring.length; i++) {
    const a = proj.toXY(ring[i])
    const b = proj.toXY(ring[(i + 1) % ring.length])
    const c = closestOnSegmentXY(t, a, b)
    const distanceM = Math.hypot(c.x - t.x, c.y - t.y)
    if (!best || distanceM < best.distanceM) {
      best = { position: proj.toPosition(c), distanceM, edgeIndex: i }
    }
  }
  return best
}

// ── Imanes ──────────────────────────────────────────────────────────────────

export interface SnapResult {
  position: Position
  /** `vertex` gana sobre `edge`: pegarse a una esquina existente es más fuerte. */
  kind: 'vertex' | 'edge'
  distanceM: number
}

/**
 * Pega un punto al vértice o la arista más cercana de los polígonos de
 * referencia, si hay alguno dentro de la tolerancia.
 *
 * Los vértices ganan siempre a las aristas aunque estén más lejos (dentro de la
 * tolerancia): al cerrar una sala contra la esquina del pasillo, lo que se
 * quiere es la esquina exacta, no un punto cualquiera del borde a 20 cm.
 */
export function snapToPolygons(
  target: Position,
  references: Polygon[],
  toleranceM = 1,
): SnapResult | null {
  let bestVertex: SnapResult | null = null
  let bestEdge: SnapResult | null = null

  for (const polygon of references) {
    for (const ring of polygon.coordinates) {
      for (const vertex of openRing(ring)) {
        const distanceM = metersBetween(target, vertex)
        if (distanceM <= toleranceM && (!bestVertex || distanceM < bestVertex.distanceM)) {
          bestVertex = { position: [vertex[0], vertex[1]], kind: 'vertex', distanceM }
        }
      }
    }

    const hit = closestPointOnPolygon(polygon, target)
    if (hit && hit.distanceM <= toleranceM && (!bestEdge || hit.distanceM < bestEdge.distanceM)) {
      bestEdge = { position: hit.position, kind: 'edge', distanceM: hit.distanceM }
    }
  }

  return bestVertex ?? bestEdge
}

// ── Rectángulo rotado ───────────────────────────────────────────────────────

function rotateXY(p: XY, rad: number): XY {
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }
}

/**
 * Rectángulo anclado en una esquina, con ancho y alto en metros y un giro.
 *
 * ESTA es la forma en que el editor guarda un rectángulo: ancla, dimensiones y
 * ángulo. Girar entonces es rígido —el rectángulo pivota sin cambiar de tamaño—,
 * que es lo que el ojo espera del tirador de rotación.
 *
 * La primera versión guardaba dos esquinas y deducía las dimensiones en cada
 * repintado. Con eso, girar reinterpretaba la esquina opuesta en el marco nuevo
 * y la superficie cambiaba sola: un rectángulo de 300 m² se encogía a 196 m² al
 * girarlo 30°. Lo destapó la prueba "rotar conserva la superficie".
 *
 * El giro es alrededor del ancla, no del centro, para que la esquina que la
 * persona fijó primero se quede quieta.
 *
 * `rotationRad` se mide en sentido antihorario desde el este del plano local.
 */
export function rectangleFrom(
  anchor: Position,
  widthM: number,
  heightM: number,
  rotationRad = 0,
): Polygon {
  const proj = localProjection(anchor[1], anchor[0])
  const corners: XY[] = [
    { x: 0, y: 0 },
    { x: widthM, y: 0 },
    { x: widthM, y: heightM },
    { x: 0, y: heightM },
  ]
  return polygonFromRing(corners.map((c) => proj.toPosition(rotateXY(c, rotationRad))))
}

/**
 * Ancho y alto que definen el rectángulo mientras se arrastra desde `anchor`
 * hasta `cursor`, leídos en el marco ya girado. Pueden salir negativos: el
 * arrastre hacia arriba o hacia la izquierda es igual de válido.
 */
export function rectangleDims(
  anchor: Position,
  cursor: Position,
  rotationRad = 0,
): { widthM: number; heightM: number } {
  const proj = localProjection(anchor[1], anchor[0])
  const local = rotateXY(proj.toXY(cursor), -rotationRad)
  return { widthM: local.x, heightM: local.y }
}

/** Atajo para el arrastre inicial: dos esquinas opuestas en el marco girado. */
export function rotatedRectangle(a: Position, b: Position, rotationRad = 0): Polygon {
  const { widthM, heightM } = rectangleDims(a, b, rotationRad)
  return rectangleFrom(a, widthM, heightM, rotationRad)
}

// ── Modo ortogonal ──────────────────────────────────────────────────────────

const QUARTER_TURN = Math.PI / 4

/**
 * Ángulo de la primera arista del trazado, en radianes. Es la "veta" del
 * edificio: las siguientes aristas se alinean respecto de ella y no del norte,
 * porque un edificio es rectilíneo pero casi nunca está alineado al norte.
 */
export function grainAngle(ring: Position[]): number {
  if (ring.length < 2) return 0
  const proj = localProjection(ring[0][1], ring[0][0])
  const v = proj.toXY(ring[1])
  return Math.atan2(v.y, v.x)
}

/**
 * Ajusta `cursor` para que la arista desde `from` caiga en un múltiplo de 45°
 * respecto de la veta, conservando el avance a lo largo de esa dirección.
 *
 * Se conserva la proyección sobre la dirección elegida, no la distancia total:
 * si no, al desviarse del eje la arista crecía sola y el trazo "resbalaba".
 */
export function orthogonalSnap(from: Position, cursor: Position, grainRad = 0): Position {
  const proj = localProjection(from[1], from[0])
  const v = proj.toXY(cursor)
  const length = Math.hypot(v.x, v.y)
  if (length < 1e-6) return [...cursor] as Position

  const angle = Math.atan2(v.y, v.x)
  const snapped = grainRad + Math.round((angle - grainRad) / QUARTER_TURN) * QUARTER_TURN
  const projected = v.x * Math.cos(snapped) + v.y * Math.sin(snapped)
  // Nunca invertir el sentido: sin esto, al cruzar los 90° el punto saltaba al
  // lado opuesto del vértice.
  const advance = Math.max(0, projected)

  return proj.toPosition({ x: advance * Math.cos(snapped), y: advance * Math.sin(snapped) })
}

// ── Dividir en N ────────────────────────────────────────────────────────────

/**
 * Parte un cuadrilátero en `n` franjas iguales a lo largo de su eje mayor.
 * Un pasillo de seis salas iguales se dibuja como un solo rectángulo y se
 * divide, en vez de trazar seis veces.
 *
 * Solo actúa sobre cuadriláteros: en una forma en L "el eje mayor" no significa
 * nada y el resultado sería basura, así que se devuelve el polígono intacto.
 */
export function splitQuadIntoN(polygon: Polygon, n: number): Polygon[] {
  const ring = openRing(polygon.coordinates[0] ?? [])
  if (n < 2 || ring.length !== 4) return [polygon]

  const [p0, p1, p2, p3] = ring
  // Se comparan los dos pares de lados opuestos para saber cuál es el eje mayor.
  const alongFirst = metersBetween(p0, p1) >= metersBetween(p1, p2)
  const [a0, a1, b1, b0] = alongFirst ? [p0, p1, p2, p3] : [p1, p2, p3, p0]

  const lerp = (from: Position, to: Position, t: number): Position => [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
  ]

  const slices: Polygon[] = []
  for (let i = 0; i < n; i++) {
    const t0 = i / n
    const t1 = (i + 1) / n
    slices.push(
      polygonFromRing([
        lerp(a0, a1, t0),
        lerp(a0, a1, t1),
        lerp(b0, b1, t1),
        lerp(b0, b1, t0),
      ]),
    )
  }
  return slices
}

// ── Contención y solape ─────────────────────────────────────────────────────

/** Un anillo es convexo si todos sus giros van en el mismo sentido. */
export function isConvexRing(ring: XY[]): boolean {
  if (ring.length < 4) return true
  let sign = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]
    const b = ring[(i + 1) % ring.length]
    const c = ring[(i + 2) % ring.length]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    if (Math.abs(cross) < 1e-9) continue
    const current = Math.sign(cross)
    if (sign === 0) sign = current
    else if (current !== sign) return false
  }
  return true
}

/** Recorte de Sutherland–Hodgman. Exacto cuando el recortante es convexo. */
function clipByConvex(subject: XY[], clip: XY[]): XY[] {
  const area = shoelace(clip)
  // El algoritmo asume el recortante en sentido antihorario.
  const ccw = area >= 0 ? clip : [...clip].reverse()
  let output = subject

  for (let i = 0; i < ccw.length && output.length > 0; i++) {
    const a = ccw[i]
    const b = ccw[(i + 1) % ccw.length]
    const inside = (p: XY) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0

    const input = output
    output = []
    for (let j = 0; j < input.length; j++) {
      const current = input[j]
      const previous = input[(j + input.length - 1) % input.length]
      const currentIn = inside(current)
      const previousIn = inside(previous)

      if (currentIn !== previousIn) {
        const d1 = (b.x - a.x) * (previous.y - a.y) - (b.y - a.y) * (previous.x - a.x)
        const d2 = (b.x - a.x) * (current.y - a.y) - (b.y - a.y) * (current.x - a.x)
        const t = d1 / (d1 - d2)
        output.push({
          x: previous.x + t * (current.x - previous.x),
          y: previous.y + t * (current.y - previous.y),
        })
      }
      if (currentIn) output.push(current)
    }
  }
  return output
}

function pointInRingXY(p: XY, ring: XY[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cruza =
      ring[i].y > p.y !== ring[j].y > p.y &&
      p.x < ((ring[j].x - ring[i].x) * (p.y - ring[i].y)) / (ring[j].y - ring[i].y) + ring[i].x
    if (cruza) inside = !inside
  }
  return inside
}

/**
 * Superficie compartida por dos polígonos, en m².
 *
 * Sutherland–Hodgman da el resultado exacto cuando el polígono que recorta es
 * convexo, así que se usa el convexo de los dos como recortante. Las salas y
 * los pasillos son rectángulos, de modo que ese es el caso normal. Si NINGUNO
 * lo es se cae a un muestreo por rejilla: el número deja de ser exacto, pero
 * este valor solo alimenta un aviso ("estas dos áreas se solapan 12 m²"), no
 * una decisión, y una forma en L rara no debería bloquear el editor.
 */
export function polygonIntersectionAreaM2(a: Polygon, b: Polygon): number {
  const proj = projectionForPolygon(a)
  const ringA = openRing(a.coordinates[0] ?? []).map(proj.toXY)
  const ringB = openRing(b.coordinates[0] ?? []).map(proj.toXY)
  if (ringA.length < 3 || ringB.length < 3) return 0

  if (isConvexRing(ringB)) return Math.abs(shoelace(clipByConvex(ringA, ringB)))
  if (isConvexRing(ringA)) return Math.abs(shoelace(clipByConvex(ringB, ringA)))

  // Solo se muestrea la caja donde las dos se cruzan, no la unión.
  const minX = Math.max(Math.min(...ringA.map((p) => p.x)), Math.min(...ringB.map((p) => p.x)))
  const maxX = Math.min(Math.max(...ringA.map((p) => p.x)), Math.max(...ringB.map((p) => p.x)))
  const minY = Math.max(Math.min(...ringA.map((p) => p.y)), Math.min(...ringB.map((p) => p.y)))
  const maxY = Math.min(Math.max(...ringA.map((p) => p.y)), Math.max(...ringB.map((p) => p.y)))
  if (maxX <= minX || maxY <= minY) return 0

  const STEPS = 64
  const stepX = (maxX - minX) / STEPS
  const stepY = (maxY - minY) / STEPS
  let hits = 0
  for (let i = 0; i < STEPS; i++) {
    for (let j = 0; j < STEPS; j++) {
      const p = { x: minX + (i + 0.5) * stepX, y: minY + (j + 0.5) * stepY }
      if (pointInRingXY(p, ringA) && pointInRingXY(p, ringB)) hits++
    }
  }
  return hits * stepX * stepY
}

/**
 * ¿Está `inner` dentro de `outer`? La tolerancia permite que un vértice sobresalga
 * unos centímetros, que es lo normal cuando el perímetro corre pegado a la fachada.
 */
export function polygonWithinPolygon(inner: Polygon, outer: Polygon, toleranceM = 1): boolean {
  const ring = openRing(inner.coordinates[0] ?? [])
  if (ring.length < 3) return false

  const outerRing = openRing(outer.coordinates[0] ?? [])
  if (outerRing.length < 3) return false

  const proj = projectionForPolygon(outer)
  const outerXY = outerRing.map(proj.toXY)

  return ring.every((vertex) => {
    if (pointInRingXY(proj.toXY(vertex), outerXY)) return true
    const hit = closestPointOnPolygon(outer, vertex)
    return hit !== null && hit.distanceM <= toleranceM
  })
}

/**
 * De todas las áreas que contienen el punto, la de MENOR superficie.
 *
 * Es la regla correcta para contenedores anidados: un quiosco dentro del casino
 * debe resolver "quiosco". El desempate por distancia al centro que usa
 * facultyIdAt sirve para perímetros hermanos solapados por error, no para esto.
 */
export function smallestContaining<T extends { polygon: Polygon }>(
  candidates: T[],
  lng: number,
  lat: number,
): T | null {
  let best: T | null = null
  let bestArea = Infinity

  for (const candidate of candidates) {
    const proj = projectionForPolygon(candidate.polygon)
    const ring = openRing(candidate.polygon.coordinates[0] ?? []).map(proj.toXY)
    if (ring.length < 3 || !pointInRingXY(proj.toXY([lng, lat]), ring)) continue

    const area = Math.abs(shoelace(ring))
    if (area < bestArea) {
      bestArea = area
      best = candidate
    }
  }
  return best
}

/** Formatea una superficie para mostrarla mientras se dibuja. */
export function formatArea(m2: number): string {
  if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(2)} ha`
  if (m2 >= 100) return `${Math.round(m2)} m²`
  return `${m2.toFixed(1)} m²`
}
