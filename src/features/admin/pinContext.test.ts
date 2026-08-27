import { describe, expect, it } from 'vitest'
import type { Pin } from '@/shared/types/database'
import { pinContext } from './pinContext'

const base = {
  id: 'p1', type: 'report', title: 'Sala S101',
  category_id: null, faculty_id: null, floor: null, room_code: null,
} as unknown as Pin

const pin = (extra: Partial<Pin>) => ({ ...base, ...extra }) as Pin

describe('pinContext', () => {
  it('ordena de lo más grande a lo más pequeño', () => {
    // Es como se ubica uno: primero el edificio, después el piso.
    expect(pinContext(pin({ category_id: 'sala', faculty_id: 'ingenieria', floor: 2, room_code: 'E441.2.S201' })))
      .toBe('Sala · Facultad de Ingeniería y Ciencias · Piso 2 · E441.2.S201')
  })

  it('llama subterráneo al piso negativo', () => {
    // "Piso -1" no es como lo dice nadie, y la planta 0 no existe.
    expect(pinContext(pin({ floor: -1 }))).toBe('Subterráneo 1')
    expect(pinContext(pin({ floor: 1 }))).toBe('Piso 1')
  })

  it('se salta lo que falta en vez de dejar separadores sueltos', () => {
    expect(pinContext(pin({ category_id: 'sala', floor: 3 }))).toBe('Sala · Piso 3')
  })

  it('sin nada que decir cae al tipo, no a una línea vacía', () => {
    // Una fila con el subtítulo vacío descuadra la lista entera.
    expect(pinContext(pin({ type: 'event' as Pin['type'] }))).toBe('event')
  })

  it('ignora una categoría o facultad que ya no existen en el catálogo', () => {
    expect(pinContext(pin({ category_id: 'categoria-borrada', faculty_id: 'facultad-borrada', floor: 2 })))
      .toBe('Piso 2')
  })
})
