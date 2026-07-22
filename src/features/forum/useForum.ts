import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuthStore } from '@/features/auth/authStore'
import type { ForumThread } from '@/shared/types/database'
import {
  fetchThreads,
  fetchThreadById,
  createThread,
  deleteThread,
  togglePinThread,
  fetchComments,
  createComment,
  deleteComment,
  voteThread,
  fetchUserVoteOnThread,
  type CreateThreadInput,
  type CreateCommentInput
} from './api'

export function useThreads(facultyId: string | null, sortBy: 'recent' | 'top') {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['forum-threads', facultyId, sortBy],
    queryFn: () => fetchThreads(facultyId, sortBy),
  })

  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel(`forum-threads-${Math.random()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'forum_threads' },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['forum-threads'] })
        }
      )
      .subscribe()

    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [facultyId, sortBy, queryClient])

  return query
}

export function useThread(threadId: string) {
  return useQuery({
    queryKey: ['forum-thread', threadId],
    queryFn: () => fetchThreadById(threadId),
    enabled: Boolean(threadId),
  })
}

export function useCreateThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateThreadInput) => createThread(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum-threads'] })
    },
  })
}

export function useDeleteThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (threadId: string) => deleteThread(threadId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['forum-threads'] })
    },
  })
}

export function useTogglePinThread() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ threadId, isPinned }: { threadId: string; isPinned: boolean }) =>
      togglePinThread(threadId, isPinned),
    onSuccess: (_, { threadId }) => {
      void queryClient.invalidateQueries({ queryKey: ['forum-threads'] })
      void queryClient.invalidateQueries({ queryKey: ['forum-thread', threadId] })
    },
  })
}

export function useComments(threadId: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['forum-comments', threadId],
    queryFn: () => fetchComments(threadId),
    enabled: Boolean(threadId),
  })

  useEffect(() => {
    if (!supabase || !threadId) return
    const channel = supabase
      .channel(`forum-comments-${threadId}-${Math.random()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'forum_comments', filter: `thread_id=eq.${threadId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['forum-comments', threadId] })
          void queryClient.invalidateQueries({ queryKey: ['forum-threads'] })
          void queryClient.invalidateQueries({ queryKey: ['forum-thread', threadId] })
        }
      )
      .subscribe()

    return () => {
      void supabase?.removeChannel(channel)
    }
  }, [threadId, queryClient])

  return query
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCommentInput) => createComment(input),
    onSuccess: (_, { threadId }) => {
      void queryClient.invalidateQueries({ queryKey: ['forum-comments', threadId] })
      void queryClient.invalidateQueries({ queryKey: ['forum-threads'] })
      void queryClient.invalidateQueries({ queryKey: ['forum-thread', threadId] })
    },
  })
}

export function useDeleteComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId }: { commentId: string; threadId: string }) =>
      deleteComment(commentId),
    onSuccess: (_, { threadId }) => {
      void queryClient.invalidateQueries({ queryKey: ['forum-comments', threadId] })
      void queryClient.invalidateQueries({ queryKey: ['forum-threads'] })
      void queryClient.invalidateQueries({ queryKey: ['forum-thread', threadId] })
    },
  })
}

export function useVoteThread() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)

  return useMutation({
    mutationFn: ({ threadId, value }: { threadId: string; value: 1 | -1 }) =>
      voteThread(threadId, value),
    onSuccess: (result, { threadId }) => {
      if (result) {
        const updateThread = (thread: ForumThread): ForumThread => thread.id === threadId
          ? { ...thread, votes_up: result.votesUp, votes_down: result.votesDown }
          : thread
        queryClient.setQueriesData<ForumThread[]>({ queryKey: ['forum-threads'] }, (threads) =>
          threads?.map(updateThread),
        )
        queryClient.setQueryData<ForumThread | null>(['forum-thread', threadId], (thread) =>
          thread ? updateThread(thread) : thread,
        )
        if (userId) {
          queryClient.setQueryData(['forum-user-vote', threadId, userId], result.userVote)
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['forum-threads'] })
      void queryClient.invalidateQueries({ queryKey: ['forum-thread', threadId] })
      if (userId) {
        void queryClient.invalidateQueries({ queryKey: ['forum-user-vote', threadId, userId] })
      }
    },
  })
}

export function useUserVoteOnThread(threadId: string) {
  const userId = useAuthStore((s) => s.user?.id)

  return useQuery({
    queryKey: ['forum-user-vote', threadId, userId],
    queryFn: () =>
      userId ? fetchUserVoteOnThread(threadId, userId) : Promise.resolve(null),
    enabled: Boolean(threadId) && Boolean(userId),
  })
}
