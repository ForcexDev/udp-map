import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/authStore'
import { supabase } from '@/shared/lib/supabase'
import type { NotificationCategory } from '@/shared/types/database'
import { fetchNotifications, markCategoryRead, markNotificationRead } from './api'

export function useNotifications() {
  const userId = useAuthStore((state) => state.user?.id)
  const role = useAuthStore((state) => state.role)
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['notifications', userId, role],
    queryFn: () => userId ? fetchNotifications(userId, role) : [],
    enabled: Boolean(userId),
    staleTime: 30_000,
  })

  useEffect(() => {
    const client = supabase
    if (!client || !userId) return
    const channel = client
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => void queryClient.invalidateQueries({ queryKey: ['notifications', userId] }),
      )
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [queryClient, userId])

  return query
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: markNotificationRead,
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
