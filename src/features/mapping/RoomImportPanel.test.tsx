import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Building, BuildingFloor, Pin } from '@/shared/types/database'
import { buildRoomCatalog, type CatalogRoom } from '@/shared/utils/roomCatalog'
import type { FacultyMapping } from './api'

// El catálogo se sirve desde un doble: lo que se prueba aquí es lo que el panel
// hace con él, no la descarga — de eso ya se encarga `salasEit.ts`, que además
// nunca lanza.
const catalogState: { data: CatalogRoom[]; isPending: boolean } = {
  data: [],
  isPending: false,
}
vi.mock('./salasEit', () => ({
  useEitRoomCatalog: () => ({
    data: catalogState.data,
    isPending: catalogState.isPending,
    isFetching: false,
    refetch: vi.fn(),
  }),
}))

const { RoomImportPanel } = await import('./RoomImportPanel')
const { useMappingEditor } = await import('./editorStore')

const building = (over: Partial<Building> = {}): Building =>
  ({
    id: 'fic-e441',
    faculty_id: 'ingenieria',
    name: 'Edificio Ejército 441',
    short_name: 'E441',
    aliases: [],
    footprint: { type: 'Polygon', coordinates: [[]] },
    default_floor: 1,
    height_m: null,
    color: null,
    ...over,
  }) as unknown as Building

const floor = (level: number): BuildingFloor =>
  ({ building_id: 'fic-e441', level, label: null }) as unknown as BuildingFloor

const mappingWith = (floors: BuildingFloor[]): FacultyMapping => ({
  buildings: [building()],
  floors,
  areas: [],
})

const pinWithCode = (code: string | null): Pin => ({ id: code ?? 'x', room_code: code }) as Pin

beforeEach(() => {
  catalogState.data = buildRoomCatalog(['E441.1.S101', 'E441.1.S102', 'E441.5.LAB INF'])
  catalogState.isPending = false
  useMappingEditor.getState().setPendingRoom(null)
})

describe('RoomImportPanel', () => {
  it('sin edificio seleccionado no ofrece nada y dice por qué', () => {
    render(<RoomImportPanel mapping={mappingWith([])} pins={[]} building={null} />)

    expect(screen.getByText(/Elige un edificio/i)).toBeInTheDocument()
  })

  it('si la fuente no devolvió nada, lo dice sin romper el editor', () => {
    // Es un archivo de terceros: puede estar caído y el resto tiene que seguir.
    catalogState.data = []

    render(<RoomImportPanel mapping={mappingWith([])} pins={[]} building={building()} />)

    expect(screen.getByText(/No se pudo leer el horario/i)).toBeInTheDocument()
  })

  it('un edificio sin su código no ofrece salas, y explica cómo arreglarlo', () => {
    // El catálogo identifica los edificios por su dirección postal. Sin ese
    // código en el nombre corto o en un alias, no hay con qué casar.
    render(
      <RoomImportPanel
        mapping={mappingWith([])}
        pins={[]}
        building={building({ short_name: 'Principal', aliases: [] })}
      />,
    )

    expect(screen.getByText(/no reconoce este edificio/i)).toBeInTheDocument()
  })

  it('reconoce el código desde un alias, no solo desde el nombre corto', () => {
    render(
      <RoomImportPanel
        mapping={mappingWith([floor(1), floor(5)])}
        pins={[]}
        building={building({ short_name: 'Principal', aliases: ['E441'] })}
      />,
    )

    expect(screen.getByText('Salas de E441')).toBeInTheDocument()
  })

  it('cuenta cuántas están ya en el mapa', () => {
    render(
      <RoomImportPanel
        mapping={mappingWith([floor(1), floor(5)])}
        pins={[pinWithCode('E441.1.S101')]}
        building={building()}
      />,
    )

    expect(screen.getByText('1 de 3 ya están en el mapa')).toBeInTheDocument()
  })

  it('la que ya tiene pin no ofrece botón de colocar', () => {
    render(
      <RoomImportPanel
        mapping={mappingWith([floor(1), floor(5)])}
        pins={[pinWithCode('E441.1.S101')]}
        building={building()}
      />,
    )

    // Tres salas, una ya puesta → dos botones.
    expect(screen.getAllByRole('button', { name: 'Colocar' })).toHaveLength(2)
  })

  it('compara el código normalizado: el del pin se guarda tal cual se escribió', () => {
    render(
      <RoomImportPanel
        mapping={mappingWith([floor(1), floor(5)])}
        pins={[pinWithCode('  e441.1.s101 ')]}
        building={building()}
      />,
    )

    expect(screen.getByText('1 de 3 ya están en el mapa')).toBeInTheDocument()
  })

  it('avisa en vez de ofrecer una sala cuya planta nadie declaró', () => {
    // Colocarla fallaría contra `trg_validate_pin_floor`, y un botón que falla
    // siempre es peor que no tener botón.
    render(
      <RoomImportPanel mapping={mappingWith([floor(1)])} pins={[]} building={building()} />,
    )

    expect(screen.getByText('Falta la planta')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Colocar' })).toHaveLength(2)
  })

  it('al elegir una sala pide el clic en el mapa y activa la herramienta', () => {
    render(
      <RoomImportPanel
        mapping={mappingWith([floor(1), floor(5)])}
        pins={[]}
        building={building()}
      />,
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Colocar' })[0])

    // El aviso trae el código dentro de su propio <span>, así que se busca ese.
    expect(screen.getByText('E441.1.S101')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(useMappingEditor.getState().tool).toBe('room')
    expect(useMappingEditor.getState().pendingRoom?.code).toBe('E441.1.S101')
  })

  it('cambiar de herramienta suelta la sala pendiente', () => {
    // Si no, salir a dibujar un polígono dejaría una sala "esperando clic" que
    // reaparecería al volver.
    useMappingEditor.getState().setPendingRoom(catalogState.data[0])
    useMappingEditor.getState().setTool('polygon')

    expect(useMappingEditor.getState().pendingRoom).toBeNull()
  })
})
