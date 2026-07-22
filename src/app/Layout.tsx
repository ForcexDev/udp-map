import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, CalendarDays, Map, MessagesSquare, UserRound } from 'lucide-react'
import { Sidebar } from '@/shared/ui/Sidebar'
import { LoginModal } from '@/features/auth/LoginModal'
import { Toast } from '@/shared/ui/Toast'
import { NotificationUrlHandler } from '@/features/notifications/NotificationUrlHandler'
import { useSidebarStore } from '@/shared/stores/sidebarStore'
import { useNotifications } from '@/features/notifications/useNotifications'

const NAV_ITEMS = [
  { to: '/mapa', key: 'nav.map', Icon: Map },
  { to: '/eventos', key: 'nav.events', Icon: CalendarDays },
  { to: '/foro', key: 'nav.forum', Icon: MessagesSquare },
  { to: '/perfil', key: 'nav.profile', Icon: UserRound },
]

export function Layout() {
  const { t } = useTranslation()
  const openNotifications = useSidebarStore((state) => state.openNotifications)
  const { data: notifications = [] } = useNotifications()
  const unread = notifications.filter((notification) => !notification.read_at).length

  return (
    <div className="flex h-dvh flex-col">
      {/* Main content — full height, no header */}
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>

      {/* Bottom Navigation — unified fixed bar on all pages */}
      <nav
        aria-label="Principal"
        className="z-30 flex border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 pb-safe"
      >
        {NAV_ITEMS.map(({ to, key, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `bottom-nav-link ${isActive ? 'active' : ''}`
            }
          >
            <Icon size={20} aria-hidden />
            {t(key)}
          </NavLink>
        ))}
        <button type="button" onClick={openNotifications} className="bottom-nav-link relative">
          <span className="relative">
            <Bell size={20} aria-hidden />
            {unread > 0 && <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-[#D41F2D] px-1 text-center text-[9px] font-black leading-4 text-white">{unread}</span>}
          </span>
          {t('sidebar.notifications', 'Notificaciones')}
        </button>
      </nav>

      <Sidebar />
      <NotificationUrlHandler />
      <LoginModal />
      <Toast />
    </div>
  )
}
