import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Bell, BellRing, CheckCheck, Circle, Trash2 } from 'lucide-react'
import type { AppNotification, NotificationCategory } from '@/shared/types/database'
import { useAuthStore } from '@/features/auth/authStore'
import { relativeTime } from '@/shared/utils/datetime'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import {
  useMarkNotificationRead,
  useToggleNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useDeleteAllNotifications,
  useNotifications,
} from './useNotifications'
import { groupNotifications, notificationLook } from './notificationMeta'
import { PushCard } from './PushCard'

// ─────────────────────────────────────────────────────────────────────────────
// El centro de avisos.
//
// Rehecho entero el 2026-08-27. Lo que había era, en sus propias palabras del
// ROADMAP §13.2, "de lo más flojo de la aplicación visualmente": tipografía de
// 9 a 11 px casi entera, tres radios distintos en el mismo componente y ni una
// cadena por i18n. Además colgaba de aquí una sección de ADMINISTRACIÓN con la
// cola de moderación, que no pinta nada en la bandeja personal de nadie: se
// mudó al panel, que es donde vive todo lo de administrar.
//
// Tres decisiones de fondo:
//
//  · Agrupado por día, como cualquier bandeja de verdad. Una lista plana de 40
//    avisos no dice cuál es de esta mañana y cuál del mes pasado.
//  · La fila entera abre el aviso. Los dos botones —leído y papelera— son
//    objetivos de 44 px, que es lo que pide un dedo; antes eran de 14 px.
//  · Vaciar la bandeja pide confirmación, porque no hay deshacer. Borrar UNO no
//    la pide: es un solo aviso y exigir un diálogo por fila hace que limpiar
//    veinte sea insufrible.
// ─────────────────────────────────────────────────────────────────────────────

type Filter = NotificationCategory | 'all'

function timeLabel(t: TFunction, createdAt: string): string {
  const relative = relativeTime(createdAt)
  if (relative.unit === 'minute' && relative.value <= 1) return t('time.now', 'ahora')
  if (relative.unit === 'minute') return t('time.agoMinutes', { n: relative.value })
  if (relative.unit === 'hour') return t('time.agoHours', { n: relative.value })
  // Clave aparte para el singular: `time.agoDays` no tiene forma plural y decía
  // "hace 1 días". Las de minutos y horas no la necesitan porque abrevian la
  // unidad ("hace 1 min", "hace 1 h") y ahí el singular no se nota.
  if (relative.value === 1) return t('time.agoDay', { n: 1 })
  return t('time.agoDays', { n: relative.value })
}

