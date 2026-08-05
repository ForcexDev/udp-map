import { describe, expect, it } from 'vitest'
import { areaVisibleOnFloor, pinVisibleOnFloor } from './floorVisibility'

// La planta es un contexto de FACULTAD: elegir el 2 enseña el segundo piso de
// todos sus edificios a la vez, y deja fuera lo que no esté en él.

const FIC = 'ingenieria'

describe('pinVisibleOnFloor', () => {
  it('sin planta activa se ve todo', () => {
    expect(pinVisibleOnFloor({ faculty_id: FIC, floor: 3 }, FIC, null)).toBe(true)
    expect(pinVisibleOnFloor({ faculty_id: FIC, floor: null }, FIC, null)).toBe(true)
  })

  it('con el piso 2 puesto, solo los del piso 2 de esa facultad', () => {
    expect(pinVisibleOnFloor({ faculty_id: FIC, floor: 2 }, FIC, 2)).toBe(true)
    expect(pinVisibleOnFloor({ faculty_id: FIC, floor: 3 }, FIC, 2)).toBe(false)
    expect(pinVisibleOnFloor({ faculty_id: FIC, floor: -1 }, FIC, 2)).toBe(false)
  })

  it('un pin de exterior cuenta como planta baja', () => {
    // A ras de suelo el patio es contexto; desde el segundo piso es ruido.
    expect(pinVisibleOnFloor({ faculty_id: FIC, floor: null }, FIC, 1)).toBe(true)
    expect(pinVisibleOnFloor({ faculty_id: FIC, floor: null }, FIC, 2)).toBe(false)
    expect(pinVisibleOnFloor({ faculty_id: FIC, floor: null }, FIC, -1)).toBe(false)
  })

  it('los pines de otras facultades no se tocan', () => {
    // Elegir el piso 3 de Ingeniería no puede vaciar el resto del mapa.
    expect(pinVisibleOnFloor({ faculty_id: 'derecho', floor: null }, FIC, 3)).toBe(true)
    expect(pinVisibleOnFloor({ faculty_id: 'derecho', floor: 1 }, FIC, 3)).toBe(true)
    expect(pinVisibleOnFloor({ faculty_id: null, floor: null }, FIC, 3)).toBe(true)
  })
})

describe('areaVisibleOnFloor', () => {
  const defaultFloorOf = () => 1

  it('el exterior se ve siempre, en cualquier planta', () => {
    const patio = { faculty_id: FIC, building_id: null, floor: null }
    for (const floor of [null, 1, 2, -1]) {
      expect(areaVisibleOnFloor(patio, FIC, floor, defaultFloorOf)).toBe(true)
    }
  })

  it('sin planta activa, cada edificio enseña la suya por defecto', () => {
    const baja = { faculty_id: FIC, building_id: 'e441', floor: 1 }
    const tercero = { faculty_id: FIC, building_id: 'e441', floor: 3 }
    expect(areaVisibleOnFloor(baja, FIC, null, defaultFloorOf)).toBe(true)
    expect(areaVisibleOnFloor(tercero, FIC, null, defaultFloorOf)).toBe(false)
  })

  it('con el piso 2 puesto, el piso 2 de todos los edificios', () => {
    const unEdificio = { faculty_id: FIC, building_id: 'e441', floor: 2 }
    const otro = { faculty_id: FIC, building_id: 'v432', floor: 2 }
    expect(areaVisibleOnFloor(unEdificio, FIC, 2, defaultFloorOf)).toBe(true)
    expect(areaVisibleOnFloor(otro, FIC, 2, defaultFloorOf)).toBe(true)
    expect(areaVisibleOnFloor({ ...otro, floor: 1 }, FIC, 2, defaultFloorOf)).toBe(false)
  })

  it('otra facultad se queda en su planta por defecto', () => {
    const ajena = { faculty_id: 'derecho', building_id: 'd1', floor: 1 }
    expect(areaVisibleOnFloor(ajena, FIC, 3, defaultFloorOf)).toBe(true)
    expect(areaVisibleOnFloor({ ...ajena, floor: 3 }, FIC, 3, defaultFloorOf)).toBe(false)
  })
})
