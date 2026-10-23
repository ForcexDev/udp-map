import { describe, expect, it } from 'vitest'
import { NavGraph } from './graph'
import { buildInstructions } from './instructions'
import { buildSampleBuilding } from './sampleBuilding'
import { activeStepIndex, buildTrack, rectFromRing, stairsU } from './track'

const sample = buildSampleBuilding()
const graph = new NavGraph(sample.nodes, sample.edges)
const stairsArea = (floor: number) => sample.areas.find((a) => a.id === `${floor}:area:esc`)!

describe('línea de tiempo', () => {
  it('patio → auditorio sube de la planta 1 a la 3 sin bajar nunca', () => {
    const route = graph.route('out:patio', '3:AU')!
    const track = buildTrack(route, graph, {
      shaftRect: (id) => {
        const node = graph.node(id)
        return node.floor ? rectFromRing(stairsArea(node.floor).ring) : null
      },
    })
    const zs = track.keyframes.map((k) => k.z)
    for (let i = 1; i < zs.length; i++) expect(zs[i]).toBeGreaterThanOrEqual(zs[i - 1])
    expect(zs[0]).toBe(1)
    expect(zs[zs.length - 1]).toBe(3)
    expect(track.nodeTimes).toHaveLength(route.nodes.length)
    expect(track.sample(track.duration).level).toBe(3)
  })

  it('reparte cada piso de escalera en la U del hueco', () => {
    const rect = rectFromRing(stairsArea(1).ring)!
    const path = stairsU({ x: 16, y: 6.3 }, { x: 16, y: 6.3 }, rect)
    const round = (v: number) => Math.round(v * 100) / 100
    expect(path.map(({ p, rise }) => [round(p.x), round(p.y), rise])).toEqual([
      [16, 6.3, 0],
      [15, 6, 0],
      [15, 1.5, 0.5],
      [16, 0.75, 0.5],
      [17, 1.5, 0.5],
      [17, 6, 1],
      [16, 6.3, 1],
    ])
  })

  it('el ascensor no anima la espera y deja la figura quieta', () => {
    const route = graph.route('out:paradero', '5:S515', { stepFree: true })!
    const track = buildTrack(route, graph)
    expect(track.nodeTimes).toHaveLength(route.nodes.length)
    const firstElevator = route.kinds.indexOf('elevator')
    const midRide = (track.nodeTimes[firstElevator] + track.nodeTimes[firstElevator + 2]) / 2
    expect(track.sample(midRide).still).toBe(true)
    expect(track.sample(midRide).kind).toBe('elevator')
    // Cuarenta segundos de espera no se animan: el viaje dura puertas + 4 s por piso.
    const ride = track.nodeTimes[route.kinds.lastIndexOf('elevator') + 1] - track.nodeTimes[firstElevator]
    expect(ride).toBeLessThan(25)
  })

  it('el paso activo avanza con el tiempo', () => {
    const route = graph.route('out:paradero', '4:S413')!
    const steps = buildInstructions(route, graph)
    const track = buildTrack(route, graph)
    expect(activeStepIndex(steps, track.nodeTimes, 0)).toBe(0)
    expect(activeStepIndex(steps, track.nodeTimes, track.duration)).toBe(steps.length - 1)
    const stairs = steps.findIndex((s) => s.icon === 'stairs-up')
    expect(activeStepIndex(steps, track.nodeTimes, track.nodeTimes[steps[stairs].from] + 1)).toBe(stairs)
  })
})
