import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert, Trash2, XCircle } from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'
import type { ContentReport, ModerationStatus } from '@/shared/types/database'
import { useClaimModerationReport, useModerationQueue, useResolveModerationReport } from './useModeration'
import { Dialog } from '@/shared/ui/Dialog'
import { useUIStore } from '@/shared/stores/uiStore'

const FILTERS: Array<{ status: ModerationStatus; label: string }> = [
  { status: 'pending', label: 'Pendientes' },
  { status: 'reviewing', label: 'En revisión' },
  { status: 'resolved', label: 'Resueltos' },
  { status: 'dismissed', label: 'Descartados' },
]

const REASON_LABELS: Record<ContentReport['reason'], string> = {
  spam: 'Spam o publicidad',
  harassment: 'Acoso o ataques',
  misinformation: 'Información falsa',
  inappropriate: 'Contenido inapropiado',
  other: 'Otro motivo',
}

const TARGET_LABELS: Record<ContentReport['target_type'], string> = {
  pin: 'Pin', pin_comment: 'Comentario de pin', forum_thread: 'Hilo del foro', forum_comment: 'Respuesta del foro',
}

function snapshotText(report: ContentReport): string {
  const title = typeof report.snapshot.title === 'string' ? report.snapshot.title : ''
  const content = typeof report.snapshot.content === 'string' ? report.snapshot.content : ''
  return [title, content].filter(Boolean).join(' — ') || 'Contenido sin texto disponible.'
}

