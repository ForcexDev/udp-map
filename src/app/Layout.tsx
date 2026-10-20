import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Map, MessagesSquare, Plus, UserRound } from 'lucide-react'
import { Sidebar } from '@/shared/ui/Sidebar'
import { LoginModal } from '@/features/auth/LoginModal'
import { ProfileSetupModal } from '@/features/auth/ProfileSetupModal'
import { Toast } from '@/shared/ui/Toast'
import { NotificationUrlHandler } from '@/features/notifications/NotificationUrlHandler'
import { NotificationBanner } from '@/features/notifications/NotificationBanner'
import { AboutModal } from '@/features/about/AboutModal'
import { useGuard } from '@/features/auth/useGuard'
import { useUIStore } from '@/shared/stores/uiStore'

export function Layout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const guard = useGuard()
  const startPickingLocation = useUIStore((s) => s.startPickingLocation)

  const handleGlobalCreateClick = () => {
    if (!guard('pin.create.report')) return
    if (location.pathname !== '/mapa') {
      navigate('/mapa')
    }
    startPickingLocation()
  }

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
    <div className="app-shell relative h-full w-full flex flex-col overflow-hidden">
      <NotificationBanner />

      {/* Main content — full height */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom Navigation — unified fixed bar on all pages */}
      <nav
        aria-label="Principal"
        className="bottom-nav z-30 grid grid-cols-5 items-center gap-1 border-t border-[#E5DEC9] bg-[#FAF8F5] px-3 py-1.5 dark:border-white/10 dark:bg-[#151820]"
      >
        <NavLink
          to="/mapa"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-xs transition-colors ${
              isActive
                ? 'font-bold text-stone-900 dark:text-stone-100'
                : 'font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`
          }
        >
          <Map size={18} strokeWidth={1.8} aria-hidden />
          <span>{t('nav.map')}</span>
        </NavLink>

        <NavLink
          to="/eventos"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-xs transition-colors ${
              isActive
                ? 'font-bold text-stone-900 dark:text-stone-100'
                : 'font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`
          }
        >
          <CalendarDays size={18} strokeWidth={1.8} aria-hidden />
          <span>{t('nav.events')}</span>
        </NavLink>

        {/* Botón Central de Publicación (+) con aire lateral garantizado por la columna 3 */}
        <div className="flex items-center justify-center">
          <button
            type="button"
            onClick={handleGlobalCreateClick}
            aria-label={t('pin.create', 'Publicar')}
            className="flex h-10 w-12 cursor-pointer items-center justify-center rounded-2xl bg-[#C22B38] text-white shadow-xs transition-transform active:scale-95 dark:bg-[#D93846]"
          >
            <Plus size={20} strokeWidth={2.2} />
          </button>
        </div>

        <NavLink
          to="/foro"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-xs transition-colors ${
              isActive
                ? 'font-bold text-stone-900 dark:text-stone-100'
                : 'font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`
          }
        >
          <MessagesSquare size={18} strokeWidth={1.8} aria-hidden />
          <span>{t('nav.forum')}</span>
        </NavLink>

        <NavLink
          to="/perfil"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-xs transition-colors ${
              isActive
                ? 'font-bold text-stone-900 dark:text-stone-100'
                : 'font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`
          }
        >
          <UserRound size={18} strokeWidth={1.8} aria-hidden />
          <span>{t('nav.profile')}</span>
        </NavLink>
      </nav>

      <Sidebar />
      <NotificationUrlHandler />
      <LoginModal />
      <ProfileSetupModal />
      <AboutModal />
      <Toast />
    </div>
  )
}
