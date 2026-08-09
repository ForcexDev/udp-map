import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { Area, Building, BuildingFloor } from '@/shared/types/database'
import { AREA_STYLES, BUILDING_COLOR, buildingHeightM } from '@/features/mapping/areaStyles'
import { areaVisibleOnFloor } from '@/shared/utils/floorVisibility'

// ─────────────────────────────────────────────────────────────────────────────
// El mapeo interior pintado en el mapa público.
//
// Lo dibujado aparece de golpe al mismo zoom, edificios y áreas juntos:
//
//   zoom ≥ 16    huellas de edificio y áreas. Dan estructura al perímetro.
//   zoom ≥ 16.5  el nombre corto del edificio; el completo a partir de 18.
//   zoom ≥ 17    el nombre del área.
//
// Las áreas entraban antes a 17.5 y los edificios a 16. En la banda intermedia
// se veían las huellas pero el patio no, y al alejarte desaparecía él solo: un
// hueco de vista y media que se leía como que el patio iba y venía. Un mapeo es
// una sola cosa; entra entera o no entra.
//
// Los edificios que no tienen la planta activa se atenúan, que es la forma de
// decir "este no tiene subterráneo" sin borrarlo del mapa. El atenuado va con
// transición: sin ella la opacidad saltaba de golpe y se leía como parpadeo.
// ─────────────────────────────────────────────────────────────────────────────

const BUILDINGS_SOURCE = 'mapping-buildings'
const AREAS_SOURCE = 'mapping-areas'

export const BUILDING_FILL_LAYER = 'mapping-buildings-fill'
export const AREA_FILL_LAYER = 'mapping-areas-fill'

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] }

/**
 * A partir de aquí se ve el mapeo: huellas y áreas a la vez. Más lejos que esto
 * un edificio de 40 m cabe en el dedo y lo único que sitúa la facultad es el
 * contorno de su perímetro, que no tiene umbral.
 */
export const MAPPING_MIN_ZOOM = 16

/**
 * Por debajo de este zoom no se entra en ninguna facultad y no hay selector de
 * plantas. Más lejos que esto la facultad entera cabe en el dedo y elegir un
 * piso no significa nada porque no se distingue nada.
 */
export const INDOOR_MIN_ZOOM = 17.5

/**
 * Y no se sale hasta bajar de aquí. El margen existe porque con un solo umbral
 * un gesto de zoom que se queda rondando 17.5 entra y sale varias veces, y en
 * cada vuelta se rehacen los marcadores y salta la opacidad de las huellas:
 * eso era el parpadeo.
 */
export const INDOOR_EXIT_ZOOM = 17.2

/** Cuánto se agranda el perímetro antes de dar a alguien por fuera. */
export const INDOOR_EXIT_MARGIN_M = 5

export { buildingHeightM }

function buildingFeature(building: Building, height: number, dimmed: boolean): Feature<Polygon> {
  return {
    type: 'Feature',
    id: building.id,
    properties: {
      id: building.id,
      facultyId: building.faculty_id,
      name: building.name,
      shortName: building.short_name || building.name,
      color: building.color ?? BUILDING_COLOR,
      height,
      // La huella es lo que marca la facultad en 2D, ahora que el perímetro
      // solo se contornea: tiene que verse sin llegar a tapar la calle.
      opacity: dimmed ? 0.07 : 0.2,
      lineOpacity: dimmed ? 0.25 : 0.8,
    },
    geometry: building.footprint,
  }
}

function areaFeature(area: Area): Feature<Polygon> {
  const style = AREA_STYLES[area.kind]
  return {
    type: 'Feature',
    id: area.id,
    properties: {
      id: area.id,
      facultyId: area.faculty_id,
      name: area.name,
      // El tipo libre gana cuando existe: "Bodega" dice más que "Otro".
      kindLabel: area.custom_kind ?? style.label,
      color: area.color ?? style.color,
      opacity: style.opacity,
    },
    geometry: area.polygon,
  }
}

/**
 * Colores del texto de las etiquetas, por tema.
 *
 * El halo es del color del fondo del mapa, no siempre blanco: en modo oscuro un
 * halo blanco alrededor de letras oscuras dibuja un contorno luminoso que se
 * lee peor que el texto. Se invierten los dos.
 */
function labelPaint(dark: boolean) {
  return {
    'text-color': dark ? '#e4e4e7' : '#3f3f46',
    'text-halo-color': dark ? '#18181b' : '#ffffff',
  }
}

/**
 * Agrega las capas del mapeo. Idempotente: se puede repetir tras un setStyle,
 * y entonces solo refresca los colores que dependen del tema.
 */
