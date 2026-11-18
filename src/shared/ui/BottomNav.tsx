import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Map, MessagesSquare, Plus, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface BottomNavProps {
  /** Botón central (+). */
  onCreate: () => void
  /**
   * Práctica del tutorial: la barra se ve igual pero las pestañas no navegan
   * (salir a /eventos dejaría la práctica a medias) y «Mapa» queda marcada.
   */
  practice?: boolean
}

const TABS: { to: string; key: string; icon: LucideIcon }[] = [
  { to: '/mapa', key: 'nav.map', icon: Map },
  { to: '/eventos', key: 'nav.events', icon: CalendarDays },
  { to: '/foro', key: 'nav.forum', icon: MessagesSquare },
  { to: '/perfil', key: 'nav.profile', icon: UserRound },
]

function tabClass(isActive: boolean) {
  return `flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-xs transition-colors ${
    isActive
      ? 'font-bold text-stone-900 dark:text-stone-100'
      : 'font-medium text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
  }`
}

/** Barra de navegación inferior, común a todas las pantallas públicas. */
export function BottomNav({ onCreate, practice = false }: BottomNavProps) {
  const { t } = useTranslation()

  const tab = ({ to, key, icon: Icon }: (typeof TABS)[number]) => {
    const content = (
      <>
        <Icon size={18} strokeWidth={1.8} aria-hidden />
        <span>{t(key)}</span>
      </>
    )
    return practice ? (
      <span key={to} className={tabClass(to === '/mapa')} aria-disabled>
        {content}
      </span>
    ) : (
      <NavLink key={to} to={to} className={({ isActive }) => tabClass(isActive)}>
        {content}
      </NavLink>
    )
  }

  return (
    <nav
      aria-label="Principal"
      className="bottom-nav z-30 grid grid-cols-5 items-center gap-1 border-t border-[#E5DEC9] bg-[#FAF8F5] px-3 py-1.5 dark:border-white/10 dark:bg-[#151820]"
    >
      {tab(TABS[0])}
      {tab(TABS[1])}

      {/* Botón Central de Publicación (+) con aire lateral garantizado por la columna 3 */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={onCreate}
          data-guia="publicar"
          aria-label={t('pin.create', 'Publicar')}
          className="flex h-10 w-12 cursor-pointer items-center justify-center rounded-2xl bg-[#C22B38] text-white shadow-xs transition-transform active:scale-95 dark:bg-[#D93846]"
        >
          <Plus size={20} strokeWidth={2.2} />
        </button>
      </div>

      {tab(TABS[2])}
      {tab(TABS[3])}
    </nav>
  )
}
