import { supabase } from '@/shared/lib/supabase'
import type { Faculty } from '@/shared/types/database'
import { FACULTIES } from './campusData'

// ─────────────────────────────────────────────────────────────────────────────
// Capa de datos de las facultades.
//
// Hasta la fase 7B el cliente NUNCA consultaba esta tabla: las facultades
// salían del array estático de `campusData` y crear una en la base no la hacía
// aparecer en ninguna parte. Ahora la base manda y el array es solo la semilla.
//
// Escribir requiere rol admin; lo impone la política `faculties_admin`, no este
// archivo. Coincide con el editor, que ya es admin-only (`AdminLayout`).
// ─────────────────────────────────────────────────────────────────────────────

export interface FacultyInput {
  id: string
  name: string
  name_en: string
  campus_id: string
  lat: number
  lng: number
  /** null ⇔ la facultad todavía no tiene perímetro trazado. */
  polygon: Faculty['polygon']
  image: string | null
}

/**
 * Almacén del MODO DEMO.
 *
 * Se copia al cargar el módulo, ANTES de que nadie pueda rehidratar
 * `FACULTIES`: si no, arrancar con Supabase y luego perderlo mezclaría las dos
 * fuentes.
 *
 * Arranca sin perímetros, igual que `mappingDemoDb` arranca sin edificios: la
 * geometría se dibuja, no se inventa. Sin credenciales el mapa no pinta
 * contornos y `facultyIdAt` no asigna facultad a un pin — es la consecuencia
 * de que la base sea la única fuente, y es preferible a mantener aquí una
 * segunda copia que se desincronice.
 */
const demoRows: Faculty[] = FACULTIES.map((f) => ({ ...f }))

export async function fetchFaculties(): Promise<Faculty[]> {
  if (!supabase) return demoRows.map((f) => ({ ...f }))

  const { data, error } = await supabase.from('faculties').select('*').order('name')
  if (error) throw error
  return (data ?? []) as Faculty[]
}

export async function upsertFaculty(input: FacultyInput): Promise<Faculty> {
  if (!supabase) {
    const row: Faculty = { ...input }
    const index = demoRows.findIndex((f) => f.id === row.id)
    if (index >= 0) demoRows[index] = row
    else demoRows.push(row)
    return { ...row }
  }

  const { data, error } = await supabase.from('faculties').upsert(input).select().single()
  if (error) throw error
  return data as Faculty
}

/**
 * Solo para deshacer una facultad recién creada por error.
 *
 * No hay cascada que la respalde: `pins`, `forum_threads` y `profiles` apuntan
 * a `faculties` sin `on delete cascade`, así que borrar una facultad con vida
 * encima falla en la base con un 23503. Quien llama comprueba antes que esté
 * vacía; esto es la red por si se coló algo entre medio.
 */
export async function deleteFaculty(facultyId: string): Promise<void> {
  if (!supabase) {
    const index = demoRows.findIndex((f) => f.id === facultyId)
    if (index >= 0) demoRows.splice(index, 1)
    return
  }

  const { error } = await supabase.from('faculties').delete().eq('id', facultyId)
  if (error) throw error
}
