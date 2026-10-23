import type { Polygon } from 'geojson'
import type { Area, AreaKind, Building, BuildingFloor, NavEdgeRow, NavNodeRow } from '@/shared/types/database'
import type { IndoorArea, NavEdge, NavEdgeKind, NavNode, NavNodeKind, Vec2 } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Edificio de prueba: Vergara 432 como se validó en el prototipo.
//
// Es un edificio INVENTADO CON CRITERIO. Las salas S312–S315, AU, S412–S415 y
// S512–S515 existen en el horario de la EIT, pero su posición dentro de la
// planta es supuesta; el piso 2 y el piso 1 son relleno. Sirve de fixture para
// las pruebas y de grafo del modo demo. No es el plano real: ese se carga desde
// /admin/mapeo cuando exista (docs/ROADMAP.md).
//
// Plano local en metros: x a lo largo de la fachada norte, y hacia el sur por
// Vergara (y hacia abajo). Huella [0,0]–[30,26], plantas 1 a 5.
//
//   y=0  ┌──────────────┬─────┬────┬──────┬──────┐
//        │ S_12         │ESC. │ASC.│B.DAM.│B.VAR.│
//   y=7  ├────[11]──────┴[16]─┴[19.5]┴[23.25]┴[27.75]┤  puertas norte
//        │              pasillo central (eje y=8.5)    │
//   y=10 ├──[7]──────┬──────[17]──┬────[27]─────────┤  puertas sur
//        │ S_13      │ S_14       │ S_15              │
//   y=26 └───────────┴────────────┴───────────────────┘
// ─────────────────────────────────────────────────────────────────────────────

export const SAMPLE_BUILDING_ID = 'V432'
export const SAMPLE_BUILDING_NAME = 'Vergara 432'
export const SAMPLE_FLOORS = [1, 2, 3, 4, 5]
export const SAMPLE_FOOTPRINT: Vec2[] = [
  { x: 0, y: 0 },
  { x: 30, y: 0 },
  { x: 30, y: 26 },
  { x: 0, y: 26 },
]

/**
 * Georreferencia aproximada del prototipo: esquina noroeste del edificio y
 * rumbo del eje x (el lado norte del perímetro de la FIC). Solo la usa el demo.
 */
export const SAMPLE_GEOREF = { lat: -33.4525797, lng: -70.6615718, bearingDeg: 76 }

/** Del plano del fixture a lng/lat reales, con el eje x girado al rumbo de la fachada. */
export function sampleToLngLat(p: Vec2): [number, number] {
  const b = (SAMPLE_GEOREF.bearingDeg * Math.PI) / 180
  const by = b + Math.PI / 2
  const east = p.x * Math.sin(b) + p.y * Math.sin(by)
  const north = p.x * Math.cos(b) + p.y * Math.cos(by)
  return [
    SAMPLE_GEOREF.lng + east / (111_320 * Math.cos((SAMPLE_GEOREF.lat * Math.PI) / 180)),
    SAMPLE_GEOREF.lat + north / 111_320,
  ]
}

export interface SampleBuilding {
  nodes: NavNode[]
  edges: NavEdge[]
  areas: IndoorArea[]
}

type Rect = [number, number, number, number]

const CORRIDOR_Y = 8.5
const NORTH_Y = 7
const SOUTH_Y = 10
/** El nodo de sala va dentro, no en el centroide: ver `corridor.ts`. */
const ROOM_DEPTH = 2.5

interface RoomSpec {
  key: string
  name: string
  code: string | null
  rect: Rect
  door: Vec2
  kind?: string
  doorLandmark?: string
  /** La puerta da a otro nodo y no al pasillo (bodega y cafetería del piso 1). */
  hostKey?: string
}

