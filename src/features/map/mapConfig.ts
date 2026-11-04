import type { Map as MapLibreMap } from 'maplibre-gl'

/** Estilo vectorial de OpenFreeMap; contrato en docs/referencia/repositorio.md. */
export const MAP_STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty'
export const MAP_STYLE_DARK = 'https://tiles.openfreemap.org/styles/liberty'

export const DEFAULT_ZOOM = 16.3

const PRIMARY_ROADS = [
  'road_trunk_primary',
  'road_secondary_tertiary',
  'road_link',
  'bridge_trunk_primary',
  'bridge_secondary_tertiary',
  'bridge_link',
  'tunnel_trunk_primary',
  'tunnel_secondary_tertiary',
  'tunnel_link',
] as const

const MOTORWAYS = [
  'road_motorway',
  'road_motorway_link',
  'bridge_motorway',
  'bridge_motorway_link',
  'tunnel_motorway',
  'tunnel_motorway_link',
] as const

const MINOR_ROADS = [
  'road_minor',
  'road_service_track',
  'bridge_street',
  'bridge_service_track',
  'tunnel_minor',
  'tunnel_service_track',
] as const

const ROAD_CASINGS = [
  'road_motorway_casing',
  'road_trunk_primary_casing',
  'road_secondary_tertiary_casing',
  'road_link_casing',
  'road_motorway_link_casing',
  'road_minor_casing',
  'road_service_track_casing',
  'bridge_motorway_casing',
  'bridge_trunk_primary_casing',
  'bridge_secondary_tertiary_casing',
  'bridge_link_casing',
  'bridge_motorway_link_casing',
  'bridge_street_casing',
  'bridge_service_track_casing',
  'bridge_path_pedestrian_casing',
  'tunnel_motorway_casing',
  'tunnel_trunk_primary_casing',
  'tunnel_secondary_tertiary_casing',
  'tunnel_link_casing',
  'tunnel_motorway_link_casing',
  'tunnel_street_casing',
  'tunnel_service_track_casing',
] as const

const HIGHWAY_LABELS = ['highway-name-minor', 'highway-name-major', 'highway-name-path'] as const

const POI_LABELS = ['poi_r20', 'poi_r7', 'poi_r1', 'poi_transit', 'airport'] as const

const PLACE_LABELS = [
  'label_other',
  'label_village',
  'label_town',
  'label_state',
  'label_city',
  'label_city_capital',
  'label_country_3',
  'label_country_2',
  'label_country_1',
] as const

const RAIL_LAYERS = [
  'road_major_rail',
  'road_major_rail_hatching',
  'road_transit_rail',
  'road_transit_rail_hatching',
  'bridge_major_rail',
  'bridge_major_rail_hatching',
  'bridge_transit_rail',
  'bridge_transit_rail_hatching',
  'tunnel_major_rail',
  'tunnel_major_rail_hatching',
  'tunnel_transit_rail',
  'tunnel_transit_rail_hatching',
] as const

function safeSetPaint(map: MapLibreMap, layerId: string, prop: string, value: unknown) {
  try {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, prop, value)
    }
  } catch {
    // Ignorar si la capa no existe en el estilo cargado o durante tests unitarios
  }
}

/**
 * Estiliza las capas base de OpenFreeMap Liberty para replicar la estética de
 * **Mapbox Standard** tanto en modo Día (manzanas crema cálido `#F7ECE2`,
 * edificios beige `#EFE5DC` con borde `#DDD0C2`, calles en azul-pizarra
 * `#B0B8C9` / `#8C9BB0` y parques verde menta `#A3E6A1`) como en modo Noche
 * (manzanas pizarra oscura `#1E222B`, edificios `#242934` con borde `#161922`,
 * calles acero `#4D5666` / `#647084` y parques verde bosque `#3D5245`).
 */
