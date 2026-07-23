import { createPortal } from 'react-dom'
import { useUIStore } from '@/shared/stores/uiStore'
import { Info } from 'lucide-react'

export function Toast() {
  const toast = useUIStore((s) => s.toast)
  if (!toast) return null

  return createPortal(
    <div className="pointer-events-none fixed top-5 left-0 right-0 z-[99999] flex justify-center px-4 animate-fade-down">
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-neutral-900/95 dark:bg-white/95 backdrop-blur-md px-4 py-3 text-xs sm:text-sm font-semibold text-white dark:text-neutral-900 shadow-2xl max-w-md w-auto border border-white/20 dark:border-black/10"
      >
        <Info size={18} className="flex-shrink-0 text-red-400 dark:text-red-600" />
        <span className="leading-snug">{toast}</span>
      </div>
    </div>,
    document.body,
  )
}
