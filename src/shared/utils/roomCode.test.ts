import { describe, expect, it } from 'vitest'
import { floorFromRoomCode, parseRoomCode } from './roomCode'

describe('parseRoomCode', () => {
  it('lee el esquema posicional de los edificios principales', () => {
    expect(parseRoomCode('E441.1.S101')).toEqual({
      buildingCode: 'E441',
      floor: 1,
      room: 'S101',
    })
    expect(parseRoomCode('V432.3.A12')).toEqual({
      buildingCode: 'V432',
      floor: 3,
      room: 'A12',
    })
  })

  it('entiende los subterráneos', () => {
    expect(parseRoomCode('E441.-1.S02')?.floor).toBe(-1)
  })

  it('lee los edificios con sufijo de letra, que son edificios distintos', () => {
    // `E278A` y `E278B` son dos entradas del mismo número de Ejército, y
    // `M253A`/`M253B` lo mismo en Manuel Rodríguez. El patrón exigía que el
    // prefijo terminara en dígito, así que estas once salas del catálogo de
    // `docs/SALAS.md` se quedaban sin planta.
    expect(parseRoomCode('E278A.4.S402')).toEqual({
      buildingCode: 'E278A',
      floor: 4,
      room: 'S402',
    })
    expect(parseRoomCode('M253B.4.S402')?.buildingCode).toBe('M253B')
  })

  it('conserva el punto interior de los laboratorios del cuarto de E441', () => {
    // `L.D`, `L.O` y `L.U` llevan un punto dentro del nombre de la sala.
    // Partir por TODOS los puntos los perdería; solo cuentan los dos primeros.
    expect(parseRoomCode('E441.4.L.D')).toEqual({
      buildingCode: 'E441',
      floor: 4,
      room: 'L.D',
    })
  })

  it('conserva los nombres de sala con espacio', () => {
    expect(parseRoomCode('E441.5.LAB INF')?.room).toBe('LAB INF')
  })

  it('lee el esquema con guion, donde la planta es el primer dígito', () => {
    expect(parseRoomCode('A-302')).toEqual({ buildingCode: 'A', floor: 3, room: '302' })
  })

  it('normaliza el prefijo a mayúsculas pero conserva la sala', () => {
    expect(parseRoomCode('e441.2.s205')).toEqual({
      buildingCode: 'E441',
      floor: 2,
      room: 's205',
    })
  })

  it('devuelve null en los códigos que no siguen ningún esquema conocido', () => {
    // El caso real: una sala del subterráneo con código propio. Que no se pueda
    // deducir la planta es normal, no un error — se elige a mano.
    expect(parseRoomCode('SMV-03')).toBeNull()
    expect(parseRoomCode('Sala del fondo')).toBeNull()
    expect(parseRoomCode('')).toBeNull()
    expect(parseRoomCode('   ')).toBeNull()
  })

  it('no deduce nada si el código dice planta 0', () => {
    // La planta 0 no existe en la convención: antes que preseleccionar algo
    // imposible, no se preselecciona nada.
    expect(parseRoomCode('E441.0.S1')?.floor).toBeNull()
  })

  it('ignora espacios alrededor', () => {
    expect(parseRoomCode('  E441.1.S101  ')?.room).toBe('S101')
  })
})

describe('floorFromRoomCode', () => {
  it('devuelve la planta cuando el código la expone', () => {
    expect(floorFromRoomCode('E441.2.S201')).toBe(2)
  })

  it('devuelve null cuando no', () => {
    expect(floorFromRoomCode('SMV-03')).toBeNull()
  })
})
