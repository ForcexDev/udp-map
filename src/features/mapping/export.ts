import type { FacultyMapping } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Exportar el mapeo a archivos TypeScript.
//
// Se dibuja en la app y se guarda en Supabase, pero eso deja el trabajo en un
// solo sitio. Exportar lo baja a `src/shared/data/` para que quede versionado
// en git y para que el MODO DEMO tenga datos: es el mismo papel que cumple hoy
// facultyPerimeters.ts.
//
// Sale como TypeScript y no como JSON a propósito: así el compilador avisa si
// un día cambia la forma de `Building` o de `Area` y estos archivos se quedan
// atrás.
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportedFile {
  name: string
  contents: string
}

const HEADER = `// ⚠️ Archivo generado por el editor de /admin/mapeo. No editar a mano:
// vuelve a exportar desde ahí y reemplaza este archivo.
`

export function buildExport(mapping: FacultyMapping): ExportedFile[] {
  const buildings = `${HEADER}
import type { Building, BuildingFloor } from '@/shared/types/database'

export const BUILDINGS: Building[] = ${json(mapping.buildings)}

export const BUILDING_FLOORS: BuildingFloor[] = ${json(mapping.floors)}
`

  const areas = `${HEADER}
import type { Area } from '@/shared/types/database'

export const AREAS: Area[] = ${json(mapping.areas)}
`

  return [
    { name: 'buildings.ts', contents: buildings },
    { name: 'areas.ts', contents: areas },
  ]
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

/**
 * Descarga cada archivo por separado. Un zip obligaría a traerse una
 * dependencia para empaquetar dos archivos de texto.
 */
export function downloadExport(files: ExportedFile[]): void {
  for (const file of files) {
    const url = URL.createObjectURL(new Blob([file.contents], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }
}
