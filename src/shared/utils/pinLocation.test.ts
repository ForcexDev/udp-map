import { describe, expect, it } from 'vitest'
import type { Pin } from '@/shared/types/database'
import { isPinLocationOccupied } from './pinLocation'

const NOW = Date.parse('2026-07-21T15:00:00.000Z')
const LAT = -33.4494
const LNG = -70.6551

function location(overrides: Partial<Pin> = {}) {
  return {
    id: 'pin-1',
    lat: LAT,
    lng: LNG,
    floor: null as number | null,
    is_permanent: false,
    expires_at: '2026-07-21T16:00:00.000Z',
    ...overrides,
  }
}

describe('ocupación de coordenadas de pines', () => {
  it('detecta un pin vigente en las mismas coordenadas exactas', () => {
    expect(isPinLocationOccupied([location()], LAT, LNG, null, undefined, NOW)).toBe(true)
    expect(isPinLocationOccupied([location()], -33.44941, LNG, null, undefined, NOW)).toBe(false)
  })

  it('ignora el pin que se está moviendo y los pines expirados', () => {
    expect(isPinLocationOccupied([location()], LAT, LNG, null, 'pin-1', NOW)).toBe(false)
    expect(
      isPinLocationOccupied(
        [location({ expires_at: '2026-07-21T14:00:00.000Z' })],
        LAT,
        LNG,
        null,
        undefined,
        NOW,
      ),
    ).toBe(false)
  })

  it('el mismo punto en plantas distintas no está ocupado', () => {
    // Una impresora en el piso 2 y otra en el 3 de la misma esquina son dos
    // cosas distintas. Sin esto, mapear un edificio de salas era imposible.
    const enElDos = [location({ floor: 2 })]
    expect(isPinLocationOccupied(enElDos, LAT, LNG, 3, undefined, NOW)).toBe(false)
    expect(isPinLocationOccupied(enElDos, LAT, LNG, 2, undefined, NOW)).toBe(true)
  })

  it('el exterior no choca con la planta baja', () => {
    // floor null es "al aire libre", y no es lo mismo que el piso 1.
    expect(isPinLocationOccupied([location({ floor: null })], LAT, LNG, 1, undefined, NOW)).toBe(false)
    expect(isPinLocationOccupied([location({ floor: 1 })], LAT, LNG, null, undefined, NOW)).toBe(false)
  })

  it('un subterráneo no choca con el piso del mismo número positivo', () => {
    expect(isPinLocationOccupied([location({ floor: -1 })], LAT, LNG, 1, undefined, NOW)).toBe(false)
    expect(isPinLocationOccupied([location({ floor: -1 })], LAT, LNG, -1, undefined, NOW)).toBe(true)
  })
})
