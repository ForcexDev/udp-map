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
 * Responsive: en móvil muestra solo íconos en un óvalo compacto;
 * en pantallas ≥ sm muestra ícono + label como segmented control.
 */
export function ThemeSwitcher() {
  const { t } = useTranslation()
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)

  return (
    <div className="flex p-1 sm:p-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full sm:rounded-2xl w-fit sm:w-full">
      {MODES.map(({ value, Icon, labelKey }) => {
        const isActive = theme === value
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            aria-label={t(labelKey)}
            className={`
              w-9 h-9 sm:flex-1 sm:w-auto sm:h-auto sm:py-2.5
              rounded-full sm:rounded-[14px]
              flex items-center justify-center gap-2
              text-[11px] font-black tracking-wide transition-all
              ${isActive
                ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300'
              }
            `}
          >
            <Icon size={16} strokeWidth={2} className="sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">{t(labelKey)}</span>
          </button>
        )
      })}
    </div>
  )
}
