import type { Polygon } from 'geojson'
import {
  formatArea,
  openRing,
  polygonAreaM2,
  polygonIntersectionAreaM2,
  polygonWithinPolygon,
} from '@/shared/utils/geometry'

// ─────────────────────────────────────────────────────────────────────────────
// Validaciones del trazado.
//
// Distinguen ERROR de AVISO a propósito, y la diferencia importa:
//
//   error  impide guardar. Solo lo que dejaría datos incoherentes: un área
//          fuera de su edificio, una forma sin superficie, un nombre vacío.
//   aviso  se muestra y deja seguir. Un solape suele ser un error de trazado,
//          pero también puede ser deliberado —un quiosco dentro del casino— y
//          el editor no está en posición de saber cuál de los dos es.
//
// Todos los mensajes van junto al campo, no en un toast: son correcciones en
// curso, no cosas que ya pasaron.
// ─────────────────────────────────────────────────────────────────────────────

/** Por debajo de esto casi siempre es un doble clic accidental. */
export const MIN_AREA_M2 = 2

/** El perímetro corre pegado a la fachada, así que unos centímetros fuera pasan. */
export const CONTAINMENT_TOLERANCE_M = 1

export interface ValidationIssue {
  level: 'error' | 'warning'
  field: 'name' | 'shape'
  message: string
}

export interface ShapeContext {
  /** Huella del edificio, o perímetro de la facultad si el área es exterior. */
  container: Polygon | null
  containerLabel: string
  /** Áreas de la misma planta contra las que comprobar solapes. */
  siblings: { id: string; name: string; polygon: Polygon }[]
  /** Al editar, la propia área no cuenta como vecina. */
  editingAreaId?: string | null
}

export function validateArea(
  name: string,
  polygon: Polygon | null,
  context: ShapeContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!name.trim()) {
    issues.push({ level: 'error', field: 'name', message: 'Ponle un nombre.' })
  } else if (name.trim().length > 120) {
    issues.push({ level: 'error', field: 'name', message: 'Máximo 120 caracteres.' })
  }

  if (!polygon || openRing(polygon.coordinates[0] ?? []).length < 3) {
    issues.push({ level: 'error', field: 'shape', message: 'Dibuja la forma en el mapa.' })
    return issues
  }

  const area = polygonAreaM2(polygon)
  if (area < MIN_AREA_M2) {
    issues.push({
      level: 'error',
      field: 'shape',
      message: `Son ${formatArea(area)}: demasiado pequeña para ser un área real.`,
    })
  }

  if (context.container && !polygonWithinPolygon(polygon, context.container, CONTAINMENT_TOLERANCE_M)) {
    issues.push({
      level: 'error',
      field: 'shape',
      message: `Se sale de ${context.containerLabel}.`,
    })
  }

  for (const sibling of context.siblings) {
    if (sibling.id === context.editingAreaId) continue
    const shared = polygonIntersectionAreaM2(polygon, sibling.polygon)
    // Por debajo del 1 % no es un solape sino ruido del trazado.
    if (shared > Math.max(MIN_AREA_M2, area * 0.01)) {
      issues.push({
        level: 'warning',
        field: 'shape',
        message: `Se solapa ${formatArea(shared)} con "${sibling.name}".`,
      })
    }
  }

  return issues
}

export function validateBuilding(
  name: string,
  polygon: Polygon | null,
  context: { perimeter: Polygon | null },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!name.trim()) {
    issues.push({ level: 'error', field: 'name', message: 'Ponle un nombre.' })
  }

  if (!polygon || openRing(polygon.coordinates[0] ?? []).length < 3) {
    issues.push({ level: 'error', field: 'shape', message: 'Dibuja la huella en el mapa.' })
    return issues
  }

  if (polygonAreaM2(polygon) < MIN_AREA_M2) {
    issues.push({ level: 'error', field: 'shape', message: 'La huella es demasiado pequeña.' })
  }

  // Aviso y no error: hay edificios que asoman del perímetro trazado, y no es
  // motivo para impedir guardarlos.
  if (context.perimeter && !polygonWithinPolygon(polygon, context.perimeter, CONTAINMENT_TOLERANCE_M)) {
    issues.push({
      level: 'warning',
      field: 'shape',
      message: 'La huella se sale del perímetro de la facultad.',
    })
  }

  return issues
}

/** Por debajo de esto no es una facultad, es un error de trazado. */
export const MIN_FACULTY_AREA_M2 = 100

export function validateFaculty(
  name: string,
  polygon: Polygon | null,
  context: {
    /** true si es una facultad nueva; entonces el perímetro es obligatorio. */
    isNew: boolean
    /** Perímetros de las DEMÁS facultades, para avisar de solapes. */
    others: { id: string; name: string; polygon: Polygon }[]
  },
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!name.trim()) {
    issues.push({ level: 'error', field: 'name', message: 'Ponle un nombre.' })
  } else if (name.trim().length > 120) {
    issues.push({ level: 'error', field: 'name', message: 'Máximo 120 caracteres.' })
  }

  if (!polygon || openRing(polygon.coordinates[0] ?? []).length < 3) {
    // El perímetro es obligatorio al crear porque de él sale la chincheta y
    // porque sin él la facultad no asigna pines ni se puede entrar a mapearla:
    // existiría en la lista y en ningún sitio más. Al editar una que ya está,
    // no: se puede querer solo corregirle el nombre.
    if (context.isNew) {
      issues.push({
        level: 'error',
        field: 'shape',
        message: 'Traza el perímetro en el mapa: de ahí sale la chincheta.',
      })
    }
    return issues
  }

  if (polygonAreaM2(polygon) < MIN_FACULTY_AREA_M2) {
    issues.push({
      level: 'error',
      field: 'shape',
      message: `Son ${formatArea(polygonAreaM2(polygon))}: demasiado poco para una facultad.`,
    })
  }

  // Aviso y no error: la Biblioteca y Ciencias Sociales comparten manzana y sus
  // perímetros ya se rozan a propósito. `facultyIdAt` desempata por cercanía.
  for (const other of context.others) {
    const shared = polygonIntersectionAreaM2(polygon, other.polygon)
    if (shared > MIN_FACULTY_AREA_M2) {
      issues.push({
        level: 'warning',
        field: 'shape',
        message: `Se solapa ${formatArea(shared)} con "${other.name}". Un pin ahí irá a la más cercana.`,
      })
    }
  }

  return issues
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === 'error')
}

export function issuesFor(issues: ValidationIssue[], field: ValidationIssue['field']) {
  return issues.filter((i) => i.field === field)
}
