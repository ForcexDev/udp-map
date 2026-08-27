import { useState } from 'react'
import { Link, Outlet, Navigate, NavLink, useLocation } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, Monitor, ShieldAlert } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { Toast } from '@/shared/ui/Toast'
import { UserAvatar } from '@/shared/ui/UserAvatar'
import { useAuthStore } from '@/features/auth/authStore'
import { ADMIN_SECTIONS, sectionForPath } from './sections'

export function AdminLayout() {
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const loading = useAuthStore((s) => s.loading)
  const { pathname } = useLocation()
  const [picking, setPicking] = useState(false)

  // El ÚNICO guard de administración de la aplicación. Antes había dos, uno
  // aquí y otro dentro de la cola de moderación, y el segundo no esperaba a
  // `loading`: como el rol arranca en 'guest', abrir esa pantalla por URL
  // rebotaba siempre al mapa. Al vivir todo bajo /admin, ese guard sobra.
  if (loading) {
    return (
      <div className="app-shell relative flex h-full w-full flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#D41F2D] border-t-transparent" />
          <span className="text-xs font-bold text-neutral-400">
            Verificando credenciales…
          </span>
        </div>
      </div>
    )
  }

  if (role !== 'admin') return <Navigate to="/mapa" replace />

  const current = sectionForPath(pathname)

  return (
    <div className="app-shell relative flex h-full w-full flex-col overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      <header className="z-30 shrink-0 border-b border-neutral-200 bg-white/90 backdrop-blur-md pt-safe dark:border-neutral-800 dark:bg-neutral-900/90">
        {/* Fila 1: identidad. En móvil también — antes `hidden sm:` se llevaba
            el branding, el nombre y el rol, y quedaba un "VOLVER AL MA…"
            cortado junto a dos iconos mudos. */}
        <div className="flex min-h-14 items-center justify-between gap-2 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              to="/mapa"
              aria-label="Volver al mapa"
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-black uppercase tracking-wider text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-[#D41F2D] active:scale-95 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:px-3"
            >
              <ArrowLeft size={16} />
              <span className="hidden md:inline">Volver al mapa</span>
            </Link>

            <div className="hidden h-4 w-px shrink-0 bg-neutral-200 dark:bg-neutral-800 sm:block" />

            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-red-50 text-[#D41F2D] dark:bg-red-950/40">
                <ShieldAlert size={18} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-black uppercase leading-none tracking-[0.2em] text-[#D41F2D]">
                  UDP Map
                </span>
                <span className="block truncate text-sm font-black tracking-tight text-neutral-900 dark:text-white">
                  Administración
                </span>
              </div>
            </div>
          </div>

          {/* El avatar nunca se esconde: saber con qué cuenta estás mirando el
              panel importa más aquí que en cualquier otra pantalla. */}
          <div className="flex shrink-0 items-center gap-2 rounded-full bg-neutral-100 py-1.5 pl-1.5 pr-1.5 dark:bg-neutral-800/80 sm:pr-3">
            <UserAvatar name={user?.name} src={user?.avatarUrl} className="h-7 w-7 text-[28px]" />
            <span className="hidden max-w-[9rem] truncate text-xs font-bold text-neutral-800 dark:text-neutral-200 sm:inline">
              {user?.name}
            </span>
            <span className="hidden rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black uppercase text-[#D41F2D] dark:bg-red-950/60 sm:inline">
              Admin
            </span>
          </div>
        </div>

        {/* Fila 2: secciones.

            En pantalla ancha, píldoras como las de Eventos. En móvil, un botón
            que abre la lista — el mismo recurso que usa el Foro para sus
            canales. La barra de pestañas anterior era peor que inútil en el
            teléfono: Radix la recentraba en la activa, así que al desplazarla
            para alcanzar otra se la llevaba de debajo del dedo. */}
        <div className="px-3 pb-2.5 sm:px-6">
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex h-11 w-full items-center justify-between gap-2 rounded-full border border-neutral-200 bg-white px-4 text-left transition-colors active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-900 sm:hidden"
          >
            <span className="flex min-w-0 items-center gap-2">
              {current && <current.icon size={15} className="shrink-0 text-[#D41F2D]" />}
              <span className="truncate text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-white">
                {current?.label ?? 'Sección'}
              </span>
            </span>
            <ChevronDown size={15} className="shrink-0 text-neutral-400" />
          </button>

          <nav
            aria-label="Secciones de administración"
            className="hidden gap-1.5 overflow-x-auto no-scrollbar sm:flex"
          >
            {ADMIN_SECTIONS.map((section) => (
              <NavLink
                key={section.to}
                to={section.to}
                end={section.end}
                className={({ isActive }) =>
                  `flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold uppercase tracking-wider transition-colors active:scale-95 ${
                    isActive
                      ? 'bg-[#D41F2D] text-white shadow-sm'
                      : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
                  }`
                }
              >
                <section.icon size={14} />
                {section.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Sin scroll: lo pone cada pantalla. El editor de mapeo lo necesita así
          para ocupar el alto completo sin barra. */}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>

      <Dialog
        open={picking}
        onOpenChange={setPicking}
        title="Secciones"
        contentClassName="!bg-white dark:!bg-neutral-900"
      >
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {ADMIN_SECTIONS.map((section) => {
            const active = current?.to === section.to
            return (
              <li key={section.to}>
                <NavLink
                  to={section.to}
                  end={section.end}
                  onClick={() => setPicking(false)}
                  className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors active:scale-[0.98] ${
                    active
                      ? 'bg-[#D41F2D]/10'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      active
                        ? 'bg-[#D41F2D] text-white'
                        : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    <section.icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-neutral-900 dark:text-white">
                        {section.label}
                      </span>
                      {section.desktopOnly && (
                        <Monitor size={12} className="shrink-0 text-neutral-400" />
                      )}
                    </span>
                    <span className="block text-[11px] font-medium leading-snug text-neutral-400">
                      {section.desktopOnly
                        ? 'Necesita un computador'
                        : section.description}
                    </span>
                  </span>
                  {active && <Check size={16} className="shrink-0 text-[#D41F2D]" />}
                </NavLink>
              </li>
            )
          })}
        </ul>
      </Dialog>

      <Toast />
    </div>
  )
}