export function buildSampleBuilding(): SampleBuilding {
  const nodes: NavNode[] = []
  const edges: NavEdge[] = []
  const areas: IndoorArea[] = []

  const add = (
    id: string,
    kind: NavNodeKind,
    x: number,
    y: number,
    floor: number | null,
    extra: Partial<NavNode> = {},
  ) => {
    nodes.push({
      id,
      kind,
      p: { x, y },
      buildingId: floor === null ? null : SAMPLE_BUILDING_ID,
      floor,
      landmark: null,
      via: null,
      areaId: null,
      roomCode: null,
      shaft: null,
      widthM: null,
      name: null,
      service: false,
      ...extra,
    })
    return id
  }
  const link = (a: string, b: string, kind: NavEdgeKind = 'walk', stepFree = true) => {
    edges.push({ id: `${a}~${b}`, a, b, kind, stepFree })
  }
  const area = (floor: number, key: string, kind: string, name: string, [x0, y0, x1, y1]: Rect) => {
    const id = `${floor}:area:${key}`
    areas.push({
      id,
      buildingId: SAMPLE_BUILDING_ID,
      floor,
      kind,
      name,
      ring: [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
      ],
    })
    return id
  }

  for (const floor of SAMPLE_FLOORS) {
    const f = (key: string) => `${floor}:${key}`
    const corridorXs = new Set<number>([0.8, 29.2, 16, 19.5, 23.25, 27.75])
    const landmarks = new Map<number, string>([
      [16, 'el pasillo, frente a la escalera'],
      [19.5, 'el pasillo, frente al ascensor'],
      [23.25, 'el pasillo, frente a los baños'],
      [27.75, 'el pasillo, frente a los baños'],
    ])

    // Núcleos y baños: iguales en todas las plantas.
    area(floor, 'esc', 'service', 'Escalera', [14, 0, 18, 7])
    area(floor, 'asc', 'service', 'Ascensor', [18, 0, 21, 7])
    const damas = area(floor, 'bdam', 'service', 'Baño de damas', [21, 0, 25.5, 7])
    const varones = area(floor, 'bvar', 'service', 'Baño de varones', [25.5, 0, 30, 7])
    const corridorArea = area(
      floor,
      'pasillo',
      'corridor',
      floor === 1 ? 'Hall de ascensores' : 'Pasillo central',
      [0, 7, 30, 10],
    )

    add(f('esc'), 'stairs', 16, 6.3, floor, { shaft: 'ESC', landmark: 'la escalera principal' })
    add(f('esc:door'), 'door', 16, NORTH_Y, floor, { landmark: 'la escalera principal', widthM: 1.4 })
    link(f('esc'), f('esc:door'))
    add(f('asc'), 'elevator', 19.5, 4, floor, { shaft: 'ASC', landmark: 'el ascensor' })
    add(f('asc:door'), 'door', 19.5, NORTH_Y, floor, { landmark: 'el ascensor', widthM: 1.1 })
    link(f('asc'), f('asc:door'))
    add(f('bdam:door'), 'door', 23.25, NORTH_Y, floor, { areaId: damas, widthM: 0.9 })
    add(f('bvar:door'), 'door', 27.75, NORTH_Y, floor, { areaId: varones, widthM: 0.9 })

    const rooms: RoomSpec[] = []
    if (floor === 1) {
      rooms.push(
        { key: 'conserjeria', name: 'Conserjería', code: null, rect: [0, 0, 6, 7], door: { x: 3, y: NORTH_Y }, kind: 'office' },
        { key: 'secretaria', name: 'Secretaría de Estudios', code: null, rect: [6, 0, 14, 7], door: { x: 10, y: NORTH_Y }, kind: 'office' },
        { key: 'bodega', name: 'Bodega', code: null, rect: [0, 18, 4, 26], door: { x: 4, y: 22 }, kind: 'other', hostKey: 'lobby:d' },
        { key: 'cafeteria', name: 'Cafetería', code: null, rect: [22, 10, 30, 18], door: { x: 22, y: 14 }, kind: 'cafeteria', hostKey: 'lobby:b' },
      )
      corridorXs.add(9)
      corridorXs.add(18)
      landmarks.set(9, 'el hall de ascensores')
    } else if (floor === 3) {
      rooms.push(
        { key: 'S312', name: 'Sala 312', code: 'V432.3.S312', rect: [0, 0, 7, 7], door: { x: 4, y: NORTH_Y } },
        { key: 'S315', name: 'Sala 315', code: 'V432.3.S315', rect: [7, 0, 14, 7], door: { x: 11, y: NORTH_Y } },
        {
          key: 'AU',
          name: 'Auditorio',
          code: 'V432.3.AU',
          rect: [0, 10, 16, 26],
          door: { x: 13, y: SOUTH_Y },
          doorLandmark: 'la puerta del auditorio',
        },
        { key: 'S313', name: 'Sala 313', code: 'V432.3.S313', rect: [16, 10, 23, 26], door: { x: 20, y: SOUTH_Y } },
        { key: 'S314', name: 'Sala 314', code: 'V432.3.S314', rect: [23, 10, 30, 26], door: { x: 27, y: SOUTH_Y } },
      )
    } else {
      const s = (n: number) => `S${floor}${n}`
      rooms.push(
        { key: s(12), name: `Sala ${floor}12`, code: `V432.${floor}.${s(12)}`, rect: [0, 0, 14, 7], door: { x: 11, y: NORTH_Y } },
        { key: s(13), name: `Sala ${floor}13`, code: `V432.${floor}.${s(13)}`, rect: [0, 10, 10, 26], door: { x: 7, y: SOUTH_Y } },
        { key: s(14), name: `Sala ${floor}14`, code: `V432.${floor}.${s(14)}`, rect: [10, 10, 20, 26], door: { x: 17, y: SOUTH_Y } },
        { key: s(15), name: `Sala ${floor}15`, code: `V432.${floor}.${s(15)}`, rect: [20, 10, 30, 26], door: { x: 27, y: SOUTH_Y } },
      )
    }

    for (const room of rooms) if (!room.hostKey) corridorXs.add(room.door.x)

    // El pasillo: un nodo frente a cada puerta y en cada extremo, encadenados.
    const xs = [...corridorXs].sort((a, b) => a - b)
    for (const x of xs) {
      add(f(`c${x}`), 'walk', x, CORRIDOR_Y, floor, { landmark: landmarks.get(x) ?? null, areaId: corridorArea })
    }
    for (let i = 1; i < xs.length; i++) link(f(`c${xs[i - 1]}`), f(`c${xs[i]}`))
    link(f('esc:door'), f('c16'))
    link(f('asc:door'), f('c19.5'))
    link(f('bdam:door'), f('c23.25'))
    link(f('bvar:door'), f('c27.75'))

    if (floor === 1) {
      area(1, 'acceso', 'hall', 'Acceso Vergara', [0, 10, 4, 18])
      area(1, 'lobby', 'hall', 'Lobby', [4, 10, 22, 26])
      area(1, 'hallpatio', 'hall', 'Hall al patio', [22, 18, 30, 26])

      add('out:paradero', 'outdoor', -7, -24, null, { landmark: 'el paradero Vergara / esq. Gorbea' })
      add('out:vergara432', 'outdoor', -7, 14, null, {
        landmark: 'el número 432 de Vergara',
        via: 'la vereda de Vergara',
      })
      add('out:patio', 'outdoor', 40, 22, null, { landmark: 'el patio de la FIC (lado Ejército 441)' })
      add('1:ent:vergara', 'entrance', 0, 14, 1, { landmark: 'la puerta principal de Vergara 432', widthM: 2 })
      add('1:acceso', 'walk', 2, 14, 1)
      add('1:torniquetes', 'door', 4, 14, 1, { landmark: 'los torniquetes', widthM: 3 })
      add('1:lobby:a', 'walk', 9, 14, 1, { landmark: 'el lobby' })
      add('1:lobby:b', 'walk', 18, 14, 1, { landmark: 'el lobby, frente a la cafetería' })
      add('1:lobby:c', 'walk', 18, 22, 1, { landmark: 'el hall al patio' })
      add('1:lobby:d', 'walk', 9, 22, 1)
      add('1:ent:patio', 'entrance', 30, 22, 1, { landmark: 'la salida al patio', widthM: 2 })

      link('out:paradero', 'out:vergara432')
      link('out:vergara432', '1:ent:vergara')
      link('1:ent:vergara', '1:acceso')
      link('1:acceso', '1:torniquetes')
      link('1:torniquetes', '1:lobby:a')
      link('1:lobby:a', '1:lobby:b')
      link('1:lobby:b', '1:lobby:c')
      link('1:lobby:a', '1:lobby:d')
      link('1:lobby:d', '1:lobby:c')
      link('1:lobby:c', '1:ent:patio')
      link('1:ent:patio', 'out:patio')
      link('1:lobby:a', '1:c9')
      link('1:lobby:b', '1:c18')
    }

    for (const room of rooms) {
      const areaId = area(floor, room.key, room.kind ?? 'other', room.name, room.rect)
      const doorId = add(f(`${room.key}:door`), 'door', room.door.x, room.door.y, floor, {
        areaId,
        widthM: 1,
        landmark: room.doorLandmark ?? null,
      })
      // Hacia dentro: el lado de la puerta opuesto al punto del que cuelga.
      const host = room.hostKey ? nodes.find((n) => n.id === f(room.hostKey!))! : null
      const inward = host
        ? { x: Math.sign(room.door.x - host.p.x), y: Math.sign(room.door.y - host.p.y) }
        : { x: 0, y: room.door.y < CORRIDOR_Y ? -1 : 1 }
      const roomId = add(
        f(room.key),
        'room',
        room.door.x + inward.x * ROOM_DEPTH,
        room.door.y + inward.y * ROOM_DEPTH,
        floor,
        { areaId, roomCode: room.code, name: room.name },
      )
      link(doorId, roomId)
      link(doorId, room.hostKey ? f(room.hostKey) : f(`c${room.door.x}`))
    }
  }

  // Núcleos entre plantas consecutivas. La escalera nunca es apta sin escalones.
  for (let i = 1; i < SAMPLE_FLOORS.length; i++) {
    const below = SAMPLE_FLOORS[i - 1]
    const above = SAMPLE_FLOORS[i]
    link(`${below}:esc`, `${above}:esc`, 'stairs', false)
    link(`${below}:asc`, `${above}:asc`, 'elevator', true)
  }

  return { nodes, edges, areas }
}

