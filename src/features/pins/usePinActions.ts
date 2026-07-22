import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { Pin } from '@/shared/types/database'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { deletePin, extendPinTTL, toggleFavorite, verifyPin, votePin } from './api'

export function usePinActions() {
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const showToast = useUIStore((s) => s.showToast)
  const selectPin = useUIStore((s) => s.selectPin)
  const userId = useAuthStore((s) => s.user?.id)

  const invalidatePins = () => queryClient.invalidateQueries({ queryKey: ['pins'] })

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
    onError: () => showToast(t('common.error')),
  })

  const extendTTL = useMutation({
    mutationFn: ({ pinId, hours }: { pinId: string; hours?: number }) => extendPinTTL(pinId, hours ?? 24),
    onSuccess: () => showToast(t('pin.timeExtended', 'Tiempo extendido +24h')),
    onSettled: () => void invalidatePins(),
    onError: () => showToast(t('common.error')),
  })

  const favorite = useMutation({
    mutationFn: ({ pinId, next }: { pinId: string; next: boolean }) => {
      if (!userId) throw new Error('not signed in')
      return toggleFavorite(pinId, userId, next)
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['favorites'] }),
    onError: () => showToast(t('common.error')),
  })

  return { vote, remove, promote, extendTTL, favorite }
}
