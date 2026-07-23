import { useEffect } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Map, MessagesSquare, UserRound } from 'lucide-react'
import { Sidebar } from '@/shared/ui/Sidebar'
import { LoginModal } from '@/features/auth/LoginModal'
import { Toast } from '@/shared/ui/Toast'
import { NotificationUrlHandler } from '@/features/notifications/NotificationUrlHandler'
import { NotificationBanner } from '@/features/notifications/NotificationBanner'
import { AboutModal } from '@/features/about/AboutModal'

const NAV_ITEMS = [
  { to: '/mapa', key: 'nav.map', Icon: Map },
  { to: '/eventos', key: 'nav.events', Icon: CalendarDays },
  { to: '/foro', key: 'nav.forum', Icon: MessagesSquare },
  { to: '/perfil', key: 'nav.profile', Icon: UserRound },
]

export function Layout() {
  const { t } = useTranslation()

  // Lock window scroll to (0,0) globally to prevent Android WebView/PWA displacement
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0)
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="fixed inset-0 flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden">
      <NotificationBanner />

      {/* Main content — full height */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom Navigation — unified fixed bar on all pages */}
      <nav
        aria-label="Principal"
        className="bottom-nav z-30 flex border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 pb-safe"
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
      <NotificationUrlHandler />
      <LoginModal />
      <AboutModal />
      <Toast />
    </div>
  )
}
