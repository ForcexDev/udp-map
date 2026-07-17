import { useRegisterSW } from 'virtual:pwa-register/react'
import { ArrowDownToLine, CheckCircle2 } from 'lucide-react'
import changelogRaw from '../../../CHANGELOG.md?raw'

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // 1. Check updates when app is foregrounded or tab becomes visible
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && !r.installing) {
            r.update().catch(console.error)
          }
        })

        // 2. Periodic check every hour for long-running sessions (e.g. PC users)
        setInterval(() => {
          if (document.visibilityState === 'visible' && navigator.onLine && !r.installing) {
            r.update().catch(console.error)
          }
        }, 60 * 60 * 1000) // 1 hour
      }
    }
  })

  const isDevTesting = import.meta.env.DEV && window.location.search.includes('test-pwa')

  if (!needRefresh && !isDevTesting) return null

  const improvements = changelogRaw
    .split('\n')
    .filter((line) => line.trim().startsWith('-'))
    .map((line) => line.replace(/^-/, '').trim())

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-[320px] rounded-[22px] p-5 shadow-3xl flex flex-col gap-5 bg-white dark:bg-neutral-900 animate-in zoom-in-95 duration-300 border border-neutral-200/50 dark:border-neutral-800/50">
        
        <div className="flex flex-col items-center text-center mt-2 gap-3">
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-900 dark:text-white">
            <ArrowDownToLine size={24} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[18px] font-black tracking-tight text-neutral-900 dark:text-white">
              Actualización disponible
            </h3>
            <p className="text-[13px] text-neutral-500 font-medium mt-0.5 leading-snug px-2">
              Se descargó una nueva versión de la aplicación.
            </p>
          </div>
        </div>

        <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-3.5 border border-neutral-100 dark:border-neutral-800">
          <ul className="flex flex-col gap-2.5">
            {improvements.length > 0 ? (
              improvements.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-[#D41F2D] mt-0.5 flex-shrink-0" strokeWidth={2.5} />
                  <span className="text-[13px] font-semibold text-neutral-700 dark:text-neutral-300 leading-snug">
                    {item}
                  </span>
                </li>
              ))
            ) : (
              <li className="text-[13px] text-neutral-500 text-center font-medium">Mejoras de rendimiento.</li>
            )}
          </ul>
        </div>

        <button
          onClick={() => {
            if (isDevTesting) {
              const url = new URL(window.location.href)
              url.searchParams.delete('test-pwa')
              window.location.href = url.toString()
            } else {
              updateServiceWorker(true)
            }
          }}
          className="w-full py-3 px-4 bg-[#D41F2D] hover:bg-[#b01a25] text-white rounded-full text-sm font-bold transition-all active:scale-95 shadow-sm"
        >
          Actualizar ahora
        </button>
      </div>
    </div>
  )
}
