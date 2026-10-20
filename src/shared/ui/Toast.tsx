import { createPortal } from 'react-dom'
import { useUIStore } from '@/shared/stores/uiStore'
import { Info } from 'lucide-react'

export function Toast() {
  const toast = useUIStore((s) => s.toast)
  if (!toast) return null

  return createPortal(
    <div
      className="pointer-events-none fixed left-0 right-0 z-[99999] flex justify-center px-4 animate-fade-down"
      style={{ top: 'calc(1.25rem + env(safe-area-inset-top, 0px))' }}
    >
      <div
        role="status"
        className="pointer-events-auto flex items-center gap-3 rounded-2xl bg-[#FAF8F5]/95 text-stone-900 border border-[#E5DEC9] dark:bg-[#151820]/95 dark:text-stone-100 dark:border-white/10 backdrop-blur-md px-4 py-3 text-xs sm:text-sm font-semibold premium-shadow shadow-xl max-w-md w-auto"
      >
        <Info size={18} className="flex-shrink-0 text-[#C22B38] dark:text-[#D93846]" />
        <span className="leading-snug">{toast}</span>
      </div>
    </div>,
    document.body,
  )
}
