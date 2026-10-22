import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Bell, BellRing, CheckCheck, Circle, Trash2, TriangleAlert } from 'lucide-react'
import type { AppNotification, NotificationCategory } from '@/shared/types/database'
import { useAuthStore } from '@/features/auth/authStore'
import { relativeTime, relativeTimeKey } from '@/shared/utils/datetime'
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog'
import {
  useSetNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useDeleteAllNotifications,
  useNotifications,
} from './useNotifications'
import { groupNotifications, notificationLook } from './notificationMeta'
import { PushCard } from './PushCard'
import { NotificationPreferences } from './NotificationPreferences'

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
  // Menos de un minuto no es "hace 1 min": es "ahora".
  if (relative.unit === 'minute' && relative.value <= 1) return t('time.now', 'ahora')
  return t(relativeTimeKey(relative), { n: relative.value })
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
          ? 'hover:bg-[#FAF8F5] dark:hover:bg-white/[0.04]'
          : 'bg-[#FBECEB]/60 dark:bg-[#D93846]/10'
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
              ? 'font-medium text-stone-700 dark:text-stone-300'
              : 'font-bold text-stone-900 dark:text-stone-100'
          }`}
        >
          {notification.title}
        </p>
        <p className="mt-0.5 text-xs font-normal leading-relaxed text-stone-500 dark:text-stone-400">
          {notification.body}
        </p>
        <span className="mt-1 block text-[11px] font-medium text-stone-400 dark:text-stone-500 tabular-nums">
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
          className="grid h-11 w-9 cursor-pointer place-items-center text-stone-300 transition-colors hover:text-stone-500 dark:text-stone-600 dark:hover:text-stone-400"
        >
          {isRead
            ? <Circle size={13} />
            : <span className="block h-2.5 w-2.5 rounded-full bg-[#C22B38] dark:bg-[#D93846] shadow-[0_0_8px_rgba(194,43,56,0.5)]" />}
        </button>

        <button
          type="button"
          onClick={() => onDelete(notification.id)}
          title={t('notifications.delete', 'Eliminar aviso')}
          aria-label={t('notifications.delete', 'Eliminar aviso')}
          className="grid h-11 w-10 cursor-pointer place-items-center rounded-xl text-stone-400 transition-colors hover:bg-[#FBECEB] hover:text-[#C22B38] dark:text-stone-500 dark:hover:bg-[#D93846]/20 dark:hover:text-[#D93846]"
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
  const { data: notifications = [], isLoading, isError, refetch } = useNotifications()

  const setRead = useSetNotificationRead()
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
    { value: 'pins', label: t('notifications.filterPins', 'Mis pines') },
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
      <div className="rounded-3xl border border-dashed border-[#E6E0D5] p-8 text-center dark:border-white/[0.1]">
        <Bell size={30} strokeWidth={1.5} className="mx-auto text-stone-300 dark:text-stone-600" />
        <p className="mt-3 text-sm font-bold text-stone-700 dark:text-stone-200">
          {t('notifications.signedOut', 'Inicia sesión para ver tus avisos')}
        </p>
        <p className="mt-1 text-xs font-medium text-stone-400 dark:text-stone-500">
          {t('notifications.signedOutHint', 'Son privados y van asociados a tu cuenta UDP.')}
        </p>
      </div>
    )
  }

  const openNotification = (notification: AppNotification) => {
    if (!notification.read_at) setRead.mutate({ id: notification.id, read: true })
    if (notification.url && notification.url !== '/') navigate(notification.url)
    onNavigate()
  }

  return (
    <div className="space-y-5 pb-12">
      <PushCard />
      <NotificationPreferences />

      {isLoading ? (
        <p className="py-10 text-center text-sm font-semibold text-stone-400 dark:text-stone-500">
          {t('notifications.loading', 'Cargando avisos…')}
        </p>
      ) : isError ? (
        /* Un fallo de carga NO puede verse como una bandeja vacía. `data`
           cae a `[]` cuando la consulta revienta, así que sin esta rama la
           pantalla decía "No tienes avisos" con la red caída o la sesión
           caducada — que es la peor mentira posible aquí: el usuario deja de
           mirar justo cuando hay algo que no le está llegando. */
        <div className="rounded-3xl border border-dashed border-amber-300/80 p-8 text-center dark:border-amber-900/60">
          <TriangleAlert size={28} strokeWidth={1.5} className="mx-auto text-amber-500" />
          <p className="mt-3 text-sm font-bold text-stone-700 dark:text-stone-200">
            {t('notifications.loadFailed', 'No se pudieron cargar tus avisos')}
          </p>
          <p className="mx-auto mt-1 max-w-[16rem] text-xs font-medium leading-relaxed text-stone-400 dark:text-stone-500">
            {t('notifications.loadFailedHint', 'Revisa tu conexión. Si acabas de volver, puede que tu sesión haya caducado.')}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-4 h-10 cursor-pointer rounded-2xl bg-[#C22B38] hover:bg-[#a8242f] dark:bg-[#D93846] px-5 text-xs font-semibold text-white transition-colors active:scale-95"
          >
            {t('notifications.retry', 'Reintentar')}
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                {t('notifications.title', 'Tus avisos')}
              </h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[#C22B38] dark:bg-[#D93846] px-2 py-0.5 text-[11px] font-bold leading-none text-white tabular-nums">
                  {unreadCount}
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#C22B38] dark:text-[#D93846] transition-colors hover:opacity-80 disabled:opacity-50"
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
                    className={`flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl px-3.5 text-xs font-semibold transition-colors active:scale-95 ${
                      active
                        ? 'bg-stone-900 text-[#FAF8F5] dark:bg-stone-100 dark:text-stone-950 shadow-sm'
                        : 'border border-[#E6E0D5] bg-white text-stone-600 hover:bg-[#FAF8F5] dark:border-white/[0.08] dark:bg-[#1E222D] dark:text-stone-300 dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    {option.label}
                    {count > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#C22B38] dark:bg-[#D93846]" />
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
                  <h4 className="mb-1.5 px-1 text-xs font-semibold text-stone-400 dark:text-stone-500">
                    {GROUP_LABEL[group.id]}
                  </h4>
                  <ul className="m-0 list-none space-y-0.5 p-0">
                    {group.items.map((notification) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        onOpen={openNotification}
                        onToggleRead={(id, readAt) => setRead.mutate({ id, read: !readAt })}
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
                className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-[#E6E0D5] bg-white text-xs font-semibold text-stone-500 transition-colors hover:border-[#FBECEB] hover:bg-[#FBECEB] hover:text-[#C22B38] active:scale-[0.98] disabled:opacity-50 dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-400 dark:hover:border-[#D93846]/20 dark:hover:bg-[#D93846]/10 dark:hover:text-[#D93846]"
              >
                <Trash2 size={14} />
                {t('notifications.clearAll', 'Vaciar todo')}
              </button>
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#E6E0D5] py-12 text-center dark:border-white/[0.08]">
              <BellRing size={30} strokeWidth={1.5} className="mx-auto text-stone-300 dark:text-stone-600" />
              <p className="mt-3 text-sm font-semibold text-stone-600 dark:text-stone-300">
                {personal.length === 0
                  ? t('notifications.empty', 'No tienes avisos')
                  : t('notifications.emptyFiltered', 'Nada en esta categoría')}
              </p>
              {personal.length === 0 && (
                <p className="mx-auto mt-1 max-w-[15rem] text-xs font-medium leading-relaxed text-stone-400 dark:text-stone-500">
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
