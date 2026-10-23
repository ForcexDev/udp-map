import { describe, expect, it } from 'vitest'
import type { IndoorArea } from '@/shared/utils/indoor/types'
import { dedupeEdges, snapToWall } from './navEdit'

const rect = (id: string, kind: string, x0: number, y0: number, x1: number, y1: number): IndoorArea => ({
  id,
  buildingId: 'B',
  floor: 1,
  kind,
  name: id,
  ring: [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ],
})

describe('herramienta de navegación', () => {
  it('ajusta la puerta al borde y se la da a la sala, no al pasillo', () => {
    const areas = [rect('sala', 'other', 0, 0, 10, 7), rect('pasillo', 'corridor', 0, 7, 10, 10)]
    const snap = snapToWall(areas, { x: 4, y: 7.4 })
    expect(snap?.p).toEqual({ x: 4, y: 7 })
    expect(snap?.areaId).toBe('sala')
    expect(snapToWall(areas, { x: 4, y: 3.5 })).toBeNull()
  })

  it('no repite aristas en ningún sentido', () => {
    const edge = (a: string, b: string) => ({ faculty_id: 'f', a, b, kind: 'walk' as const, step_free: true })
    const kept = dedupeEdges([edge('a', 'b'), edge('b', 'a'), edge('c', 'c'), edge('b', 'c')], [{ a: 'c', b: 'b' }])
    expect(kept.map((e) => `${e.a}${e.b}`)).toEqual(['ab'])
  })
})
