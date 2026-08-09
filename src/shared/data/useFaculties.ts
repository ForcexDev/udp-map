import { useQuery } from '@tanstack/react-query'
import { fetchFaculties } from './facultiesApi'
import { publishFaculties } from './facultyStore'

// ─────────────────────────────────────────────────────────────────────────────
// Rehidratación del catálogo de facultades al arrancar.
//
// Se monta UNA vez, en `App`, y su resultado no se lee: lo que importa es el
// efecto, publicar la lista en la caché de módulo para que todo el que hace
// `FACULTIES.find(...)` vea lo que hay en la base.
//
// `staleTime` alto porque el catálogo cambia cuando un admin crea una facultad,
// no cuando alguien publica un pin. `retry` corto y sin propagar el error: si
// falla, la app sigue con el catálogo estático, que es lo que ya enseñaba antes
// de que esta consulta existiera.
// ─────────────────────────────────────────────────────────────────────────────

export const FACULTIES_QUERY_KEY = ['faculties'] as const

export function useFacultiesSync(): void {
  useQuery({
    queryKey: FACULTIES_QUERY_KEY,
    queryFn: async () => {
      const rows = await fetchFaculties()
      publishFaculties(rows)
      return rows
    },
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