export function ModerationPage() {
  const role = useAuthStore((state) => state.role)
  const user = useAuthStore((state) => state.user)
  const showToast = useUIStore((state) => state.showToast)
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<ModerationStatus>('pending')
  const [resolution, setResolution] = useState<{ report: ContentReport; action: 'dismiss' | 'delete' } | null>(null)
  const [note, setNote] = useState('')
  const queue = useModerationQueue(status)
  const claim = useClaimModerationReport()
  const resolve = useResolveModerationReport()

  if (role !== 'admin') return <Navigate to="/mapa" replace />

  const highlightedId = searchParams.get('report')

  const runResolution = () => {
    if (!resolution || resolve.isPending) return
    resolve.mutate({ reportId: resolution.report.id, action: resolution.action, note: note.trim() || undefined }, {
      onSuccess: () => {
        showToast(resolution.action === 'delete' ? 'Contenido eliminado y reporte resuelto.' : 'Reporte descartado.')
        setResolution(null)
        setNote('')
      },
      onError: (error) => showToast(error instanceof Error ? error.message : 'No se pudo resolver el reporte.'),
    })
  }

  return (
    <div className="h-full overflow-y-auto bg-neutral-50 px-4 pb-20 pt-safe-page dark:bg-neutral-950">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-col gap-3 border-b border-neutral-200 pb-5 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#D41F2D]"><ShieldAlert size={22} /><span className="text-xs font-black uppercase tracking-[0.18em]">Administración</span></div>
            <h1 className="mt-2 text-2xl font-black text-neutral-900 dark:text-white">Cola de moderación</h1>
            <p className="mt-1 text-xs text-neutral-400">Reportes privados, asignación y resolución auditable.</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900">
            Administrador: <span className="text-neutral-800 dark:text-neutral-100">{user?.name}</span>
          </div>
        </header>

        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((filter) => (
            <button key={filter.status} type="button" onClick={() => setStatus(filter.status)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition-colors ${status === filter.status ? 'bg-[#D41F2D] text-white' : 'border border-neutral-200 bg-white text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900'}`}>
              {filter.label}
            </button>
          ))}
        </div>

        {queue.isLoading ? (
          <div className="py-20 text-center text-sm font-semibold text-neutral-400">Cargando cola…</div>
        ) : queue.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-600 dark:border-red-900 dark:bg-red-950/20">No se pudo cargar la cola.</div>
        ) : (queue.data ?? []).length === 0 ? (
          <div className="rounded-3xl border border-dashed border-neutral-200 bg-white px-6 py-16 text-center dark:border-neutral-800 dark:bg-neutral-900">
            <CheckCircle2 size={34} className="mx-auto text-emerald-500" />
            <h2 className="mt-3 font-black text-neutral-800 dark:text-neutral-100">No hay reportes en esta etapa</h2>
            <p className="mt-1 text-xs text-neutral-400">La lista se actualiza en tiempo real.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(queue.data ?? []).map((report) => {
              const assignedToMe = report.assigned_to === user?.id || report.assigned_to === 'demo-admin'
              const canResolve = report.status === 'pending' || (report.status === 'reviewing' && assignedToMe)
              return (
                <article key={report.id} className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-neutral-900 ${highlightedId === report.id ? 'border-[#D41F2D] ring-2 ring-[#D41F2D]/10' : 'border-neutral-200 dark:border-neutral-800'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-red-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#D41F2D] dark:bg-red-950/30">{TARGET_LABELS[report.target_type]}</span>
                      <h2 className="mt-2 text-sm font-black text-neutral-900 dark:text-white">{REASON_LABELS[report.reason]}</h2>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-neutral-400"><Clock3 size={12} />{new Date(report.created_at).toLocaleString('es-CL')}</span>
                  </div>

                  <blockquote className="mt-4 line-clamp-5 rounded-xl bg-neutral-50 p-3 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300">{snapshotText(report)}</blockquote>
                  {report.details && <p className="mt-3 text-xs text-neutral-500"><strong>Contexto:</strong> {report.details}</p>}
                  <div className="mt-3 border-t border-neutral-100 pt-3 text-[10px] text-neutral-400 dark:border-neutral-800">Reportado por <strong>{report.reporter_name || report.reporter_id}</strong></div>

                  {report.status === 'pending' && (
                    <button type="button" onClick={() => claim.mutate(report.id, { onError: (error) => showToast(error instanceof Error ? error.message : 'No se pudo tomar el caso.') })} disabled={claim.isPending} className="mt-4 w-full rounded-full bg-neutral-900 px-4 py-2 text-xs font-black text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900">Tomar caso</button>
                  )}

                  {report.status === 'reviewing' && !assignedToMe && <p className="mt-4 rounded-xl bg-amber-50 p-2.5 text-center text-xs font-bold text-amber-700 dark:bg-amber-950/20 dark:text-amber-400">Asignado a otro administrador</p>}

                  {canResolve && assignedToMe && (
                    <div className="mt-4 flex gap-2">
                      <button type="button" onClick={() => setResolution({ report, action: 'dismiss' })} className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-neutral-300 px-3 py-2 text-xs font-black text-neutral-600 dark:border-neutral-600 dark:text-neutral-300"><XCircle size={14} />Descartar</button>
                      <button type="button" onClick={() => setResolution({ report, action: 'delete' })} className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[#D41F2D] px-3 py-2 text-xs font-black text-white"><Trash2 size={14} />Eliminar</button>
                    </div>
                  )}

                  {report.resolution_action && <p className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-500 dark:bg-neutral-800"><strong>Resolución:</strong> {report.resolution_action === 'delete' ? 'Contenido eliminado' : 'Reporte descartado'}{report.resolution_note ? ` — ${report.resolution_note}` : ''}</p>}
                </article>
              )
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(resolution)} onOpenChange={(open) => !open && setResolution(null)} title={resolution?.action === 'delete' ? 'Eliminar contenido reportado' : 'Descartar reporte'} description={resolution?.action === 'delete' ? 'Esta acción elimina el contenido original y no se puede deshacer.' : 'El contenido se conservará y el reporte quedará cerrado.'}>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={4} placeholder="Nota interna opcional…" className="w-full resize-none rounded-xl border border-neutral-200 bg-white p-3 text-sm outline-none focus:border-[#D41F2D] dark:border-neutral-700 dark:bg-neutral-900" />
        {resolution?.action === 'delete' && <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700 dark:bg-red-950/20 dark:text-red-300"><AlertTriangle size={15} className="mt-0.5 shrink-0" />Se eliminará el contenido, pero el snapshot permanecerá en el historial del reporte.</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => setResolution(null)} className="rounded-full px-4 py-2 text-xs font-bold text-neutral-500">Cancelar</button>
          <button type="button" onClick={runResolution} disabled={resolve.isPending} className={`rounded-full px-4 py-2 text-xs font-black text-white disabled:opacity-50 ${resolution?.action === 'delete' ? 'bg-[#D41F2D]' : 'bg-neutral-900 dark:bg-neutral-700'}`}>{resolve.isPending ? 'Resolviendo…' : 'Confirmar'}</button>
        </div>
      </Dialog>
    </div>
  )
}
