import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/authStore'
import { markNotificationFromUrl } from './api'

export function NotificationUrlHandler() {
  const location = useLocation()
  const userId = useAuthStore((state) => state.user?.id)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId || !new URLSearchParams(location.search).has('notification')) return
    void markNotificationFromUrl()
      .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
      .catch((error) => console.error('No se pudo marcar la notificación como leída.', error))
  }, [location.search, queryClient, userId])

  return null
}
