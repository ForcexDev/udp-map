import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  BellRing,
  CheckCheck,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquare,
  Trash2,
  XCircle,
} from 'lucide-react'
import { useAuthStore } from '@/features/auth/authStore'
import { useMarkCategoryRead, useNotifications } from '@/features/notifications/useNotifications'
import { relativeTime } from '@/shared/utils/datetime'
import type { ContentReport, ModerationStatus } from '@/shared/types/database'
import {
  useClaimModerationReport,
  useModerationQueue,
  useResolveModerationReport,
} from '@/features/moderation/useModeration'
import { REASON_LABELS, TARGET_LABELS } from '@/features/moderation/labels'
import { Dialog } from '@/shared/ui/Dialog'
import { useUIStore } from '@/shared/stores/uiStore'
import { AdminEmpty, AdminError, AdminLoading, AdminScreen } from './AdminScreen'

// ─────────────────────────────────────────────────────────────────────────────
// La cola de denuncias.
//
// Vivía en `/moderacion`, fuera del panel y con la barra de navegación pública,
// y tenía su propio guard de rol que no esperaba a que cargara la sesión: como
// el rol arranca en 'guest', abrirla por URL rebotaba SIEMPRE al mapa. En la
// práctica solo se llegaba pinchando desde el centro de notificaciones.
//
// Aquí el guard lo pone `AdminLayout` una sola vez, y el título y la cabecera
// los pone `AdminScreen`. Lo que sigue es lo de siempre: la lógica de tomar,
// descartar y eliminar un caso no se ha tocado.
//
// Los hooks siguen en `features/moderation` a propósito: esa carpeta es el
// dominio (incluido `ReportContentDialog`, que usan pines y foro para DENUNCIAR).
// Lo que se mudó es la pantalla de administración, no los datos.
// ─────────────────────────────────────────────────────────────────────────────

const FILTERS: Array<{ status: ModerationStatus; label: string }> = [
  { status: 'pending', label: 'Pendientes' },
  { status: 'reviewing', label: 'En revisión' },
  { status: 'resolved', label: 'Resueltos' },
  { status: 'dismissed', label: 'Descartados' },
]

/**
 * Lo que ha entrado desde la última visita.
 *
 * Los avisos con `audience: 'admin'` colgaban del centro de notificaciones del
 * sidebar, bajo un encabezado "Administración", mezclados con los logros y las
 * respuestas del foro de quien miraba. Es trabajo del equipo, no correo
 * personal, así que ahora aparecen donde se hace ese trabajo.
 *
 * No se marcan solos al entrar: la razón de enseñarlos es justamente saber qué
 * es NUEVO, y marcarlos al montar borraría esa señal antes de leerla.
 */
