import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import type { ModerationStatus } from '@/shared/types/database'
import {
  claimModerationReport, createContentReport, fetchModerationReports, resolveModerationReport,
} from './api'

export function useModerationQueue(status: ModerationStatus) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['moderation-reports', status],
    queryFn: () => fetchModerationReports(status),
  })

  useEffect(() => {
    const client = supabase
    if (!client) return
    const channel = client.channel(`moderation-queue:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_reports' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['moderation-reports'] })
      })
      .subscribe()
    return () => { void client.removeChannel(channel) }
  }, [queryClient])
  return query
}

export function useCreateContentReport() {
  return useMutation({ mutationFn: createContentReport })
}

export function useClaimModerationReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: claimModerationReport,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['moderation-reports'] }),
  })
}

export function useResolveModerationReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reportId, action, note }: { reportId: string; action: 'dismiss' | 'delete'; note?: string }) =>
      resolveModerationReport(reportId, action, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['moderation-reports'] })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
      void queryClient.invalidateQueries({ queryKey: ['pins'] })
      void queryClient.invalidateQueries({ queryKey: ['forum-threads'] })
      void queryClient.invalidateQueries({ queryKey: ['forum-comments'] })
    },
  })
}
