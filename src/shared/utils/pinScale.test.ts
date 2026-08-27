import { describe, expect, it } from 'vitest'
import { pinScaleForZoom } from './pinScale'

describe('pinScaleForZoom', () => {
  it('no encoge nunca por debajo del tamaño de siempre', () => {
    // Se probó encogiendo a 20 px de lejos y quedó ilegible, sobre todo
    // combinado con la base más pequeña de la infraestructura fija.
    expect(pinScaleForZoom(10)).toBe(1)
    expect(pinScaleForZoom(16)).toBe(1)
    expect(pinScaleForZoom(18)).toBe(1)
  })

  it('crece de cerca hasta los 30 px', () => {
    expect(pinScaleForZoom(19) * 26).toBeCloseTo(30, 1)
    expect(pinScaleForZoom(22) * 26).toBeCloseTo(30, 1)
  })

  it('interpola entre los dos tramos en vez de saltar', () => {
    expect(pinScaleForZoom(18.5)).toBeGreaterThan(1)
    expect(pinScaleForZoom(18.5)).toBeLessThan(pinScaleForZoom(19))
  })
})
