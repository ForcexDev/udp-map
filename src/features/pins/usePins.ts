import { useEffect, useState } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFilterStore } from '@/shared/stores/filterStore'
import type { Bounds } from '@/shared/utils/geo'
import { fetchPins, fetchFavoriteIds } from './api'
import { useAuthStore } from '@/features/auth/authStore'

/** Bounds visibles del mapa, compartidos entre MapView y usePins. */
let boundsListeners: ((b: Bounds | null) => void)[] = []
let currentBounds: Bounds | null = null

export function publishBounds(b: Bounds) {
  currentBounds = b
  boundsListeners.forEach((l) => l(b))
}

function useMapBounds(): Bounds | null {
  const [bounds, setBounds] = useState<Bounds | null>(currentBounds)
  useEffect(() => {
    boundsListeners.push(setBounds)
    return () => {
      boundsListeners = boundsListeners.filter((l) => l !== setBounds)
    }
  }, [])
  return bounds
}

export function usePins() {
  const queryClient = useQueryClient()
  useMapBounds()
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

  const favoriteIds = new Set(favoritesQuery.data ?? [])
  const pins = (pinsQuery.data ?? []).filter((p) => !onlyFavorites || favoriteIds.has(p.id))

  return { pins, favoriteIds, isLoading: pinsQuery.isLoading, error: pinsQuery.error }
}
