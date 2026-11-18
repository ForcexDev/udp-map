import { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { BottomNav } from '@/shared/ui/BottomNav'
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
    <div className="app-shell w-full flex flex-col overflow-hidden">
      <NotificationBanner />

      {/* Main content — full height */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom Navigation — unified fixed bar on all pages */}
      <BottomNav onCreate={handleGlobalCreateClick} />

      <Sidebar />
      <NotificationUrlHandler />
      <LoginModal />
      <ProfileSetupModal />
      <AboutModal />
      <Toast />
    </div>
  )
}
