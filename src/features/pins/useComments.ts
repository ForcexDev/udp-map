import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import type { PinComment } from '@/shared/types/database'
import { addComment, fetchComments, deleteComment } from './api'
import { useAuthStore } from '@/features/auth/authStore'

/** Comentarios de un pin en tiempo real (canal filtrado por pin_id) + envío. */
export function useComments(pinId: string) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)

  const query = useQuery({
    queryKey: ['comments', pinId],
    queryFn: () => fetchComments(pinId),
  })

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel(`comments-${pinId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pin_comments', filter: `pin_id=eq.${pinId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['comments', pinId] })
        },
      )
      .subscribe()
    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [pinId, queryClient])

  const send = useMutation({
    mutationFn: (body: string) => {
      if (!user) throw new Error('not signed in')
      return addComment(pinId, body, user.id, user.name)
    },
    // UI optimista con rollback (rescatado de v1, plan §0)
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: ['comments', pinId] })
      const previous = queryClient.getQueryData<PinComment[]>(['comments', pinId])
      const optimistic: PinComment = {
        id: `optimistic-${Date.now()}`,
        pin_id: pinId,
        author_id: user?.id ?? null,
        author_name: user?.name ?? null,
        body,
        created_at: new Date().toISOString(),
      }
      queryClient.setQueryData<PinComment[]>(['comments', pinId], (old) => [
        ...(old ?? []),
        optimistic,
      ])
      return { previous }
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['comments', pinId], ctx.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', pinId] })
    },
  })

  const remove = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId, pinId),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ['comments', pinId] })
      const previous = queryClient.getQueryData<PinComment[]>(['comments', pinId])
      queryClient.setQueryData<PinComment[]>(['comments', pinId], (old) => 
        (old ?? []).filter(c => c.id !== commentId)
      )
      return { previous }
    },
    onError: (_err, _commentId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(['comments', pinId], ctx.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', pinId] })
    },
  })

  return { comments: query.data ?? [], isLoading: query.isLoading, send, remove }
}
