import type { AreaKind } from '@/shared/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// El color por defecto identifica el TIPO; la etiqueta identifica el LUGAR.
//
// Doce áreas en doce colores fuertes se ve a parches y no se aprende; el mismo
// tono apagado con el nombre encima se lee de un vistazo. Quien mapea puede
// sobreescribir el color de un área concreta cuando el automático no convenga
// (`areas.color`), pero el valor por defecto evita tener que elegir uno cada vez.
//
// Las opacidades son bajas a propósito: debajo hay un mapa que tiene que
// seguir leyéndose.
// ─────────────────────────────────────────────────────────────────────────────

export interface AreaStyle {
  label: string
  color: string
  opacity: number
  /** Un área exterior no cuelga de ningún edificio ni de ninguna planta. */
  outdoor: boolean
}

export const AREA_STYLES: Record<AreaKind, AreaStyle> = {
  hall: { label: 'Hall', color: '#F59E0B', opacity: 0.18, outdoor: false },
  corridor: { label: 'Pasillo', color: '#A8A29E', opacity: 0.14, outdoor: false },
  cafeteria: { label: 'Casino', color: '#F59E0B', opacity: 0.22, outdoor: false },
  kiosk: { label: 'Quiosco', color: '#B45309', opacity: 0.24, outdoor: false },
  lab: { label: 'Laboratorio', color: '#3B82F6', opacity: 0.20, outdoor: false },
  office: { label: 'Oficinas', color: '#64748B', opacity: 0.18, outdoor: false },
  service: { label: 'Servicios', color: '#94A3B8', opacity: 0.14, outdoor: false },
  courtyard: { label: 'Patio', color: '#65A30D', opacity: 0.18, outdoor: true },
  sports: { label: 'Cancha', color: '#0EA5E9', opacity: 0.18, outdoor: true },
  parking: { label: 'Estacionamiento', color: '#78716C', opacity: 0.16, outdoor: true },
  green: { label: 'Área verde', color: '#84CC16', opacity: 0.15, outdoor: true },
  other: { label: 'Otro', color: '#A1A1AA', opacity: 0.16, outdoor: false },
}

export const AREA_KINDS = Object.keys(AREA_STYLES) as AreaKind[]

/** Los tipos que tienen sentido dentro de un edificio, y los del exterior. */
export const INDOOR_KINDS = AREA_KINDS.filter((k) => !AREA_STYLES[k].outdoor)
export const OUTDOOR_KINDS = AREA_KINDS.filter((k) => AREA_STYLES[k].outdoor)

export function areaColor(kind: AreaKind, override: string | null): string {
  return override ?? AREA_STYLES[kind].color
}

/** Rojo UDP: el mismo de los perímetros y los edificios 3D. */
export const BUILDING_COLOR = '#D41F2D'

/**
 * La altura del volumen 3D, en metros. **0 = no se levanta nada.**
 *
 * Sale exclusivamente de `height_m`, que es lo que se escribe a mano en
 * `/admin/mapeo`, y no se deduce de ningún sitio. Casi todos los edificios del
 * campus YA están en OpenStreetMap con su altura, y el estilo del mapa los
 * levanta solo: generarles encima un volumen propio sería dibujar dos veces el
 * mismo edificio, uno tapando al otro. La altura se rellena únicamente para los
 * que faltan en OSM, y hasta entonces vale 0.
 *
 * Vive aquí, junto al color, y no en `map/mappingLayers.ts`, porque la
 * comparten el mapa público y la previsualización del editor. Con una copia en
 * cada lado, la vista previa acabaría mintiendo sobre lo que se va a ver.
 */
export function buildingHeightM(building: { height_m: number | null }): number {
  return building.height_m && building.height_m > 0 ? building.height_m : 0
}

/**
 * Nombre de una planta. `label` gana cuando existe, porque hay plantas que la
 * gente no llama por su número ("Zócalo", "Entrepiso").
 */
export function floorName(level: number, label: string | null): string {
  if (label) return label
  if (level < 0) return level === -1 ? 'Subterráneo' : `Subterráneo ${Math.abs(level)}`
  return `Piso ${level}`
}

/** Versión corta para el selector vertical del mapa: 3, 1, S1. */
export function floorShortName(level: number): string {
  return level < 0 ? `S${Math.abs(level)}` : String(level)
}
