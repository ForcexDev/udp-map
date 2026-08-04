import { describe, expect, it } from 'vitest'
import { eventPhase, eventTouchesDay, isEventLive } from './eventState'

const iso = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString()

const at = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime()

describe('eventPhase', () => {
  const start = iso(2026, 8, 12, 10, 0)
  const end = iso(2026, 8, 12, 14, 0)

  it('sin fecha de inicio no se puede situar', () => {
    expect(eventPhase(null, end, at(2026, 8, 12, 11))).toBe('unscheduled')
    expect(eventPhase('no-es-una-fecha', end, at(2026, 8, 12, 11))).toBe('unscheduled')
  })

  it('antes del inicio está por venir', () => {
    expect(eventPhase(start, end, at(2026, 8, 12, 9, 59))).toBe('upcoming')
  })

  it('el instante de inicio ya cuenta como en vivo', () => {
    expect(eventPhase(start, end, at(2026, 8, 12, 10, 0))).toBe('live')
  })

  it('el instante de término ya no', () => {
    expect(eventPhase(start, end, at(2026, 8, 12, 14, 0))).toBe('ended')
  })

  it('sin fecha de término sigue en vivo tras empezar', () => {
    expect(eventPhase(start, null, at(2027, 1, 1))).toBe('live')
  })

  it('isEventLive coincide con la fase', () => {
    expect(isEventLive(start, end, at(2026, 8, 12, 12))).toBe(true)
    expect(isEventLive(start, end, at(2026, 8, 12, 15))).toBe(false)
  })
})

describe('eventTouchesDay', () => {
  it('un evento de varios días cuenta en los intermedios', () => {
    const start = iso(2026, 8, 10, 18, 0)
    const end = iso(2026, 8, 13, 2, 0)
    expect(eventTouchesDay(start, end, new Date(2026, 7, 11))).toBe(true)
    expect(eventTouchesDay(start, end, new Date(2026, 7, 13))).toBe(true)
    expect(eventTouchesDay(start, end, new Date(2026, 7, 14))).toBe(false)
    expect(eventTouchesDay(start, end, new Date(2026, 7, 9))).toBe(false)
  })

  it('sin término se cuenta solo el día de inicio', () => {
    const start = iso(2026, 8, 10, 18, 0)
    expect(eventTouchesDay(start, null, new Date(2026, 7, 10))).toBe(true)
    expect(eventTouchesDay(start, null, new Date(2026, 7, 11))).toBe(false)
  })
})
