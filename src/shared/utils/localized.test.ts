import { describe, expect, it } from 'vitest'
import { localizedName } from './localized'

const sala = { name: 'Sala', name_en: 'Classroom' }

describe('localizedName', () => {
  it('devuelve el idioma que toca', () => {
    expect(localizedName(sala, 'es')).toBe('Sala')
    expect(localizedName(sala, 'en')).toBe('Classroom')
  })

  it('acepta las variantes regionales de i18next', () => {
    // i18next entrega 'en-US' cuando lo detecta del navegador. Comparar la
    // cadena entera contra 'en' dejaba esos casos en español.
    expect(localizedName(sala, 'en-US')).toBe('Classroom')
    expect(localizedName(sala, 'es-CL')).toBe('Sala')
  })

  it('cae al español si falta la traducción, en vez de dejar el hueco vacío', () => {
    expect(localizedName({ name: 'Escalera' }, 'en')).toBe('Escalera')
    expect(localizedName({ name: 'Escalera', name_en: '' }, 'en')).toBe('Escalera')
  })

  it('aguanta que no haya nada', () => {
    expect(localizedName(null, 'en')).toBe('')
    expect(localizedName(undefined, 'es')).toBe('')
  })
})
