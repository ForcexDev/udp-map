import { useEffect, useRef, useState } from 'react'
import { Locate, LocateFixed } from 'lucide-react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Pin } from '@/shared/types/database'
import type { FloorPlan } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { CAMPUSES, FACULTIES, categoryById, EVENT_COLOR, PLACE_COLOR } from '@/shared/data/campusData'
import { expiryState, FADE_WINDOW_MS } from '@/shared/utils/expiry'
import { eventPhase } from '@/shared/utils/eventState'
import { useNowTick } from '@/shared/lib/useNowTick'
import { publishBounds } from '@/features/pins/usePins'
import { MAP_STYLE_LIGHT, MAP_STYLE_DARK, DEFAULT_ZOOM } from './mapConfig'
import { addFacultyLayers } from './facultyLayers'
import { addBoundaryMask, BOUNDARY_MAX_BOUNDS, BOUNDARY_MIN_ZOOM, isLocationOutOfBounds } from './campusBoundary'
import type { WalkingRoute } from './routing'

interface MapViewProps {
  pins: Pin[]
  route: WalkingRoute | null
  floorPlan: FloorPlan | null
  userLocation?: { lat: number; lng: number } | null
  userHeading?: number | null
  isTrackingLocation?: boolean
  onRequestLocation?: () => Promise<{ lat: number; lng: number } | null>
}

function markerColor(pin: Pin): string {
  if (pin.category_id) return categoryById(pin.category_id)?.color ?? '#64748b'
  if (pin.type === 'place') return PLACE_COLOR
  if (pin.type === 'event') return EVENT_COLOR
  return '#64748b'
}

// Exact lucide DoorOpen icon paths (stroke-based). Uses inline style to
// override the CSS `.pin-marker svg { fill: white }` rule.
const DOOR_OPEN_SVG = `<svg viewBox="0 0 24 24" width="16" height="16" style="fill:none;stroke:white;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="M13 4h3a2 2 0 0 1 2 2v14"/><path d="M2 20h3"/><path d="M13 20h9"/><path d="M10 12v.01"/><path d="M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"/></svg>`

