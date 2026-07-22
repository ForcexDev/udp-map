import { useUIStore } from '@/shared/stores/uiStore'
import { Info } from 'lucide-react'

export function Toast() {
  const toast = useUIStore((s) => s.toast)
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed bottom-24 left-0 right-0 z-[4000] flex justify-center px-4 animate-fade-up">
      <div
        role="status"
        className="flex items-center gap-3 rounded-2xl bg-neutral-900/95 dark:bg-white/95 backdrop-blur-md px-4 py-3 text-sm font-medium text-white dark:text-neutral-900 shadow-2xl max-w-sm w-full sm:w-auto border border-white/10 dark:border-black/5"
      >
        <Info size={18} className="flex-shrink-0 text-white/70 dark:text-neutral-900/70" />
        <span className="leading-snug">{toast}</span>
      </div>
    </div>
  )
}
