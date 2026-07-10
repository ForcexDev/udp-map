import { describe, expect, it } from 'vitest'
import { FACULTIES } from './campusData'
import { facultyIdAt, facultyPerimetersGeoJSON } from './facultyPerimeters'

describe('facultyIdAt (cluster automático por perímetro)', () => {
  it('un punto dentro del perímetro de Ingeniería se asigna a "ingenieria"', () => {
    // Centro de la facultad según campusData
    expect(facultyIdAt(-33.45276, -70.66105)).toBe('ingenieria')
    // Patio interior de la manzana
    expect(facultyIdAt(-33.45275, -70.66095)).toBe('ingenieria')
  })

  it('puntos fuera del perímetro no se asignan a ninguna facultad', () => {
    // Campus República
    expect(facultyIdAt(-33.44961, -70.66442)).toBeNull()
    // Iglesia San Lázaro (al norte, cruzando Gorbea)
    expect(facultyIdAt(-33.4515, -70.661)).toBeNull()
    // Vereda oriente de Paseo Ejército
    expect(facultyIdAt(-33.45255, -70.6603)).toBeNull()
  })

  it('la facultad "ingenieria" usa el perímetro real como polygon', () => {
    const ing = FACULTIES.find((f) => f.id === 'ingenieria')
    expect(ing?.polygon?.coordinates[0].length).toBe(15)
  })

  it('el GeoJSON para el mapa trae una feature por perímetro', () => {
    const fc = facultyPerimetersGeoJSON()
    expect(fc.features).toHaveLength(16)
    expect(fc.features[0].properties?.faculty_id).toBe('ingenieria')
  })
})
