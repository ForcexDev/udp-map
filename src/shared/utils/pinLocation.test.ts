import { describe, expect, it } from 'vitest'
import type { Pin } from '@/shared/types/database'
import { isPinLocationOccupied } from './pinLocation'

const NOW = Date.parse('2026-07-21T15:00:00.000Z')

function location(overrides: Partial<Pin> = {}) {
  return {
    id: 'pin-1',
    lat: -33.4494,
    lng: -70.6551,
    is_permanent: false,
    expires_at: '2026-07-21T16:00:00.000Z',
    ...overrides,
  }
}

describe('ocupación de coordenadas de pines', () => {
  it('detecta un pin vigente en las mismas coordenadas exactas', () => {
    expect(isPinLocationOccupied([location()], -33.4494, -70.6551, null, NOW)).toBe(true)
    expect(isPinLocationOccupied([location()], -33.44941, -70.6551, null, NOW)).toBe(false)
  })

  it('ignora el pin que se está moviendo y los pines expirados', () => {
    expect(isPinLocationOccupied([location()], -33.4494, -70.6551, 'pin-1', NOW)).toBe(false)
    expect(isPinLocationOccupied([
      location({ expires_at: '2026-07-21T14:00:00.000Z' }),
    ], -33.4494, -70.6551, null, NOW)).toBe(false)
  })
})
