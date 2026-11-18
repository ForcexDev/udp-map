import { useEffect, useImperativeHandle, useRef } from 'react'
import type { Ref } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { Pin } from '@/shared/types/database'
import { CAMPUSES, isFixedInfraCategory } from '@/shared/data/campusData'
import { useUIStore } from '@/shared/stores/uiStore'
import { pinScaleForZoom } from '@/shared/utils/pinScale'
import {
  MAP_STYLE_DARK,
  MAP_STYLE_LIGHT,
  DEFAULT_ZOOM,
  applyMapThemePalette,
  shrinkBaseMapLabels,
} from '../mapConfig'
import { addFacultyLayers } from '../facultyLayers'
import { addBoundaryMask, BOUNDARY_MAX_BOUNDS, BOUNDARY_MIN_ZOOM } from '../campusBoundary'
import { markerColor, markerSvgContent } from '../pinMarker'

// ─────────────────────────────────────────────────────────────────────────────
// Mapa de la práctica del tutorial.
//
// No es `MapView`: aquel escribe en uiStore (pin seleccionado, planta,
// límites que consultan pines), se publica como «el mapa» para wayfinding y
// lee el mapeo interior con react-query. Montarlo aquí ensuciaría el estado
// del mapa real y pediría datos a la base. Comparte con él lo que se VE:
// estilo, paleta, perímetros, máscara del campus y el dibujo del marcador.
// ─────────────────────────────────────────────────────────────────────────────

export interface PracticeMapHandle {
  flyTo: (lat: number, lng: number, zoom?: number) => void
  getCenter: () => { lat: number; lng: number } | null
}

interface PracticeMapProps {
  ref?: Ref<PracticeMapHandle>
  pins: Pin[]
  selectedId: string | null
  onPinClick: (id: string) => void
  /** `data-guia` de cada marcador, para que el tutorial lo destaque. */
  guiaDePin?: (pin: Pin) => string | undefined
}

function esOscuro(): boolean {
  const theme = useUIStore.getState().theme
  return (
    theme === 'dark' || (theme === 'system' && document.documentElement.classList.contains('dark'))
  )
}

export function PracticeMap({ ref, pins, selectedId, onPinClick, guiaDePin }: PracticeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef(new Map<string, maplibregl.Marker>())
  // El clic del marcador se cablea una vez; el callback puede cambiar.
  const onPinClickRef = useRef(onPinClick)
  useEffect(() => {
    onPinClickRef.current = onPinClick
  })

  useImperativeHandle(ref, () => ({
    flyTo: (lat, lng, zoom = 17.5) => {
      const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: reducido ? 0 : 1200 })
    },
    getCenter: () => {
      const c = mapRef.current?.getCenter()
      return c ? { lat: c.lat, lng: c.lng } : null
    },
  }))

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const campus = CAMPUSES[0]
    const oscuro = esOscuro()
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: oscuro ? MAP_STYLE_DARK : MAP_STYLE_LIGHT,
      center: [campus.lng, campus.lat],
      zoom: DEFAULT_ZOOM,
      maxBounds: BOUNDARY_MAX_BOUNDS,
      minZoom: BOUNDARY_MIN_ZOOM,
      attributionControl: false,
      maxPitch: 0,
      pitch: 0,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-left')
    map.touchPitch?.disable()

    map.on('style.load', () => {
      applyMapThemePalette(map, oscuro)
      shrinkBaseMapLabels(map)
      addFacultyLayers(map)
      addBoundaryMask(map, oscuro)
    })

    // Mismo tamaño de marcador por zoom que el mapa real (variable CSS en el
    // contenedor, no transform: el transform es de MapLibre).
    const aplicarEscala = () =>
      map.getContainer().style.setProperty('--pin-scale', String(pinScaleForZoom(map.getZoom())))
    aplicarEscala()
    map.on('zoom', aplicarEscala)

    // La protección de MapView: sin esto los marcadores salen corridos cuando
    // el layout se asienta después del constructor.
    const observer = new ResizeObserver(() => map.resize())
    observer.observe(containerRef.current)

    mapRef.current = map
    const markers = markersRef.current
    return () => {
      observer.disconnect()
      map.remove()
      mapRef.current = null
      markers.clear()
    }
  }, [])

  // ── Marcadores: diff por id, sin rehacer innerHTML si no cambió lo visible ──
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = markersRef.current
    const ids = new Set(pins.map((p) => p.id))

    for (const [id, marker] of markers) {
      if (!ids.has(id)) {
        marker.remove()
        markers.delete(id)
      }
    }

    for (const pin of pins) {
      let marker = markers.get(pin.id)
      if (!marker) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'pin-marker'
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          onPinClickRef.current(pin.id)
        })
        marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat([pin.lng, pin.lat])
          .addTo(map)
        markers.set(pin.id, marker)
      }
      const el = marker.getElement()
      const renderKey = `${pin.category_id ?? ''}|${pin.type}`
      if (el.dataset.render !== renderKey) {
        el.dataset.render = renderKey
        el.innerHTML = markerSvgContent(pin)
      }
      const guia = guiaDePin?.(pin)
      if (guia) el.dataset.guia = guia
      else delete el.dataset.guia
      el.style.setProperty('--pin-color', markerColor(pin))
      el.setAttribute('aria-label', pin.title)
      el.title = pin.title
      // Clases con toggle, nunca className: MapLibre añade las suyas.
      el.classList.toggle('pin-marker--selected', pin.id === selectedId)
      el.classList.toggle('pin-marker--fixed', isFixedInfraCategory(pin.category_id))
      marker.setLngLat([pin.lng, pin.lat])
    }
  }, [pins, selectedId, guiaDePin])

  // El posicionado va en un envoltorio: maplibre-gl.css pone
  // `.maplibregl-map { position: relative }` sin capa, y eso le gana a la
  // utilidad `absolute` de Tailwind 4 en el mismo elemento. El contenedor se
  // quedaba con 0 px de alto y los marcadores, apilados arriba.
  return (
    <div data-guia="mapa" className="absolute inset-0">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  )
}
