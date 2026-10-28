import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNavGraph, type NavGraphRows } from '@/features/mapping/api'
import { useMapping } from '@/features/mapping/useMapping'
import type { Area } from '@/shared/types/database'
import type { NavGraph } from '@/shared/utils/indoor/graph'
import { areasToLocal, graphFromRows } from '@/shared/utils/indoor/load'
import type { LocalPlane } from '@/shared/utils/indoor/projection'
import type { IndoorArea } from '@/shared/utils/indoor/types'

// ─────────────────────────────────────────────────────────────────────────────
// El grafo de navegación de una facultad, ya en metros.
//
// Se pide por facultad y no entero, como el mapeo, porque solo hace falta al
// pedir una ruta: nadie navega por dos facultades a la vez. Si la consulta
// falla —la migración puede no estar aplicada en un entorno—, el modelo queda
// en null y "Cómo llegar" vuelve a la guía de tres pasos.
// ─────────────────────────────────────────────────────────────────────────────

export interface IndoorModel {
  facultyId: string
  graph: NavGraph
  plane: LocalPlane
  /** Áreas de la facultad en el plano local. */
  areas: IndoorArea[]
  /** Las mismas áreas tal cual vienen de la base, para pintar. */
  sourceAreas: Area[]
  rows: NavGraphRows
}

export function useNavGraph(facultyId: string | null) {
  const { mapping, isLoading: mappingLoading } = useMapping()

  const query = useQuery({
    queryKey: ['navGraph', facultyId],
    queryFn: () => fetchNavGraph(facultyId as string),
    enabled: facultyId !== null,
    // Cambia cuando alguien mapea, no cuando alguien publica.
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const model = useMemo<IndoorModel | null>(() => {
    if (!facultyId || !query.data || query.data.nodes.length === 0) return null
    const sourceAreas = mapping.areas.filter((a) => a.faculty_id === facultyId)
    const { graph, plane } = graphFromRows(query.data.nodes, query.data.edges, {
      areas: sourceAreas,
    })
    return {
      facultyId,
      graph,
      plane,
      areas: areasToLocal(sourceAreas, plane),
      sourceAreas,
      rows: query.data,
    }
  }, [facultyId, query.data, mapping.areas])

  return {
    model,
    // Mientras no se sepa si hay grafo no se elige entre las dos guías: elegir
    // la de tres pasos y cambiar al llegar el grafo hacía saltar la hoja.
    isLoading: facultyId !== null && (query.isLoading || mappingLoading),
    error: query.error,
  }
}
