import type { ContentReport, ModerationReason, ModerationTargetType } from '@/shared/types/database'

export const demoModerationReports: ContentReport[] = [
  {
    id: 'demo-report',
    target_type: 'forum_comment',
    target_id: 'demo-comment',
    reporter_id: 'demo-student',
    reporter_name: 'Estudiante Demo',
    reason: 'harassment',
    details: 'El comentario contiene ataques personales.',
    snapshot: { content: 'Comentario de ejemplo pendiente de revisión.', threadId: 'demo-1' },
    status: 'pending',
    assigned_to: null,
    resolution_action: null,
    resolution_note: null,
    created_at: new Date(Date.now() - 15 * 60_000).toISOString(),
    updated_at: new Date(Date.now() - 15 * 60_000).toISOString(),
    resolved_at: null,
  },
]

export function createDemoReport(
  reporterId: string,
  targetType: ModerationTargetType,
  targetId: string,
  reason: ModerationReason,
  details?: string,
): string {
  const existing = demoModerationReports.find((report) =>
    report.reporter_id === reporterId
      && report.target_type === targetType
      && report.target_id === targetId
      && ['pending', 'reviewing'].includes(report.status),
  )
  if (existing) return existing.id

  const id = crypto.randomUUID()
  demoModerationReports.unshift({
    id, target_type: targetType, target_id: targetId, reporter_id: reporterId,
    reporter_name: 'Estudiante Demo', reason, details: details || null,
    snapshot: { content: 'Contenido reportado en modo demo.' }, status: 'pending',
    assigned_to: null, resolution_action: null, resolution_note: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), resolved_at: null,
  })
  return id
}