export function applyMapThemePalette(map: MapLibreMap, dark = false): void {
  if (typeof map.getLayer !== 'function' || typeof map.setPaintProperty !== 'function') return

  const p = dark
    ? {
        // Mapbox Standard Night
        bg: '#1E222B',
        residential: '#1E222B',
        school: '#2B282E',
        hospital: '#29242C',
        sand: '#25262E',
        park: '#3D5245',
        parkOutline: '#465E4F',
        grass: '#3A4F42',
        wood: '#34483B',
        pitch: '#41584A',
        water: '#18283B',
        buildingFill: '#242934',
        buildingOutline: '#151821',
        building3d: '#282E3B',
        roadMinor: '#4D5666',
        roadPrimary: '#576173',
        roadMotorway: '#647084',
        roadCasing: '#2E3440',
        pedestrian: '#555F70',
        rail: '#3B4252',
        roadLabel: '#E2E8F0',
        roadHalo: 'rgba(24, 28, 38, 0.92)',
        poiLabel: '#CBD5E1',
        poiHalo: 'rgba(20, 24, 33, 0.92)',
        placeLabel: '#E2E8F0',
      }
    : {
        // Mapbox Standard Day
        bg: '#F7ECE2',
        residential: '#F6EBE0',
        school: '#EFE0CA',
        hospital: '#F5E4E0',
        sand: '#F2E5D2',
        park: '#A3E6A1',
        parkOutline: '#8FD98D',
        grass: '#A6E7A4',
        wood: '#92DC90',
        pitch: '#ADEAA9',
        water: '#8CC2F5',
        buildingFill: '#EFE5DC',
        buildingOutline: '#DDD0C2',
        building3d: '#EDE2D7',
        roadMinor: '#B0B8C9',
        roadPrimary: '#A7B1C4',
        roadMotorway: '#8C9BB0',
        roadCasing: '#949FB3',
        pedestrian: '#E9EDF2',
        rail: '#9BA5B7',
        roadLabel: '#333C4D',
        roadHalo: 'rgba(255, 255, 255, 0.85)',
        poiLabel: '#475569',
        poiHalo: 'rgba(255, 255, 255, 0.92)',
        placeLabel: '#1E293B',
      }

  safeSetPaint(map, 'background', 'background-color', p.bg)
  safeSetPaint(map, 'landuse_residential', 'fill-color', p.residential)
  safeSetPaint(map, 'landuse_school', 'fill-color', p.school)
  safeSetPaint(map, 'landuse_hospital', 'fill-color', p.hospital)
  safeSetPaint(map, 'landcover_sand', 'fill-color', p.sand)

  safeSetPaint(map, 'park', 'fill-color', p.park)
  safeSetPaint(map, 'park', 'fill-opacity', 0.88)
  safeSetPaint(map, 'park', 'fill-outline-color', p.parkOutline)
  safeSetPaint(map, 'park_outline', 'line-color', p.parkOutline)
  safeSetPaint(map, 'landcover_grass', 'fill-color', p.grass)
  safeSetPaint(map, 'landcover_grass', 'fill-opacity', 0.65)
  safeSetPaint(map, 'landcover_wood', 'fill-color', p.wood)
  safeSetPaint(map, 'landuse_pitch', 'fill-color', p.pitch)
  safeSetPaint(map, 'landuse_track', 'fill-color', p.pitch)
  safeSetPaint(map, 'landuse_cemetery', 'fill-color', p.pitch)

  safeSetPaint(map, 'water', 'fill-color', p.water)
  safeSetPaint(map, 'waterway_river', 'line-color', p.water)
  safeSetPaint(map, 'waterway_other', 'line-color', p.water)
  safeSetPaint(map, 'waterway_tunnel', 'line-color', p.water)

  safeSetPaint(map, 'building', 'fill-color', p.buildingFill)
  safeSetPaint(map, 'building', 'fill-outline-color', p.buildingOutline)
  safeSetPaint(map, 'building-3d', 'fill-extrusion-color', p.building3d)

  for (const id of MINOR_ROADS) {
    safeSetPaint(map, id, 'line-color', p.roadMinor)
  }
  for (const id of PRIMARY_ROADS) {
    safeSetPaint(map, id, 'line-color', p.roadPrimary)
  }
  for (const id of MOTORWAYS) {
    safeSetPaint(map, id, 'line-color', p.roadMotorway)
  }
  for (const id of ROAD_CASINGS) {
    safeSetPaint(map, id, 'line-color', p.roadCasing)
  }
  for (const id of RAIL_LAYERS) {
    safeSetPaint(map, id, 'line-color', p.rail)
  }

  safeSetPaint(map, 'road_path_pedestrian', 'line-color', p.pedestrian)
  safeSetPaint(map, 'bridge_path_pedestrian', 'line-color', p.pedestrian)
  safeSetPaint(map, 'tunnel_path_pedestrian', 'line-color', p.pedestrian)

  for (const id of HIGHWAY_LABELS) {
    safeSetPaint(map, id, 'text-color', p.roadLabel)
    safeSetPaint(map, id, 'text-halo-color', p.roadHalo)
    safeSetPaint(map, id, 'text-halo-width', 1.4)
  }
  for (const id of POI_LABELS) {
    safeSetPaint(map, id, 'text-color', p.poiLabel)
    safeSetPaint(map, id, 'text-halo-color', p.poiHalo)
    safeSetPaint(map, id, 'text-halo-width', 1.2)
  }
  for (const id of PLACE_LABELS) {
    safeSetPaint(map, id, 'text-color', p.placeLabel)
    safeSetPaint(map, id, 'text-halo-color', p.poiHalo)
  }
}
