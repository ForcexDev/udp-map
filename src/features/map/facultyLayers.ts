import type { Map as MapLibreMap, FilterSpecification, GeoJSONSource } from 'maplibre-gl'
import type { Polygon } from 'geojson'
import { facultyPerimeterEntries, facultyPerimetersGeoJSON } from '@/shared/data/facultyStore'

// ─────────────────────────────────────────────────────────────────
// Capas de facultad (hoy solo Ingeniería):
//  1. faculty-perimeter-fill  → INVISIBLE. Es solo el blanco de clic que abre
//     el feed de la facultad.
//  2. faculty-buildings-3d-*  → edificios 3D dentro del perímetro en
//     rojo sólido uniforme (filtro espacial `within`)
//  3. faculty-perimeter-line  → el CONTORNO, que es lo único que se pinta.
// Referencias: maplibre.org/maplibre-gl-js/docs/examples/display-buildings-in-3d
//
// El perímetro se dibuja, pero no se rellena.
//
// Rellenarlo convertía una hectárea de campus en una mancha plana: tapaba las
// calles, competía con los pines y no decía nada que el contorno no diga mejor.
// El contorno sí hace falta y va a todos los zooms: es lo único que enseña
// dónde empieza y termina una facultad cuando estás lejos y todavía no se ven
// sus edificios, y lo que ancla el mapeo interior cuando estás cerca.
//
// La capa de relleno se queda con opacidad 0 en vez de borrarse:
// `queryRenderedFeatures` sigue devolviéndola —la opacidad de pintado no
// afecta al golpeo— así que tocar dentro del perímetro sigue abriendo el feed
// de la facultad sin necesidad de otro mecanismo.
// ─────────────────────────────────────────────────────────────────

/** Rojo UDP para los edificios de la facultad. */
const FACULTY_RED = '#D41F2D'

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

/**
 * El relleno del perímetro es además el blanco de clic que abre el feed de la
 * facultad, así que su id lo necesita el manejador de clics de `MapView`.
 */
export const PERIMETER_FILL_LAYER = FILL_LAYER
const BUILDINGS_LAYER_PREFIX = 'faculty-buildings-3d-'
const buildingsLayerId = (facultyId: string) => `${BUILDINGS_LAYER_PREFIX}${facultyId}`

/** El source de edificios del estilo cargado, o el de OpenFreeMap por defecto. */
function buildingSourceOf(map: MapLibreMap): { source: string; sourceLayer: string } | null {
  const baseExtrusion = (map.getStyle().layers ?? []).find((l) => l.type === 'fill-extrusion')
  const source = String(
    (baseExtrusion && 'source' in baseExtrusion && baseExtrusion.source) || 'openmaptiles',
  )
  if (!map.getSource(source)) return null
  return {
    source,
    sourceLayer: String(
      (baseExtrusion && 'source-layer' in baseExtrusion && baseExtrusion['source-layer']) ||
        'building',
    ),
  }
}

/**
 * Una capa de edificios 3D por facultad CON perímetro, y ninguna de más.
 *
 * Se sincroniza en vez de solo añadir porque los perímetros ya no son una
 * constante del bundle: llegan de la base y se redibujan desde `/admin/mapeo`.
 * Sin la parte de quitar, redibujar un perímetro dejaría la capa vieja pintando
 * los edificios del trazo anterior encima del nuevo.
 */
function syncBuildingLayers(map: MapLibreMap, source: string, sourceLayer: string) {
  if (!map.getSource(source)) return

  const entries = facultyPerimeterEntries()
  const wanted = new Set(entries.map(([facultyId]) => buildingsLayerId(facultyId)))

  for (const layer of map.getStyle().layers ?? []) {
    if (layer.id.startsWith(BUILDINGS_LAYER_PREFIX) && !wanted.has(layer.id)) {
      map.removeLayer(layer.id)
    }
  }

  for (const [facultyId, polygon] of entries) {
    const id = buildingsLayerId(facultyId)
    // `within` exige la huella COMPLETA dentro, y el perímetro corre pegado a
    // las fachadas: por eso se expande unos metros solo para el filtro.
    const filter = ['within', expandPolygon(polygon, 8)] as unknown as FilterSpecification
    if (map.getLayer(id)) {
      map.setFilter(id, filter)
      continue
    }
    map.addLayer({
      id,
      type: 'fill-extrusion',
      source,
      'source-layer': sourceLayer,
      minzoom: 14,
      filter,
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

/**
 * Repinta los contornos con los perímetros que haya ahora en `facultyStore`.
 *
 * Se llama cuando el catálogo se rehidrata desde la base, que ocurre DESPUÉS de
 * que el mapa se monte: las capas se crearon con la semilla estática y hay que
 * ponerlas al día. Es idempotente y barato — un `setData` y, como mucho, alta y
 * baja de una capa por facultad.
 */
export function refreshFacultyPerimeters(map: MapLibreMap) {
  const source = map.getSource(PERIMETER_SOURCE) as GeoJSONSource | undefined
  if (!source) return
  source.setData(facultyPerimetersGeoJSON())

  const building = buildingSourceOf(map)
  if (building) syncBuildingLayers(map, building.source, building.sourceLayer)
}

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

  const buildingSource = String(
    (baseExtrusion && 'source' in baseExtrusion && baseExtrusion.source) || 'openmaptiles',
  )
  const buildingSourceLayer = String(
    (baseExtrusion && 'source-layer' in baseExtrusion && baseExtrusion['source-layer']) || 'building',
  )

  if (!map.getSource(PERIMETER_SOURCE)) {
    map.addSource(PERIMETER_SOURCE, { type: 'geojson', data: facultyPerimetersGeoJSON() })
  }

  // 1) Blanco de clic del perímetro. Invisible a propósito: ver el comentario
  //    de cabecera. Va debajo de los edificios 3D, donde estaba el relleno.
  if (!map.getLayer(FILL_LAYER)) {
    map.addLayer(
      {
        id: FILL_LAYER,
        type: 'fill',
        source: PERIMETER_SOURCE,
        paint: {
          'fill-color': FACULTY_RED,
          'fill-opacity': 0,
        },
      },
      baseExtrusion?.id,
    )
  }

  // 2) Edificios 3D dentro del perímetro → rojo sólido uniforme.
  //    `within` selecciona solo las huellas contenidas en el polígono.
  syncBuildingLayers(map, buildingSource, buildingSourceLayer)

  // 3) El contorno, sobre todo lo demás y sin `minzoom`: tiene que verse tanto
  //    en la vista de campus, donde es lo único que sitúa la facultad, como
  //    dentro, donde delimita lo mapeado.
  if (!map.getLayer(LINE_LAYER)) {
    map.addLayer({
      id: LINE_LAYER,
      type: 'line',
      source: PERIMETER_SOURCE,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': FACULTY_RED,
        'line-width': 2,
        'line-opacity': 0.85,
      },
    })
  }
}
