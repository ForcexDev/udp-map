import { describe, expect, it } from 'vitest'
import { shortenUrl } from './shortenUrl'

describe('shortenUrl', () => {
  it('deja el dominio solo cuando no hay ruta', () => {
    expect(shortenUrl('https://www.udp.cl')).toBe('udp.cl')
    expect(shortenUrl('https://udp.cl/')).toBe('udp.cl')
  })

  it('quita el www pero conserva el resto del dominio', () => {
    expect(shortenUrl('https://www.ingenieria.udp.cl/salas')).toBe('ingenieria.udp.cl/salas')
  })

  it('acorta una ruta larga conservando el dominio entero', () => {
    // El dominio es lo que dice a dónde lleva el enlace: se recorta la ruta,
    // nunca el host.
    const largo =
      'https://lh3.googleusercontent.com/meips/ADKq_NZbvtbpakMrmWaftp2imJTeeRIYBxd_ryI47Y-SCWF6RSHCJrq1vgZDxv3rj4GqLisuWLqyUq6ldwL'
    const corto = shortenUrl(largo)

    expect(corto.startsWith('lh3.googleusercontent.com')).toBe(true)
    expect(corto.endsWith('…')).toBe(true)
    expect(corto.length).toBeLessThanOrEqual(39)
  })

  it('no alarga una URL que ya es corta', () => {
    expect(shortenUrl('https://udp.cl/mapa')).toBe('udp.cl/mapa')
  })

  it('respeta el largo máximo pedido', () => {
    expect(shortenUrl('https://ejemplo.com/uno/dos/tres/cuatro/cinco', 20).length).toBeLessThanOrEqual(21)
  })

  it('devuelve el texto tal cual si no es una URL válida', () => {
    expect(shortenUrl('no soy una url')).toBe('no soy una url')
  })

  it('un host más largo que el máximo no se parte a la mitad', () => {
    // Cortar el host dejaría un enlace que parece de otro sitio.
    const corto = shortenUrl('https://subdominio-larguisimo.ejemplo.com/x/y/z', 15)
    expect(corto.startsWith('subdominio-larguisimo.ejemplo.com')).toBe(true)
  })
})
