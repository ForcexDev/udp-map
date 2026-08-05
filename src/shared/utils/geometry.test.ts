import { describe, expect, it } from 'vitest'
import type { Polygon, Position } from 'geojson'
import {
  closeRing,
  formatArea,
  grainAngle,
  localProjection,
  metersBetween,
  openRing,
  orthogonalSnap,
  polygonAreaM2,
  polygonCentroid,
  polygonFromRing,
  polygonIntersectionAreaM2,
  polygonPerimeterM,
  polygonWithinPolygon,
  rectangleDims,
  rectangleFrom,
  rotatedRectangle,
  smallestContaining,
  snapToPolygons,
  splitQuadIntoN,
} from './geometry'

// Punto de referencia dentro del perímetro real de la FIC, para que las
// pruebas corran sobre la misma latitud donde se va a dibujar.
const LAT = -33.4527
const LNG = -70.661

/** Cuadrado de `sizeM` metros con la esquina inferior izquierda en el origen. */
function square(sizeM: number, originLat = LAT, originLng = LNG): Polygon {
  const proj = localProjection(originLat, originLng)
  return polygonFromRing([
    proj.toPosition({ x: 0, y: 0 }),
    proj.toPosition({ x: sizeM, y: 0 }),
    proj.toPosition({ x: sizeM, y: sizeM }),
    proj.toPosition({ x: 0, y: sizeM }),
  ])
}

describe('proyección local', () => {
  it('va y vuelve sin perder precisión', () => {
    const proj = localProjection(LAT, LNG)
    const original: Position = [LNG + 0.001, LAT - 0.0005]
    const [lng, lat] = proj.toPosition(proj.toXY(original))
    expect(lng).toBeCloseTo(original[0], 10)
    expect(lat).toBeCloseTo(original[1], 10)
  })

  it('mide en metros, no en grados', () => {
    // Un grado de longitud en Santiago mide bastante menos que uno de latitud:
    // si esto fallara, todo el resto del módulo estaría deformado.
    const este = metersBetween([LNG, LAT], [LNG + 0.001, LAT])
    const norte = metersBetween([LNG, LAT], [LNG, LAT + 0.001])
    expect(norte).toBeGreaterThan(este)
    expect(norte).toBeCloseTo(111.32, 1)
  })
})

describe('anillos', () => {
  it('closeRing repite el primer punto y openRing lo quita', () => {
    const abierto: Position[] = [[0, 0], [1, 0], [1, 1]]
    const cerrado = closeRing(abierto)
    expect(cerrado).toHaveLength(4)
    expect(cerrado[3]).toEqual(cerrado[0])
    expect(openRing(cerrado)).toHaveLength(3)
  })

  it('closeRing no vuelve a cerrar un anillo ya cerrado', () => {
    const cerrado: Position[] = [[0, 0], [1, 0], [1, 1], [0, 0]]
    expect(closeRing(cerrado)).toHaveLength(4)
  })
})

describe('medidas', () => {
  it('calcula la superficie de un cuadrado de 20 m', () => {
    expect(polygonAreaM2(square(20))).toBeCloseTo(400, 1)
  })

  it('el perímetro de ese cuadrado son 80 m', () => {
    expect(polygonPerimeterM(square(20))).toBeCloseTo(80, 1)
  })

  it('el centroide de un cuadrado cae en su centro', () => {
    const proj = localProjection(LAT, LNG)
    const centro = polygonCentroid(square(20))
    const xy = proj.toXY(centro)
    expect(xy.x).toBeCloseTo(10, 2)
    expect(xy.y).toBeCloseTo(10, 2)
  })

  it('formatArea cambia de unidad según el tamaño', () => {
    expect(formatArea(62.35)).toBe('62.4 m²')
    expect(formatArea(430)).toBe('430 m²')
    expect(formatArea(15_000)).toBe('1.50 ha')
  })
})

