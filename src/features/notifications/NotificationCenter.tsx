import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, BellOff, CalendarDays, CheckCheck, ChevronRight,
  MessagesSquare, ShieldAlert, Trophy, Trash2, CheckCircle2, Circle
} from 'lucide-react'
import type { AppNotification, NotificationCategory } from '@/shared/types/database'
import { useAuthStore } from '@/features/auth/authStore'
import { relativeTime } from '@/shared/utils/datetime'
import {
  useMarkCategoryRead,
  useMarkNotificationRead,
  useToggleNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useNotifications
} from './useNotifications'
import { usePushSubscription } from './usePushSubscription'

const CATEGORY_TABS: Array<{ category: NotificationCategory | 'all'; label: string; icon: typeof Trophy }> = [
  { category: 'all', label: 'Todas', icon: Bell },
  { category: 'forum', label: 'Foro', icon: MessagesSquare },
  { category: 'events', label: 'Eventos', icon: CalendarDays },
  { category: 'profile', label: 'Perfil', icon: Trophy },
]

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
  const relative = relativeTime(notification.created_at)
  const isRead = Boolean(notification.read_at)

  return (
    <div
      className={`group relative flex items-start gap-2.5 rounded-2xl p-3 text-left transition-all border ${
        isRead
          ? 'bg-neutral-50/50 dark:bg-neutral-800/40 border-neutral-100 dark:border-neutral-800'
          : 'bg-red-50/60 dark:bg-red-950/20 border-red-100/80 dark:border-red-900/40 shadow-sm'
      }`}
    >
      {/* Read Status Dot / Toggle */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggleRead(notification.id, notification.read_at)
        }}
        title={isRead ? 'Marcar como no leída' : 'Marcar como leída'}
        className="mt-0.5 text-neutral-400 hover:text-[#D41F2D] transition-colors p-0.5 cursor-pointer flex-shrink-0"
      >
        {isRead ? (
          <Circle size={14} className="text-neutral-300 dark:text-neutral-600" />
        ) : (
          <span className="block w-2.5 h-2.5 rounded-full bg-[#D41F2D] shadow-[0_0_8px_rgba(212,31,45,0.6)]" />
        )}
      </button>

      {/* Main Content (Clickable) */}
      <button
        type="button"
        onClick={() => onOpen(notification)}
        className="min-w-0 flex-1 text-left cursor-pointer"
      >
        <p className={`text-xs font-black leading-snug ${isRead ? 'text-neutral-700 dark:text-neutral-300' : 'text-neutral-900 dark:text-white'}`}>
          {notification.title}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400 line-clamp-2">
          {notification.body}
        </p>
        <span className="inline-block mt-1 text-[9px] font-extrabold uppercase tracking-wider text-neutral-400">
          {relative.value === 0 ? 'Ahora' : `${relative.value} ${relative.unit === 'day' ? 'd' : relative.unit === 'hour' ? 'h' : 'min'}`}
        </span>
      </button>

      {/* Actions (Delete) */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(notification.id)
          }}
          title="Eliminar notificación"
          className="text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 transition-all p-1.5 cursor-pointer rounded-xl"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  )
}

