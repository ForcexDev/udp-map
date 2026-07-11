import { useRegisterSW } from 'virtual:pwa-register/react'
// Import the changelog raw text
import changelogRaw from '../../../CHANGELOG.md?raw'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r)
    },
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })

  // Only render if an update is available
  if (!needRefresh) return null

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl flex flex-col gap-5 bg-white dark:bg-neutral-900 animate-in zoom-in-95 duration-300 border border-neutral-200 dark:border-neutral-800">
        <h3 className="text-xl font-bold text-neutral-900 dark:text-white">¡Actualización disponible! 🚀</h3>
        
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Hay una nueva versión de UDP Map. Hemos añadido las siguientes mejoras:
        </p>

        <div className="text-[13px] text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800/50 p-4 rounded-xl whitespace-pre-wrap leading-relaxed max-h-[40vh] overflow-y-auto font-mono">
          {changelogRaw.trim()}
        </div>

        <button
          onClick={() => updateServiceWorker(true)}
          className="w-full flex items-center justify-center py-3.5 px-4 bg-[#D41F2D] hover:bg-[#b01a25] text-white rounded-xl font-bold transition-all active:scale-[0.98] shadow-md hover:shadow-lg"
        >
          Actualizar ahora
        </button>
      </div>
    </div>
  )
}
