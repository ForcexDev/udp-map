import { describe, expect, it } from 'vitest'
import {
  buildRoomCatalog,
  catalogFloorsOf,
  catalogRoomsOf,
  missingRooms,
  normalizeRoomCode,
  buildingMatchesCode,
} from './roomCatalog'

// Los `place` de abajo son reales, del corte del 2026-08-26 de
// `salas.docencia-eit.cl/data.json`. Los casos feos son los que importan: el
// horario trae una fila por bloque, no por sala.
const PLACES = [
  'E441.1.S101',
  'E441.1.S101',
  'E441.1.S101',
  'E441.4.L.D',
  'E441.5.LAB INF',
  'E441.-1.AU',
  'E278A.4.S402',
  'V432.-1.SIM',
  'LOC',
  '',
]

describe('buildRoomCatalog', () => {
  it('cuenta los bloques y deja una sola entrada por sala', () => {
    const catalog = buildRoomCatalog(PLACES)
    const s101 = catalog.find((r) => r.code === 'E441.1.S101')

    expect(s101).toMatchObject({ buildingCode: 'E441', floor: 1, room: 'S101', blocks: 3 })
    expect(catalog.filter((r) => r.code === 'E441.1.S101')).toHaveLength(1)
  })

  it('descarta en silencio lo que no se puede mapear', () => {
    // `LOC` y el campo vacío son diez filas de mil trescientas. Fallar por ellas
    // dejaría al importador sin catálogo entero.
    const catalog = buildRoomCatalog(PLACES)

    expect(catalog.map((r) => r.code)).not.toContain('LOC')
    expect(catalog).toHaveLength(6)
  })

  it('conserva las salas con punto y con espacio en el nombre', () => {
    const catalog = buildRoomCatalog(PLACES)

    expect(catalog.find((r) => r.code === 'E441.4.L.D')?.room).toBe('L.D')
    expect(catalog.find((r) => r.code === 'E441.5.LAB INF')?.room).toBe('LAB INF')
  })

  it('no pierde los edificios con sufijo de letra', () => {
    const catalog = buildRoomCatalog(PLACES)

    expect(catalog.find((r) => r.buildingCode === 'E278A')).toBeDefined()
  })

  it('sale ordenado por edificio, planta y sala, con los subterráneos primero', () => {
    const catalog = buildRoomCatalog(PLACES)

    expect(catalog.map((r) => r.code)).toEqual([
      'E278A.4.S402',
      'E441.-1.AU',
      'E441.1.S101',
      'E441.4.L.D',
      'E441.5.LAB INF',
      'V432.-1.SIM',
    ])
  })

  it('ordena las salas por número y no alfabéticamente', () => {
    // Sin `numeric`, S10 iría antes que S2.
    const catalog = buildRoomCatalog(['E441.1.S10', 'E441.1.S2'])

    expect(catalog.map((r) => r.room)).toEqual(['S2', 'S10'])
  })
})

describe('catalogFloorsOf', () => {
  it('devuelve las plantas de un edificio de abajo arriba', () => {
    expect(catalogFloorsOf(buildRoomCatalog(PLACES), 'E441')).toEqual([-1, 1, 4, 5])
  })

  it('devuelve vacío para un edificio que el catálogo no conoce', () => {
    expect(catalogFloorsOf(buildRoomCatalog(PLACES), 'X999')).toEqual([])
  })
})

describe('catalogRoomsOf', () => {
  it('acota por edificio', () => {
    expect(catalogRoomsOf(buildRoomCatalog(PLACES), 'V432')).toHaveLength(1)
  })

  it('acota además por planta cuando se le pide una', () => {
    const enEl4 = catalogRoomsOf(buildRoomCatalog(PLACES), 'E441', 4)

    expect(enEl4.map((r) => r.room)).toEqual(['L.D'])
  })

  it('planta nula significa "todas", no "ninguna"', () => {
    expect(catalogRoomsOf(buildRoomCatalog(PLACES), 'E441', null)).toHaveLength(4)
  })
})

describe('missingRooms', () => {
  const catalog = buildRoomCatalog(['E441.1.S101', 'E441.1.S102'])

  it('deja fuera las que ya tienen pin', () => {
    expect(missingRooms(catalog, ['E441.1.S101']).map((r) => r.room)).toEqual(['S102'])
  })

  it('compara normalizando: el código del pin se guarda tal cual se escribió', () => {
    // `room_code` no se normaliza al guardarlo, a propósito. Si aquí se
    // comparara en crudo, una sala escrita en minúsculas se ofrecería como si
    // faltara y acabaría duplicada.
    expect(missingRooms(catalog, ['  e441.1.s101  '])).toHaveLength(1)
  })

  it('ignora los pines sin código de sala', () => {
    expect(missingRooms(catalog, [null, ''])).toHaveLength(2)
  })
})

describe('normalizeRoomCode', () => {
  it('recorta, sube a mayúsculas y colapsa los espacios interiores', () => {
    expect(normalizeRoomCode('  e441.5.lab   inf ')).toBe('E441.5.LAB INF')
  })
})

describe('buildingMatchesCode', () => {
  it('acepta el código venga del nombre corto o de un alias', () => {
    expect(buildingMatchesCode(['E441'], 'E441')).toBe(true)
    expect(buildingMatchesCode([null, 'Ejército 441', 'e441'], 'E441')).toBe(true)
  })

  it('no confunde dos entradas del mismo número', () => {
    // `E278A` y `E278B` son edificios distintos: si esto fuera "empieza por",
    // las salas de uno se ofrecerían para el otro.
    expect(buildingMatchesCode(['E278A'], 'E278B')).toBe(false)
    expect(buildingMatchesCode(['E278'], 'E278A')).toBe(false)
  })

  it('un edificio sin código no casa con nada', () => {
    expect(buildingMatchesCode([null, undefined, ''], 'E441')).toBe(false)
  })
})