function TeamInbox() {
  const { data: notifications = [] } = useNotifications()
  const markCategory = useMarkCategoryRead()

  const unread = notifications.filter((n) => n.audience === 'admin' && !n.read_at)
  if (unread.length === 0) return null

  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-[#D41F2D]/30 bg-white shadow-sm ring-1 ring-[#D41F2D]/10 dark:bg-neutral-900">
      <div className="flex items-center gap-3 border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-50 text-[#D41F2D] dark:bg-red-950/40">
          <BellRing size={17} strokeWidth={2.2} />
        </span>
        <h2 className="min-w-0 flex-1 text-sm font-extrabold text-neutral-900 dark:text-white">
          {unread.length === 1 ? '1 aviso nuevo del equipo' : `${unread.length} avisos nuevos del equipo`}
        </h2>
        <button
          type="button"
          onClick={() => markCategory.mutate('moderation')}
          disabled={markCategory.isPending}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-bold text-[#D41F2D] transition-colors hover:text-[#b11a25] disabled:opacity-50"
        >
          <CheckCheck size={14} />
          Marcar leídos
        </button>
      </div>
      <ul className="m-0 list-none divide-y divide-neutral-100 p-0 dark:divide-neutral-800">
        {unread.slice(0, 4).map((notification) => {
          const relative = relativeTime(notification.created_at)
          return (
            <li key={notification.id} className="flex items-baseline gap-2 px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-neutral-700 dark:text-neutral-300">
                {notification.title}
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-neutral-400">
                {relative.value}
                {relative.unit === 'day' ? ' d' : relative.unit === 'hour' ? ' h' : ' min'}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function snapshotText(report: ContentReport): string {
  const title = typeof report.snapshot.title === 'string' ? report.snapshot.title : ''
  const content = typeof report.snapshot.content === 'string' ? report.snapshot.content : ''
  return [title, content].filter(Boolean).join(' — ') || 'Contenido sin texto disponible.'
}

export function ReportsPanel() {
  const user = useAuthStore((state) => state.user)
  const showToast = useUIStore((state) => state.showToast)
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<ModerationStatus>('pending')
  const [resolution, setResolution] = useState<{
    report: ContentReport
    action: 'dismiss' | 'delete'
  } | null>(null)
  const [note, setNote] = useState('')
  const queue = useModerationQueue(status)
  const claim = useClaimModerationReport()
  const resolve = useResolveModerationReport()

  // `?report=<id>` resalta un caso: es el enlace que traen las notificaciones.
  const highlightedId = searchParams.get('report')
  const reports = queue.data ?? []

  const runResolution = () => {
    if (!resolution || resolve.isPending) return
    resolve.mutate(
      { reportId: resolution.report.id, action: resolution.action, note: note.trim() || undefined },
      {
        onSuccess: () => {
          showToast(
            resolution.action === 'delete'
              ? 'Contenido eliminado y reporte resuelto.'
              : 'Reporte descartado.',
          )
          setResolution(null)
          setNote('')
        },
        onError: (error) =>
          showToast(error instanceof Error ? error.message : 'No se pudo resolver el reporte.'),
      },
    )
  }

  return (
    <AdminScreen
      title="Denuncias"
      description="Reportes de la comunidad: tomar el caso, descartar o eliminar. La lista se actualiza en tiempo real."
    >
      <TeamInbox />

      <div className="mb-5 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map((filter) => {
          const isActive = status === filter.status
          return (
            <button
              key={filter.status}
              type="button"
              onClick={() => setStatus(filter.status)}
              className={`flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-colors active:scale-95 ${
                isActive
                  ? 'bg-[#D41F2D] text-white shadow-sm'
                  : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              {filter.label}
              {isActive && reports.length > 0 && (
                <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-black">
                  {reports.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {queue.isLoading ? (
        <AdminLoading />
      ) : queue.error ? (
        <AdminError message="No se pudo cargar la cola de denuncias." />
      ) : reports.length === 0 ? (
        <AdminEmpty
          icon={
            <CheckCircle2 size={40} strokeWidth={1.5} className="text-emerald-300 dark:text-emerald-800" />
          }
          title="Todo al día"
          hint="No hay reportes en esta etapa."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {reports.map((report) => {
            const assignedToMe =
              report.assigned_to === user?.id || report.assigned_to === 'demo-admin'
            const canResolve =
              report.status === 'pending' || (report.status === 'reviewing' && assignedToMe)
            const isHighlighted = highlightedId === report.id

            return (
              <article
                key={report.id}
                className={`flex flex-col justify-between rounded-3xl border bg-white p-4 shadow-sm transition-all dark:bg-neutral-900 ${
                  isHighlighted
                    ? 'border-[#D41F2D]/40 ring-1 ring-[#D41F2D]/20'
                    : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <div>
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#D41F2D] dark:bg-red-950/40">
                      {report.target_type.includes('pin') ? (
                        <MapPin size={11} />
                      ) : (
                        <MessageSquare size={11} />
                      )}
                      {TARGET_LABELS[report.target_type]}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-neutral-400">
                      <Clock3 size={11} />
                      {new Date(report.created_at).toLocaleString('es-CL', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <h2 className="text-[15px] font-extrabold leading-snug tracking-tight text-neutral-900 dark:text-white">
                    {REASON_LABELS[report.reason]}
                  </h2>

                  <div className="mt-3 line-clamp-4 rounded-r-xl border-l-2 border-[#D41F2D] bg-neutral-50 py-2 pl-3.5 pr-3 text-xs font-medium leading-relaxed text-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-300">
                    {snapshotText(report)}
                  </div>

                  {report.details && (
                    <div className="mt-2.5 rounded-xl bg-neutral-100/70 p-2.5 text-xs text-neutral-600 dark:bg-neutral-800/40 dark:text-neutral-400">
                      <strong className="font-extrabold text-neutral-900 dark:text-white">
                        Contexto del usuario:
                      </strong>{' '}
                      {report.details}
                    </div>
                  )}

                  <div className="mt-3 border-t border-neutral-100 pt-2.5 text-[11px] font-medium text-neutral-400 dark:border-neutral-800">
                    Reportado por{' '}
                    <strong className="font-bold text-neutral-700 dark:text-neutral-200">
                      {report.reporter_name || report.reporter_id}
                    </strong>
                  </div>
                </div>

                <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-neutral-800">
                  {report.status === 'pending' && (
                    <button
                      type="button"
                      onClick={() =>
                        claim.mutate(report.id, {
                          onError: (error) =>
                            showToast(
                              error instanceof Error ? error.message : 'No se pudo tomar el caso.',
                            ),
                        })
                      }
                      disabled={claim.isPending}
                      className="flex h-10 w-full items-center justify-center rounded-xl bg-neutral-900 text-xs font-bold uppercase tracking-wider text-white transition-all active:scale-95 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
                    >
                      Tomar caso
                    </button>
                  )}

                  {report.status === 'reviewing' && !assignedToMe && (
                    <p className="rounded-xl border border-amber-200/60 bg-amber-50 p-2.5 text-center text-xs font-bold text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
                      Asignado a otro administrador
                    </p>
                  )}

                  {canResolve && assignedToMe && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setResolution({ report, action: 'dismiss' })}
                        className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-neutral-50 text-xs font-bold text-neutral-700 transition-all hover:bg-neutral-100 active:scale-95 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                      >
                        <XCircle size={14} />
                        Descartar
                      </button>
                      <button
                        type="button"
                        onClick={() => setResolution({ report, action: 'delete' })}
                        className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#D41F2D] text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-[#b11a25] active:scale-95"
                      >
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    </div>
                  )}

                  {report.resolution_action && (
                    <div
                      className={`flex items-start gap-2.5 rounded-xl p-3 text-xs font-bold ${
                        report.resolution_action === 'delete'
                          ? 'border border-red-200/60 bg-red-50/80 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
                          : 'border border-neutral-200/80 bg-neutral-100/80 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-300'
                      }`}
                    >
                      {report.resolution_action === 'delete' ? (
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#D41F2D]" />
                      ) : (
                        <XCircle size={15} className="mt-0.5 shrink-0 text-neutral-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold">
                          Resolución:{' '}
                          {report.resolution_action === 'delete'
                            ? 'Contenido eliminado'
                            : 'Reporte descartado'}
                        </p>
                        {report.resolution_note && (
                          <p className="mt-0.5 truncate font-medium opacity-90">
                            {report.resolution_note}
                          </p>
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

      <Dialog
        open={Boolean(resolution)}
        onOpenChange={(open) => !open && setResolution(null)}
        title={resolution?.action === 'delete' ? 'Eliminar contenido reportado' : 'Descartar reporte'}
        description={
          resolution?.action === 'delete'
            ? 'Elimina el contenido original de la plataforma. No se puede deshacer.'
            : 'El contenido se conserva y el reporte queda cerrado.'
        }
        contentClassName="!bg-white dark:!bg-neutral-900"
      >
        <div className="flex flex-col gap-4 pt-1">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Nota interna de resolución (opcional)…"
            className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs font-medium text-neutral-900 shadow-sm outline-none transition-all placeholder:text-neutral-400 focus:border-[#D41F2D] focus:bg-white dark:border-neutral-700/80 dark:bg-neutral-800/60 dark:text-white dark:focus:bg-neutral-900"
          />
          {resolution?.action === 'delete' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200/60 bg-red-50 p-3.5 text-xs font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#D41F2D]" />
              <span>
                Se elimina el contenido, pero el registro permanece en el historial de moderación.
              </span>
            </div>
          )}
          <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            <button
              type="button"
              onClick={() => setResolution(null)}
              className="rounded-full px-5 py-2.5 text-xs font-bold text-neutral-500 transition-all hover:bg-neutral-100 active:scale-95 dark:hover:bg-neutral-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={runResolution}
              disabled={resolve.isPending}
              className={`rounded-full px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all active:scale-95 disabled:opacity-50 ${
                resolution?.action === 'delete'
                  ? 'bg-[#D41F2D] hover:bg-[#b11a25]'
                  : 'bg-neutral-900 dark:bg-white dark:text-neutral-900'
              }`}
            >
              {resolve.isPending ? 'Resolviendo…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Dialog>
    </AdminScreen>
  )
}
