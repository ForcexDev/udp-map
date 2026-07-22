import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/authStore'
import { supabase } from '@/shared/lib/supabase'
import type { AppNotification, NotificationCategory } from '@/shared/types/database'
import { fetchNotifications, markCategoryRead, markNotificationRead, markAllNotificationsRead, toggleNotificationRead, deleteNotification } from './api'

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

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useToggleNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, readAt }: { id: string; readAt: string | null }) => toggleNotificationRead(id, readAt),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkAllNotificationsRead() {
  const userId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => userId ? markAllNotificationsRead(userId) : Promise.resolve(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useDeleteNotification() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}

export function useMarkCategoryRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (category: NotificationCategory) => markCategoryRead(category),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
}
