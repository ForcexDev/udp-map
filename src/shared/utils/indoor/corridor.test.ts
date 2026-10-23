import { describe, expect, it } from 'vitest'
import { planCorridor, ROOM_DEPTH_M } from './corridor'
import { sub, turnAngle } from './projection'

describe('pasillo generado desde las puertas', () => {
  const axis = [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
  ]

  it('tres puertas a un lado generan una cadena ordenada a lo largo del eje', () => {
    const plan = planCorridor(axis, [
      { id: 'c', p: { x: 15, y: -1.5 }, room: true },
      { id: 'a', p: { x: 3, y: -1.5 }, room: true },
      { id: 'b', p: { x: 8, y: -1.5 }, room: true },
    ])
    expect(plan.walk.map((w) => w.p.x)).toEqual([0, 3, 8, 15, 20])
    const chain = plan.edges.filter((e) => e.a.startsWith('w') && e.b.startsWith('w'))
    expect(chain).toHaveLength(4)
    const doorOf = (id: string) => plan.edges.find((e) => e.a === id && e.b.startsWith('w'))!.b
    expect([doorOf('a'), doorOf('b'), doorOf('c')]).toEqual(['w1', 'w2', 'w3'])
    // La sala queda hacia dentro, lejos del eje.
    expect(plan.rooms.find((r) => r.door === 'a')!.p.y).toBeCloseTo(-1.5 - ROOM_DEPTH_M)
  })

  it('una puerta a cada lado se ve a lados opuestos desde el recorrido', () => {
    const doors = [
      { id: 'norte', p: { x: 5, y: -1.5 } },
      { id: 'sur', p: { x: 12, y: 1.5 } },
    ]
    const plan = planCorridor(axis, doors)
    const walking = sub(plan.walk[plan.walk.length - 1].p, plan.walk[0].p)
    const side = (id: string) => {
      const host = plan.walk[Number(plan.edges.find((e) => e.a === id)!.b.slice(1))]
      return Math.sign(turnAngle(walking, sub(doors.find((d) => d.id === id)!.p, host.p)))
    }
    expect(side('norte')).toBe(-1)
    expect(side('sur')).toBe(1)
  })

  it('funde proyecciones casi iguales y respeta los vértices del eje', () => {
    const plan = planCorridor(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      [
        { id: 'a', p: { x: 9.9, y: -1 } },
        { id: 'b', p: { x: 11, y: 0.1 } },
      ],
    )
    expect(plan.walk.map((w) => [w.p.x, w.p.y])).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ])
  })
})
