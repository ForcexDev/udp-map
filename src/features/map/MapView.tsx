import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Pin } from '@/shared/types/database'
import type { FloorPlan } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { CAMPUSES, FACULTIES, categoryById, EVENT_COLOR, PLACE_COLOR } from '@/shared/data/campusData'
import { expiryState } from '@/shared/utils/expiry'
import { publishBounds } from '@/features/pins/usePins'
import { MAP_STYLE_LIGHT, MAP_STYLE_DARK, DEFAULT_ZOOM } from './mapConfig'
import { addFacultyLayers } from './facultyLayers'
import { addBoundaryMask, BOUNDARY_MAX_BOUNDS, BOUNDARY_MIN_ZOOM } from './campusBoundary'
import type { WalkingRoute } from './routing'

interface MapViewProps {
  pins: Pin[]
  route: WalkingRoute | null
  floorPlan: FloorPlan | null
  userLocation?: { lat: number; lng: number } | null
}

function markerColor(pin: Pin): string {
  if (pin.category_id) return categoryById(pin.category_id)?.color ?? '#64748b'
  if (pin.type === 'place') return PLACE_COLOR
  if (pin.type === 'event') return EVENT_COLOR
  return '#64748b'
}

function markerSvgPath(pin: Pin): string {
  const defaultPlace = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'
  const defaultEvent = 'M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99l-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12c.01-1.66-1.33-3-2.99-3z'
  if (pin.category_id) return categoryById(pin.category_id)?.svgPath ?? defaultPlace
  if (pin.type === 'event') return defaultEvent
  return defaultPlace
}

// Module-level map reference for external access
let _mapInstance: maplibregl.Map | null = null

// maplibre never lands an animated pitch on an exact 0 — treat "close enough" as flat
const PITCH_EPSILON = 0.01

function setBuildingsVisible(map: maplibregl.Map, visible: boolean) {
  const style = map.getStyle()
  if (!style?.layers) return
  const target = visible ? 'visible' : 'none'
  for (const l of style.layers) {
    if (l.type !== 'fill-extrusion') continue
    try {
      if (map.getLayoutProperty(l.id, 'visibility') !== target) {
        map.setLayoutProperty(l.id, 'visibility', target)
      }
    } catch {
      // Ignorar si el estilo está en transición/carga
    }
  }
}

/** Returns the current map center coordinates, or null if map isn't ready */
// eslint-disable-next-line react-refresh/only-export-components
export function getMapCenter(): { lat: number; lng: number } | null {
  if (!_mapInstance) return null
  const c = _mapInstance.getCenter()
  return { lat: c.lat, lng: c.lng }
}

