import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import {
  X, MapPin, LogOut, Search,
  CalendarDays, MessagesSquare, UserRound, Globe, HelpCircle
} from 'lucide-react'
import { useSidebarStore } from '@/shared/stores/sidebarStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { setLanguage } from '@/shared/lib/i18n'
import { CAMPUSES, FACULTIES } from '@/shared/data/campusData'
import { ThemeSwitcher } from '@/shared/ui/ThemeSwitcher'

export function Sidebar() {
  const { t, i18n } = useTranslation()
  const isOpen = useSidebarStore((s) => s.isOpen)
  const close = useSidebarStore((s) => s.close)

  const setCampusId = useUIStore((s) => s.setCampusId)
  const openLoginModal = useUIStore((s) => s.openLoginModal)
  const openTutorial = useUIStore((s) => s.openTutorial)
  const user = useAuthStore((s) => s.user)
  const signOut = useAuthStore((s) => s.signOut)

  const [tab, setTab] = useState<'places' | 'community' | 'settings'>('places')
  const [searchQuery, setSearchQuery] = useState('')
  const langActiveIndex = i18n.language.startsWith('en') ? 1 : 0

  // Group faculties by campus, filtered by search
  const groupedFaculties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return CAMPUSES.map((campus) => {
      const faculties = FACULTIES.filter((f) => {
        if (f.campus_id !== campus.id) return false
        if (!q) return true
        const name = i18n.language === 'en' ? f.name_en : f.name
        return name.toLowerCase().includes(q) || campus.name.toLowerCase().includes(q)
      })
      return { campus, faculties }
    }).filter((g) => g.faculties.length > 0)
  }, [searchQuery, i18n.language])

  const handleSelectFaculty = (faculty: typeof FACULTIES[0]) => {
    // Switch to the faculty's campus and trigger flyTo via campusId change
    setCampusId(faculty.campus_id)
    // Dispatch a custom event so MapView can flyTo the faculty's exact coords
    window.dispatchEvent(
      new CustomEvent('faculty-flyto', { detail: { lat: faculty.lat, lng: faculty.lng } })
    )
    setSearchQuery('')
    close()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[2000] flex justify-end">
      {/* Overlay */}
      <div
        className="sidebar-overlay absolute inset-0 bg-black/10 backdrop-blur-md"
        onClick={close}
      />

      {/* Panel */}
      <div className="sidebar-panel relative w-full max-w-sm h-full bg-white dark:bg-neutral-900 flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.1)] border-l border-neutral-100 dark:border-neutral-800">
        {/* Header */}
        <div className="p-6 pt-10 sm:p-8 sm:pt-12">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-black text-neutral-900 dark:text-white tracking-tight mt-1">
                {t('nav.map', 'Mapa')}
              </h2>
              <div className="w-[2px] h-7 rounded-full bg-neutral-200 dark:bg-neutral-700"></div>
              <img 
                src="/udp-logo-full.png" 
                alt="Universidad Diego Portales" 
                className="h-8 w-auto object-contain"
              />
            </div>
            <button
              onClick={close}
              aria-label={t('common.close')}
              className="w-9 h-9 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-90 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs Menu on Top with Sliding Animation */}
          {(() => {
            const TABS = ['places', 'community', 'settings'] as const
            const tabActiveIndex = TABS.indexOf(tab)
            return (
              <div className="relative flex p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-2xl w-full select-none mt-2">
                <div
                  className="absolute top-1.5 bottom-1.5 left-1.5 bg-white dark:bg-neutral-700 rounded-[14px] shadow-sm transition-transform duration-300 ease-out pointer-events-none"
                  style={{
                    width: 'calc((100% - 12px) / 3)',
                    transform: `translateX(${tabActiveIndex * 100}%)`,
                  }}
                />
                {TABS.map((tKey) => {
                  const isActive = tab === tKey
                  return (
                    <button
                      key={tKey}
                      onClick={() => setTab(tKey)}
                      className={`relative z-10 flex-1 py-2.5 rounded-[14px] text-[10px] font-black tracking-[0.15em] transition-colors duration-300 uppercase ${
                        isActive
                          ? 'text-neutral-900 dark:text-white'
                          : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
                      }`}
                    >
                      {tKey === 'places' ? t('sidebar.places') : tKey === 'community' ? t('sidebar.community') : t('sidebar.settings')}
                    </button>
                  )
                })}
              </div>
            )
          })()}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 no-scrollbar">
          {tab === 'places' && (
            <div className="space-y-6 pb-12">
              <h4 className="text-[11px] font-black text-neutral-900 dark:text-neutral-200 uppercase tracking-[0.2em] mb-1">
                {t('sidebar.faculties', 'Facultades')}
              </h4>
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('sidebar.searchFaculty', 'Buscar facultad...')}
                  className="w-full pl-10 pr-4 py-3 rounded-[16px] bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-sm font-medium placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#D41F2D]/20 focus:border-[#D41F2D]/30 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="space-y-4">
                {groupedFaculties.map(({ campus, faculties }) => (
                  <div key={campus.id}>
                    <p className="text-[9px] font-black text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2 px-1">
                      {campus.name}
                    </p>
                    <div className="space-y-1.5">
                      {faculties.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => handleSelectFaculty(f)}
                          className="w-full flex items-center gap-3 p-3 rounded-[14px] text-left transition-all border border-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700 active:scale-[0.98]"
                        >
                          <div className="w-9 h-9 rounded-xl bg-[#D41F2D]/8 dark:bg-[#D41F2D]/15 flex items-center justify-center flex-shrink-0">
                            <MapPin size={16} className="text-[#D41F2D]" strokeWidth={2.5} />
                          </div>
                          <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 leading-tight">
                            {i18n.language === 'en' ? f.name_en : f.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {groupedFaculties.length === 0 && (
                  <p className="text-sm text-neutral-400 dark:text-neutral-500 text-center py-6">
                    {t('sidebar.noResults', 'Sin resultados')}
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === 'community' && (
            <div className="space-y-3 pb-12">
              {/* Navigation Links */}
              {[
                { to: '/eventos', icon: CalendarDays, label: t('nav.events') },
                { to: '/foro', icon: MessagesSquare, label: t('nav.forum') },
                { to: '/perfil', icon: UserRound, label: t('nav.profile') },
              ].map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={close}
                  className={({ isActive }) =>
                    `w-full p-4 rounded-[18px] flex items-center gap-4 font-bold transition-all border ${
                      isActive
                        ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white border-neutral-200 dark:border-neutral-700 shadow-md'
                        : 'bg-neutral-50/50 dark:bg-neutral-800/50 text-neutral-400 dark:text-neutral-500 border-transparent hover:border-neutral-200 dark:hover:border-neutral-700'
                    }`
                  }
                >
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center">
                    <Icon size={20} />
                  </div>
                  <span className="text-sm">{label}</span>
                </NavLink>
              ))}
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-8 pb-12">
              {/* Language toggle */}
              <section className="space-y-4">
                <h4 className="text-[11px] font-black text-neutral-900 dark:text-neutral-200 uppercase tracking-[0.2em]">
                  {t('common.language')}
                </h4>
                <div className="relative flex p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-2xl w-full select-none">
                  <div
                    className="absolute top-1.5 bottom-1.5 left-1.5 bg-white dark:bg-neutral-700 rounded-[14px] shadow-sm transition-transform duration-300 ease-out pointer-events-none"
                    style={{
                      width: 'calc((100% - 12px) / 2)',
                      transform: `translateX(${langActiveIndex * 100}%)`,
                    }}
                  />
                  <button
                    onClick={() => setLanguage('es')}
                    className={`relative z-10 flex-1 py-2.5 rounded-[14px] text-[11px] font-black tracking-wide transition-colors duration-300 flex items-center justify-center gap-2 ${
                      langActiveIndex === 0
                        ? 'text-neutral-900 dark:text-white'
                        : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
                    }`}
                  >
                    <Globe size={14} /> Español
                  </button>
                  <button
                    onClick={() => setLanguage('en')}
                    className={`relative z-10 flex-1 py-2.5 rounded-[14px] text-[11px] font-black tracking-wide transition-colors duration-300 flex items-center justify-center gap-2 ${
                      langActiveIndex === 1
                        ? 'text-neutral-900 dark:text-white'
                        : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
                    }`}
                  >
                    <Globe size={14} /> English
                  </button>
                </div>
              </section>

              {/* Theme toggle */}
              <section className="space-y-4">
                <h4 className="text-[11px] font-black text-neutral-900 dark:text-neutral-200 uppercase tracking-[0.2em]">
                  {t('common.theme')}
                </h4>
                <ThemeSwitcher />
              </section>

              {/* Help / Tutorial */}
              <section className="space-y-4">
                <h4 className="text-[11px] font-black text-neutral-900 dark:text-neutral-200 uppercase tracking-[0.2em]">
                  {t('sidebar.help', 'Ayuda')}
                </h4>
                <button
                  onClick={() => {
                    openTutorial()
                    close()
                  }}
                  className="w-full p-4 rounded-[18px] bg-neutral-50/50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 flex items-center gap-3 font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 active:scale-[0.98] transition-all"
                >
                  <HelpCircle size={18} />
                  <span className="text-sm">
                    {t('sidebar.showTutorial', 'Ver tutorial')}
                  </span>
                </button>
              </section>

              {/* Auth */}
              <section className="pt-2">
                {user ? (
                  <button
                    onClick={() => void signOut()}
                    className="w-full p-4 rounded-[18px] bg-red-50 dark:bg-red-950/50 text-[#D41F2D] font-bold flex items-center justify-center gap-3 border border-red-100 dark:border-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-[0.97] transition-all"
                  >
                    <LogOut size={18} strokeWidth={2.5} />
                    {t('auth.signOut')}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      openLoginModal()
                      close()
                    }}
                    className="w-full p-4 rounded-[18px] bg-[#D41F2D] text-white font-bold flex items-center justify-center gap-3 red-shadow hover:bg-[#b11a25] active:scale-[0.97] transition-all"
                  >
                    {t('auth.signIn')}
                  </button>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
