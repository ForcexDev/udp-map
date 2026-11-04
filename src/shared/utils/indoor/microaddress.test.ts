import { describe, expect, it } from 'vitest'
import { NavGraph } from './graph'
import { microaddress } from './microaddress'
import { buildSampleBuilding, SAMPLE_BUILDING_NAME } from './sampleBuilding'
import { validateNavGraph } from './validate'

const sample = buildSampleBuilding()
const graph = new NavGraph(sample.nodes, sample.edges)
const ctx = { graph, areas: sample.areas, buildingName: () => SAMPLE_BUILDING_NAME }

describe('microdirección', () => {
  it('describe la Sala 413 desde la escalera', () => {
    expect(microaddress('4:S413', ctx)).toEqual({
      line1: 'Vergara 432 · Piso 4 · Pasillo central, lado sur',
      line2: 'Saliendo de la escalera, a la derecha: 1.ª puerta a tu izquierda',
    })
  })

  it('sin escalera mapeada en la planta solo da la primera línea', () => {
    const noStairs = new NavGraph(
      sample.nodes.filter((n) => n.id !== '4:esc'),
      sample.edges,
    )
    const result = microaddress('4:S413', { ...ctx, graph: noStairs })
    expect(result?.line1).toContain('Piso 4')
    expect(result?.line2).toBeNull()
  })

  it('no inventa microdirección para lo que no es una sala', () => {
    expect(microaddress('4:c16', ctx)).toBeNull()
  })
})

describe('validación del grafo', () => {
  it('el edificio del prototipo queda en verde', () => {
    expect(validateNavGraph({ graph, areas: sample.areas })).toEqual([])
  })

  it('avisa de salas inalcanzables, núcleos sin unir y códigos sin nodo', () => {
    const broken = new NavGraph(
      sample.nodes,
      sample.edges.filter((e) => e.id !== '4:esc~5:esc' && e.id !== '4:asc~5:asc'),
    )
    const issues = validateNavGraph({
      graph: broken,
      areas: sample.areas,
      roomCodes: ['V432.4.S413', 'v432.2.s299'],
    })
    const codes = issues.map((i) => i.code)
    expect(codes).toContain('room-unreachable')
    expect(codes).toContain('shaft-unlinked')
    expect(issues.find((i) => i.code === 'room-without-node')?.detail).toBe('V432.2.S299')
  })

  it('distingue lo que solo falla sin escaleras', () => {
    const noLift = new NavGraph(
      sample.nodes,
      sample.edges.filter((e) => e.kind !== 'elevator'),
    )
    const issues = validateNavGraph({ graph: noLift })
    expect(issues.every((i) => i.code !== 'room-unreachable')).toBe(true)
    expect(
      issues.some((i) => i.code === 'room-unreachable-step-free' && i.severity === 'warning'),
    ).toBe(true)
  })
})
