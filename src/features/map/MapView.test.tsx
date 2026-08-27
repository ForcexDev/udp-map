import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MapView } from './MapView'
import '@/shared/lib/i18n'
import { useAuthStore } from '@/features/auth/authStore'
import { useUIStore } from '@/shared/stores/uiStore'

// Mock maplibre-gl
const mockMapEvents = new Map<string, (() => void)[]>()

const mockMapInstance = {
  on: vi.fn((_event, cb) => {
    if (!mockMapEvents.has(_event)) {
      mockMapEvents.set(_event, [])
    }
    mockMapEvents.get(_event)?.push(cb)
  }),
  off: vi.fn((_event, cb) => {
    const handlers = mockMapEvents.get(_event) ?? []
    const idx = handlers.indexOf(cb)
    if (idx !== -1) handlers.splice(idx, 1)
  }),
  once: vi.fn((_event, cb) => {
    cb()
  }),
  getBearing: vi.fn(() => 0),
  getPitch: vi.fn(() => 0),
  // Vista de campus: por debajo del umbral indoor, así que el mapa no intenta
  // entrar en ningún edificio durante estas pruebas.
  getZoom: vi.fn(() => 16),
  getCenter: vi.fn(() => ({ lng: -70.661, lat: -33.4527 })),
  // El tamaño del marcador según el zoom va como variable CSS en el contenedor.
  getContainer: vi.fn(() => document.createElement('div')),
  queryRenderedFeatures: vi.fn(() => []),
  setBearing: vi.fn(),
  setPitch: vi.fn(),
  setMaxPitch: vi.fn(),
  setMinPitch: vi.fn(),
  setMaxBounds: vi.fn(),
  setMinZoom: vi.fn(),
  getBounds: vi.fn(() => ({
    getWest: () => -70.7,
    getSouth: () => -33.5,
    getEast: () => -70.6,
    getNorth: () => -33.4,
  })),
  getStyle: vi.fn(() => ({
    layers: [
      { id: 'building-3d', type: 'fill-extrusion' }
    ]
  })),
  getLayoutProperty: vi.fn(() => 'none'),
  setLayoutProperty: vi.fn(),
  addSource: vi.fn(),
  removeSource: vi.fn(),
  getSource: vi.fn(),
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
  // El manejador de clics filtra las capas por existencia antes de consultarlas.
  getLayer: vi.fn((id: string) => ({ id })),
  isStyleLoaded: vi.fn(() => true),
  easeTo: vi.fn(),
  flyTo: vi.fn(),
  remove: vi.fn(),
  addControl: vi.fn(),
  touchPitch: {
    enable: vi.fn(),
    disable: vi.fn(),
  }
}

vi.mock('maplibre-gl', () => {
  return {
    default: {
      Map: vi.fn(() => mockMapInstance),
      AttributionControl: vi.fn(),
      Marker: vi.fn((options?: { element?: HTMLElement }) => {
        // El elemento es el MISMO en cada llamada a getElement(): MapView le
        // guarda clases y variables CSS entre efectos, y devolver uno nuevo
        // cada vez haría que nada de eso sobreviviera.
        const element = options?.element ?? document.createElement('div')
        const marker = {
          setLngLat: vi.fn(() => marker),
          addTo: vi.fn(() => marker),
          remove: vi.fn(() => marker),
          getElement: vi.fn(() => element),
        }
        return marker
      }),
    }
  }
})

/**
 * MapView consulta el mapeo interior con react-query, así que necesita un
 * provider. Cada render estrena QueryClient para que un test no vea la caché
 * del anterior; `retry: false` evita que un fallo simulado reintente y deje la
 * prueba colgada.
 */
function renderMap() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MapView pins={[]} route={null} userLocation={null} />
    </QueryClientProvider>,
  )
}

/** Dispara el clic del mapa con las features que devolvería cada capa. */
function clickMapOver(features: { layer: string; properties: Record<string, unknown> }[]) {
  mockMapInstance.queryRenderedFeatures.mockReturnValue(
    features.map((f) => ({ layer: { id: f.layer }, properties: f.properties })) as never,
  )
  const handlers = mockMapEvents.get('click') ?? []
  act(() => {
    handlers.forEach((cb) =>
      (cb as unknown as (e: unknown) => void)({
        point: { x: 10, y: 10 },
        lngLat: { lng: -70.661, lat: -33.4527 },
      }),
    )
  })
}

