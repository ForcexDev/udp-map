import { describe, expect, it } from 'vitest'
import { DAILY_PIN_LIMIT, countPinsCreatedToday, hasReachedDailyPinLimit, nextDailyPinReset } from './rateLimit'

const NOW = Date.parse('2026-07-21T15:00:00.000Z')

function pinsFor(count: number, userId = 'user-1') {
  return Array.from({ length: count }, (_, index) => ({
    creator_id: userId,
    created_at: `2026-07-21T${String(index).padStart(2, '0')}:00:00.000Z`,
  }))
}

describe('límite diario de pines', () => {
  it('usa un máximo de 10 pines', () => {
    expect(DAILY_PIN_LIMIT).toBe(10)
    expect(countPinsCreatedToday(pinsFor(9), 'user-1', NOW)).toBe(9)
    expect(hasReachedDailyPinLimit(pinsFor(9), 'user-1', NOW)).toBe(false)
    expect(hasReachedDailyPinLimit(pinsFor(10), 'user-1', NOW)).toBe(true)
  })

  it('separa usuarios y días', () => {
    const pins = [
      ...pinsFor(10),
      ...pinsFor(10, 'user-2'),
      { creator_id: 'user-1', created_at: '2026-07-20T23:59:59.000Z' },
    ]
    expect(countPinsCreatedToday(pins, 'user-1', NOW)).toBe(10)
    expect(countPinsCreatedToday(pins, 'user-2', NOW)).toBe(10)
  })

  it('restablece la cuota a medianoche UTC', () => {
    expect(nextDailyPinReset(NOW).toISOString()).toBe('2026-07-22T00:00:00.000Z')
  })
})
