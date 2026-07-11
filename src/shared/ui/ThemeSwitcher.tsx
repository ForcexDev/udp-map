import { useTranslation } from 'react-i18next'
import { Sun, Moon, Monitor } from 'lucide-react'
import { useUIStore, type Theme } from '@/shared/stores/uiStore'

const MODES: { value: Theme; Icon: typeof Sun; labelKey: string }[] = [
  { value: 'light', Icon: Sun, labelKey: 'sidebar.themeLight' },
  { value: 'dark', Icon: Moon, labelKey: 'sidebar.themeDark' },
  { value: 'system', Icon: Monitor, labelKey: 'sidebar.themeSystem' },
]

/**
 * Selector de tema (Claro / Oscuro / Sistema).
 * No responsivo (siempre muestra ícono + texto).
 * Con animación de deslizamiento (sliding) suave y fluida.
 */
export function ThemeSwitcher() {
  const { t } = useTranslation()
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  const activeIndex = Math.max(0, MODES.findIndex((m) => m.value === theme))

  return (
    <div className="relative flex p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-2xl w-full select-none">
      {/* Indicador de fondo deslizante */}
      <div
        className="absolute top-1.5 bottom-1.5 left-1.5 bg-white dark:bg-neutral-700 rounded-[14px] shadow-sm transition-transform duration-300 ease-out pointer-events-none"
        style={{
          width: 'calc((100% - 12px) / 3)',
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />

      {MODES.map(({ value, Icon, labelKey }) => {
        const isActive = theme === value
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            aria-label={t(labelKey)}
            className={`
              relative z-10 flex-1 py-2.5
              rounded-[14px]
              flex items-center justify-center gap-2
              text-[11px] font-black tracking-wide transition-colors duration-300
              ${isActive
                ? 'text-neutral-900 dark:text-white'
                : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
              }
            `}
          >
            <Icon size={14} strokeWidth={2.5} className="flex-shrink-0" />
            <span>{t(labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}
