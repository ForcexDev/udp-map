import { supabase } from '@/shared/lib/supabase'
import type {
  ContentReport, ModerationReason, ModerationStatus, ModerationTargetType,
} from '@/shared/types/database'
import { createDemoReport, demoModerationReports } from './demoStore'

export async function createContentReport(input: {
  reporterId: string
  targetType: ModerationTargetType
  targetId: string
  reason: ModerationReason
  details?: string
}): Promise<string> {
  if (!supabase) {
    return createDemoReport(input.reporterId, input.targetType, input.targetId, input.reason, input.details)
  }
  const { data, error } = await supabase.rpc('create_content_report', {
    p_target_type: input.targetType,
    p_target_id: input.targetId,
    p_reason: input.reason,
    p_details: input.details || null,
  })
  if (error) throw error
  return data as string
}

export async function fetchModerationReports(status: ModerationStatus): Promise<ContentReport[]> {
  if (!supabase) return demoModerationReports.filter((report) => report.status === status)

  const { data, error } = await supabase
    .from('content_reports')
    .select('*, profiles:reporter_id(name)')
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((row) => ({
    ...row,
    reporter_name: (row.profiles as { name?: string | null } | null)?.name ?? null,
  })) as ContentReport[]
}

export async function claimModerationReport(reportId: string): Promise<void> {
  if (!supabase) {
    const report = demoModerationReports.find((item) => item.id === reportId)
    if (report) {
      report.status = 'reviewing'
      report.assigned_to = 'demo-admin'
      report.updated_at = new Date().toISOString()
    }
    return
  }
  const { error } = await supabase.rpc('claim_moderation_report', { p_report_id: reportId })
  if (error) throw error
}

export async function resolveModerationReport(
  reportId: string,
  action: 'dismiss' | 'delete',
  note?: string,
): Promise<void> {
  if (!supabase) {
    const report = demoModerationReports.find((item) => item.id === reportId)
    if (report) {
      report.status = action === 'delete' ? 'resolved' : 'dismissed'
      report.resolution_action = action
      report.resolution_note = note || null
      report.resolved_at = new Date().toISOString()
      report.updated_at = report.resolved_at
    }
    return
  }
  const { error } = await supabase.rpc('resolve_moderation_report', {
    p_report_id: reportId,
    p_action: action,
    p_note: note || null,
  })
  if (error) throw error
}
