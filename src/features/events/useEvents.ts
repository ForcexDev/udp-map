import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/authStore'
import { fetchUserRSVPs, fetchRSVPCounts, setRSVP } from './api'

export function useUserRSVPs() {
  const userId = useAuthStore((s) => s.user?.id)

  return useQuery({
    queryKey: ['user-rsvps', userId],
    queryFn: () => (userId ? fetchUserRSVPs(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
  })
}

export function useRSVPCounts(pinId: string) {
  return useQuery({
    queryKey: ['rsvp-counts', pinId],
    queryFn: () => fetchRSVPCounts(pinId),
  })
}

export function useSetRSVP() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)

  return useMutation({
    mutationFn: ({ pinId, status }: { pinId: string; status: 'going' | 'interested' | null }) => {
      if (!userId) throw new Error('Debes iniciar sesión')
      return setRSVP(pinId, userId, status)
    },
    onSuccess: (_, { pinId }) => {
      void queryClient.invalidateQueries({ queryKey: ['user-rsvps', userId] })
      void queryClient.invalidateQueries({ queryKey: ['rsvp-counts', pinId] })
    },
  })
}
