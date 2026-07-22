import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert, Trash2, XCircle, UserCheck, MessageSquare, MapPin } from 'lucide-react'
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
  harassment: 'Acoso o ataques personales',
  misinformation: 'Información falsa',
  inappropriate: 'Contenido inapropiado',
  other: 'Otro motivo',
}

const TARGET_LABELS: Record<ContentReport['target_type'], string> = {
  pin: 'Pin del Mapa',
  pin_comment: 'Comentario de Pin',
  forum_thread: 'Hilo del Foro',
  forum_comment: 'Respuesta del Foro',
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

  const reports = queue.data ?? []

  return (
    <div className="h-full overflow-y-auto bg-neutral-50/70 dark:bg-neutral-950 px-3.5 sm:px-6 pb-24 pt-safe-page">
      <div className="mx-auto max-w-5xl">
        {/* Header HUD */}
        <header className="mb-5 p-4 sm:p-6 rounded-2xl sm:rounded-[28px] bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[#D41F2D]">
              <ShieldAlert size={18} strokeWidth={2.5} />
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em]">Administración UDP</span>
            </div>
            <h1 className="mt-0.5 text-xl sm:text-2xl font-black text-neutral-900 dark:text-white tracking-tight">
              Cola de moderación
            </h1>
            <p className="mt-0.5 text-[11px] sm:text-xs font-semibold text-neutral-400">
              Reportes privados, asignación de casos y resolución auditable.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-100 dark:border-neutral-700/80 rounded-xl px-3.5 py-2 shrink-0 self-start sm:self-auto">
            <UserCheck size={15} className="text-[#D41F2D]" />
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">Administrador</span>
              <span className="text-xs font-extrabold text-neutral-900 dark:text-white">{user?.name}</span>
            </div>
          </div>
        </header>

        {/* Filter Scrollable Capsule Tabs (Fixes Mobile Overflow) */}
        <div className="mb-5 p-1 bg-neutral-100/90 dark:bg-neutral-800/90 rounded-2xl flex gap-1.5 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden sm:[&::-webkit-scrollbar]:block sm:[&::-webkit-scrollbar]:h-1 sm:[&::-webkit-scrollbar-thumb]:bg-neutral-300">
          {FILTERS.map((filter) => {
            const isActive = status === filter.status
            return (
              <button
                key={filter.status}
                type="button"
                onClick={() => setStatus(filter.status)}
                className={`shrink-0 snap-start py-2 px-4 rounded-xl text-xs font-extrabold tracking-wider uppercase transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#D41F2D] text-white shadow-sm'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <span>{filter.label}</span>
                {isActive && reports.length > 0 && (
                  <span className="bg-white/25 text-white px-1.5 py-0.5 rounded-full text-[10px] font-black">
                    {reports.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        {queue.isLoading ? (
          <div className="py-20 text-center text-sm font-semibold text-neutral-400">Cargando cola de moderación…</div>
        ) : queue.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-bold text-red-600 dark:border-red-900 dark:bg-red-950/20">
            No se pudo cargar la cola de moderación.
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-2xl sm:rounded-[28px] border border-dashed border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-14 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={24} strokeWidth={2.2} />
            </div>
            <h2 className="text-base sm:text-lg font-black text-neutral-900 dark:text-white tracking-tight">
              ¡Todo al día! No hay reportes en esta etapa
            </h2>
            <p className="mt-1 text-xs font-semibold text-neutral-400 max-w-sm mx-auto">
              La lista se actualiza automáticamente en tiempo real al recibirse nuevos casos.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {reports.map((report) => {
              const assignedToMe = report.assigned_to === user?.id || report.assigned_to === 'demo-admin'
              const canResolve = report.status === 'pending' || (report.status === 'reviewing' && assignedToMe)
              const isHighlighted = highlightedId === report.id

              return (
                <article
                  key={report.id}
                  className={`rounded-2xl bg-white dark:bg-neutral-900 p-4 sm:p-5 shadow-sm border transition-all flex flex-col justify-between ${
                    isHighlighted
                      ? 'border-[#D41F2D] ring-2 ring-[#D41F2D]/20'
                      : 'border-neutral-200/80 dark:border-neutral-800'
                  }`}
                >
                  <div>
                    {/* Header: Target Badge + Time */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-950/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#D41F2D]">
                        {report.target_type.includes('pin') ? <MapPin size={11} /> : <MessageSquare size={11} />}
                        {TARGET_LABELS[report.target_type]}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-bold text-neutral-400">
                        <Clock3 size={11} />
                        {new Date(report.created_at).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>

                    {/* Reason */}
                    <h2 className="text-sm sm:text-base font-black text-neutral-900 dark:text-white tracking-tight">
                      {REASON_LABELS[report.reason]}
                    </h2>

                    {/* Clean Quote Box */}
                    <div className="mt-3 relative pl-3.5 py-2 pr-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-r-xl text-xs font-medium leading-relaxed text-neutral-700 dark:text-neutral-300 border-l-2 border-[#D41F2D] line-clamp-4">
                      {snapshotText(report)}
                    </div>

                    {/* Details if provided */}
                    {report.details && (
                      <div className="mt-2.5 p-2.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/40 text-xs text-neutral-600 dark:text-neutral-400">
                        <strong className="font-extrabold text-neutral-900 dark:text-white">Contexto del usuario:</strong>{' '}
                        {report.details}
                      </div>
                    )}

                    {/* Reporter Metadata */}
                    <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800/80 text-[10px] sm:text-[11px] font-semibold text-neutral-400">
                      Reportado por <strong className="text-neutral-700 dark:text-neutral-200">{report.reporter_name || report.reporter_id}</strong>
                    </div>
                  </div>

                  {/* Actions / Resolutions */}
                  <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
                    {report.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() =>
                          claim.mutate(report.id, {
                            onError: (error) =>
                              showToast(error instanceof Error ? error.message : 'No se pudo tomar el caso.'),
                          })
                        }
                        disabled={claim.isPending}
                        className="w-full rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-100 py-2 text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        Tomar caso
                      </button>
                    )}

                    {report.status === 'reviewing' && !assignedToMe && (
                      <p className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 p-2.5 text-center text-xs font-bold text-amber-700 dark:text-amber-400">
                        Asignado a otro administrador
                      </p>
                    )}

                    {canResolve && assignedToMe && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setResolution({ report, action: 'dismiss' })}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-neutral-300 dark:border-neutral-700 px-3 py-2 text-xs font-extrabold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                        >
                          <XCircle size={14} />
                          Descartar
                        </button>
                        <button
                          type="button"
                          onClick={() => setResolution({ report, action: 'delete' })}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-[#D41F2D] hover:bg-[#b11a25] text-white px-3 py-2 text-xs font-extrabold uppercase tracking-wider shadow-md transition-all cursor-pointer"
                        >
                          <Trash2 size={14} />
                          Eliminar
                        </button>
                      </div>
                    )}

                    {/* Resolution Card Badge */}
                    {report.resolution_action && (
                      <div
                        className={`rounded-xl p-3 text-xs font-bold flex items-start gap-2.5 ${
                          report.resolution_action === 'delete'
                            ? 'bg-red-50/80 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 text-red-700 dark:text-red-300'
                            : 'bg-neutral-100/80 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {report.resolution_action === 'delete' ? (
                          <CheckCircle2 size={15} className="text-[#D41F2D] shrink-0 mt-0.5" />
                        ) : (
                          <XCircle size={15} className="text-neutral-400 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold">
                            Resolución:{' '}
                            {report.resolution_action === 'delete'
                              ? 'Contenido eliminado'
                              : 'Reporte descartado'}
                          </p>
                          {report.resolution_note && (
                            <p className="mt-0.5 font-medium opacity-90 truncate">{report.resolution_note}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* Resolution Confirmation Modal */}
      <Dialog
        open={Boolean(resolution)}
        onOpenChange={(open) => !open && setResolution(null)}
        title={resolution?.action === 'delete' ? 'Eliminar contenido reportado' : 'Descartar reporte'}
        description={
          resolution?.action === 'delete'
            ? 'Esta acción elimina el contenido original de la plataforma y no se puede deshacer.'
            : 'El contenido se conservará y el reporte quedará cerrado.'
        }
        contentClassName="!bg-white dark:!bg-neutral-900 shadow-2xl rounded-[28px] border border-neutral-100 dark:border-neutral-800"
      >
        <div className="space-y-4 pt-1">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Nota interna de resolución opcional…"
            className="w-full resize-none rounded-2xl border border-neutral-200 dark:border-neutral-700/80 bg-neutral-50 dark:bg-neutral-800/60 px-4 py-3 text-xs font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:border-[#D41F2D] focus:bg-white dark:focus:bg-neutral-900 transition-all shadow-sm"
          />
          {resolution?.action === 'delete' && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 p-3.5 text-xs font-semibold text-red-700 dark:text-red-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#D41F2D]" />
              <span>Se eliminará el contenido, pero el registro permanecerá en el historial de moderación.</span>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setResolution(null)}
              className="rounded-full px-5 py-2.5 text-xs font-extrabold text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={runResolution}
              disabled={resolve.isPending}
              className={`rounded-full px-6 py-2.5 text-xs font-extrabold text-white uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer ${
                resolution?.action === 'delete' ? 'bg-[#D41F2D] hover:bg-[#b11a25]' : 'bg-neutral-900 dark:bg-white dark:text-neutral-900'
              }`}
            >
              {resolve.isPending ? 'Resolviendo…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