export function addMappingLayers(map: MapLibreMap, dark = false): void {
  const label = labelPaint(dark)
  if (!map.getSource(BUILDINGS_SOURCE)) {
    map.addSource(BUILDINGS_SOURCE, { type: 'geojson', data: EMPTY })
  }
  if (!map.getSource(AREAS_SOURCE)) {
    map.addSource(AREAS_SOURCE, { type: 'geojson', data: EMPTY })
  }

  if (!map.getLayer(BUILDING_FILL_LAYER)) {
    map.addLayer({
      id: BUILDING_FILL_LAYER,
      type: 'fill',
      source: BUILDINGS_SOURCE,
      minzoom: MAPPING_MIN_ZOOM,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['get', 'opacity'],
        'fill-opacity-transition': { duration: 220, delay: 0 },
      },
    })
  }

  if (!map.getLayer('mapping-buildings-line')) {
    map.addLayer({
      id: 'mapping-buildings-line',
      type: 'line',
      source: BUILDINGS_SOURCE,
      minzoom: MAPPING_MIN_ZOOM,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1.2,
        'line-opacity': ['get', 'lineOpacity'],
        'line-opacity-transition': { duration: 220, delay: 0 },
      },
    })
  }

  // Volumen propio SOLO para los edificios que faltan en OpenStreetMap.
  //
  // El filtro por altura > 0 es lo que lo mantiene así: quien mapea deja la
  // altura en 0 y el edificio de OSM se ve tal cual, y solo escribe metros
  // cuando OSM no lo tiene. Sin el filtro se levantaban los cuatro, encima de
  // los de OSM, y el campus salía con los edificios duplicados.
  if (!map.getLayer('mapping-buildings-3d')) {
    map.addLayer({
      id: 'mapping-buildings-3d',
      type: 'fill-extrusion',
      source: BUILDINGS_SOURCE,
      minzoom: MAPPING_MIN_ZOOM,
      filter: ['>', ['get', 'height'], 0],
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0,
        // Opacidad 1 y sin gradiente: color plano, igual que los edificios de
        // OSM que resalta `facultyLayers`, para que si alguno coincide no se
        // note la superposición.
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': false,
      },
    })
  }

  // El nombre del edificio. Sin esta capa el mapa público enseñaba las huellas
  // pero no decía de qué eran: solo se leía "Patio", que es un área y sí tenía
  // etiqueta. El corto entra pronto porque cabe; el completo, cuando hay sitio.
  if (!map.getLayer('mapping-buildings-label')) {
    map.addLayer({
      id: 'mapping-buildings-label',
      type: 'symbol',
      source: BUILDINGS_SOURCE,
      minzoom: 16.5,
      layout: {
        'text-field': ['step', ['zoom'], ['get', 'shortName'], 18, ['get', 'name']],
        'text-size': ['step', ['zoom'], 11, 18, 12.5],
        'text-font': ['Noto Sans Regular'],
        'text-max-width': 8,
        'text-padding': 6,
        'text-allow-overlap': false,
        'symbol-sort-key': 0,
      },
      paint: { ...label, 'text-halo-width': 1.6 },
    })
  } else {
    map.setPaintProperty('mapping-buildings-label', 'text-color', label['text-color'])
    map.setPaintProperty('mapping-buildings-label', 'text-halo-color', label['text-halo-color'])
  }

  if (!map.getLayer(AREA_FILL_LAYER)) {
    map.addLayer({
      id: AREA_FILL_LAYER,
      type: 'fill',
      source: AREAS_SOURCE,
      minzoom: MAPPING_MIN_ZOOM,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['get', 'opacity'],
        'fill-opacity-transition': { duration: 220, delay: 0 },
      },
    })
  }

  if (!map.getLayer('mapping-areas-line')) {
    map.addLayer({
      id: 'mapping-areas-line',
      type: 'line',
      source: AREAS_SOURCE,
      minzoom: MAPPING_MIN_ZOOM,
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 1,
        'line-opacity': 0.7,
        'line-opacity-transition': { duration: 220, delay: 0 },
      },
    })
  }

  // Media vista después que el relleno: el polígono ya se ve, y el nombre entra
  // cuando hay sitio para leerlo sin pisar al del edificio.
  if (!map.getLayer('mapping-areas-label')) {
    map.addLayer({
      id: 'mapping-areas-label',
      type: 'symbol',
      source: AREAS_SOURCE,
      minzoom: 17,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-font': ['Noto Sans Regular'],
        // Antes que solaparse, se esconde: dos nombres encimados no se leen.
        'text-allow-overlap': false,
        'text-padding': 4,
        // Por debajo del nombre del edificio: si solo cabe uno, que sea el
        // contenedor, que es el que orienta.
        'symbol-sort-key': 1,
      },
      paint: { ...label, 'text-halo-width': 1.4 },
    })
  } else {
    map.setPaintProperty('mapping-areas-label', 'text-color', label['text-color'])
    map.setPaintProperty('mapping-areas-label', 'text-halo-color', label['text-halo-color'])
  }
}

/**
 * Actualiza qué se ve, para la facultad y la planta activas.
 *
 * La planta manda sobre TODA la facultad a la vez, no sobre un edificio: elegir
 * "piso 2" enseña el segundo piso de los cuatro edificios. Un edificio que no
 * llegue a esa planta —el que no tiene subterráneo— se atenúa en vez de
 * desaparecer: sigue estando ahí, simplemente no tiene nada que enseñar.
 */
export function updateMappingData(
  map: MapLibreMap,
  buildings: Building[],
  floors: BuildingFloor[],
  areas: Area[],
  activeFacultyId: string | null,
  activeFloor: number | null,
): void {
  const buildingsSource = map.getSource(BUILDINGS_SOURCE) as GeoJSONSource | undefined
  const areasSource = map.getSource(AREAS_SOURCE) as GeoJSONSource | undefined
  if (!buildingsSource || !areasSource) return

  const hasLevel = (buildingId: string, level: number) =>
    floors.some((f) => f.building_id === buildingId && f.level === level)

  buildingsSource.setData({
    type: 'FeatureCollection',
    features: buildings.map((b) => {
      const dimmed =
        activeFloor !== null && b.faculty_id === activeFacultyId && !hasLevel(b.id, activeFloor)
      return buildingFeature(b, buildingHeightM(b), dimmed)
    }),
  })

  const defaultFloorOf = new Map(buildings.map((b) => [b.id, b.default_floor]))
  const visible = areas.filter((a) =>
    areaVisibleOnFloor(a, activeFacultyId, activeFloor, (id) => defaultFloorOf.get(id)),
  )

  areasSource.setData({ type: 'FeatureCollection', features: visible.map(areaFeature) })
}
