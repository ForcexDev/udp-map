import { describe, expect, it } from 'vitest'
import { NavGraph } from '@/shared/utils/indoor/graph'
import { buildSampleBuilding, SAMPLE_FOOTPRINT } from '@/shared/utils/indoor/sampleBuilding'
import type { NavNode } from '@/shared/utils/indoor/types'
import { buildFloorPrisms, floorOpacity, wallSegments } from './explodedView'

const door = (x: number, y: number, widthM = 1): NavNode =>
  ({ id: `d${x}`, kind: 'door', p: { x, y }, widthM }) as NavNode

describe('vista por plantas', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ]

  it('corta el muro en el vano de cada puerta', () => {
    const walls = wallSegments(square, [door(5, 0, 2)])
    const top = walls.filter(([a, b]) => a.y === 0 && b.y === 0)
    expect(top.map(([a, b]) => [a.x, b.x])).toEqual([
      [0, 4],
      [6, 10],
    ])
    expect(walls).toHaveLength(5)
  })

  it('ignora puertas lejos del borde', () => {
    expect(wallSegments(square, [door(5, 5)])).toHaveLength(4)
  })

  it('apaga más las plantas de arriba cuando se navega', () => {
    expect(floorOpacity(4, 4, true, false)).toBe(1)
    expect(floorOpacity(5, 4, true, true)).toBe(0.05)
    expect(floorOpacity(5, 4, false, true)).toBe(0.28)
    expect(floorOpacity(1, 4, true, false)).toBe(0.22)
    expect(floorOpacity(1, 4, false, true)).toBe(0.4)
  })

  it('separa las plantas sumando el gap a cada altura', () => {
    const sample = buildSampleBuilding()
    const graph = new NavGraph(sample.nodes, sample.edges)
    const input = {
      buildings: [{ id: 'V432', footprint: SAMPLE_FOOTPRINT, levels: [1, 2, 3, 4, 5] }],
      areas: sample.areas,
      graph,
      dark: false,
    }
    const slabTop = (gap: number, level: number) =>
      Math.max(...buildFloorPrisms({ ...input, gap }).filter((p) => p.props?.level === level && Math.abs(p.height - p.base - 0.35) < 1e-6).map((p) => p.height))
    expect(slabTop(0, 4)).toBeCloseTo(3 * 3.6)
    expect(slabTop(7, 4)).toBeCloseTo(3 * (3.6 + 7))
    // Desde el piso 2 la losa lleva agujeros en los núcleos.
    const slab2 = buildFloorPrisms({ ...input, gap: 0 }).find((p) => p.props?.level === 2 && p.rings.length > 1)
    expect(slab2?.rings).toHaveLength(3)
  })
})