export function NotificationCenter({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const role = useAuthStore((state) => state.role)
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const toggleRead = useToggleNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const deleteSingle = useDeleteNotification()
  const markCategory = useMarkCategoryRead()
  const push = usePushSubscription(Boolean(user))

  const [activeFilter, setActiveFilter] = useState<NotificationCategory | 'all'>('all')

  const openNotification = (notification: AppNotification) => {
    if (!notification.read_at) markRead.mutate(notification.id)
    if (notification.url) {
      navigate(notification.url)
    }
    onNavigate()
  }

  const openSection = (path: string, category: NotificationCategory) => {
    markCategory.mutate(category)
    navigate(path)
    onNavigate()
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 p-6 text-center dark:border-neutral-700">
        <Bell size={28} className="mx-auto text-neutral-300 dark:text-neutral-600" />
        <p className="mt-3 text-sm font-bold text-neutral-700 dark:text-neutral-200">Inicia sesión para ver tus notificaciones</p>
        <p className="mt-1 text-xs text-neutral-400">Los avisos son privados y están asociados a tu cuenta UDP.</p>
      </div>
    )
  }

  const personal = notifications.filter((notification) => notification.audience === 'personal')
  const adminNotifications = notifications.filter((notification) => notification.audience === 'admin')
  const unreadCount = notifications.filter((n) => !n.read_at).length

  // Filtered notifications list
  const filteredPersonal = activeFilter === 'all'
    ? personal
    : personal.filter((n) => n.category === activeFilter)

  return (
    <div className="space-y-5 pb-12">
      {/* Web Push Card */}
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3.5 dark:border-neutral-700 dark:bg-neutral-800/50 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${push.state === 'subscribed' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50' : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700'}`}>
              {push.state === 'subscribed' ? <Bell size={17} /> : <BellOff size={17} />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black text-neutral-800 dark:text-neutral-100">Notificaciones Web Push</p>
              <p className="truncate text-[10px] text-neutral-400 font-medium">
                {push.state === 'subscribed'
                  ? 'Activadas en este dispositivo'
                  : push.state === 'denied'
                    ? 'Bloqueadas por el navegador'
                    : push.state === 'unsupported'
                      ? 'Este navegador no admite Web Push'
                      : 'Recíbelas aunque la app esté cerrada'}
              </p>
            </div>
          </div>
          {push.state === 'subscribed' ? (
            <button type="button" onClick={() => void push.unsubscribe()} className="text-[10px] font-black text-neutral-400 hover:text-red-600 transition-colors cursor-pointer">Desactivar</button>
          ) : (
            <button type="button" onClick={() => void push.subscribe()} disabled={push.state === 'loading' || push.state === 'unsupported' || push.state === 'denied'} className="rounded-xl bg-[#D41F2D] px-3 py-1.5 text-[10px] font-black text-white active:scale-95 transition-all disabled:opacity-40 cursor-pointer">
              {push.state === 'loading' ? 'Activando…' : push.state === 'error' ? 'Reintentar' : 'Activar'}
            </button>
          )}
        </div>
        {push.error && <p className="mt-2 text-[10px] font-semibold text-red-500">{push.error}</p>}
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-xs font-semibold text-neutral-400">Cargando notificaciones…</div>
      ) : (
        <>
          {/* Header & Mark All Read */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Tus avisos</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#D41F2D] text-white text-[9px] font-black leading-none">
                    {unreadCount}
                  </span>
                )}
              </div>
              
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  className="flex items-center gap-1.5 text-[10px] font-black text-[#D41F2D] hover:text-[#b11a25] transition-colors cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck size={14} />
                  <span>Marcar leídas</span>
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1.5 pt-0.5 px-0.5 pr-8">
              {CATEGORY_TABS.map(({ category, label, icon: Icon }) => {
                const isActive = activeFilter === category
                const categoryUnread = category === 'all'
                  ? unreadCount
                  : personal.filter((n) => n.category === category && !n.read_at).length

                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveFilter(category)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                        : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    <Icon size={12} />
                    <span>{label}</span>
                    {categoryUnread > 0 && (
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#D41F2D]' : 'bg-[#D41F2D]'}`} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Notifications List */}
            {filteredPersonal.length > 0 ? (
              <div className="space-y-2">
                {filteredPersonal.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onOpen={openNotification}
                    onToggleRead={(id, readAt) => toggleRead.mutate({ id, readAt })}
                    onDelete={(id) => deleteSingle.mutate(id)}
                  />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center bg-neutral-50/50 dark:bg-neutral-800/20 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-800">
                <CheckCircle2 size={24} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-2" />
                <p className="text-xs font-bold text-neutral-500 dark:text-neutral-400">Sin notificaciones en esta categoría</p>
              </div>
            )}
          </div>

          {/* Admin Moderation Section */}
          {role === 'admin' && (
            <section className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D41F2D]">Administración</h3>
              <div className="overflow-hidden rounded-[18px] border border-red-200 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/10">
                <button type="button" onClick={() => openSection('/moderacion', 'moderation')} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-red-100 text-[#D41F2D] dark:bg-red-950/50"><ShieldAlert size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-neutral-800 dark:text-neutral-100">Cola de moderación</p>
                    <p className="text-[10px] text-neutral-400 font-medium">Reportes separados de tus avisos personales</p>
                  </div>
                  {adminNotifications.filter((notification) => !notification.read_at).length > 0 && (
                    <span className="min-w-5 rounded-full bg-[#D41F2D] px-1.5 py-0.5 text-center text-[10px] font-black text-white">
                      {adminNotifications.filter((notification) => !notification.read_at).length}
                    </span>
                  )}
                  <ChevronRight size={15} className="text-neutral-300" />
                </button>
                {adminNotifications.length > 0 && (
                  <div className="border-t border-red-100 p-2 space-y-2 dark:border-red-950">
                    {adminNotifications.slice(0, 3).map((notification) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        onOpen={openNotification}
                        onToggleRead={(id, readAt) => toggleRead.mutate({ id, readAt })}
                        onDelete={(id) => deleteSingle.mutate(id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

