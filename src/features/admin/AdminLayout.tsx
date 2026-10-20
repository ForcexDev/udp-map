import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, Navigate, NavLink, useLocation } from 'react-router-dom'
import { ArrowLeft, Check, ChevronDown, Monitor, ShieldAlert } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import { Toast } from '@/shared/ui/Toast'
import { UserAvatar } from '@/shared/ui/UserAvatar'
import { useAuthStore } from '@/features/auth/authStore'
import { ADMIN_SECTIONS, sectionForPath } from './sections'

export function AdminLayout() {
  const { t } = useTranslation()
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
      <div className="app-shell relative flex h-full w-full flex-col items-center justify-center bg-[#FAF8F5] dark:bg-[#151820]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#C22B38] border-t-transparent dark:border-[#D93846] dark:border-t-transparent" />
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
            {t('admin.checkingCredentials', 'Verificando credenciales…')}
          </span>
        </div>
      </div>
    )
  }

  if (role !== 'admin') return <Navigate to="/mapa" replace />

  const current = sectionForPath(pathname)

  return (
    <div className="app-shell relative flex h-full w-full flex-col overflow-hidden bg-[#FAF8F5] dark:bg-[#151820]">
      <header className="z-30 shrink-0 border-b border-[#E5DEC9] bg-[#FAF8F5]/90 backdrop-blur-md pt-safe dark:border-white/10 dark:bg-[#151820]/90">
        {/* Fila 1: identidad. En móvil también — antes `hidden sm:` se llevaba
            el branding, el nombre y el rol, y quedaba un "VOLVER AL MA…"
            cortado junto a dos iconos mudos. */}
        <div className="flex min-h-14 items-center justify-between gap-2 px-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              to="/mapa"
              aria-label={t('admin.backToMap', 'Volver al mapa')}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-2xl px-2.5 text-xs font-semibold text-stone-600 transition-colors hover:bg-[#EFECE4] hover:text-[#C22B38] active:scale-95 dark:text-stone-300 dark:hover:bg-white/[0.08] dark:hover:text-[#D93846] sm:px-3"
            >
              <ArrowLeft size={16} />
              <span className="hidden md:inline">{t('admin.backToMap', 'Volver al mapa')}</span>
            </Link>

            <div className="hidden h-4 w-px shrink-0 bg-[#E5DEC9] dark:bg-white/10 sm:block" />

            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FBECEB] text-[#B02330] dark:bg-[#D93846]/15 dark:text-rose-300">
                <ShieldAlert size={18} strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-bold uppercase leading-none tracking-wider text-[#C22B38] dark:text-[#D93846]">
                  UDP Map
                </span>
                <span className="block truncate text-sm font-bold tracking-tight text-stone-900 dark:text-stone-100">
                  {t('admin.title', 'Administración')}
                </span>
              </div>
            </div>
          </div>

          {/* El avatar nunca se esconde: saber con qué cuenta estás mirando el
              panel importa más aquí que en cualquier otra pantalla. */}
          <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-[#EFECE4] py-1.5 pl-1.5 pr-1.5 dark:bg-white/[0.08] sm:pr-3">
            <UserAvatar name={user?.name} src={user?.avatarUrl} className="h-7 w-7 text-[28px]" />
            <span className="hidden max-w-[9rem] truncate text-xs font-semibold text-stone-800 dark:text-stone-200 sm:inline">
              {user?.name}
            </span>
            <span className="hidden rounded-lg bg-[#FBECEB] px-2 py-0.5 text-[10px] font-bold text-[#B02330] dark:bg-[#D93846]/20 dark:text-rose-300 sm:inline">
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
            className="flex h-11 w-full items-center justify-between gap-2 rounded-2xl border border-[#E6E0D5] bg-white px-4 text-left transition-colors active:scale-[0.99] dark:border-white/[0.07] dark:bg-[#1E222D] sm:hidden"
          >
            <span className="flex min-w-0 items-center gap-2">
              {current && <current.icon size={15} className="shrink-0 text-[#C22B38] dark:text-[#D93846]" />}
              <span className="truncate text-xs font-semibold text-stone-900 dark:text-stone-100">
                {current ? t(current.labelKey) : t('admin.sectionsTitle', 'Secciones')}
              </span>
            </span>
            <ChevronDown size={15} className="shrink-0 text-stone-400" />
          </button>

          <nav
            aria-label={t('admin.sectionsTitle', 'Secciones')}
            className="hidden gap-1.5 overflow-x-auto no-scrollbar sm:flex"
          >
            {ADMIN_SECTIONS.map((section) => (
              <NavLink
                key={section.to}
                to={section.to}
                end={section.end}
                className={({ isActive }) =>
                  `flex h-10 shrink-0 items-center gap-1.5 rounded-2xl px-3.5 text-xs font-semibold transition-colors active:scale-95 ${
                    isActive
                      ? 'bg-[#C22B38] text-white shadow-xs dark:bg-[#D93846]'
                      : 'border border-[#E6E0D5] bg-white text-stone-600 hover:bg-[#FAF8F5] dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-300 dark:hover:bg-[#252A37]'
                  }`
                }
              >
                <section.icon size={14} />
                {t(section.labelKey)}
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
        title={t('admin.sectionsTitle', 'Secciones')}
        contentClassName="!bg-[#FAF8F5] dark:!bg-[#151820] border border-[#E5DEC9] dark:border-white/10 rounded-3xl premium-shadow"
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
                      ? 'bg-[#FBECEB] dark:bg-[#D93846]/15'
                      : 'hover:bg-[#EFECE4] dark:hover:bg-white/[0.08]'
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      active
                        ? 'bg-[#C22B38] text-white dark:bg-[#D93846]'
                        : 'bg-[#EFECE4] text-stone-600 dark:bg-white/[0.08] dark:text-stone-400'
                    }`}
                  >
                    <section.icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                        {t(section.labelKey)}
                      </span>
                      {section.desktopOnly && (
                        <Monitor size={12} className="shrink-0 text-stone-400" />
                      )}
                    </span>
                    <span className="block text-[11px] font-normal leading-snug text-stone-500 dark:text-stone-400">
                      {section.desktopOnly
                        ? t('admin.needsComputer', 'Necesita un computador')
                        : t(section.descriptionKey)}
                    </span>
                  </span>
                  {active && <Check size={16} className="shrink-0 text-[#C22B38] dark:text-[#D93846]" />}
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