function markerSvgContent(pin: Pin): string {
  const defaultEvent = 'M12 6c1.11 0 2-.9 2-2 0-.38-.1-.73-.29-1.03L12 0l-1.71 2.97c-.19.3-.29.65-.29 1.03 0 1.1.9 2 2 2zm4.6 9.99l-1.07-1.07-1.08 1.07c-1.3 1.3-3.58 1.31-4.89 0l-1.07-1.07-1.09 1.07C6.75 16.64 5.88 17 4.96 17c-.73 0-1.4-.23-1.96-.61V21c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-4.61c-.56.38-1.23.61-1.96.61-.92 0-1.79-.36-2.44-1.01zM18 9h-5V7h-2v2H6c-1.66 0-3 1.34-3 3v1.54c0 1.08.88 1.96 1.96 1.96.52 0 1.02-.2 1.38-.57l2.14-2.13 2.13 2.13c.74.74 2.03.74 2.77 0l2.14-2.13 2.13 2.13c.37.37.86.57 1.38.57 1.08 0 1.96-.88 1.96-1.96V12c.01-1.66-1.33-3-2.99-3z'

  if (pin.category_id) {
    // Entrada uses its own filled DoorOpen icon
    if (pin.category_id === 'entrada') return DOOR_OPEN_SVG
    const cat = categoryById(pin.category_id)
    if (cat?.svgPath) {
      return `<svg viewBox="0 0 24 24" width="16" height="16"><path d="${cat.svgPath}" fill="white"/></svg>`
    }
  }

  if (pin.type === 'event') {
    return `<svg viewBox="0 0 24 24" width="16" height="16"><path d="${defaultEvent}" fill="white"/></svg>`
  }

  // Fallback for null category (legacy or place without category)
  return DOOR_OPEN_SVG
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

export function MapView({ pins, route, floorPlan, userLocation, userHeading, isTrackingLocation, onRequestLocation }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map())
  const userMarkerRef = useRef<maplibregl.Marker | null>(null)
  const campusId = useUIStore((s) => s.campusId)
  const selectedPinId = useUIStore((s) => s.selectedPinId)
  const theme = useUIStore((s) => s.theme)
  const viewMode = useUIStore((s) => s.viewMode)
  const devUnlockSetting = useUIStore((s) => s.devUnlockMap)
  const role = useAuthStore((s) => s.role)
  const devUnlockMap = role === 'admin' && devUnlockSetting
  const mapStyleUrl = theme === 'dark' ? MAP_STYLE_DARK : MAP_STYLE_LIGHT

  const [bearing, setBearing] = useState(0)
  const [pitch, setPitch] = useState(0)

  // Un evento que empieza a las 14:00 debe ponerse en vivo a las 14:00, no la
  // próxima vez que el usuario mueva el mapa.
  const now = useNowTick()

  // ── Instancia del mapa (una sola vez) ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const campus = CAMPUSES.find((c) => c.id === useUIStore.getState().campusId) ?? CAMPUSES[0]
    const initialViewMode = useUIStore.getState().viewMode
    const show3D = initialViewMode === '3d'
    
    const currentPinId = useUIStore.getState().selectedPinId
    let initialCenter: [number, number] = [campus.lng, campus.lat]
    let initialZoom = DEFAULT_ZOOM
    
    if (currentPinId) {
      const pin = pins.find(p => p.id === currentPinId)
      if (pin) {
         initialCenter = [pin.lng, pin.lat]
         initialZoom = 18
      }
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyleUrl,
      center: initialCenter,
      zoom: initialZoom,
      // Límite circular: no panear ni alejar fuera del área de la U
      // (impide además que se pidan tiles fuera de la zona).
      maxBounds: BOUNDARY_MAX_BOUNDS,
      minZoom: BOUNDARY_MIN_ZOOM,
      attributionControl: false,
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
    } as unknown as maplibregl.MapOptions)
    
    // Mostramos la atribución como texto estático (watermark) en lugar de un botón/menú desplegable
    map.addControl(
      new maplibregl.AttributionControl({ compact: false }),
      'bottom-left',
    )
    
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

  // ── Admin: toggle de desbloqueo de mapa ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (devUnlockMap) {
      // Remove boundary restrictions
      map.setMaxBounds(undefined as unknown as maplibregl.LngLatBoundsLike)
      map.setMinZoom(1)
      // Hide mask and border layers
      if (map.getLayer('campus-boundary-mask-fill')) {
        map.setLayoutProperty('campus-boundary-mask-fill', 'visibility', 'none')
      }
      if (map.getLayer('campus-boundary-line-layer')) {
        map.setLayoutProperty('campus-boundary-line-layer', 'visibility', 'none')
      }
    } else {
      // Restore boundary restrictions
      map.setMaxBounds(BOUNDARY_MAX_BOUNDS)
      map.setMinZoom(BOUNDARY_MIN_ZOOM)
      // Show mask and border layers
      if (map.getLayer('campus-boundary-mask-fill')) {
        map.setLayoutProperty('campus-boundary-mask-fill', 'visibility', 'visible')
      }
      if (map.getLayer('campus-boundary-line-layer')) {
        map.setLayoutProperty('campus-boundary-line-layer', 'visibility', 'visible')
      }
    }
  }, [devUnlockMap])

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
      if (expiryState(pin.expires_at, pin.is_permanent).status === 'expired') continue

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
      el.innerHTML = markerSvgContent(pin)
      el.style.setProperty('--pin-color', markerColor(pin))
      el.setAttribute('aria-label', pin.title)
      el.title = pin.title
      el.classList.toggle('pin-marker--selected', pin.id === selectedPinId)
      marker.setLngLat([pin.lng, pin.lat])
    }
  }, [pins, selectedPinId])

  // ── Estado temporal del marcador (en vivo / por vencer) ──
  //
  // Aparte del efecto de arriba porque corre con cada tick del reloj: rehacer
  // ahí el innerHTML de 300 marcadores cada 30 s sería tirar el icono a la
  // basura para volver a pintarlo idéntico. Aquí solo se tocan clases y
  // variables CSS, que es lo único que cambia al pasar el tiempo.
  useEffect(() => {
    const markers = markersRef.current

    for (const pin of pins) {
      const el = markers.get(pin.id)?.getElement()
      if (!el) continue

      // Un evento no "se está agotando": pasa, ocurre y termina. Aplicarle el
      // estado de expiración lo hacía parpadear en su última hora, que es
      // justo la señal que ahora se reserva para "está ocurriendo".
      const isEvent = pin.type === 'event'
      const expiry = expiryState(pin.expires_at, pin.is_permanent, now)
      const isLive = isEvent && eventPhase(pin.starts_at, pin.ends_at, now) === 'live'
      const isExpiring = !isEvent && expiry.status === 'fading'

      // El desvanecido va por variables CSS, NO por el.style.opacity.
      //
      // MapLibre es dueño del `opacity` en línea del elemento del marcador:
      // Marker._updateOpacity() lo reescribe a su propio valor (1 por defecto)
      // en cada move/moveend. Escribirlo aquí daba un efecto fantasma —
      // aparecía con el mapa quieto y se borraba al primer paneo—. El CSS lo
      // aplica con filter: opacity(), que MapLibre no toca.
      //
      // Los eventos no se atenúan: uno de mañana debe verse tan sólido como
      // uno de hoy (siguen apareciendo en el mapa desde que se crean).
      el.style.setProperty('--pin-fade', isExpiring ? String(expiry.opacity) : '1')
      // Fracción de vida restante (1 → 0), que gradúa el desaturado.
      el.style.setProperty(
        '--pin-remaining',
        isExpiring && expiry.remainingMs !== null
          ? String(Math.max(0, Math.min(1, expiry.remainingMs / FADE_WINDOW_MS)))
          : '1',
      )
      el.classList.toggle('pin-marker--expiring', isExpiring)
      el.classList.toggle('pin-marker--live', isLive)
    }
  }, [pins, now])

  // ── Centrado automático de Pin ──
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedPinId) return
    const pin = pins.find((p) => p.id === selectedPinId)
    if (pin) {
      map.flyTo({
        center: [pin.lng, pin.lat],
        zoom: 18,
        duration: 800
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPinId])

  // ── Marcador del usuario (punto rojo con cono de dirección estilo Google Maps) ─
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
      el.className = 'user-location-dot'
      el.style.cssText = 'position:relative;width:20px;height:20px;'

      // Heading cone — SVG fan (~60°) with radial gradient, Google Maps style
      const coneSvgNS = 'http://www.w3.org/2000/svg'
      const svg = document.createElementNS(coneSvgNS, 'svg')
      svg.setAttribute('width', '60')
      svg.setAttribute('height', '60')
      svg.setAttribute('viewBox', '0 0 60 60')
      svg.classList.add('user-heading-cone')
      Object.assign(svg.style, {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transformOrigin: '50% 100%',
        transform: 'translateX(-50%) translateY(-100%) rotate(0deg)',
        pointerEvents: 'none',
        display: 'none', // hidden until heading is known
        overflow: 'visible',
      })

      // Radial gradient: solid red center → transparent edge
      const defs = document.createElementNS(coneSvgNS, 'defs')
      const grad = document.createElementNS(coneSvgNS, 'radialGradient')
      grad.setAttribute('id', 'user-cone-grad')
      grad.setAttribute('cx', '50%')
      grad.setAttribute('cy', '100%')
      grad.setAttribute('r', '100%')
      const stop1 = document.createElementNS(coneSvgNS, 'stop')
      stop1.setAttribute('offset', '0%')
      stop1.setAttribute('stop-color', 'rgba(212,31,45,0.45)')
      const stop2 = document.createElementNS(coneSvgNS, 'stop')
      stop2.setAttribute('offset', '100%')
      stop2.setAttribute('stop-color', 'rgba(212,31,45,0)')
      grad.appendChild(stop1)
      grad.appendChild(stop2)
      defs.appendChild(grad)
      svg.appendChild(defs)

      // Fan sector path (~60° arc)
      const path = document.createElementNS(coneSvgNS, 'path')
      path.setAttribute('d', 'M30,60 L13,5 A30,30 0 0,1 47,5 Z')
      path.setAttribute('fill', 'url(#user-cone-grad)')
      svg.appendChild(path)
      el.appendChild(svg)

      // Red dot
      const dot = document.createElement('div')
      dot.style.cssText = [
        'position:absolute',
        'inset:0',
        'margin:auto',
        'width:14px',
        'height:14px',
        'background:#D41F2D',
        'border:2.5px solid white',
        'border-radius:50%',
        'box-shadow:0 0 0 3px rgba(212,31,45,0.25),0 2px 8px rgba(0,0,0,0.3)',
        'z-index:2',
      ].join(';')
      el.appendChild(dot)

      // Pulse ring
      const pulse = document.createElement('div')
      pulse.style.cssText = [
        'position:absolute',
        'inset:-4px',
        'border-radius:50%',
        'background:rgba(212,31,45,0.15)',
        'animation:user-pulse 2s ease-out infinite',
        'z-index:1',
      ].join(';')
      el.appendChild(pulse)

      userMarkerRef.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([userLocation.lng, userLocation.lat])
        .addTo(map)
    } else {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat])
      if (!userMarkerRef.current.getElement().parentNode) {
        userMarkerRef.current.addTo(map)
      }
    }

    // Helper: update cone rotation compensating for map bearing
    const updateConeRotation = () => {
      if (!userMarkerRef.current) return
      const markerEl = userMarkerRef.current.getElement()
      const coneSvg = markerEl.querySelector('.user-heading-cone') as SVGElement | null
      if (!coneSvg) return

      if (userHeading !== null && userHeading !== undefined) {
        coneSvg.style.display = 'block'
        // Subtract map bearing so the cone always points to the real-world direction
        const mapBearing = map.getBearing()
        const visualHeading = ((userHeading - mapBearing) % 360 + 360) % 360
        coneSvg.style.transform = `translateX(-50%) translateY(-100%) rotate(${visualHeading}deg)`
      } else {
        coneSvg.style.display = 'none'
      }
    }

    updateConeRotation()

    // Keep cone orientation correct when the user rotates the map
    map.on('rotate', updateConeRotation)

    return () => {
      map.off('rotate', updateConeRotation)
    }
  }, [userLocation, userHeading, mapStyleUrl])

  // ── Capa de ruta ("cómo llegar") ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apply = () => {
      if (map.getLayer('route-line')) map.removeLayer('route-line')
      if (map.getSource('route')) map.removeSource('route')
      if (!route) return

      if (route.coordinates.length > 0) {
        const bounds = route.coordinates.reduce((b, coord) => {
          return b.extend([coord[0], coord[1]])
        }, new maplibregl.LngLatBounds(route.coordinates[0] as [number, number], route.coordinates[0] as [number, number]))
        map.fitBounds(bounds, { padding: { top: 120, bottom: 180, left: 50, right: 50 }, duration: 1000 })
      }

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

      {/* Location button */}
      <button
        onClick={async () => {
          if (onRequestLocation) {
             try {
               const loc = await onRequestLocation()
               if (loc) {
                  if (!devUnlockMap && isLocationOutOfBounds(loc.lat, loc.lng)) {
                     useUIStore.getState().showToast('Estás fuera del área del mapa')
                  } else {
                     mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 18, duration: 1000 })
                  }
               }
             } catch (err) {
               const error = err as Error
               if (error.message === 'PERMISSION_DENIED') {
                 useUIStore.getState().showToast('Debes activar la ubicación en tu navegador para centrar el mapa.')
               } else {
                 useUIStore.getState().showToast('No se pudo obtener tu ubicación.')
               }
             }
          }
        }}
        aria-label="Centrar en mi ubicación"
        className="absolute right-3 top-[72px] sm:right-5 sm:top-[80px] z-30 w-10 h-10 rounded-full glass-hud premium-shadow flex items-center justify-center transition-all duration-300 pointer-events-auto hover:scale-105 active:scale-95"
      >
        {isTrackingLocation ? (
          <LocateFixed size={20} className="text-[#D41F2D]" />
        ) : (
          <Locate size={20} className="text-neutral-700 dark:text-neutral-300" />
        )}
      </button>

      {/* Compass button */}
      <button
        onClick={handleResetOrientation}
        aria-label="Restaurar orientación al Norte"
        className={`absolute right-3 top-[120px] sm:right-5 sm:top-[128px] z-30 w-10 h-10 rounded-full glass-hud premium-shadow flex items-center justify-center transition-all duration-300 pointer-events-auto hover:scale-105 active:scale-95 ${isDefaultOrientation ? 'opacity-0 pointer-events-none' : 'opacity-100'
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