/** Los orígenes que ofrece el demo cuando no hay ubicación. */
export const SAMPLE_ORIGINS = ['out:paradero', 'out:vergara432', 'out:patio', '1:lobby:a']

// ── Como filas de la base, para el modo demo ────────────────────────────────

export interface SampleRows {
  building: Building
  floors: BuildingFloor[]
  areas: Area[]
  nodes: NavNodeRow[]
  edges: NavEdgeRow[]
}

/** Prefijo de los ids del demo: no son uuid, y así se distinguen de lo dibujado. */
export const sampleRowId = (localId: string) => `demo-v432-${localId}`

function ringToPolygon(ring: Vec2[]): Polygon {
  const coordinates = ring.map(sampleToLngLat)
  return { type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] }
}

/** El edificio del prototipo como lo devolvería la base, en lng/lat. */
export function sampleRows(facultyId: string): SampleRows {
  const { nodes, edges, areas } = buildSampleBuilding()
  return {
    building: {
      id: SAMPLE_BUILDING_ID,
      faculty_id: facultyId,
      name: SAMPLE_BUILDING_NAME,
      short_name: SAMPLE_BUILDING_ID,
      aliases: [],
      footprint: ringToPolygon(SAMPLE_FOOTPRINT),
      default_floor: 1,
      height_m: null,
      color: null,
      sort_order: 0,
    },
    floors: SAMPLE_FLOORS.map((level) => ({ building_id: SAMPLE_BUILDING_ID, level, label: null })),
    areas: areas.map((a, i) => ({
      id: sampleRowId(a.id),
      faculty_id: facultyId,
      building_id: a.buildingId,
      floor: a.floor,
      kind: a.kind as AreaKind,
      custom_kind: a.kind === 'other' ? (a.name.startsWith('Sala') ? 'Sala de clases' : a.name) : null,
      name: a.name,
      polygon: ringToPolygon(a.ring),
      color: null,
      sort_order: i,
    })),
    nodes: nodes.map((n) => {
      const [lng, lat] = sampleToLngLat(n.p)
      return {
        id: sampleRowId(n.id),
        faculty_id: facultyId,
        building_id: n.buildingId,
        floor: n.floor,
        kind: n.kind,
        lng,
        lat,
        landmark: n.landmark,
        via: n.via,
        area_id: n.areaId ? sampleRowId(n.areaId) : null,
        room_code: n.roomCode,
        shaft: n.shaft,
        width_m: n.widthM,
      }
    }),
    edges: edges.map((e) => ({
      id: sampleRowId(e.id),
      faculty_id: facultyId,
      a: sampleRowId(e.a),
      b: sampleRowId(e.b),
      kind: e.kind,
      step_free: e.stepFree,
    })),
  }
}