describe('rectángulo rotado', () => {
  it('sin rotación produce el rectángulo entre las dos esquinas', () => {
    const proj = localProjection(LAT, LNG)
    const a: Position = [LNG, LAT]
    const b = proj.toPosition({ x: 30, y: 10 })
    expect(polygonAreaM2(rotatedRectangle(a, b))).toBeCloseTo(300, 1)
  })

  it('rotar conserva la superficie', () => {
    // El tirador de rotación pivota el rectángulo, no lo redimensiona. Guardar
    // dos esquinas en vez de las dimensiones hacía que 300 m² se encogieran a
    // 196 m² al girar 30°.
    const a: Position = [LNG, LAT]
    for (const angulo of [0, Math.PI / 6, Math.PI / 3, (3 * Math.PI) / 4]) {
      expect(polygonAreaM2(rectangleFrom(a, 30, 10, angulo))).toBeCloseTo(300, 1)
    }
  })

  it('la esquina fijada primero no se mueve al rotar', () => {
    const a: Position = [LNG, LAT]
    const girado = rectangleFrom(a, 30, 10, Math.PI / 3)
    expect(metersBetween(girado.coordinates[0][0], a)).toBeLessThan(0.01)
  })

  it('rectangleDims lee las dimensiones en el marco girado', () => {
    const proj = localProjection(LAT, LNG)
    const a: Position = [LNG, LAT]
    // Cursor a 20 m sobre una veta de 45°: 20 de ancho y 0 de alto en ese marco.
    const cursor = proj.toPosition({ x: 20 * Math.cos(Math.PI / 4), y: 20 * Math.sin(Math.PI / 4) })
    const { widthM, heightM } = rectangleDims(a, cursor, Math.PI / 4)
    expect(widthM).toBeCloseTo(20, 2)
    expect(heightM).toBeCloseTo(0, 2)
  })

  it('acepta arrastrar hacia atrás', () => {
    // Arrastrar hacia arriba y a la izquierda da dimensiones negativas, y el
    // rectángulo resultante es igual de válido.
    const a: Position = [LNG, LAT]
    expect(polygonAreaM2(rectangleFrom(a, -30, -10))).toBeCloseTo(300, 1)
  })
})

describe('modo ortogonal', () => {
  const proj = localProjection(LAT, LNG)
  const origen: Position = [LNG, LAT]

  it('sin veta, alinea al este/norte', () => {
    // Cursor a 10 m al este y 1 m al norte: debe caer sobre el eje este.
    const cursor = proj.toPosition({ x: 10, y: 1 })
    const xy = proj.toXY(orthogonalSnap(origen, cursor))
    expect(xy.x).toBeCloseTo(10, 1)
    expect(xy.y).toBeCloseTo(0, 1)
  })

  it('se alinea a la veta del edificio, no al norte', () => {
    // Veta a 30°: un cursor cerca de esa dirección debe caer exactamente en ella.
    const veta = Math.PI / 6
    const casi = proj.toPosition({
      x: 20 * Math.cos(veta + 0.05),
      y: 20 * Math.sin(veta + 0.05),
    })
    const xy = proj.toXY(orthogonalSnap(origen, casi, veta))
    expect(Math.atan2(xy.y, xy.x)).toBeCloseTo(veta, 4)
  })

  it('no invierte el sentido cuando el cursor queda detrás', () => {
    // Antes, al cruzar los 90°, el punto saltaba al lado opuesto del vértice.
    const cursor = proj.toPosition({ x: -15, y: 0.2 })
    const xy = proj.toXY(orthogonalSnap(origen, cursor, 0))
    expect(xy.x).toBeLessThanOrEqual(0.001)
  })

  it('grainAngle lee la orientación de la primera arista', () => {
    const ring = [origen, proj.toPosition({ x: 10, y: 10 })]
    expect(grainAngle(ring)).toBeCloseTo(Math.PI / 4, 3)
  })
})

