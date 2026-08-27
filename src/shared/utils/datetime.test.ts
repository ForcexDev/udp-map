import { describe, expect, it } from 'vitest'
import { relativeTime, relativeTimeKey } from './datetime'

const NOW = new Date('2026-08-27T12:00:00').getTime()
const minutes = (n: number) => NOW + n * 60_000

describe('relativeTimeKey', () => {
  it('usa el singular cuando falta o pasó UN día', () => {
    // El bug que cierra: "en 1 días" salía en la ficha de facultad, en las
    // insignias del pin y en el centro de avisos, porque `time.inDays` no tiene
    // forma singular y los tres componían la clave a mano.
    expect(relativeTimeKey({ direction: 'future', unit: 'day', value: 1 })).toBe('time.inDay')
    expect(relativeTimeKey({ direction: 'past', unit: 'day', value: 1 })).toBe('time.agoDay')
  })

  it('usa el plural a partir de dos', () => {
    expect(relativeTimeKey({ direction: 'future', unit: 'day', value: 2 })).toBe('time.inDays')
    expect(relativeTimeKey({ direction: 'past', unit: 'day', value: 30 })).toBe('time.agoDays')
  })

  it('minutos y horas no distinguen singular, porque abrevian la unidad', () => {
    // "en 1 min" y "en 1 h" ya se leen bien; darles forma singular sería
    // inventar claves que nadie va a traducir distinto.
    expect(relativeTimeKey({ direction: 'future', unit: 'minute', value: 1 })).toBe('time.inMinutes')
    expect(relativeTimeKey({ direction: 'future', unit: 'hour', value: 1 })).toBe('time.inHours')
    expect(relativeTimeKey({ direction: 'past', unit: 'minute', value: 1 })).toBe('time.agoMinutes')
  })

  it('encaja con lo que devuelve relativeTime', () => {
    expect(relativeTimeKey(relativeTime(minutes(60 * 24), NOW))).toBe('time.inDay')
    expect(relativeTimeKey(relativeTime(minutes(-60 * 24), NOW))).toBe('time.agoDay')
    expect(relativeTimeKey(relativeTime(minutes(60 * 24 * 3), NOW))).toBe('time.inDays')
  })
})

describe('relativeTime', () => {
  it('nunca devuelve cero minutos: lo más reciente es "hace 1 min"', () => {
    // Un 0 se leería como "hace 0 min", que no dice nada. Quien quiera decir
    // "ahora" lo decide arriba, mirando el valor.
    expect(relativeTime(NOW, NOW).value).toBe(1)
  })

  it('cambia de unidad al llegar a la hora y al día', () => {
    expect(relativeTime(minutes(59), NOW).unit).toBe('minute')
    expect(relativeTime(minutes(60), NOW).unit).toBe('hour')
    expect(relativeTime(minutes(60 * 24), NOW).unit).toBe('day')
  })

  it('distingue futuro de pasado', () => {
    expect(relativeTime(minutes(30), NOW).direction).toBe('future')
    expect(relativeTime(minutes(-30), NOW).direction).toBe('past')
  })
})
