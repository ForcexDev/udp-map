import { describe, expect, it } from 'vitest'
import type { Pin } from '@/shared/types/database'
import { searchRooms, normalizeRoomQuery } from './roomSearch'

const room = (code: string | null, title = code ?? 'Sin código') =>
  ({ id: code ?? title, title, room_code: code } as unknown as Pin)

const campus: Pin[] = [
  room('E441.1.S101'),
  room('E441.1.S106'),
  room('E441.2.S201'),
  room('E278A.1.S106'),
  room('M253B.4.S402'),
  room('SMV-03', 'Laboratorio del subterráneo'),
  room(null, 'Microondas del casino'),
  room(null, 'Sala de estudio 106'),
]

describe('searchRooms', () => {
  it('encuentra por código completo: el caso que devolvía "Sin resultados"', () => {
    const r = searchRooms(campus, 'E441.1.S106')
    expect(r[0].room_code).toBe('E441.1.S106')
  })

  it('encuentra por edificio: todas las salas de ese edificio', () => {
    const r = searchRooms(campus, 'E441')
    expect(r.map((p) => p.room_code)).toEqual(['E441.1.S101', 'E441.1.S106', 'E441.2.S201'])
  })

  it('encuentra por número: la misma sala en facultades distintas', () => {
    // "106" tiene que traer las dos S106, de edificios diferentes.
    const codigos = searchRooms(campus, '106').map((p) => p.room_code)
    expect(codigos).toContain('E441.1.S106')
    expect(codigos).toContain('E278A.1.S106')
  })

  it('pone la sala antes que el pin que solo la menciona en el título', () => {
    // Quien escribe "106" busca una sala llamada 106, no algo que la nombre.
    const r = searchRooms(campus, '106')
    expect(r[0].room_code).not.toBeNull()
  })

  it('un pin sin código no es una sala, aunque su título encaje', () => {
    // "Sala de estudio 106" no tiene código: no es una sala del catálogo.
    const r = searchRooms(campus, '106')
    expect(r.some((p) => p.title === 'Sala de estudio 106')).toBe(false)
  })

  it('acota por planta cuando se escribe', () => {
    expect(searchRooms(campus, 'E441.2').map((p) => p.room_code)).toEqual(['E441.2.S201'])
  })

  it('aguanta los edificios con sufijo de letra', () => {
    // E278A y E278B son entradas distintas del mismo número, y son edificios
    // distintos. Buscar "E278A" no puede traer los dos.
    expect(searchRooms(campus, 'E278A').map((p) => p.room_code)).toEqual(['E278A.1.S106'])
  })

  it('encuentra los códigos que no siguen el esquema posicional', () => {
    expect(searchRooms(campus, 'SMV').map((p) => p.room_code)).toEqual(['SMV-03'])
  })

  it('no busca con menos de dos caracteres, que casaría medio campus', () => {
    expect(searchRooms(campus, 'E')).toEqual([])
    expect(searchRooms(campus, '')).toEqual([])
  })

  it('da igual mayúsculas, tildes y espacios', () => {
    expect(searchRooms(campus, ' e441.1.s106 ')[0].room_code).toBe('E441.1.S106')
  })

  it('respeta el límite', () => {
    expect(searchRooms(campus, 'S', 2)).toHaveLength(0) // una letra, no busca
    expect(searchRooms(campus, 'E4', 2)).toHaveLength(2)
  })
})

describe('normalizeRoomQuery', () => {
  it('conserva los puntos, que son los que separan edificio, planta y sala', () => {
    expect(normalizeRoomQuery('E441.1.S106')).toBe('e441.1.s106')
  })
})
