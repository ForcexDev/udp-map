import { useNavigate } from 'react-router-dom'
import {
  Bell, BellOff, CalendarDays, CheckCheck, ChevronRight,
  MessagesSquare, ShieldAlert, Trophy,
} from 'lucide-react'
import type { AppNotification, NotificationCategory } from '@/shared/types/database'
import { useAuthStore } from '@/features/auth/authStore'
import { relativeTime } from '@/shared/utils/datetime'
import { useMarkCategoryRead, useMarkNotificationRead, useNotifications } from './useNotifications'
import { usePushSubscription } from './usePushSubscription'

const SECTION_CONFIG: Array<{
  category: NotificationCategory
  label: string
  path: string
  icon: typeof Trophy
}> = [
  { category: 'profile', label: 'Perfil', path: '/perfil', icon: Trophy },
  { category: 'forum', label: 'Foro', path: '/foro', icon: MessagesSquare },
  { category: 'events', label: 'Eventos', path: '/eventos', icon: CalendarDays },
]

function NotificationRow({
  notification,
  onOpen,
}: {
  notification: AppNotification
  onOpen: (notification: AppNotification) => void
}) {
  const relative = relativeTime(notification.created_at)
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
        notification.read_at
          ? 'bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-800'
          : 'bg-red-50/70 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30'
      }`}
    >
      <div className="flex items-start gap-2">
        {!notification.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#D41F2D]" />}
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-extrabold text-neutral-800 dark:text-neutral-100">
            {notification.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
            {notification.body}
          </p>
          <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-neutral-400">
            {relative.value === 0 ? 'Ahora' : `${relative.unit === 'day' ? relative.value + ' d' : relative.unit === 'hour' ? relative.value + ' h' : relative.value + ' min'}`}
          </p>
        </div>
      </div>
    </button>
  )
}

export function NotificationCenter({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const role = useAuthStore((state) => state.role)
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markCategory = useMarkCategoryRead()
  const push = usePushSubscription(Boolean(user))

  const openNotification = (notification: AppNotification) => {
    if (!notification.read_at) markRead.mutate(notification.id)
    navigate(notification.url)
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

  return (
    <div className="space-y-5 pb-12">
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${push.state === 'subscribed' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50' : 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700'}`}>
              {push.state === 'subscribed' ? <Bell size={17} /> : <BellOff size={17} />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-neutral-800 dark:text-neutral-100">Notificaciones Web Push</p>
              <p className="truncate text-[10px] text-neutral-400">
                {push.state === 'subscribed' ? 'Activadas en este dispositivo' : push.state === 'denied' ? 'Bloqueadas por el navegador' : 'Recíbelas aunque la app esté cerrada'}
              </p>
            </div>
          </div>
          {push.state === 'subscribed' ? (
            <button type="button" onClick={() => void push.unsubscribe()} className="text-[10px] font-black text-neutral-400 hover:text-red-600">Desactivar</button>
          ) : (
            <button type="button" onClick={() => void push.subscribe()} disabled={push.state === 'loading' || push.state === 'unsupported' || push.state === 'denied'} className="rounded-full bg-[#D41F2D] px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-40">
              {push.state === 'loading' ? 'Activando…' : 'Activar'}
            </button>
          )}
        </div>
        {push.error && <p className="mt-2 text-[10px] font-semibold text-red-500">{push.error}</p>}
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-xs font-semibold text-neutral-400">Cargando notificaciones…</div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Tus notificaciones</h3>
              {personal.some((notification) => !notification.read_at) && <CheckCheck size={15} className="text-neutral-400" />}
            </div>

            {SECTION_CONFIG.map(({ category, label, path, icon: Icon }) => {
              const items = personal.filter((notification) => notification.category === category)
              const unread = items.filter((notification) => !notification.read_at).length
              return (
                <div key={category} className="overflow-hidden rounded-[18px] border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900">
                  <button type="button" onClick={() => openSection(path, category)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800">
                    <div className="grid h-9 w-9 place-items-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"><Icon size={17} /></div>
                    <span className="flex-1 text-sm font-extrabold text-neutral-800 dark:text-neutral-100">{label}</span>
                    {unread > 0 && <span className="min-w-5 rounded-full bg-[#D41F2D] px-1.5 py-0.5 text-center text-[10px] font-black text-white">{unread}</span>}
                    <ChevronRight size={15} className="text-neutral-300" />
                  </button>
                  {items.length > 0 && (
                    <div className="border-t border-neutral-100 p-1.5 dark:border-neutral-800">
                      {items.slice(0, 3).map((notification) => <NotificationRow key={notification.id} notification={notification} onOpen={openNotification} />)}
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          {role === 'admin' && (
            <section className="space-y-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
              <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D41F2D]">Administración</h3>
              <div className="overflow-hidden rounded-[18px] border border-red-200 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/10">
                <button type="button" onClick={() => openSection('/moderacion', 'moderation')} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-red-50 dark:hover:bg-red-950/20">
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-red-100 text-[#D41F2D] dark:bg-red-950/50"><ShieldAlert size={18} /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold text-neutral-800 dark:text-neutral-100">Cola de moderación</p>
                    <p className="text-[10px] text-neutral-400">Reportes separados de tus avisos personales</p>
                  </div>
                  {adminNotifications.filter((notification) => !notification.read_at).length > 0 && (
                    <span className="min-w-5 rounded-full bg-[#D41F2D] px-1.5 py-0.5 text-center text-[10px] font-black text-white">
                      {adminNotifications.filter((notification) => !notification.read_at).length}
                    </span>
                  )}
                  <ChevronRight size={15} className="text-neutral-300" />
                </button>
                {adminNotifications.length > 0 && (
                  <div className="border-t border-red-100 p-1.5 dark:border-red-950">
                    {adminNotifications.slice(0, 3).map((notification) => <NotificationRow key={notification.id} notification={notification} onOpen={openNotification} />)}
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