describe('MapView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMapEvents.clear()
    mockMapInstance.getLayer.mockImplementation((id: string) => ({ id }))
    mockMapInstance.queryRenderedFeatures.mockReturnValue([])
    useAuthStore.setState({ role: 'guest' })
    useUIStore.setState({
      devUnlockMap: false,
      selectedFacultyId: null,
      placeFocus: null,
      pickingLocation: false,
      movingPinId: null,
    })
  })

  it('renders the map container correctly', () => {
    renderMap()
    
    // El mapa debe mostrarse
    const mapElement = screen.getByLabelText('Mapa del campus')
    expect(mapElement).toBeInTheDocument()
  })

  it('initially hides the compass when map is aligned to North', () => {
    renderMap()
    
    const compassButton = screen.getByLabelText('Restaurar orientación al Norte')
    expect(compassButton).toHaveClass('opacity-0')
    expect(compassButton).toHaveClass('pointer-events-none')
  })

  it('shows the compass when the map is rotated or pitched', () => {
    renderMap()

    // Simulamos que el mapa gira
    mockMapInstance.getBearing.mockReturnValue(45)
    mockMapInstance.getPitch.mockReturnValue(0)

    const rotateHandlers = mockMapEvents.get('rotate') ?? []
    act(() => {
      rotateHandlers.forEach(cb => cb())
    })

    const compassButton = screen.getByLabelText('Restaurar orientación al Norte')
    expect(compassButton).not.toHaveClass('opacity-0')
    expect(compassButton).not.toHaveClass('pointer-events-none')
  })

  it('resets map orientation when compass is clicked', () => {
    renderMap()

    // Gira el mapa
    mockMapInstance.getBearing.mockReturnValue(45)
    const rotateHandlers = mockMapEvents.get('rotate') ?? []
    act(() => {
      rotateHandlers.forEach(cb => cb())
    })

    const compassButton = screen.getByLabelText('Restaurar orientación al Norte')
    
    // Clic en la brújula
    fireEvent.click(compassButton)

    // Debe llamar a easeTo con bearing y pitch 0
    expect(mockMapInstance.easeTo).toHaveBeenCalledWith({
      bearing: 0,
      pitch: 0,
      duration: 800
    })
  })

  it('ignora un desbloqueo guardado si el usuario no es admin', () => {
    useAuthStore.setState({ role: 'moderator' })
    useUIStore.setState({ devUnlockMap: true })

    renderMap()

    expect(mockMapInstance.setMaxBounds).not.toHaveBeenCalledWith(undefined)
    expect(mockMapInstance.setMinZoom).not.toHaveBeenCalledWith(1)
  })

  it('permite desbloquear los límites solamente a un admin', () => {
    useAuthStore.setState({ role: 'admin' })
    useUIStore.setState({ devUnlockMap: true })

    renderMap()

    expect(mockMapInstance.setMaxBounds).toHaveBeenCalledWith(undefined)
    expect(mockMapInstance.setMinZoom).toHaveBeenCalledWith(1)
  })

  // ── Un toque, una ficha ────────────────────────────────────────────────
  //
  // Área, edificio y perímetro abren la MISMA ficha, la de la facultad. Cada
  // uno tenía antes la suya y además corrían dos manejadores con el mismo
  // clic, así que se abría el feed con la tarjeta del edificio asomando detrás
  // y los posts repartidos en fichas casi siempre vacías.

  it('el área abre la ficha de su facultad y la deja enfocada', () => {
    renderMap()

    clickMapOver([
      {
        layer: 'mapping-areas-fill',
        properties: { id: 'area-1', facultyId: 'ingenieria', name: 'Patio', kindLabel: 'Patio' },
      },
      {
        layer: 'mapping-buildings-fill',
        properties: { id: 'ingenieria-e441', facultyId: 'ingenieria', name: 'Edificio Ejército 441' },
      },
      { layer: 'faculty-perimeter-fill', properties: { faculty_id: 'ingenieria' } },
    ])

    const ui = useUIStore.getState()
    expect(ui.selectedFacultyId).toBe('ingenieria')
    // El área es lo más específico bajo el dedo, así que gana el foco.
    expect(ui.placeFocus).toMatchObject({ kind: 'area', id: 'area-1' })
  })

  it('el edificio enfoca el edificio, no el área', () => {
    renderMap()

    clickMapOver([
      {
        layer: 'mapping-buildings-fill',
        properties: { id: 'ingenieria-e441', facultyId: 'ingenieria', name: 'Edificio Ejército 441' },
      },
      { layer: 'faculty-perimeter-fill', properties: { faculty_id: 'ingenieria' } },
    ])

    const ui = useUIStore.getState()
    expect(ui.selectedFacultyId).toBe('ingenieria')
    expect(ui.placeFocus).toMatchObject({ kind: 'building', id: 'ingenieria-e441' })
  })

  it('el perímetro abre la facultad entera, sin lugar enfocado', () => {
    renderMap()

    useUIStore.setState({ placeFocus: { kind: 'building', id: 'ingenieria-e441' } })

    clickMapOver([{ layer: 'faculty-perimeter-fill', properties: { faculty_id: 'ingenieria' } }])

    const ui = useUIStore.getState()
    expect(ui.selectedFacultyId).toBe('ingenieria')
    expect(ui.placeFocus).toBeNull()
  })

  it('un clic en el vacío cierra todo', () => {
    renderMap()

    useUIStore.setState({
      selectedFacultyId: 'ingenieria',
      placeFocus: { kind: 'building', id: 'ingenieria-e441' },
    })
    clickMapOver([])

    const ui = useUIStore.getState()
    expect(ui.selectedFacultyId).toBeNull()
    expect(ui.placeFocus).toBeNull()
  })
})
