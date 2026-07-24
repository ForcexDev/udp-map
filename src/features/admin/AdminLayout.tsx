import { Link, Outlet, Navigate } from 'react-router-dom'
import { ShieldAlert, ArrowLeft } from 'lucide-react'
import { Toast } from '@/shared/ui/Toast'
import { LoginModal } from '@/features/auth/LoginModal'
import { useAuthStore } from '@/features/auth/authStore'

export function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const loading = useAuthStore((s) => s.loading)

  // Guard de nivel de layout: si está cargando sesión, spinner. Si no es admin, redirigir a /mapa.
  if (loading) {
    return (
      <div className="app-shell relative h-full w-full flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#D41F2D] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-neutral-400">Verificando credenciales de administración…</span>
        </div>
      </div>
    )
  }

  if (role !== 'admin') {
    return <Navigate to="/mapa" replace />
  }

  return (
    <div className="app-shell relative h-full w-full flex flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      {/* Top Header Bar */}
      <header className="z-30 min-h-16 shrink-0 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md px-4 sm:px-6 pt-safe flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/mapa"
            className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-neutral-600 dark:text-neutral-300 hover:text-[#D41F2D] transition-colors py-2 px-3 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ArrowLeft size={16} />
            <span>Volver al mapa</span>
          </Link>
          <div className="h-4 w-px bg-neutral-200 dark:bg-neutral-800 hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 text-[#D41F2D] flex items-center justify-center">
              <ShieldAlert size={18} strokeWidth={2.5} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-[#D41F2D] block leading-none">UDP MAP</span>
              <span className="text-sm font-black text-neutral-900 dark:text-white tracking-tight">Panel de Administración</span>
            </div>
          </div>
        </div>

        {/* Current Admin User Info */}
        <div className="flex items-center gap-2 bg-neutral-100 dark:bg-neutral-800/80 rounded-full px-3 py-1.5">
          <div className="w-6 h-6 rounded-full bg-[#D41F2D] text-white text-[10px] font-black flex items-center justify-center">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <span className="text-xs font-bold text-neutral-800 dark:text-neutral-200 hidden sm:inline">{user?.name}</span>
          <span className="text-[9px] font-black uppercase bg-red-100 dark:bg-red-950/60 text-[#D41F2D] px-2 py-0.5 rounded-full">ADMIN</span>
        </div>
      </header>

      {/* Main Administrative Workplace */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      <Toast />
      <LoginModal />
    </div>
  )
}
