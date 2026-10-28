import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/authStore'
import { supabase } from '@/shared/lib/supabase'
import type { AppNotification, NotificationCategory } from '@/shared/types/database'
import {
  fetchNotifications,
  markCategoryRead,
  setNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  deleteAllNotifications,
} from './api'

function useNotificationsQuery<T = AppNotification[]>(select?: (list: AppNotification[]) => T) {
  const userId = useAuthStore((state) => state.user?.id)
  const role = useAuthStore((state) => state.role)
  return useQuery({
    queryKey: ['notifications', userId, role],
    queryFn: () => (userId ? fetchNotifications(userId, role) : []),
    enabled: Boolean(userId),
    staleTime: 30_000,
    select,
  })
}

export function useNotifications() {
  return useNotificationsQuery()
}

// Los avisos de `audience: 'admin'` no cuentan: son trabajo del equipo y viven en
// /admin/moderacion, no en la bandeja personal que anuncia este número.
const countUnreadPersonal = (list: AppNotification[]) =>
  list.filter((n) => n.audience === 'personal' && !n.read_at).length

/** El número de la campana: comparte caché con `useNotifications`. */
export function useUnreadCount(): number {
  return useNotificationsQuery(countUnreadPersonal).data ?? 0
}

export function useNotificationRealtime(
  onNewNotification: (notification: AppNotification) => void,
) {
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
          if (payload.eventType === 'INSERT' && payload.new) {
            onNewNotification(payload.new as AppNotification)
          }
        },
      )
      .subscribe()
    return () => {
      void client.removeChannel(channel)
    }
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
  queryClient.setQueriesData<AppNotification[]>({ queryKey: ['notifications'] }, (list) =>
    list ? update(list) : list,
  )
  return snapshot as Snapshot
}

/**
 * Una mutación de la bandeja con su parche optimista. Con `enabled` en falso no
 * hace nada, ni en el servidor ni en la caché: sin usuario, pintar la bandeja
 * vacía o leída sería enseñar un cambio que no ocurrió y que solo se deshace
 * cuando el refetch lo devuelve.
 */
function useInboxMutation<V>(
  run: (vars: V) => Promise<void>,
  patch: (list: AppNotification[], vars: V) => AppNotification[],
  enabled = true,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: V) => (enabled ? run(vars) : Promise.resolve()),
    onMutate: (vars: V) =>
      enabled ? patchCache(queryClient, (list) => patch(list, vars)) : Promise.resolve(undefined),
    onError: (_error, _vars, snapshot) => {
      for (const [key, value] of snapshot ?? []) queryClient.setQueryData(key, value)
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useSetNotificationRead() {
  return useInboxMutation(
    ({ id, read }: { id: string; read: boolean }) => setNotificationRead(id, read),
    (list, { id, read }) =>
      list.map((n) =>
        n.id === id ? { ...n, read_at: read ? (n.read_at ?? new Date().toISOString()) : null } : n,
      ),
  )
}

export function useMarkAllNotificationsRead() {
  const userId = useAuthStore((state) => state.user?.id)
  return useInboxMutation<void>(
    () => markAllNotificationsRead(userId!),
    (list) => {
      const now = new Date().toISOString()
      return list.map((n) => (n.read_at ? n : { ...n, read_at: now }))
    },
    Boolean(userId),
  )
}

export function useDeleteNotification() {
  return useInboxMutation(deleteNotification, (list, id: string) => list.filter((n) => n.id !== id))
}

export function useDeleteAllNotifications() {
  const userId = useAuthStore((state) => state.user?.id)
  const role = useAuthStore((state) => state.role)
  return useInboxMutation<void>(
    () => deleteAllNotifications(userId!, role),
    (list) => list.filter((n) => n.audience !== 'personal'),
    Boolean(userId),
  )
}

export function useMarkCategoryRead() {
  const userId = useAuthStore((state) => state.user?.id)
  return useInboxMutation(
    (category: NotificationCategory) => markCategoryRead(userId!, category),
    (list, category) => {
      const now = new Date().toISOString()
      return list.map((n) => (n.category === category && !n.read_at ? { ...n, read_at: now } : n))
    },
    Boolean(userId),
  )
}
