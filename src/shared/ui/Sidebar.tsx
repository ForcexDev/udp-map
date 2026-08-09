import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import * as Tabs from '@radix-ui/react-tabs'
import {
  X, LogOut, Search,
  Globe, HelpCircle, MapPinOff, MapPin, Bell, Settings, Info
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
import { useNotifications } from '@/features/notifications/useNotifications'
import { usePushSubscription } from '@/features/notifications/usePushSubscription'

export function Sidebar() {
  const { t, i18n } = useTranslation()
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
  const devUnlockMap = useUIStore((s) => s.devUnlockMap)
  const setDevUnlockMap = useUIStore((s) => s.setDevUnlockMap)

  const [searchQuery, setSearchQuery] = useState('')
  const showToast = useUIStore((s) => s.showToast)
  const { subscribe: subscribeToPush } = usePushSubscription(false)
  const { data: notifications = [] } = useNotifications()
  const unreadNotifications = notifications.filter((notification) => !notification.read_at).length
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
      new CustomEvent('faculty-flyto', { detail: { lat: faculty.lat, lng: faculty.lng } })
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
        className="sidebar-overlay absolute inset-0 bg-black/10 backdrop-blur-md"
        onClick={close}
      />

      {/* Panel */}
      <div className="sidebar-panel relative w-full max-w-sm sm:max-w-md h-full bg-white dark:bg-neutral-900 flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.1)] border-l border-neutral-100 dark:border-neutral-800">
      <Tabs.Root
        value={tab}
        onValueChange={(v) => setTab(v as SidebarTab)}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* Header */}
        <div className="sidebar-header p-6 sm:p-8">
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
              className="w-9 h-9 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 active:scale-90 transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs Menu on Top with Sliding Animation.
              La pastilla es hermana de Tabs.List (no hija) para no meter nodos
              ajenos dentro del role="tablist". */}
          <div className="relative mt-2 p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl w-full select-none">
            <div
              className="absolute top-1 bottom-1 bg-white dark:bg-neutral-700 rounded-[14px] shadow-sm transition-all duration-300 ease-out pointer-events-none"
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
                  className="py-2.5 rounded-[14px] text-[10px] font-black tracking-wider transition-colors duration-200 flex items-center justify-center gap-1.5 uppercase cursor-pointer outline-none text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 data-[state=active]:text-neutral-900 dark:data-[state=active]:text-white focus-visible:ring-2 focus-visible:ring-[#D41F2D]"
                >
                  <Icon size={14} className="flex-shrink-0" />
                  <span className="truncate">{label}</span>
                  {key === 'notifications' && unreadNotifications > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D41F2D] flex-shrink-0 animate-pulse" />
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
                          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                            <img src="/udp-shield.png" alt="Escudo UDP" className="w-full h-full object-contain dark:invert opacity-90" />
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
          </Tabs.Content>

          <Tabs.Content value="notifications" className="outline-none">
            <NotificationCenter onNavigate={close} />
          </Tabs.Content>

          <Tabs.Content value="settings" className="outline-none">
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
                <button
                  onClick={() => {
                    openAbout()
                    close()
                  }}
                  className="w-full p-4 rounded-[18px] bg-neutral-50/50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 flex items-center gap-3 font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 active:scale-[0.98] transition-all"
                >
                  <Info size={18} />
                  <span className="text-sm">
                    {t('sidebar.aboutUs', 'Sobre nosotros')}
                  </span>
                </button>
              </section>

              {/* Admin: Dev Unlock Map */}
              {role === 'admin' && (
                <section className="space-y-4">
                  <h4 className="text-[11px] font-black text-neutral-900 dark:text-neutral-200 uppercase tracking-[0.2em]">
                    Administrador
                  </h4>
                  <button
                    onClick={() => setDevUnlockMap(!devUnlockMap)}
                    className={`w-full p-4 rounded-[18px] flex items-center gap-3 font-bold transition-all border active:scale-[0.98] ${
                      devUnlockMap
                        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                        : 'bg-neutral-50/50 dark:bg-neutral-800/50 border-neutral-100 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      devUnlockMap
                        ? 'bg-amber-100 dark:bg-amber-900/50'
                        : 'bg-neutral-100 dark:bg-neutral-700'
                    }`}>
                      <MapPinOff size={18} />
                    </div>
                    <div className="flex flex-col flex-1 text-left">
                      <span className="text-sm font-bold">
                        {devUnlockMap ? 'Mapa desbloqueado' : 'Desbloquear mapa'}
                      </span>
                      <span className="text-[10px] font-medium opacity-60">
                        Quita restricciones de área
                      </span>
                    </div>
                    {/* Toggle pill */}
                    <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${
                      devUnlockMap ? 'bg-amber-400 dark:bg-amber-500' : 'bg-neutral-300 dark:bg-neutral-600'
                    }`}>
                      <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
                        devUnlockMap ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </button>
                </section>
              )}

              {/* Notifications: Local Test */}
              <section className="space-y-4">
                <h4 className="text-[11px] font-black text-neutral-900 dark:text-neutral-200 uppercase tracking-[0.2em]">
                  {t('sidebar.notifications', 'Notificaciones')}
                </h4>
                <button
                  onClick={async () => {
                    if (!('Notification' in window)) {
                      showToast('Tu navegador no soporta notificaciones.')
                      return
                    }
                    if (Notification.permission !== 'granted') {
                      await subscribeToPush()
                      return
                    }
                    new Notification('Notificación de prueba UDP Map', {
                      body: 'Así se ven las notificaciones en este dispositivo.',
                      icon: '/favicon.svg',
                    })
                  }}
                  className="w-full p-4 rounded-[18px] bg-neutral-50/50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-700 flex items-center gap-3 font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 active:scale-[0.98] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                    <Bell size={18} />
                  </div>
                  <div className="flex flex-col flex-1 text-left">
                    <span className="text-sm font-bold">
                      Probar notificación
                    </span>
                    <span className="text-[10px] font-medium opacity-60">
                      Envía una notificación de prueba a este dispositivo
                    </span>
                  </div>
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
          </Tabs.Content>
        </div>
      </Tabs.Root>
      </div>
    </div>
  )
}
