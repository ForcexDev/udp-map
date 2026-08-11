import { describe, expect, it } from 'vitest'
import type { Building, BuildingFloor } from '@/shared/types/database'
import { floorRejectionKey, validatePinFloor } from './floorValidation'

// ─────────────────────────────────────────────────────────────────────────────
// Espejo del trigger trg_validate_pin_floor.
//
// Lo que se fija aquí no es "rechaza plantas raras": es DÓNDE deja de rechazar.
// La regla tiene que ser estricta dentro de un edificio mapeado y muda en el
// campus sin mapear, porque si no bloquea el uso normal de la app en casi todo
// el campus. Esas dos fronteras son lo que se rompe si alguien la endurece.
// ─────────────────────────────────────────────────────────────────────────────

function building(id: string, facultyId: string): Building {
  return {
    id,
    faculty_id: facultyId,
    name: id,
    short_name: null,
    aliases: [],
    footprint: { type: 'Polygon', coordinates: [] },
    default_floor: 1,
    height_m: null,
    color: null,
    sort_order: 0,
  } as Building
}

function floor(buildingId: string, level: number): BuildingFloor {
  return { building_id: buildingId, level, label: null }
}

// Ingeniería tiene un edificio con pisos 1..3 y un subterráneo; Derecho tiene
// otro edificio solo con planta baja. Arquitectura no está mapeada.
const MAPPING = {
  buildings: [building('v432', 'ingenieria'), building('rep', 'derecho')],
  floors: [
    floor('v432', -1),
    floor('v432', 1),
    floor('v432', 2),
    floor('v432', 3),
    floor('rep', 1),
  ],
}

describe('validatePinFloor', () => {
  it('acepta un pin sin planta: es de exterior', () => {
    expect(validatePinFloor(MAPPING, { floor: null, buildingId: 'v432', facultyId: 'ingenieria' }))
      .toBeNull()
  })

  it('rechaza la planta 0, que no existe en el modelo', () => {
    expect(validatePinFloor(MAPPING, { floor: 0, buildingId: null, facultyId: 'ingenieria' }))
      .toBe('FLOOR_ZERO')
  })

  describe('dentro de un edificio', () => {
    it('acepta una planta declarada, incluido el subterráneo', () => {
      expect(validatePinFloor(MAPPING, { floor: 3, buildingId: 'v432', facultyId: 'ingenieria' }))
        .toBeNull()
      expect(validatePinFloor(MAPPING, { floor: -1, buildingId: 'v432', facultyId: 'ingenieria' }))
        .toBeNull()
    })

    it('rechaza una planta que ese edificio no tiene', () => {
      expect(validatePinFloor(MAPPING, { floor: 5, buildingId: 'v432', facultyId: 'ingenieria' }))
        .toBe('INVALID_FLOOR_FOR_BUILDING')
    })

    // El caso exacto del bug: el -1 existe en el campus, pero no en ESTE
    // edificio. Comprobar contra la facultad aquí dejaría pasar el error.
    it('rechaza una planta que existe en otro edificio pero no en el suyo', () => {
      expect(validatePinFloor(MAPPING, { floor: -1, buildingId: 'rep', facultyId: 'derecho' }))
        .toBe('INVALID_FLOOR_FOR_BUILDING')
    })

    // Único punto donde el cliente se aparta del trigger, y a propósito: el
    // snapshot empieza vacío y viene acotado a una facultad, así que "no está
    // en el snapshot" significa "no sé", no "no existe". Tratarlo como rechazo
    // bloqueaba editar la planta antes de que cargara el mapeo.
    it('no juzga un edificio que no está en el snapshot', () => {
      expect(validatePinFloor(MAPPING, { floor: 9, buildingId: 'desconocido', facultyId: 'ingenieria' }))
        .toBeNull()
      expect(validatePinFloor({ buildings: [], floors: [] }, { floor: 9, buildingId: 'v432', facultyId: 'ingenieria' }))
        .toBeNull()
    })
  })

  describe('con planta pero sin edificio', () => {
    it('acepta si el nivel existe en algún edificio de la facultad', () => {
      expect(validatePinFloor(MAPPING, { floor: 2, buildingId: null, facultyId: 'ingenieria' }))
        .toBeNull()
    })

    it('rechaza si la facultad no tiene ese nivel en ninguno', () => {
      expect(validatePinFloor(MAPPING, { floor: -3, buildingId: null, facultyId: 'ingenieria' }))
        .toBe('FLOOR_NOT_IN_FACULTY')
    })

    // Las dos salidas mudas. Exigir mapeo para poder decir "piso 2" apagaría la
    // planta en todo el campus que aún no se ha trazado, que es casi todo.
    it('no rechaza nada si la facultad no tiene edificios mapeados', () => {
      expect(validatePinFloor(MAPPING, { floor: 7, buildingId: null, facultyId: 'arquitectura' }))
        .toBeNull()
    })

    it('no rechaza nada si el pin no tiene facultad', () => {
      expect(validatePinFloor(MAPPING, { floor: 7, buildingId: null, facultyId: null }))
        .toBeNull()
    })

    it('no rechaza nada si el mapeo todavía no cargó', () => {
      expect(validatePinFloor({ buildings: [], floors: [] }, { floor: 4, buildingId: null, facultyId: 'ingenieria' }))
        .toBeNull()
    })
  })
})

describe('floorRejectionKey', () => {
  it('traduce los códigos que levantan la base y el modo demo', () => {
    expect(floorRejectionKey('INVALID_FLOOR_FOR_BUILDING')).toBe('pin.invalidFloorForBuilding')
    expect(floorRejectionKey('FLOOR_NOT_IN_FACULTY')).toBe('pin.floorNotInFaculty')
    expect(floorRejectionKey('FLOOR_ZERO')).toBe('pin.floorZero')
  })

  // Postgres antepone su propio prefijo al mensaje de un raise exception.
  it('reconoce el código dentro del mensaje envuelto de Postgres', () => {
    expect(floorRejectionKey('error: INVALID_FLOOR_FOR_BUILDING'))
      .toBe('pin.invalidFloorForBuilding')
  })

  // La planta 0 la base la rechaza con frase, no con código.
  it('reconoce la frase en español de la planta 0', () => {
    expect(floorRejectionKey('La planta 0 no existe: usa 1 para la planta baja y -1 para el subterráneo.'))
      .toBe('pin.floorZero')
  })

  it('no se apropia de errores que no son de planta', () => {
    expect(floorRejectionKey('PIN_LOCATION_OCCUPIED')).toBeNull()
    expect(floorRejectionKey('')).toBeNull()
  })
})