describe('dividir en N', () => {
  it('parte un rectángulo en franjas de igual superficie', () => {
    const proj = localProjection(LAT, LNG)
    const rect = rotatedRectangle([LNG, LAT], proj.toPosition({ x: 60, y: 10 }))
    const partes = splitQuadIntoN(rect, 6)

    expect(partes).toHaveLength(6)
    for (const parte of partes) {
      expect(polygonAreaM2(parte)).toBeCloseTo(100, 0)
    }
  })

  it('la suma de las partes reconstruye el total', () => {
    const proj = localProjection(LAT, LNG)
    const rect = rotatedRectangle([LNG, LAT], proj.toPosition({ x: 45, y: 12 }))
    const total = splitQuadIntoN(rect, 3).reduce((acc, p) => acc + polygonAreaM2(p), 0)
    expect(total).toBeCloseTo(polygonAreaM2(rect), 0)
  })

  it('divide por el eje mayor aunque sea el vertical', () => {
    const proj = localProjection(LAT, LNG)
    const alto = rotatedRectangle([LNG, LAT], proj.toPosition({ x: 10, y: 60 }))
    const partes = splitQuadIntoN(alto, 3)
    expect(partes).toHaveLength(3)
    for (const parte of partes) {
      expect(polygonAreaM2(parte)).toBeCloseTo(200, 0)
    }
  })

  it('deja intacto lo que no es un cuadrilátero', () => {
    const proj = localProjection(LAT, LNG)
    const ele = polygonFromRing([
      proj.toPosition({ x: 0, y: 0 }),
      proj.toPosition({ x: 20, y: 0 }),
      proj.toPosition({ x: 20, y: 10 }),
      proj.toPosition({ x: 10, y: 10 }),
      proj.toPosition({ x: 10, y: 20 }),
      proj.toPosition({ x: 0, y: 20 }),
    ])
    expect(splitQuadIntoN(ele, 4)).toEqual([ele])
  })
})

describe('imanes', () => {
  it('se pega al vértice cuando está dentro de la tolerancia', () => {
    const proj = localProjection(LAT, LNG)
    const referencia = square(20)
    const casiEsquina = proj.toPosition({ x: 20.4, y: 0.3 })

    const snap = snapToPolygons(casiEsquina, [referencia], 1)
    expect(snap?.kind).toBe('vertex')
    expect(metersBetween(snap!.position, proj.toPosition({ x: 20, y: 0 }))).toBeLessThan(0.01)
  })

  it('el vértice gana a la arista aunque la arista esté más cerca', () => {
    // A 30 cm del borde y a 60 cm de la esquina: se quiere la esquina.
    const proj = localProjection(LAT, LNG)
    const cerca = proj.toPosition({ x: 19.5, y: -0.3 })

    expect(snapToPolygons(cerca, [square(20)], 1)?.kind).toBe('vertex')
  })

  it('se pega a la arista en mitad de un lado', () => {
    const proj = localProjection(LAT, LNG)
    const snap = snapToPolygons(proj.toPosition({ x: 10, y: -0.4 }), [square(20)], 1)
    expect(snap?.kind).toBe('edge')
    expect(proj.toXY(snap!.position).y).toBeCloseTo(0, 2)
  })

  it('no devuelve nada fuera de la tolerancia', () => {
    const proj = localProjection(LAT, LNG)
    expect(snapToPolygons(proj.toPosition({ x: 10, y: -5 }), [square(20)], 1)).toBeNull()
  })
})

