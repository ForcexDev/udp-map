import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/authStore'
import { fetchEventAttendees, fetchEventRsvpCounts, fetchUserRSVPs, setRSVP } from './api'

export function useUserRSVPs() {
  const userId = useAuthStore((s) => s.user?.id)

  return useQuery({
    queryKey: ['user-rsvps', userId],
    queryFn: () => (userId ? fetchUserRSVPs(userId) : Promise.resolve([])),
    enabled: Boolean(userId),
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
      // Sin el pin: la clave del conteo es la LISTA de eventos de la pantalla,
      // no un pin suelto, así que `['rsvp-counts', pinId]` no casaba con
      // ninguna consulta y el número se quedaba viejo hasta recargar.
      void queryClient.invalidateQueries({ queryKey: ['rsvp-counts'] })
      void queryClient.invalidateQueries({ queryKey: ['event-attendees', pinId] })
    },
  })
}

/** Conteo agregado para una lista de eventos. Una sola consulta para toda la
 *  pantalla: la base acepta hasta 200 pines por llamada. */
export function useEventRsvpCounts(pinIds: string[]) {
  // La clave se ordena para que dos renders con los mismos eventos en distinto
  // orden no se traten como dos consultas distintas.
  const key = [...pinIds].sort()

  return useQuery({
    queryKey: ['rsvp-counts', key],
    queryFn: () => fetchEventRsvpCounts(key),
    enabled: key.length > 0,
  })
}

/** Quién va. Solo devuelve algo para quien organiza el evento: la base rechaza
 *  al resto, así que esto se pide únicamente cuando ya se sabe que lo es. */
export function useEventAttendees(pinId: string | null) {
  return useQuery({
    queryKey: ['event-attendees', pinId],
    queryFn: () => fetchEventAttendees(pinId!),
    enabled: Boolean(pinId),
  })
}
