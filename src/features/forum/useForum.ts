import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/authStore'
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
  return useQuery({
    queryKey: ['forum-threads', facultyId, sortBy],
    queryFn: () => fetchThreads(facultyId, sortBy),
  })
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
  return useQuery({
    queryKey: ['forum-comments', threadId],
    queryFn: () => fetchComments(threadId),
    enabled: Boolean(threadId),
  })
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateCommentInput) => createComment(input),
    onSuccess: (_, { threadId }) => {
      void queryClient.invalidateQueries({ queryKey: ['forum-comments', threadId] })
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
    },
  })
}

export function useVoteThread() {
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.user?.id)

  return useMutation({
    mutationFn: ({ threadId, value }: { threadId: string; value: 1 | -1 }) =>
      voteThread(threadId, value),
    onSuccess: (_, { threadId }) => {
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
