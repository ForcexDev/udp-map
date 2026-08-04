import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Pin } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { dbErrorMessage, isUserFacingDbError } from '@/shared/utils/dbError'
import { useAuthStore } from '@/features/auth/authStore'
import { deletePin, extendPinTTL, toggleFavorite, unverifyPin, verifyPin, votePin } from './api'

/**
 * Las RPC de moderación devuelven mensajes pensados para leerse ("Este pin ya
 * está verificado", "Solo se pueden verificar reportes"). Antes se tapaban
 * todos con un genérico, así que una operación rechazada era indistinguible de
 * un fallo de red.
 */
function messageOf(err: unknown, fallback: string): string {
  return isUserFacingDbError(err) ? dbErrorMessage(err) : fallback
}

export function usePinActions() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const showToast = useUIStore((s) => s.showToast)
  const selectPin = useUIStore((s) => s.selectPin)
  const userId = useAuthStore((s) => s.user?.id)

  const invalidatePins = () => {
    queryClient.invalidateQueries({ queryKey: ['pins'] })
    queryClient.invalidateQueries({ queryKey: ['user-pins'] })
  }

  const vote = useMutation({
    mutationFn: ({ pinId, value }: { pinId: string; value: 1 | -1 }) => {
      if (!userId) throw new Error('not signed in')
      return votePin(pinId, value, userId)
    },
    onSuccess: (result, { pinId }) => {
      if (!result || !userId) return
      queryClient.setQueryData(['pin_vote', pinId, userId], result.userVote ?? 0)
      queryClient.setQueriesData<Pin[]>({ queryKey: ['pins'] }, (pins) =>
        pins?.map((pin) => pin.id === pinId
          ? { ...pin, votes_up: result.votesUp, votes_down: result.votesDown }
          : pin),
      )
      queryClient.setQueriesData<Pin[]>({ queryKey: ['user-pins'] }, (pins) =>
        pins?.map((pin) => pin.id === pinId
          ? { ...pin, votes_up: result.votesUp, votes_down: result.votesDown }
          : pin),
      )
    },
    onSettled: (_, __, { pinId }) => {
      void invalidatePins()
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: ['pin_vote', pinId, userId] })
      }
    },
    onError: () => showToast(t('common.error')),
  })

  const remove = useMutation({
    mutationFn: (pin: Pin) => deletePin(pin),
    onSuccess: () => {
      selectPin(null)
      showToast(t('pin.deleted'))
    },
    onSettled: () => void invalidatePins(),
    onError: () => showToast(t('common.error')),
  })

  const promote = useMutation({
    mutationFn: ({ pinId, verifierName }: { pinId: string; verifierName?: string }) =>
      verifyPin(pinId, verifierName),
    onSuccess: () => showToast(t('pin.verifiedSuccess', '¡Pin verificado y fijado!')),
    onSettled: () => void invalidatePins(),
    onError: (err) => showToast(messageOf(err, t('common.error'))),
  })

  const unverify = useMutation({
    mutationFn: ({ pinId, hours }: { pinId: string; hours?: number }) => unverifyPin(pinId, hours ?? 24),
    onSuccess: () => showToast(t('pin.unverified', 'Verificación retirada; el pin vuelve a tener plazo')),
    onSettled: () => void invalidatePins(),
    onError: (err) => showToast(messageOf(err, t('common.error'))),
  })

  const extendTTL = useMutation({
    mutationFn: ({ pinId, hours }: { pinId: string; hours?: number }) => extendPinTTL(pinId, hours ?? 24),
    onSuccess: () => showToast(t('pin.timeExtended', 'Tiempo extendido +24h')),
    onSettled: () => void invalidatePins(),
    onError: (err) => showToast(messageOf(err, t('common.error'))),
  })

  const favorite = useMutation({
    mutationFn: ({ pinId, next }: { pinId: string; next: boolean }) => {
      if (!userId) throw new Error('not signed in')
      return toggleFavorite(pinId, userId, next)
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['favorites'] }),
    onError: () => showToast(t('common.error')),
  })

  return { vote, remove, promote, unverify, extendTTL, favorite }
}
