import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MapView } from './MapView'
import '@/shared/lib/i18n'

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
  setBearing: vi.fn(),
  setPitch: vi.fn(),
  setMaxPitch: vi.fn(),
  setMinPitch: vi.fn(),
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
  getLayer: vi.fn(),
  isStyleLoaded: vi.fn(() => true),
  easeTo: vi.fn(),
  flyTo: vi.fn(),
  remove: vi.fn(),
  touchPitch: {
    enable: vi.fn(),
    disable: vi.fn(),
  }
}

vi.mock('maplibre-gl', () => {
  return {
    default: {
      Map: vi.fn(() => mockMapInstance),
      Marker: vi.fn(() => ({
        setLngLat: vi.fn().mockReturnThis(),
        addTo: vi.fn().mockReturnThis(),
        remove: vi.fn().mockReturnThis(),
        getElement: vi.fn(() => document.createElement('div')),
      })),
    }
  }
})

describe('MapView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMapEvents.clear()
  })

  it('renders the map container correctly', () => {
    render(<MapView pins={[]} route={null} floorPlan={null} userLocation={null} />)
    
    // El mapa debe mostrarse
    const mapElement = screen.getByLabelText('Mapa del campus')
    expect(mapElement).toBeInTheDocument()
  })

  it('initially hides the compass when map is aligned to North', () => {
    render(<MapView pins={[]} route={null} floorPlan={null} userLocation={null} />)
    
    const compassButton = screen.getByLabelText('Restaurar orientación al Norte')
    expect(compassButton).toHaveClass('opacity-0')
    expect(compassButton).toHaveClass('pointer-events-none')
  })

  it('shows the compass when the map is rotated or pitched', () => {
    render(<MapView pins={[]} route={null} floorPlan={null} userLocation={null} />)

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
    render(<MapView pins={[]} route={null} floorPlan={null} userLocation={null} />)

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
})
