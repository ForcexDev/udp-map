import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import type { AppNotification } from '@/shared/types/database'
import { useMarkNotificationRead, useNotificationRealtime } from './useNotifications'
import { useSidebarStore } from '@/shared/stores/sidebarStore'
import { notificationLook } from './notificationMeta'

export function NotificationBanner() {
  const { t } = useTranslation()
  const [activeBanner, setActiveBanner] = useState<AppNotification | null>(null)
  const markRead = useMarkNotificationRead()
  const navigate = useNavigate()
  const openNotificationsSidebar = useSidebarStore((s) => s.openNotifications)

  const handleNewNotification = useCallback((notification: AppNotification) => {
    setActiveBanner(notification)
  }, [])

  useNotificationRealtime(handleNewNotification)

  if (!activeBanner) return null

  const handleView = () => {
    if (!activeBanner.read_at) {
      markRead.mutate(activeBanner.id)
    }
    // '/' no es un destino: es lo que llevan los avisos de difusión, que no
    // apuntan a ninguna pantalla concreta. Navegar ahí deja al usuario en el
    // mapa preguntándose qué pasó, así que se abre la lista de avisos, que es
    // donde está lo que acaba de tocar.
    if (activeBanner.url && activeBanner.url !== '/') {
      navigate(activeBanner.url)
    } else {
      openNotificationsSidebar()
    }
    setActiveBanner(null)
  }

  // El icono sale del mismo sitio que en la lista de avisos. Este componente
  // tenía su propio `switch` —la tercera copia del mapa categoría→icono— y ya
  // se había quedado atrás: los avisos de difusión ('system') caían en el
  // `default` y salían con una campana genérica en vez del megáfono.
  const look = notificationLook(activeBanner.category)
  const CategoryIcon = look.icon

  return (
    <div
      className="fixed left-3 right-3 z-[3500] pointer-events-auto sm:left-auto sm:right-4 sm:w-96 animate-fade-up"
      style={{ top: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
    >
      <div className="glass-hud p-4 rounded-2xl shadow-2xl border border-[#E6E0D5] dark:border-white/[0.08] flex items-start gap-3 bg-white/95 dark:bg-[#1E222D]/95 backdrop-blur-md">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${look.bg} ${look.fg}`}>
          <CategoryIcon size={18} strokeWidth={2.2} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
            {activeBanner.title}
          </p>
          <p className="text-[11px] text-stone-600 dark:text-stone-300 font-normal line-clamp-2 mt-0.5 leading-snug">
            {activeBanner.body}
          </p>
          
          <div className="flex items-center gap-2 mt-2.5">
            <button
              type="button"
              onClick={handleView}
              className="px-3 py-1 rounded-xl bg-[#C22B38] hover:bg-[#a8242f] dark:bg-[#D93846] dark:hover:bg-[#c22b38] text-white text-xs font-semibold active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              {t('notifications.bannerView', 'Ver')}
            </button>
            <button
              type="button"
              onClick={() => setActiveBanner(null)}
              className="px-2.5 py-1 rounded-xl bg-[#EFECE4] dark:bg-white/[0.08] text-stone-600 dark:text-stone-300 text-xs font-semibold hover:bg-[#E2DDD2] dark:hover:bg-white/[0.12] hover:text-stone-900 dark:hover:text-white transition-all cursor-pointer"
            >
              {t('notifications.bannerDismiss', 'Ignorar')}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveBanner(null)}
          className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors p-1 cursor-pointer"
          aria-label={t('common.close', 'Cerrar')}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
