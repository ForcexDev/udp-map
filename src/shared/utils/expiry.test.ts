import { describe, expect, it } from 'vitest'
import { expiresAtFromTtl, expiryState, FADE_WINDOW_MS, MIN_FADE_OPACITY } from './expiry'

const NOW = Date.parse('2026-07-08T12:00:00Z')
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

describe('expiryState — ciclo de vida efímero (plan §2)', () => {
  it('permanente: nunca expira ni se desvanece', () => {
    expect(expiryState(null, true, NOW).status).toBe('permanent')
    // is_permanent manda incluso si quedó un expires_at antiguo
    expect(expiryState(iso(-1000), true, NOW).status).toBe('permanent')
    expect(expiryState(null, false, NOW).status).toBe('permanent')
  })

  it('activo con opacidad 1 fuera de la ventana de desvanecimiento', () => {
    const s = expiryState(iso(FADE_WINDOW_MS + 60_000), false, NOW)
    expect(s.status).toBe('active')
    expect(s.opacity).toBe(1)
  })

  it('se desvanece dentro de la ventana: opacidad decrece hacia el mínimo', () => {
    const half = expiryState(iso(FADE_WINDOW_MS / 2), false, NOW)
    expect(half.status).toBe('fading')
    expect(half.opacity).toBeLessThan(1)
    expect(half.opacity).toBeGreaterThan(MIN_FADE_OPACITY)

    const almost = expiryState(iso(60_000), false, NOW)
    expect(almost.opacity).toBeLessThan(half.opacity)
    expect(almost.opacity).toBeGreaterThanOrEqual(MIN_FADE_OPACITY)
  })

  it('expirado: se oculta', () => {
    const s = expiryState(iso(-1), false, NOW)
    expect(s.status).toBe('expired')
    expect(s.opacity).toBe(0)
  })
})

describe('expiresAtFromTtl — TTL por categoría', () => {
  it('calcula NOW + ttl horas', () => {
    expect(expiresAtFromTtl(6, NOW)).toBe(iso(6 * 3600_000))
    expect(expiresAtFromTtl(72, NOW)).toBe(iso(72 * 3600_000))
  })
  it('null o TTL no positivo → sin expiración', () => {
    expect(expiresAtFromTtl(null, NOW)).toBeNull()
    expect(expiresAtFromTtl(0, NOW)).toBeNull()
  })
})
