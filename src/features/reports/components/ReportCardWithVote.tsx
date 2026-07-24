import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/features/auth/authStore'
import { usePinActions } from '@/features/pins/usePinActions'
import { useGuard } from '@/features/auth/useGuard'
import { ReportCard } from './ReportCard'
import type { Pin } from '@/shared/types/database'
import type { ReportCardProps } from '../types'

interface ReportCardWithVoteProps extends Omit<ReportCardProps, 'userVote' | 'onVote' | 'votesScore'> {
  pin: Pin
}

export function ReportCardWithVote({ pin, ...props }: ReportCardWithVoteProps) {
  const user = useAuthStore((s) => s.user)
  const guard = useGuard()
  const { vote } = usePinActions()

  const { data: userVote = 0 } = useQuery({
    queryKey: ['pin_vote', pin.id, user?.id],
    queryFn: async () => {
      if (!supabase || !user) return 0
      const { data } = await supabase
        .from('pin_votes')
        .select('value')
        .eq('pin_id', pin.id)
        .eq('user_id', user.id)
        .maybeSingle()
      return (data?.value as 1 | -1) ?? 0
    },
    enabled: !!user && !!supabase,
  })

  const onVote = (value: 1 | -1) => {
    if (!guard('pin.vote')) return
    if (vote.isPending) return
    vote.mutate({ pinId: pin.id, value })
  }

  return (
    <ReportCard
      {...props}
      votesScore={pin.votes_up - pin.votes_down}
      userVote={userVote}
      onVote={onVote}
    />
  )
}
