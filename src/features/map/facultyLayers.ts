import type { Map as MapLibreMap, FilterSpecification } from 'maplibre-gl'
import type { Polygon } from 'geojson'
import { FACULTY_PERIMETERS, facultyPerimetersGeoJSON } from '@/shared/data/facultyPerimeters'

// ─────────────────────────────────────────────────────────────────
// Capas de facultad (hoy solo Ingeniería):
//  1. faculty-perimeter-fill  → interior del perímetro en rojo suave
//  2. faculty-buildings-3d-*  → edificios 3D dentro del perímetro en
//     rojo sólido uniforme (filtro espacial `within`)
//  3. faculty-perimeter-line  → borde del perímetro
// Referencias: maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d
// ─────────────────────────────────────────────────────────────────

/** Rojo UDP para edificios seleccionados y borde del perímetro. */
const FACULTY_RED = '#D41F2D'
/** El interior usa el mismo rojo con baja opacidad → rojo suave sobre el suelo. */
const INTERIOR_OPACITY = 0.16

/**
 * `within` exige que la huella del edificio quede COMPLETA dentro del polígono
 * y el perímetro corre pegado a las fachadas, así que para el filtro se expande
 * el polígono unos metros hacia afuera (desplazando cada vértice desde el
 * centroide). El pintado del interior y el borde usan el polígono original.
 */
function expandPolygon(polygon: Polygon, meters: number): Polygon {
  const M_PER_DEG_LAT = 111_320
  return {
    type: 'Polygon',
    coordinates: polygon.coordinates.map((ring) => {
      const cLng = ring.reduce((s, p) => s + p[0], 0) / ring.length
      const cLat = ring.reduce((s, p) => s + p[1], 0) / ring.length
      const mPerDegLng = M_PER_DEG_LAT * Math.cos((cLat * Math.PI) / 180)
      return ring.map(([lng, lat]) => {
        const dx = (lng - cLng) * mPerDegLng
        const dy = (lat - cLat) * M_PER_DEG_LAT
        const dist = Math.hypot(dx, dy) || 1
        return [
          lng + ((dx / dist) * meters) / mPerDegLng,
          lat + ((dy / dist) * meters) / M_PER_DEG_LAT,
        ]
      })
    }),
  }
}

const PERIMETER_SOURCE = 'faculty-perimeters'
const FILL_LAYER = 'faculty-perimeter-fill'
const LINE_LAYER = 'faculty-perimeter-line'
const buildingsLayerId = (facultyId: string) => `faculty-buildings-3d-${facultyId}`

/**
 * Agrega las capas de facultad al estilo cargado. Idempotente: se puede
 * llamar de nuevo tras un cambio de estilo sin duplicar capas.
 */
export function addFacultyLayers(map: MapLibreMap) {
  const layers = map.getStyle().layers ?? []

  // Capa 3D base del estilo (en OpenFreeMap Liberty: 'building-3d',
  // source 'openmaptiles', source-layer 'building').
  let baseExtrusion = layers.find((l) => l.type === 'fill-extrusion')

  // Fallback: si el estilo no trae edificios 3D, agregarlos (ejemplo
  // display-buildings-in-3d de MapLibre) para poder resaltar encima.
  if (!baseExtrusion && !map.getLayer('building-3d')) {
    if (map.getSource('openmaptiles')) {
      map.addLayer({
        id: 'building-3d',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': 'hsl(35,8%,85%)',
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.8,
        },
      })
      baseExtrusion = map.getStyle().layers?.find((l) => l.type === 'fill-extrusion')
    }
  }

  const buildingSource = (baseExtrusion && 'source' in baseExtrusion && baseExtrusion.source) || 'openmaptiles'
  const buildingSourceLayer =
    (baseExtrusion && 'source-layer' in baseExtrusion && baseExtrusion['source-layer']) || 'building'

  if (!map.getSource(PERIMETER_SOURCE)) {
    map.addSource(PERIMETER_SOURCE, { type: 'geojson', data: facultyPerimetersGeoJSON() })
  }

  // 1) Interior rojo suave, debajo de los edificios 3D para teñir el suelo.
  if (!map.getLayer(FILL_LAYER)) {
    map.addLayer(
      {
        id: FILL_LAYER,
        type: 'fill',
        source: PERIMETER_SOURCE,
        paint: {
          'fill-color': FACULTY_RED,
          'fill-opacity': INTERIOR_OPACITY,
        },
      },
      baseExtrusion?.id,
    )
  }

  // 2) Edificios 3D dentro del perímetro → rojo sólido uniforme.
  //    `within` selecciona solo las huellas contenidas en el polígono.
  if (map.getSource(buildingSource)) {
    for (const [facultyId, polygon] of Object.entries(FACULTY_PERIMETERS)) {
      const id = buildingsLayerId(facultyId)
      if (map.getLayer(id)) continue
      map.addLayer({
        id,
        type: 'fill-extrusion',
        source: buildingSource,
        'source-layer': buildingSourceLayer,
        minzoom: 14,
        filter: ['within', expandPolygon(polygon, 8)] as unknown as FilterSpecification,
        paint: {
          'fill-extrusion-color': FACULTY_RED,
          'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          // Opacidad 1 + sin gradiente vertical = color plano y uniforme.
          'fill-extrusion-opacity': 1,
          'fill-extrusion-vertical-gradient': false,
        },
      })
    }
  }

  // 3) Borde del perímetro, sobre todo lo demás.
  if (!map.getLayer(LINE_LAYER)) {
    map.addLayer({
      id: LINE_LAYER,
      type: 'line',
      source: PERIMETER_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': FACULTY_RED,
        'line-width': 2.5,
        'line-opacity': 0.9,
      },
    })
  }
}
