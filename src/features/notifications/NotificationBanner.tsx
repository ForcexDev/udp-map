import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CalendarDays, MessagesSquare, Trophy, X, ShieldAlert } from 'lucide-react'
import type { AppNotification } from '@/shared/types/database'
import { useMarkNotificationRead, useNotificationRealtime } from './useNotifications'
import { useSidebarStore } from '@/shared/stores/sidebarStore'

export function NotificationBanner() {
  const [activeBanner, setActiveBanner] = useState<AppNotification | null>(null)
  const markRead = useMarkNotificationRead()
  const navigate = useNavigate()
  const openNotificationsSidebar = useSidebarStore((s) => s.openNotifications)

  const handleNewNotification = useCallback((notification: AppNotification) => {
    setActiveBanner(notification)
  }, [])

  useNotificationRealtime(handleNewNotification)

  if (!activeBanner) return null

  const handleView = () => {
    if (!activeBanner.read_at) {
      markRead.mutate(activeBanner.id)
    }
    if (activeBanner.url) {
      navigate(activeBanner.url)
    } else {
      openNotificationsSidebar()
    }
    setActiveBanner(null)
  }

  const getCategoryIcon = () => {
    switch (activeBanner.category) {
      case 'forum':
        return <MessagesSquare size={18} className="text-blue-500" />
      case 'events':
        return <CalendarDays size={18} className="text-emerald-500" />
      case 'profile':
        return <Trophy size={18} className="text-amber-500" />
      case 'moderation':
        return <ShieldAlert size={18} className="text-red-500" />
      default:
        return <Bell size={18} className="text-[#D41F2D]" />
    }
  }

  return (
    <div
      className="fixed left-3 right-3 z-[3500] pointer-events-auto sm:left-auto sm:right-4 sm:w-96 animate-fade-up"
      style={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
    >
      <div className="glass-hud p-4 rounded-2xl shadow-2xl border border-neutral-200/80 dark:border-neutral-700/80 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0 mt-0.5">
          {getCategoryIcon()}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-black text-neutral-900 dark:text-white truncate">
            {activeBanner.title}
          </p>
          <p className="text-[11px] text-neutral-600 dark:text-neutral-300 font-medium line-clamp-2 mt-0.5 leading-snug">
            {activeBanner.body}
          </p>
          
          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={handleView}
              className="px-3 py-1 rounded-lg bg-[#D41F2D] text-white text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              Ver
            </button>
            <button
              type="button"
              onClick={() => setActiveBanner(null)}
              className="px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 text-[10px] font-bold uppercase tracking-wider hover:text-neutral-800 dark:hover:text-neutral-200 transition-all cursor-pointer"
            >
              Ignorar
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveBanner(null)}
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors p-1 cursor-pointer"
          aria-label="Cerrar notificación"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
