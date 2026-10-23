import { describe, expect, it } from 'vitest'
import { ELEVATOR_WAIT_S, NavGraph } from './graph'
import { bearingOf, cardinalOf, floorSpan, levelOfZ, turnAngle, zFromIndex, zMeters } from './projection'
import { buildSampleBuilding } from './sampleBuilding'

const sample = buildSampleBuilding()
const graph = new NavGraph(sample.nodes, sample.edges)

describe('convención del plano local', () => {
  it('caminar al este y girar al sur es girar a la derecha', () => {
    expect(turnAngle({ x: 1, y: 0 }, { x: 0, y: 1 })).toBe(90)
    expect(turnAngle({ x: 1, y: 0 }, { x: 0, y: -1 })).toBe(-90)
  })

  it('y crece hacia el sur', () => {
    expect(bearingOf({ x: 0, y: 1 })).toBe(180)
    expect(cardinalOf({ x: 0, y: -1 })).toBe('n')
    expect(cardinalOf({ x: 1, y: 1 })).toBe('se')
  })

  it('la planta 0 no existe: del -1 al 1 hay un piso', () => {
    expect(floorSpan(-1, 1)).toBe(1)
    expect(floorSpan(1, 4)).toBe(3)
    expect(zMeters(1)).toBe(0)
    expect(zMeters(-1)).toBeCloseTo(-3.6)
    expect(zFromIndex(-0.5)).toBe(0)
    expect(levelOfZ(3.4)).toBe(3)
    expect(levelOfZ(3.6)).toBe(4)
  })
})

describe('ruta más rápida', () => {
  it('toda sala con código es alcanzable desde la calle', () => {
    const rooms = sample.nodes.filter((n) => n.kind === 'room' && n.roomCode)
    expect(rooms.length).toBeGreaterThan(15)
    for (const room of rooms) expect(graph.route('out:paradero', room.id), room.id).not.toBeNull()
  })

  it('sin escaleras nunca usa la escalera y sube en ascensor al quinto', () => {
    const route = graph.route('out:paradero', '5:S515', { stepFree: true })!
    expect(route.kinds).not.toContain('stairs')
    expect(route.kinds).toContain('elevator')
  })

  it('la espera del ascensor se paga una sola vez', () => {
    const toFive = graph.route('1:asc', '5:asc', { stepFree: true })!
    const toTwo = graph.route('1:asc', '2:asc', { stepFree: true })!
    expect(toFive.seconds - toTwo.seconds).toBeLessThan(20)
    expect(toTwo.seconds).toBeGreaterThanOrEqual(ELEVATOR_WAIT_S)
  })

  it('para subir dos pisos prefiere la escalera', () => {
    const route = graph.route('out:patio', '3:AU')!
    expect(route.kinds).toContain('stairs')
    expect(route.kinds).not.toContain('elevator')
  })

  it('cuenta solo los metros caminados', () => {
    const route = graph.route('out:paradero', '4:S413')!
    expect(route.meters).toBeGreaterThan(70)
    expect(route.meters).toBeLessThan(90)
  })

  it('devuelve null si no hay camino sin escaleras', () => {
    const cut = new NavGraph(
      sample.nodes,
      sample.edges.filter((e) => e.kind !== 'elevator'),
    )
    expect(cut.route('out:paradero', '4:S413', { stepFree: true })).toBeNull()
    expect(cut.route('out:paradero', '4:S413')).not.toBeNull()
  })

  it('calcula una ruta en pocos milisegundos', () => {
    const start = performance.now()
    for (let i = 0; i < 20; i++) graph.route('out:paradero', '5:S515')
    expect((performance.now() - start) / 20).toBeLessThan(5)
  })
})
