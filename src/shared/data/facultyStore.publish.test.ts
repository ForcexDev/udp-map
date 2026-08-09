import { describe, expect, it } from 'vitest'
import type { Polygon } from 'geojson'
import type { Faculty } from '@/shared/types/database'
import { FACULTIES } from './campusData'
import {
  facultyIdAt,
  facultyPerimeter,
  facultyPerimetersGeoJSON,
  publishFaculties,
  subscribeFaculties,
} from './facultyStore'

// El catálogo ya no trae geometría: los perímetros viven en la base y entran
// por `publishFaculties`. Por eso todas las pruebas publican primero — es
// exactamente lo que hace la app al arrancar.

/** Cuadrado de ~100 m centrado en (lat, lng). */
function square(lat: number, lng: number, d = 0.00045): Polygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lng - d, lat - d],
        [lng + d, lat - d],
        [lng + d, lat + d],
        [lng - d, lat + d],
        [lng - d, lat - d],
      ],
    ],
  }
}

const faculty = (id: string, lat: number, lng: number, polygon: Polygon | null): Faculty => ({
  id,
  name: `Facultad ${id}`,
  name_en: `Faculty ${id}`,
  campus_id: 'ejercito',
  lat,
  lng,
  polygon,
  image: null,
})

const trazada = faculty('trazada', -33.45, -70.66, square(-33.45, -70.66))
const sinTrazar = faculty('sin-trazar', -33.5, -70.7, null)

describe('publishFaculties', () => {
  it('una facultad creada en el editor entra al catálogo que ve toda la app', () => {
    publishFaculties([trazada, sinTrazar])

    expect(FACULTIES.map((f) => f.id)).toEqual(['trazada', 'sin-trazar'])
    expect(facultyIdAt(-33.45, -70.66)).toBe('trazada')
  })

  it('sin perímetro no hay contorno ni asignación de pines', () => {
    publishFaculties([trazada, sinTrazar])

    // Sin trazo la facultad existe en la lista, pero no captura nada: un pin en
    // su chincheta no cae "dentro" de ninguna facultad.
    expect(facultyPerimeter('sin-trazar')).toBeNull()
    expect(facultyIdAt(-33.5, -70.7)).toBeNull()
    expect(facultyPerimetersGeoJSON().features).toHaveLength(1)
  })

  it('el perímetro y el resto de la ficha salen del MISMO sitio', () => {
    // La regresión que motiva esta prueba: el nombre se actualizaba y el
    // perímetro no, porque eran dos contenedores distintos. Ahora publicar una
    // versión nueva de la misma facultad tiene que mover las dos cosas a la vez.
    publishFaculties([faculty('x', -33.45, -70.66, null)])
    expect(facultyPerimeter('x')).toBeNull()

    publishFaculties([
      { ...faculty('x', -33.45, -70.66, square(-33.45, -70.66)), name: 'Nombre nuevo' },
    ])
    expect(FACULTIES[0].name).toBe('Nombre nuevo')
    expect(facultyPerimeter('x')).not.toBeNull()
  })

  it('desempata por cercanía cuando dos perímetros se solapan', () => {
    // Es el caso real de Biblioteca y Ciencias Sociales, que comparten manzana.
    const grande = faculty('grande', -33.45, -70.66, square(-33.45, -70.66, 0.001))
    const chica = faculty('chica', -33.4504, -70.6604, square(-33.4504, -70.6604, 0.0002))
    publishFaculties([grande, chica])

    expect(facultyIdAt(-33.4504, -70.6604)).toBe('chica')
    expect(facultyIdAt(-33.4495, -70.6595)).toBe('grande')
  })

  it('una lista vacía se ignora: mejor el catálogo de siempre que ninguno', () => {
    publishFaculties([trazada])
    publishFaculties([])
    expect(FACULTIES).toHaveLength(1)
  })

  it('avisa a quien esté suscrito', () => {
    let calls = 0
    const unsubscribe = subscribeFaculties(() => {
      calls += 1
    })
    publishFaculties([trazada])
    unsubscribe()
    publishFaculties([trazada, sinTrazar])
    expect(calls).toBe(1)
  })
})
