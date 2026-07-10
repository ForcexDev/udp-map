import { useUIStore } from '@/shared/stores/uiStore'

export function Toast() {
  const toast = useUIStore((s) => s.toast)
  if (!toast) return null
  return (
    <div
      role="status"
      className="fixed bottom-20 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-neutral-900"
    >
      {toast}
    </div>
  )
}
