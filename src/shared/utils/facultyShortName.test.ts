import { describe, expect, it } from 'vitest'
import { FACULTIES } from '@/shared/data/campusData'
import { facultyShortName } from './facultyShortName'

describe('facultyShortName', () => {
  it('arma la sigla saltándose las palabras vacías', () => {
    // La que importa: dentro de la universidad nadie dice el nombre completo.
    expect(facultyShortName('Facultad de Ingeniería y Ciencias')).toBe('FIC')
    expect(facultyShortName('Facultad de Medicina')).toBe('FM')
    expect(facultyShortName('Biblioteca Nicanor Parra')).toBe('BNP')
  })

  it('ignora la puntuación', () => {
    expect(facultyShortName('Facultad de Arquitectura, Arte y Diseño')).toBe('FAAD')
  })

  it('corta en cuatro letras', () => {
    // Más allá deja de leerse como sigla y vuelve a ser un texto largo.
    expect(facultyShortName('Facultad de Ciencias Sociales e Historia')).toBe('FCSH')
    expect(facultyShortName('Uno Dos Tres Cuatro Cinco Seis')).toBe('UDTC')
  })

  it('deja pasar un nombre de una sola palabra', () => {
    // Su inicial sola no distingue nada, así que no hay sigla que valga.
    expect(facultyShortName('Aulario')).toBe('Aulario')
  })

  it('ninguna facultad real se queda sin sigla legible', () => {
    for (const faculty of FACULTIES) {
      const short = facultyShortName(faculty.name)
      expect(short.length).toBeGreaterThan(0)
      expect(short.length).toBeLessThanOrEqual(faculty.name.length)
    }
  })
})