function NotificationRow({
  notification,
  onOpen,
  onToggleRead,
  onDelete,
}: {
  notification: AppNotification
  onOpen: (notification: AppNotification) => void
  onToggleRead: (id: string, readAt: string | null) => void
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  const isRead = Boolean(notification.read_at)
  const look = notificationLook(notification.category)
  const Icon = look.icon

  return (
    <li
      className={`relative flex items-start gap-3 rounded-2xl p-2.5 transition-colors ${
        isRead
          ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
          : 'bg-red-50/50 dark:bg-red-950/15'
      }`}
    >
      <span className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full ${look.bg} ${look.fg}`}>
        <Icon size={18} strokeWidth={2.2} />
      </span>

      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="min-w-0 flex-1 cursor-pointer py-0.5 text-left"
      >
        <p
          className={`text-[13px] leading-snug ${
            isRead
              ? 'font-semibold text-neutral-600 dark:text-neutral-300'
              : 'font-bold text-neutral-900 dark:text-white'
          }`}
        >
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">
          {notification.body}
        </p>
        <span className="mt-1 block text-[11px] font-semibold text-neutral-400 dark:text-neutral-500">
          {timeLabel(t, notification.created_at)}
        </span>
      </button>

      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => onToggleRead(notification.id, notification.read_at)}
          title={isRead
            ? t('notifications.markUnread', 'Marcar como no leída')
            : t('notifications.markRead', 'Marcar como leída')}
          aria-label={isRead
            ? t('notifications.markUnread', 'Marcar como no leída')
            : t('notifications.markRead', 'Marcar como leída')}
          className="grid h-11 w-9 cursor-pointer place-items-center text-neutral-300 transition-colors hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400"
        >
          {isRead
            ? <Circle size={13} />
            : <span className="block h-2.5 w-2.5 rounded-full bg-[#D41F2D] shadow-[0_0_8px_rgba(212,31,45,0.6)]" />}
        </button>

        <button
          type="button"
          onClick={() => onDelete(notification.id)}
          title={t('notifications.delete', 'Eliminar aviso')}
          aria-label={t('notifications.delete', 'Eliminar aviso')}
          className="grid h-11 w-10 cursor-pointer place-items-center rounded-xl text-neutral-300 transition-colors hover:bg-red-50 hover:text-[#D41F2D] dark:text-neutral-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  )
}

export function NotificationCenter({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const { data: notifications = [], isLoading } = useNotifications()

  const markRead = useMarkNotificationRead()
  const toggleRead = useToggleNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const deleteSingle = useDeleteNotification()
  const deleteAll = useDeleteAllNotifications()

  const [filter, setFilter] = useState<Filter>('all')
  const [clearing, setClearing] = useState(false)

  // Los avisos de `audience: 'admin'` NO salen aquí. Son trabajo del equipo, no
  // avisos personales, y ahora viven en /admin/moderacion.
  const personal = useMemo(
    () => notifications.filter((n) => n.audience === 'personal'),
    [notifications],
  )
  const unreadCount = personal.filter((n) => !n.read_at).length

  const visible = useMemo(
    () => (filter === 'all' ? personal : personal.filter((n) => n.category === filter)),
    [personal, filter],
  )
  const groups = useMemo(() => groupNotifications(visible), [visible])

  const FILTERS: Array<{ value: Filter; label: string }> = [
    { value: 'all', label: t('notifications.filterAll', 'Todas') },
    { value: 'forum', label: t('notifications.filterForum', 'Foro') },
    { value: 'events', label: t('notifications.filterEvents', 'Eventos') },
    { value: 'profile', label: t('notifications.filterProfile', 'Perfil') },
    { value: 'system', label: t('notifications.filterSystem', 'Avisos') },
  ]

  const GROUP_LABEL = {
    today: t('notifications.groupToday', 'Hoy'),
    week: t('notifications.groupWeek', 'Esta semana'),
    earlier: t('notifications.groupEarlier', 'Antes'),
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-200 p-8 text-center dark:border-neutral-700">
        <Bell size={30} strokeWidth={1.5} className="mx-auto text-neutral-300 dark:text-neutral-600" />
        <p className="mt-3 text-sm font-bold text-neutral-700 dark:text-neutral-200">
          {t('notifications.signedOut', 'Inicia sesión para ver tus avisos')}
        </p>
        <p className="mt-1 text-xs font-medium text-neutral-400">
          {t('notifications.signedOutHint', 'Son privados y van asociados a tu cuenta UDP.')}
        </p>
      </div>
    )
  }

  const openNotification = (notification: AppNotification) => {
    if (!notification.read_at) markRead.mutate(notification.id)
    if (notification.url && notification.url !== '/') navigate(notification.url)
    onNavigate()
  }

  return (
    <div className="space-y-5 pb-12">
      <PushCard />

      {isLoading ? (
        <p className="py-10 text-center text-sm font-semibold text-neutral-400">
          {t('notifications.loading', 'Cargando avisos…')}
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">
                {t('notifications.title', 'Tus avisos')}
              </h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#D41F2D] px-1.5 py-0.5 text-[10px] font-black leading-none text-white">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-bold text-[#D41F2D] transition-colors hover:text-[#b11a25] disabled:opacity-50"
              >
                <CheckCheck size={14} />
                {t('notifications.markAllRead', 'Marcar leídas')}
              </button>
            )}
          </div>

          {/* Las píldoras solo aparecen cuando hay algo que filtrar. Con dos
              avisos en la bandeja, un filtro de cinco categorías es decoración. */}
          {personal.length > 2 && (
            <div role="group" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
              {FILTERS.map((option) => {
                const active = filter === option.value
                const count = option.value === 'all'
                  ? unreadCount
                  : personal.filter((n) => n.category === option.value && !n.read_at).length
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(option.value)}
                    className={`flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition-colors active:scale-95 ${
                      active
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                        : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {option.label}
                    {count > 0 && (
                      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#D41F2D]' : 'bg-[#D41F2D]'}`} />
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {groups.length > 0 ? (
            <div className="space-y-5">
              {groups.map((group) => (
                <section key={group.id}>
                  <h4 className="mb-1.5 px-1 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-400">
                    {GROUP_LABEL[group.id]}
                  </h4>
                  <ul className="m-0 list-none space-y-0.5 p-0">
                    {group.items.map((notification) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        onOpen={openNotification}
                        onToggleRead={(id, readAt) => toggleRead.mutate({ id, readAt })}
                        onDelete={(id) => deleteSingle.mutate(id)}
                      />
                    ))}
                  </ul>
                </section>
              ))}

              <button
                type="button"
                onClick={() => setClearing(true)}
                disabled={deleteAll.isPending}
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white text-xs font-bold text-neutral-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-[#D41F2D] active:scale-[0.98] disabled:opacity-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-red-900/60 dark:hover:bg-red-950/30 dark:hover:text-red-400"
              >
                <Trash2 size={14} />
                {t('notifications.clearAll', 'Vaciar todo')}
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-neutral-200 py-12 text-center dark:border-neutral-800">
              <BellRing size={30} strokeWidth={1.5} className="mx-auto text-neutral-300 dark:text-neutral-600" />
              <p className="mt-3 text-sm font-bold text-neutral-600 dark:text-neutral-300">
                {personal.length === 0
                  ? t('notifications.empty', 'No tienes avisos')
                  : t('notifications.emptyFiltered', 'Nada en esta categoría')}
              </p>
              {personal.length === 0 && (
                <p className="mx-auto mt-1 max-w-[15rem] text-xs font-medium leading-relaxed text-neutral-400">
                  {t('notifications.emptyHint', 'Aquí llegarán las respuestas del foro, los recordatorios de eventos y tus logros.')}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={clearing}
        onOpenChange={setClearing}
        title={t('notifications.clearAllTitle', '¿Vaciar todos los avisos?')}
        description={t('notifications.clearAllBody', { count: personal.length })}
        confirmText={t('notifications.clearAllConfirm', 'Vaciar')}
        onConfirm={() => deleteAll.mutate()}
      />
    </div>
  )
}
