import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Map, MessagesSquare, UserRound } from 'lucide-react'
import { Sidebar } from '@/shared/ui/Sidebar'
import { LoginModal } from '@/features/auth/LoginModal'
import { Toast } from '@/shared/ui/Toast'

const NAV_ITEMS = [
  { to: '/mapa', key: 'nav.map', Icon: Map },
  { to: '/eventos', key: 'nav.events', Icon: CalendarDays },
  { to: '/foro', key: 'nav.forum', Icon: MessagesSquare },
  { to: '/perfil', key: 'nav.profile', Icon: UserRound },
]

export function Layout() {
  const { t } = useTranslation()

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
      </nav>

      <Sidebar />
      <LoginModal />
      <Toast />
    </div>
  )
}
