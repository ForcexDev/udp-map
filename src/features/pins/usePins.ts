import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFilterStore } from '@/shared/stores/filterStore'
import type { Bounds } from '@/shared/utils/geo'
import { fetchPins, fetchFavoriteIds } from './api'
import { useAuthStore } from '@/features/auth/authStore'

// ─────────────────────────────────────────────────────────────────────────────
// Últimos bounds publicados por el mapa.
//
// Ya NO hay suscripción de React a esto, y es a propósito. La consulta pide los
// pines sin recorte de bounds (`fetchPins(null, …)`), así que el valor no
// entraba en ninguna `queryKey`: lo único que hacía el `useState` era
// re-renderizar en cada `moveend` a todo el que usara `usePins()` —MapPage
// incluido—, y con `pins` saliendo de un `.filter()`, cada re-render entregaba
// un array nuevo a `MapView`, que rehacía el icono de los ~30 marcadores.
// Eso era el parpadeo del mapa al panear y al hacer zoom.
//
// Se conserva el valor porque describe el estado del mapa y hay código que
// puede querer leerlo de forma síncrona, igual que `mappingCache`.
// ─────────────────────────────────────────────────────────────────────────────

let currentBounds: Bounds | null = null

export function publishBounds(b: Bounds) {
  currentBounds = b
}

/** Los bounds visibles ahora mismo, sin suscribirse a sus cambios. */
export function boundsSnapshot(): Bounds | null {
  return currentBounds
}

export function usePins() {
  const queryClient = useQueryClient()
  const types = useFilterStore((s) => s.types)
  const categoryId = useFilterStore((s) => s.categoryId)
  const facultyId = useFilterStore((s) => s.facultyId)
  const onlyFavorites = useFilterStore((s) => s.onlyFavorites)
  const userId = useAuthStore((s) => s.user?.id)

  const filters = { types, categoryId, facultyId, onlyFavorites }

  const pinsQuery = useQuery({
    queryKey: ['pins', types, categoryId, facultyId, onlyFavorites],
    queryFn: () => fetchPins(null, filters),
    placeholderData: keepPreviousData,
  })

  const favoritesQuery = useQuery({
    queryKey: ['favorites', userId],
    queryFn: () => (userId ? fetchFavoriteIds(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
  })

  // Realtime: cualquier cambio en pins invalida la lista (plan §7)
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel(`pins-changes-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pins' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['pins'] })
      })
      .subscribe()
    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [queryClient])

  // Memorizados porque `pins` viaja como prop a MapView y allí es una
  // dependencia de efecto: un array nuevo en cada render obligaba a repintar
  // todos los marcadores aunque no hubiera cambiado ni un pin.
  const favoriteIds = useMemo(() => new Set(favoritesQuery.data ?? []), [favoritesQuery.data])
  const pins = useMemo(
    () => (pinsQuery.data ?? []).filter((p) => !onlyFavorites || favoriteIds.has(p.id)),
    [pinsQuery.data, onlyFavorites, favoriteIds],
  )

  return { pins, favoriteIds, isLoading: pinsQuery.isLoading, error: pinsQuery.error }
}
