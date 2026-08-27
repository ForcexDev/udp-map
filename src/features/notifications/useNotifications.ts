import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/authStore'
import { supabase } from '@/shared/lib/supabase'
import type { AppNotification, NotificationCategory } from '@/shared/types/database'
import {
  fetchNotifications,
  markCategoryRead,
  markNotificationRead,
  markAllNotificationsRead,
  toggleNotificationRead,
  deleteNotification,
  deleteAllNotifications,
} from './api'

export function useNotifications() {
  const userId = useAuthStore((state) => state.user?.id)
  const role = useAuthStore((state) => state.role)
  return useQuery({
    queryKey: ['notifications', userId, role],
    queryFn: () => userId ? fetchNotifications(userId, role) : [],
    enabled: Boolean(userId),
    staleTime: 30_000,
  })
}

export function useNotificationRealtime(onNewNotification?: (notification: AppNotification) => void) {
  const userId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()
  useEffect(() => {
    const client = supabase
    if (!client || !userId) return
    const channel = client
      .channel(`notifications:${userId}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          void queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
          if (payload.eventType === 'INSERT' && payload.new && onNewNotification) {
            onNewNotification(payload.new as AppNotification)
          }
        },
      )
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [queryClient, userId, onNewNotification])
}

// ─────────────────────────────────────────────────────────────────────────────
// Todo lo que cambia la bandeja es OPTIMISTA.
//
// Antes cada mutación solo invalidaba y se esperaba al refetch, así que borrar
// un aviso dejaba la fila puesta hasta que Supabase respondía y marcar leído
// tardaba lo mismo. En una lista de avisos —donde la gente da tres o cuatro
// toques seguidos— esa espera se lee como que los botones no funcionan.
//
// El patrón es siempre el mismo: cancelar lo que esté en vuelo, guardar copia,
// pintar el resultado ya, y devolver la copia si el servidor rechaza.
// ─────────────────────────────────────────────────────────────────────────────

type Snapshot = Array<[readonly unknown[], AppNotification[] | undefined]>

/** Aplica un cambio a todas las cachés de avisos y devuelve cómo estaban. */
async function patchCache(
  queryClient: QueryClient,
  update: (list: AppNotification[]) => AppNotification[],
): Promise<Snapshot> {
  await queryClient.cancelQueries({ queryKey: ['notifications'] })
  const snapshot = queryClient.getQueriesData<AppNotification[]>({ queryKey: ['notifications'] })
  queryClient.setQueriesData<AppNotification[]>(
    { queryKey: ['notifications'] },
    (list) => (list ? update(list) : list),
  )
  return snapshot as Snapshot
}

function restore(queryClient: QueryClient, snapshot: Snapshot | undefined) {
  if (!snapshot) return
  for (const [key, value] of snapshot) queryClient.setQueryData(key, value)
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: (id: string) => patchCache(queryClient, (list) =>
      list.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)),
    ),
    onError: (_error, _id, snapshot) => restore(queryClient, snapshot),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useToggleNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, readAt }: { id: string; readAt: string | null }) => toggleNotificationRead(id, readAt),
    onMutate: ({ id, readAt }) => patchCache(queryClient, (list) =>
      list.map((n) => (n.id === id ? { ...n, read_at: readAt ? null : new Date().toISOString() } : n)),
    ),
    onError: (_error, _vars, snapshot) => restore(queryClient, snapshot),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const userId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => userId ? markAllNotificationsRead(userId) : Promise.resolve(),
    onMutate: () => userId
      ? patchCache(queryClient, (list) => {
          const now = new Date().toISOString()
          return list.map((n) => (n.read_at ? n : { ...n, read_at: now }))
        })
      : Promise.resolve(undefined),
    onError: (_error, _vars, snapshot) => restore(queryClient, snapshot),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useDeleteNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteNotification,
    onMutate: (id: string) => patchCache(queryClient, (list) => list.filter((n) => n.id !== id)),
    onError: (_error, _id, snapshot) => restore(queryClient, snapshot),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useDeleteAllNotifications() {
  const userId = useAuthStore((state) => state.user?.id)
  const role = useAuthStore((state) => state.role)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => userId ? deleteAllNotifications(userId, role) : Promise.resolve(),
    // Sin `userId` la mutación no borra nada, así que tampoco puede pintar la
    // bandeja vacía: sería enseñar una pérdida que no ocurrió y que solo se
    // deshace cuando el refetch la devuelve.
    onMutate: () => userId
      ? patchCache(queryClient, (list) => list.filter((n) => n.audience !== 'personal'))
      : Promise.resolve(undefined),
    onError: (_error, _vars, snapshot) => restore(queryClient, snapshot),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkCategoryRead() {
  const userId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (category: NotificationCategory) =>
      userId ? markCategoryRead(userId, category) : Promise.resolve(),
    onMutate: (category: NotificationCategory) => userId
      ? patchCache(queryClient, (list) => {
          const now = new Date().toISOString()
          return list.map((n) => (n.category === category && !n.read_at ? { ...n, read_at: now } : n))
        })
      : Promise.resolve(undefined),
    onError: (_error, _vars, snapshot) => restore(queryClient, snapshot),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
