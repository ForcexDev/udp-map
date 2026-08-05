import { describe, expect, it } from 'vitest'
import type { Building, BuildingFloor } from '@/shared/types/database'
import { facultyLevels } from './useMapping'

// El selector de plantas es de la FACULTAD, así que ofrece la unión de las
// plantas de sus edificios. Que el Vergara tenga dos subterráneos y los demás
// ninguno no quita que "el subterráneo de la FIC" exista y se pueda mirar.

const building = (id: string, faculty_id: string): Building =>
  ({
    id,
    faculty_id,
    name: id,
    short_name: id,
    aliases: [],
    footprint: { type: 'Polygon', coordinates: [] },
    default_floor: 1,
    height_m: null,
    color: null,
    sort_order: 0,
    updated_at: '',
  }) as unknown as Building

const floor = (building_id: string, level: number, label: string | null = null): BuildingFloor =>
  ({ building_id, level, label }) as BuildingFloor

const mapping = {
  buildings: [
    building('v432', 'ingenieria'),
    building('e441', 'ingenieria'),
    building('d1', 'derecho'),
  ],
  floors: [
    floor('v432', -2),
    floor('v432', -1),
    floor('v432', 1),
    floor('v432', 2),
    floor('v432', 3),
    floor('e441', 1),
    floor('e441', 2, 'Entrepiso'),
    floor('d1', 7),
  ],
  areas: [],
}

describe('facultyLevels', () => {
  it('une las plantas de todos los edificios, de arriba abajo', () => {
    const levels = facultyLevels(mapping, 'ingenieria').map((l) => l.level)
    expect(levels).toEqual([3, 2, 1, -1, -2])
  })

  it('cuenta cuántos edificios llegan a cada planta', () => {
    const levels = facultyLevels(mapping, 'ingenieria')
    // Al 1 y al 2 llegan los dos; al subterráneo, solo el Vergara.
    expect(levels.find((l) => l.level === 1)?.buildings).toBe(2)
    expect(levels.find((l) => l.level === 2)?.buildings).toBe(2)
    expect(levels.find((l) => l.level === -2)?.buildings).toBe(1)
  })

  it('conserva la etiqueta que alguien le puso a la planta', () => {
    expect(facultyLevels(mapping, 'ingenieria').find((l) => l.level === 2)?.label).toBe('Entrepiso')
  })

  it('no mezcla facultades', () => {
    expect(facultyLevels(mapping, 'derecho').map((l) => l.level)).toEqual([7])
    expect(facultyLevels(mapping, 'inexistente')).toEqual([])
  })
})
