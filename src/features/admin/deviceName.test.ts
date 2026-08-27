import { describe, expect, it } from 'vitest'
import { deviceName } from './deviceName'

describe('deviceName', () => {
  it('reconoce los navegadores que se disfrazan de otro', () => {
    // Edge se anuncia como Chrome Y como Edg; si Chrome se comprobara antes,
    // toda la gente de Edge aparecería como Chrome en la lista.
    expect(deviceName('Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141 Safari/537.36 Edg/141'))
      .toBe('Edge · Windows')
    // Chrome en iOS es CriOS, y Safari aparece en la cadena de casi todos.
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_2) CriOS/141 Mobile/15E148 Safari/604.1'))
      .toBe('Chrome · iPhone')
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_2) AppleWebKit/605 Version/18.2 Safari/604.1'))
      .toBe('Safari · iPhone')
  })

  it('resuelve los casos corrientes', () => {
    expect(deviceName('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/141 Mobile Safari/537.36'))
      .toBe('Chrome · Android')
    expect(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/133.0'))
      .toBe('Firefox · Mac')
  })

  it('no revienta ni miente cuando no sabe', () => {
    expect(deviceName(null)).toBe('Dispositivo desconocido')
    expect(deviceName('')).toBe('Dispositivo desconocido')
    expect(deviceName('algo-que-no-es-un-user-agent')).toBe('Dispositivo desconocido')
  })
})