describe('contención', () => {
  it('reconoce un área dentro de la huella de su edificio', () => {
    const proj = localProjection(LAT, LNG)
    const interior = polygonFromRing([
      proj.toPosition({ x: 2, y: 2 }),
      proj.toPosition({ x: 8, y: 2 }),
      proj.toPosition({ x: 8, y: 8 }),
      proj.toPosition({ x: 2, y: 8 }),
    ])
    expect(polygonWithinPolygon(interior, square(20))).toBe(true)
  })

  it('rechaza un área que se sale', () => {
    const proj = localProjection(LAT, LNG)
    const fuera = polygonFromRing([
      proj.toPosition({ x: 15, y: 15 }),
      proj.toPosition({ x: 30, y: 15 }),
      proj.toPosition({ x: 30, y: 30 }),
      proj.toPosition({ x: 15, y: 30 }),
    ])
    expect(polygonWithinPolygon(fuera, square(20))).toBe(false)
  })

  it('tolera que un vértice sobresalga unos centímetros', () => {
    // El perímetro corre pegado a la fachada: exigir contención estricta haría
    // fallar trazados que están bien.
    const proj = localProjection(LAT, LNG)
    const rozando = polygonFromRing([
      proj.toPosition({ x: 2, y: 2 }),
      proj.toPosition({ x: 20.3, y: 2 }),
      proj.toPosition({ x: 20.3, y: 8 }),
      proj.toPosition({ x: 2, y: 8 }),
    ])
    expect(polygonWithinPolygon(rozando, square(20), 1)).toBe(true)
    expect(polygonWithinPolygon(rozando, square(20), 0.1)).toBe(false)
  })
})

describe('solape', () => {
  it('mide la superficie compartida por dos rectángulos', () => {
    const proj = localProjection(LAT, LNG)
    const otro = polygonFromRing([
      proj.toPosition({ x: 10, y: 10 }),
      proj.toPosition({ x: 30, y: 10 }),
      proj.toPosition({ x: 30, y: 30 }),
      proj.toPosition({ x: 10, y: 30 }),
    ])
    // Cuadrantes solapados de 10 × 10.
    expect(polygonIntersectionAreaM2(square(20), otro)).toBeCloseTo(100, 0)
  })

  it('da cero cuando no se tocan', () => {
    const proj = localProjection(LAT, LNG)
    const lejos = polygonFromRing([
      proj.toPosition({ x: 50, y: 50 }),
      proj.toPosition({ x: 60, y: 50 }),
      proj.toPosition({ x: 60, y: 60 }),
      proj.toPosition({ x: 50, y: 60 }),
    ])
    expect(polygonIntersectionAreaM2(square(20), lejos)).toBeCloseTo(0, 3)
  })

  it('devuelve el total cuando una está dentro de la otra', () => {
    const proj = localProjection(LAT, LNG)
    const dentro = polygonFromRing([
      proj.toPosition({ x: 5, y: 5 }),
      proj.toPosition({ x: 15, y: 5 }),
      proj.toPosition({ x: 15, y: 15 }),
      proj.toPosition({ x: 5, y: 15 }),
    ])
    expect(polygonIntersectionAreaM2(square(20), dentro)).toBeCloseTo(100, 0)
  })
})

describe('smallestContaining', () => {
  it('elige el quiosco y no el casino que lo contiene', () => {
    const proj = localProjection(LAT, LNG)
    const casino = { id: 'casino', polygon: square(20) }
    const quiosco = {
      id: 'quiosco',
      polygon: polygonFromRing([
        proj.toPosition({ x: 4, y: 4 }),
        proj.toPosition({ x: 8, y: 4 }),
        proj.toPosition({ x: 8, y: 8 }),
        proj.toPosition({ x: 4, y: 8 }),
      ]),
    }
    const punto = proj.toPosition({ x: 6, y: 6 })

    expect(smallestContaining([casino, quiosco], punto[0], punto[1])?.id).toBe('quiosco')
    // El mismo resultado sin depender del orden de la lista.
    expect(smallestContaining([quiosco, casino], punto[0], punto[1])?.id).toBe('quiosco')
  })

  it('devuelve null cuando el punto no cae en ninguna', () => {
    const proj = localProjection(LAT, LNG)
    const fuera = proj.toPosition({ x: 100, y: 100 })
    expect(smallestContaining([{ polygon: square(20) }], fuera[0], fuera[1])).toBeNull()
  })
})
