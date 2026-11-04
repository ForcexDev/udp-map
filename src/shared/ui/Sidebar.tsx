import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import * as Tabs from '@radix-ui/react-tabs'
import {
  X,
  LogOut,
  Search,
  ChevronRight,
  Globe,
  HelpCircle,
  MapPin,
  Bell,
  Settings,
  Info,
  ShieldAlert,
} from 'lucide-react'
import { useSidebarStore, type SidebarTab } from '@/shared/stores/sidebarStore'
import { useUIStore } from '@/shared/stores/uiStore'
import { useAuthStore } from '@/features/auth/authStore'
import { setLanguage } from '@/shared/lib/i18n'
import type { Faculty } from '@/shared/types/database'
import { CAMPUSES } from '@/shared/data/campusData'
import { useFaculties } from '@/shared/data/facultyStore'
import { ThemeSwitcher } from '@/shared/ui/ThemeSwitcher'
import { NotificationCenter } from '@/features/notifications/NotificationCenter'
import { useUnreadCount } from '@/features/notifications/useNotifications'

export function Sidebar() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const isOpen = useSidebarStore((s) => s.isOpen)
  const close = useSidebarStore((s) => s.close)
  const tab = useSidebarStore((s) => s.activeTab)
  const setTab = useSidebarStore((s) => s.setActiveTab)

  const setCampusId = useUIStore((s) => s.setCampusId)
  const openLoginModal = useUIStore((s) => s.openLoginModal)
  const openTutorial = useUIStore((s) => s.openTutorial)
  const openAbout = useUIStore((s) => s.openAbout)
  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)
  const signOut = useAuthStore((s) => s.signOut)

  const [searchQuery, setSearchQuery] = useState('')
  const unreadNotifications = useUnreadCount()
  const langActiveIndex = i18n.language.startsWith('en') ? 1 : 0

  // Group faculties by campus, filtered by search
  const faculties = useFaculties()
  const groupedFaculties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return CAMPUSES.map((campus) => {
      const inCampus = faculties.filter((f) => {
        if (f.campus_id !== campus.id) return false
        if (!q) return true
        const name = i18n.language === 'en' ? f.name_en : f.name
        return name.toLowerCase().includes(q) || campus.name.toLowerCase().includes(q)
      })
      return { campus, faculties: inCampus }
    }).filter((g) => g.faculties.length > 0)
  }, [faculties, searchQuery, i18n.language])

  const handleSelectFaculty = (faculty: Faculty) => {
    // Switch to the faculty's campus and trigger flyTo via campusId change
    setCampusId(faculty.campus_id)
    // Abre la ficha con los posts, igual que tocar el perímetro en el mapa.
    useUIStore.getState().selectFaculty(faculty.id)
    // Dispatch a custom event so MapView can flyTo the faculty's exact coords
    window.dispatchEvent(
      new CustomEvent('faculty-flyto', { detail: { lat: faculty.lat, lng: faculty.lng } }),
    )
    setSearchQuery('')
    close()
  }

  const TABS = [
    { key: 'places', label: t('sidebar.places', 'Lugares'), Icon: MapPin },
    { key: 'notifications', label: t('sidebar.notificationsShort', 'Avisos'), Icon: Bell },
    { key: 'settings', label: t('sidebar.settings', 'Ajustes'), Icon: Settings },
  ] as const
  const tabActiveIndex = TABS.findIndex((tItem) => tItem.key === tab)

  if (!isOpen) return null

  return (
    <div className="sidebar-root fixed inset-0 z-[2000] flex justify-end">
      {/* Overlay */}
      <div
        className="sidebar-overlay absolute inset-0 bg-black/20 backdrop-blur-md"
        onClick={close}
      />

      {/* Panel */}
      <div className="sidebar-panel relative w-full max-w-sm sm:max-w-md h-full bg-[#FAF8F5] dark:bg-[#151820] flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.1)] border-l border-[#E5DEC9] dark:border-white/10">
        <Tabs.Root
          value={tab}
          onValueChange={(v) => setTab(v as SidebarTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          {/* Header */}
          <div className="sidebar-header p-6 sm:p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight mt-1">
                  {t('nav.map', 'Mapa')}
                </h2>
                <div className="w-[2px] h-7 rounded-full bg-[#E5DEC9] dark:bg-white/10"></div>
                <img
                  src="/udp-logo-full.png"
                  alt="Universidad Diego Portales"
                  className="h-8 w-auto object-contain"
                />
              </div>
              <button
                onClick={close}
                aria-label={t('common.close')}
                className="w-9 h-9 flex items-center justify-center bg-[#EFECE4] dark:bg-white/[0.08] text-stone-500 dark:text-stone-400 rounded-full hover:bg-[#E5DEC9] dark:hover:bg-white/[0.12] active:scale-90 transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs Menu on Top with Sliding Animation */}
            <div className="relative mt-2 p-1 bg-[#EFECE4] dark:bg-white/[0.06] rounded-2xl w-full select-none">
              <div
                className="absolute top-1 bottom-1 bg-white dark:bg-[#1E222D] rounded-[14px] shadow-xs transition-all duration-300 ease-out pointer-events-none"
                style={{
                  width: 'calc((100% - 8px) / 3)',
                  left: `calc(4px + ${tabActiveIndex} * ((100% - 8px) / 3))`,
                }}
              />
              <Tabs.List className="relative z-10 grid grid-cols-3">
                {TABS.map(({ key, label, Icon }) => (
                  <Tabs.Trigger
                    key={key}
                    value={key}
                    className="py-2.5 rounded-[14px] text-xs font-bold tracking-wide transition-colors duration-200 flex items-center justify-center gap-1.5 cursor-pointer outline-none text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 data-[state=active]:text-stone-900 dark:data-[state=active]:text-stone-100 focus-visible:ring-2 focus-visible:ring-[#C22B38]"
                  >
                    <Icon size={14} className="flex-shrink-0" />
                    <span className="truncate">{label}</span>
                    {key === 'notifications' && unreadNotifications > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C22B38] dark:bg-[#D93846] flex-shrink-0 animate-pulse" />
                    )}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
            </div>
          </div>

          {/* Content */}
          <div className="sidebar-content min-h-0 flex-1 overflow-y-auto px-6 sm:px-8 py-6 no-scrollbar">
            <Tabs.Content value="places" className="outline-none">
              <div className="space-y-6 pb-12">
                <h4 className="text-xs font-bold text-stone-900 dark:text-stone-200 uppercase tracking-wider mb-1">
                  {t('sidebar.faculties', 'Facultades')}
                </h4>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('sidebar.searchFaculty', 'Buscar facultad...')}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#E5DEC9] dark:border-white/10 text-sm font-medium text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#C22B38]/20 focus:border-[#C22B38] transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  {groupedFaculties.map(({ campus, faculties }) => (
                    <div key={campus.id}>
                      <p className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2 px-1">
                        {campus.name}
                      </p>
                      <div className="space-y-1.5">
                        {faculties.map((f) => (
                          <button
                            key={f.id}
                            onClick={() => handleSelectFaculty(f)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border border-transparent hover:bg-white dark:hover:bg-[#1E222D] hover:border-[#E5DEC9] dark:hover:border-white/10 active:scale-[0.98] cursor-pointer"
                          >
                            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                              <img
                                src="/udp-shield.png"
                                alt="Escudo UDP"
                                className="w-full h-full object-contain dark:invert opacity-90"
                              />
                            </div>
                            <span className="text-sm font-semibold text-stone-800 dark:text-stone-200 leading-tight">
                              {i18n.language === 'en' ? f.name_en : f.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {groupedFaculties.length === 0 && (
                    <p className="text-sm text-stone-400 dark:text-stone-500 text-center py-6">
                      {t('sidebar.noResults', 'Sin resultados')}
                    </p>
                  )}
                </div>
              </div>
            </Tabs.Content>

            <Tabs.Content value="notifications" className="outline-none">
              <NotificationCenter onNavigate={close} />
            </Tabs.Content>

            <Tabs.Content value="settings" className="outline-none">
              <div className="space-y-8 pb-12">
                {/* Language toggle */}
                <section className="space-y-4">
                  <h4 className="text-xs font-bold text-stone-900 dark:text-stone-200 uppercase tracking-wider">
                    {t('common.language')}
                  </h4>
                  <div className="relative flex p-1.5 bg-[#EFECE4] dark:bg-white/[0.06] rounded-2xl w-full select-none">
                    <div
                      className="absolute top-1.5 bottom-1.5 left-1.5 bg-white dark:bg-[#1E222D] rounded-[14px] shadow-xs transition-transform duration-300 ease-out pointer-events-none"
                      style={{
                        width: 'calc((100% - 12px) / 2)',
                        transform: `translateX(${langActiveIndex * 100}%)`,
                      }}
                    />
                    <button
                      onClick={() => setLanguage('es')}
                      className={`relative z-10 flex-1 py-2.5 rounded-[14px] text-xs font-bold tracking-wide transition-colors duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                        langActiveIndex === 0
                          ? 'text-stone-900 dark:text-stone-100'
                          : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                      }`}
                    >
                      <Globe size={14} /> Español
                    </button>
                    <button
                      onClick={() => setLanguage('en')}
                      className={`relative z-10 flex-1 py-2.5 rounded-[14px] text-xs font-bold tracking-wide transition-colors duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                        langActiveIndex === 1
                          ? 'text-stone-900 dark:text-stone-100'
                          : 'text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200'
                      }`}
                    >
                      <Globe size={14} /> English
                    </button>
                  </div>
                </section>

                {/* Theme toggle */}
                <section className="space-y-4">
                  <h4 className="text-xs font-bold text-stone-900 dark:text-stone-200 uppercase tracking-wider">
                    {t('common.theme')}
                  </h4>
                  <ThemeSwitcher />
                </section>

                {/* Help / Tutorial */}
                <section className="space-y-4">
                  <h4 className="text-xs font-bold text-stone-900 dark:text-stone-200 uppercase tracking-wider">
                    {t('sidebar.help', 'Ayuda')}
                  </h4>
                  <button
                    onClick={() => {
                      openTutorial()
                      close()
                    }}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#E5DEC9] dark:border-white/10 flex items-center gap-3 font-semibold text-stone-700 dark:text-stone-300 hover:bg-[#FAF8F5] dark:hover:bg-[#252A37] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <HelpCircle size={18} />
                    <span className="text-sm">{t('sidebar.showTutorial', 'Ver tutorial')}</span>
                  </button>
                  <button
                    onClick={() => {
                      openAbout()
                      close()
                    }}
                    className="w-full p-4 rounded-2xl bg-white dark:bg-[#1E222D] border border-[#E5DEC9] dark:border-white/10 flex items-center gap-3 font-semibold text-stone-700 dark:text-stone-300 hover:bg-[#FAF8F5] dark:hover:bg-[#252A37] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <Info size={18} />
                    <span className="text-sm">{t('sidebar.aboutUs', 'Sobre nosotros')}</span>
                  </button>
                </section>

                {/* Administración */}
                {role === 'admin' && (
                  <section className="space-y-4">
                    <h4 className="text-xs font-bold text-stone-900 dark:text-stone-200 uppercase tracking-wider">
                      Administrador
                    </h4>
                    <button
                      onClick={() => {
                        navigate('/admin')
                        close()
                      }}
                      className="w-full p-4 rounded-2xl bg-[#FBECEB]/60 dark:bg-[#D93846]/10 border border-[#F2D0CE] dark:border-[#D93846]/20 flex items-center gap-3 text-left transition-all hover:bg-[#FBECEB] dark:hover:bg-[#D93846]/20 active:scale-[0.98] cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#FBECEB] dark:bg-[#D93846]/20 text-[#C22B38] dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                        <ShieldAlert size={18} strokeWidth={2.2} />
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                          {t('sidebar.adminPanel', 'Panel de administración')}
                        </span>
                        <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                          {t(
                            'sidebar.adminPanelHint',
                            'Denuncias, usuarios y herramientas del mapa',
                          )}
                        </span>
                      </div>
                      <ChevronRight
                        size={16}
                        className="flex-shrink-0 text-stone-400 dark:text-stone-500"
                      />
                    </button>
                  </section>
                )}

                {/* Auth */}
                <section className="pt-2">
                  {user ? (
                    <button
                      onClick={() => void signOut()}
                      className="w-full p-4 rounded-2xl bg-[#FBECEB] dark:bg-[#D93846]/15 text-[#C22B38] dark:text-rose-300 font-bold flex items-center justify-center gap-3 border border-[#F2D0CE] dark:border-[#D93846]/20 hover:opacity-90 active:scale-[0.97] transition-all cursor-pointer"
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
                      className="w-full p-4 rounded-2xl bg-[#C22B38] text-white font-bold flex items-center justify-center gap-3 shadow-xs hover:bg-[#9E1F2A] active:scale-[0.97] transition-all cursor-pointer dark:bg-[#D93846]"
                    >
                      {t('auth.signIn')}
                    </button>
                  )}
                </section>
              </div>
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </div>
    </div>
  )
}
