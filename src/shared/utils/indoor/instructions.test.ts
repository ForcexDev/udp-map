import { describe, expect, it } from 'vitest'
import { NavGraph } from './graph'
import { buildInstructions, isFeminine } from './instructions'
import { buildSampleBuilding } from './sampleBuilding'

const sample = buildSampleBuilding()
const graph = new NavGraph(sample.nodes, sample.edges)

function steps(from: string, to: string, stepFree = false) {
  const route = graph.route(from, to, { stepFree })
  if (!route) throw new Error(`sin ruta ${from} → ${to}`)
  return { route, steps: buildInstructions(route, graph) }
}

describe('instrucciones sobre el edificio del prototipo', () => {
  it('paradero → S413 por escalera: sale al sur, sube al 4 y llega por la izquierda', () => {
    const { steps: s } = steps('out:paradero', '4:S413')
    expect(s[0].kind).toBe('depart')
    expect(s[0].text).toContain('paradero')
    expect(s[0].text).toContain('hacia el sur por la vereda de Vergara')
    expect(s.some((x) => x.icon === 'stairs-up' && x.text.includes('piso 4'))).toBe(true)
    const last = s[s.length - 1]
    expect(last.kind).toBe('arrive')
    expect(last.text).toBe('Sala 413 está a tu izquierda')
    expect(last.detail).toContain('1.ª puerta a tu izquierda')
    expect(last.detail).toContain('V432.4.S413')
  })

  it('reproduce el ejemplo del prototipo paso a paso', () => {
    const { steps: s } = steps('out:paradero', '4:S413')
    expect(s.map((x) => `${x.icon}|${x.text}|${x.detail ?? ''}`)).toEqual([
      'depart|Desde el paradero Vergara / esq. Gorbea, camina hacia el sur por la vereda de Vergara|Avanza 38 m',
      'left|Gira a la izquierda en el número 432 de Vergara|Avanza 16 m, cruzando la puerta principal de Vergara 432 y los torniquetes',
      'left|Gira a la izquierda en el lobby|Avanza 6 m',
      'right|Gira a la derecha en el hall de ascensores|Avanza 7 m, pasando la Secretaría de Estudios (a tu izquierda)',
      'left|Gira a la izquierda hacia la escalera principal|Avanza 2 m',
      'stairs-up|Sube por la escalera principal hasta el piso 4|3 pisos · 6 tramos con descanso',
      'depart|Sal de la escalera en el piso 4|Avanza 2 m',
      'right|Gira a la derecha en el pasillo, frente a la escalera|Avanza 9 m, pasando la Sala 412 (a tu derecha)',
      'arrive|Sala 413 está a tu izquierda|Es la 1.ª puerta a tu izquierda desde el último giro · V432.4.S413',
    ])
  })

  it('sin escaleras cuenta las puertas del lado de la sala', () => {
    const { steps: s } = steps('out:paradero', '4:S413', true)
    const last = s[s.length - 1]
    expect(last.detail).toContain('2.ª puerta a tu izquierda')
    expect(s.some((x) => x.detail?.includes('pasando la Sala 414 (a tu izquierda) y la Sala 412 (a tu derecha)'))).toBe(
      true,
    )
    expect(s.some((x) => x.icon === 'elevator' && x.text.includes('marca el 4'))).toBe(true)
  })

  it('patio → auditorio junta dos giros seguidos', () => {
    const { steps: s } = steps('out:patio', '3:AU')
    expect(s.some((x) => x.text.includes('y enseguida a la derecha'))).toBe(true)
    expect(s[s.length - 1].text).toBe('Auditorio está a tu izquierda')
  })

  it('los pasos avanzan sobre la ruta sin salirse de ella', () => {
    for (const [from, to, stepFree] of [
      ['out:paradero', '4:S413', false],
      ['out:paradero', '4:S413', true],
      ['out:patio', '3:AU', false],
      ['1:lobby:a', '5:S515', true],
    ] as const) {
      const { route, steps: s } = steps(from, to, stepFree)
      for (let i = 1; i < s.length; i++) expect(s[i].from).toBeGreaterThanOrEqual(s[i - 1].from)
      for (const step of s) expect(step.to).toBeLessThan(route.nodes.length)
    }
  })

  it('una ruta sin sala de destino termina en "Llegaste a"', () => {
    const { steps: s } = steps('out:paradero', '1:lobby:c')
    expect(s[s.length - 1].kind).toBe('end')
    expect(s[s.length - 1].text).toBe('Llegaste al hall al patio')
  })
})

describe('artículo de las salas', () => {
  it('distingue el género por el primer sustantivo', () => {
    expect(isFeminine('Sala 412')).toBe(true)
    expect(isFeminine('Secretaría de Estudios')).toBe(true)
    expect(isFeminine('Auditorio')).toBe(false)
    expect(isFeminine('Aula Magna')).toBe(false)
  })
})
