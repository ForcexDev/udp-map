import { describe, expect, it, vi } from 'vitest'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { scaleTextSize, shrinkBaseMapLabels } from './mapConfig'

describe('scaleTextSize', () => {
  it('escala un número', () => {
    expect(scaleTextSize(12, 0.9)).toBe(10.8)
  })

  it('escala solo las salidas de un interpolate por zoom', () => {
    const size = ['interpolate', ['linear'], ['zoom'], 13, 12, 14, 13]
    expect(scaleTextSize(size, 0.5)).toEqual(['interpolate', ['linear'], ['zoom'], 13, 6, 14, 6.5])
  })

  it('escala solo las salidas de un step por zoom', () => {
    expect(scaleTextSize(['step', ['zoom'], 11, 18, 12], 0.5)).toEqual([
      'step',
      ['zoom'],
      5.5,
      18,
      6,
    ])
  })

  it('deja intactas las expresiones no previstas', () => {
    const size = ['get', 'size']
    expect(scaleTextSize(size, 0.5)).toBe(size)
  })
})

describe('shrinkBaseMapLabels', () => {
  it('parte siempre del tamaño original aunque style.load se repita', () => {
    const sizes: Record<string, unknown> = { poi: 12, own: 11 }
    const map = {
      getStyle: () => ({
        layers: [
          { id: 'poi', type: 'symbol', source: 'openmaptiles' },
          { id: 'own', type: 'symbol', source: 'campus' },
        ],
      }),
      getLayoutProperty: (id: string) => sizes[id],
      setLayoutProperty: vi.fn((id: string, _prop: string, value: unknown) => {
        sizes[id] = value
      }),
    } as unknown as MapLibreMap

    shrinkBaseMapLabels(map, 0.5)
    shrinkBaseMapLabels(map, 0.5)

    expect(sizes.poi).toBe(6)
    expect(sizes.own).toBe(11)
  })
})