export function MapView({ pins, route, floorPlan, userLocation }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const campusId = useUIStore((s) => s.campusId)
  const selectedPinId = useUIStore((s) => s.selectedPinId)
  const theme = useUIStore((s) => s.theme)
  const viewMode = useUIStore((s) => s.viewMode)
  const mapStyleUrl = theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT

  const [bearing, setBearing] = useState(0)
  const [pitch, setPitch] = useState(0)

  // ── Instancia del mapa (una sola vez) ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const campus = CAMPUSES.find((c) => c.id === useUIStore.getState().campusId) ?? CAMPUSES[0]
    const initialViewMode = useUIStore.getState().viewMode
    const show3D = initialViewMode === '3d'
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleUrl,
      center: [campus.lng, campus.lat],
      zoom: DEFAULT_ZOOM,
      // Límite circular: no panear ni alejar fuera del área de la U
      // (impide además que se pidan tiles fuera de la zona).
      maxBounds: BOUNDARY_MAX_BOUNDS,
      minZoom: BOUNDARY_MIN_ZOOM,
      attributionControl: { compact: true },
      maxPitch: show3D ? 85 : 0,
      minPitch: 0,
      pitch: show3D ? 45 : 0,
      dragPan: {
        deceleration: 2800, // Detiene el deslizamiento más rápido (default: 2500)
        maxSpeed: 650,    // Reduce la velocidad máxima al deslizar (default: 1400)
        linearity: 0.15,   // Reduce la sensibilidad y momentum inicial (default: 0.3)
      },
      // Hace la rotación con mouse/arrastre más lenta y controlada (default: 0.8)
      rotateDegreesPerPixelMoved: 0.25,
      // Desactiva el modo "Orbital" que gira respecto al centro y se vuelve inestable
      // cerca del medio del mapa, usando en su lugar rotación puramente lineal.
      aroundCenter: false,
    } as any)
    // No native controls — our custom FABs handle navigation/geolocation

    if (!show3D && map.touchPitch) {
      map.touchPitch.disable()
    }

    const emitBounds = () => {
      const b = map.getBounds()
      publishBounds({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() })
    }
    const updateOrientation = () => {
      const currentBearing = map.getBearing()
      const currentPitch = map.getPitch()
      setBearing(currentBearing)
      setPitch(currentPitch)

      // Si estamos en modo 2D y la inclinación llegó a 0, bloqueamos los límites y ocultamos los edificios
      if (useUIStore.getState().viewMode === '2d' && currentPitch < PITCH_EPSILON) {
        map.setMaxPitch(0)
        map.setMinPitch(0)
        setBuildingsVisible(map, false)
      }
    }

    map.on('load', () => {
      emitBounds()
      updateOrientation()
    })
    map.on('moveend', emitBounds)
    map.on('rotate', updateOrientation)
    map.on('pitch', updateOrientation)

    map.on('style.load', () => {
      addFacultyLayers(map)
      addBoundaryMask(map, useUIStore.getState().theme === 'dark')

      // Apply initial 2D/3D visibility
      setBuildingsVisible(map, useUIStore.getState().viewMode === '3d')

      // Re-attach any custom markers that were detached by the style change
      const markers = markersRef.current
      for (const marker of markers.values()) {
        if (!marker.getElement().parentNode) {
          marker.addTo(map)
        }
      }
    })

    // Eventos de interacción con el perímetro (registrados una sola vez)
    map.on('click', 'faculty-perimeter-fill', (e) => {
      if (!e.features || e.features.length === 0) return

      const clickedFacultyIds = e.features.map(f => f.properties?.faculty_id).filter(Boolean)
      if (clickedFacultyIds.length === 0) return

      if (clickedFacultyIds.length === 1) {
        useUIStore.getState().selectFaculty(clickedFacultyIds[0])
        return
      }

      // Desempate por distancia al marcador oficial si hay polígonos solapados
      const clickLat = e.lngLat.lat
      const clickLng = e.lngLat.lng
      let bestMatch = clickedFacultyIds[0]
      let minDistance = Infinity

      for (const id of clickedFacultyIds) {
        const faculty = FACULTIES.find(f => f.id === id)
        if (faculty) {
          const d = Math.hypot(faculty.lat - clickLat, faculty.lng - clickLng)
          if (d < minDistance) {
            minDistance = d
            bestMatch = id
          }
        }
      }

      useUIStore.getState().selectFaculty(bestMatch)
    })

    map.on('mouseenter', 'faculty-perimeter-fill', () => {
      map.getCanvas().style.cursor = 'pointer'
    })

    map.on('mouseleave', 'faculty-perimeter-fill', () => {
      map.getCanvas().style.cursor = ''
    })

    // Map click: deselect pin (only when NOT picking location)
    map.on('click', (e) => {
      // Ignorar si hicimos clic en el polígono de una facultad
      try {
        const features = map.queryRenderedFeatures(e.point, { layers: ['faculty-perimeter-fill'] })
        if (features.length > 0) return
      } catch {
        // La capa podría no existir mientras carga el estilo
      }

      const ui = useUIStore.getState()
      if (!ui.pickingLocation) {
        ui.selectPin(null)
      }
    })

    // Faculty search flyTo handler
    const onFacultyFlyTo = (e: Event) => {
      const { lat, lng } = (e as CustomEvent).detail
      map.flyTo({ center: [lng, lat], zoom: 17, duration: 1200 })
    }
    window.addEventListener('faculty-flyto', onFacultyFlyTo)

    mapRef.current = map
    _mapInstance = map
    const markers = markersRef.current
    return () => {
      window.removeEventListener('faculty-flyto', onFacultyFlyTo)
      map.off('rotate', updateOrientation)
      map.off('pitch', updateOrientation)
      map.remove()
      mapRef.current = null
      _mapInstance = null
      markers.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Cambio de estilo (Modo Oscuro) ──
  const lastStyleRef = useRef(mapStyleUrl)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (mapStyleUrl !== lastStyleRef.current) {
      lastStyleRef.current = mapStyleUrl
      map.setStyle(mapStyleUrl)
    }
  }, [mapStyleUrl])

  // ── Cambio de campus → flyTo ──
  useEffect(() => {
    const map = mapRef.current
    const campus = CAMPUSES.find((c) => c.id === campusId)
    if (map && campus) map.flyTo({ center: [campus.lng, campus.lat], zoom: DEFAULT_ZOOM })
  }, [campusId])

  // ── Cambio de modo 2D/3D ──
  const isFirstViewModeRunRef = useRef(true)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // El estado inicial ya lo aplica el efecto de creación del mapa (constructor + 'style.load');
    // evitamos repetir el mismo trabajo apenas se monta el componente.
    if (isFirstViewModeRunRef.current) {
      isFirstViewModeRunRef.current = false
      return
    }
    const show3D = viewMode === '3d'

    if (show3D) {
      map.setMaxPitch(85)
      map.setMinPitch(0)
      if (map.touchPitch) map.touchPitch.enable()

      const apply3D = () => setBuildingsVisible(map, true)
      if (map.isStyleLoaded()) apply3D()
      else map.once('style.load', apply3D)

      if (map.getPitch() < PITCH_EPSILON) {
        map.easeTo({ pitch: 45, duration: 800 })
      }
    } else {
      if (map.touchPitch) map.touchPitch.disable()

      if (map.getPitch() < PITCH_EPSILON) {
        map.setMaxPitch(0)
        map.setMinPitch(0)
        setBuildingsVisible(map, false)
      } else {
        // Liberar límites de pitch para permitir la animación de regreso a 2D
        map.setMaxPitch(85)
        map.setMinPitch(0)
        map.easeTo({ pitch: 0, duration: 800 })
      }
    }
  }, [viewMode])

  // ── Marcadores: diff contra el estado actual ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = markersRef.current
    const nextIds = new Set(pins.map((p) => p.id))

    for (const [id, marker] of markers) {
      if (!nextIds.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }

    for (const pin of pins) {
      const expiry = expiryState(pin.expires_at, pin.is_permanent)
      if (expiry.status === 'expired') continue
      let marker = markers.get(pin.id)
      if (!marker) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'pin-marker'
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          useUIStore.getState().selectPin(pin.id)
        })
        marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([pin.lng, pin.lat])
        markers.set(pin.id, marker)
      }

      const el = marker.getElement()
      // Re-add marker if it was detached from the DOM by a map.setStyle() operation
      if (!el.parentNode) {
        marker.addTo(map)
      }

      // Render SVG icon inside the marker
      const svgPath = markerSvgPath(pin)
      el.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16"><path d="${svgPath}" fill="white"/></svg>`
      el.style.setProperty('--pin-color', markerColor(pin))
      el.style.opacity = String(expiry.opacity)
      el.setAttribute('aria-label', pin.title)
      el.title = pin.title
      el.classList.toggle('pin-marker--fading', expiry.status === 'fading')
      el.classList.toggle('pin-marker--selected', pin.id === selectedPinId)
      marker.setLngLat([pin.lng, pin.lat])
    }
  }, [pins, selectedPinId])

  // ── Marcador del usuario (punto azul) ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        userMarkerRef.current = null
      }
      return
    }

    if (!userMarkerRef.current) {
      const el = document.createElement('div')
      el.className = 'w-4 h-4 bg-[#D41F2D] border-2 border-white rounded-full shadow-[0_0_10px_rgba(212,31,45,0.8)] relative'

      const pulse = document.createElement('div')
      pulse.className = 'absolute inset-0 bg-[#D41F2D] rounded-full animate-ping opacity-75'
      el.appendChild(pulse)

      userMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat])
      if (!userMarkerRef.current.getElement().parentNode) {
        userMarkerRef.current.addTo(map)
      }
    }
  }, [userLocation, mapStyleUrl])

  // ── Capa de ruta ("cómo llegar") ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      if (map.getLayer('route-line')) map.removeLayer('route-line')
      if (map.getSource('route')) map.removeSource('route')
      if (!route) return
      map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: route.coordinates },
        },
      })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#9d2235',
          'line-width': 5,
          'line-opacity': 0.85,
          ...(route.source === 'fallback' ? { 'line-dasharray': [1.5, 1.5] } : {}),
        },
      })
    }
    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [route, mapStyleUrl])

  // ── Capa indoor (plano del piso activo) ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      for (const layerId of ['indoor-fill', 'indoor-outline']) {
        if (map.getLayer(layerId)) map.removeLayer(layerId)
      }
      if (map.getSource('indoor')) map.removeSource('indoor')
      if (!floorPlan) return
      map.addSource('indoor', { type: 'geojson', data: floorPlan.geojson })
      map.addLayer({
        id: 'indoor-fill',
        type: 'fill',
        source: 'indoor',
        paint: {
          'fill-color': [
            'match',
            ['get', 'kind'],
            'hall',
            '#fde68a',
            'service',
            '#a5f3fc',
            '#fca5a5',
          ],
          'fill-opacity': 0.55,
        },
      })
      map.addLayer({
        id: 'indoor-outline',
        type: 'line',
        source: 'indoor',
        paint: { 'line-color': '#78350f', 'line-width': 1.5 },
      })
    }
    if (map.isStyleLoaded()) apply()
    else map.once('style.load', apply)
  }, [floorPlan, mapStyleUrl])

  const isDefaultOrientation = Math.abs(bearing) < 0.1 && Math.abs(pitch) < 0.1

  const handleResetOrientation = () => {
    const map = mapRef.current
    if (map) {
      map.easeTo({
        bearing: 0,
        pitch: 0,
        duration: 800,
      })
    }
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" aria-label="Mapa del campus" />

      {/* Compass button */}
      <button
        onClick={handleResetOrientation}
        aria-label="Restaurar orientación al Norte"
        className={`absolute right-3 top-[72px] sm:right-5 sm:top-[80px] z-30 w-10 h-10 rounded-full glass-hud premium-shadow flex items-center justify-center transition-all duration-300 pointer-events-auto hover:scale-105 active:scale-95 ${isDefaultOrientation ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          style={{
            transform: `rotate(${-bearing}deg)`,
            transition: 'transform 100ms ease-out',
          }}
          className="w-6.5 h-6.5 select-none pointer-events-none"
        >
          {/* North needle (Red) */}
          <path d="M12 3L16 12H8L12 3Z" fill="#D41F2D" />
          {/* South needle (Grey/Light Grey) */}
          <path d="M12 21L8 12H16L12 21Z" fill="#A3A3A3" className="dark:fill-neutral-400" />
        </svg>
      </button>
    </div>
  )
}
