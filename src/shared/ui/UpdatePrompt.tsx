import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ArrowDownToLine, CheckCircle2, AlertTriangle } from 'lucide-react'

export function UpdatePrompt() {
  // Las novedades vienen de /update-info.json, emitido por el plugin
  // udp-map-update-info desde docs/CHANGELOG.md en este mismo build.
  const [improvements, setImprovements] = useState<string[]>([])
  const [newVersion, setNewVersion] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem('udp-update-dismissed') === 'true'
  )
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState(false)
  
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => {
          if (!registration.installing && navigator.onLine) {
            registration.update().catch(() => {})
          }
        }, 5 * 60 * 1000)
      }
    },
  })

  const [isDevTesting] = useState(() => import.meta.env.DEV && window.location.search.includes('test-pwa'))

  // Load update-info.json in the background to replace fallback improvements,
  // but don't block the prompt from appearing.
  useEffect(() => {
    if (!needRefresh && !isDevTesting) {
      setImprovements([])
      sessionStorage.removeItem('udp-update-dismissed')
      setDismissed(false)
      return
    }

    // Ensure it's not dismissed if we are actively prompting (e.g. testing)
    setDismissed(false)
    sessionStorage.removeItem('udp-update-dismissed')

    const controller = new AbortController()

    async function loadLatestUpdateInfo() {
      try {
        const response = await fetch(`/update-info.json?v=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json() as { improvements?: unknown; version?: string }
        if (typeof data.version === 'string') {
          setNewVersion(data.version)
        }
        if (Array.isArray(data.improvements)) {
          const latestImprovements = data.improvements.filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0,
          )
          if (latestImprovements.length > 0) setImprovements(latestImprovements)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('No se pudieron cargar las novedades de la actualización.', err)
        }
      }
    }

    void loadLatestUpdateInfo()
    return () => controller.abort()
  }, [needRefresh, isDevTesting])

  const handleUpdate = async () => {
    if (isUpdating) return
    setIsUpdating(true)
    setError(false)

    const timeout = setTimeout(() => {
      setIsUpdating(false)
      setError(true)
    }, 10_000)

    try {
      // Let the vite-plugin-pwa library handle the skip waiting and reload mechanism
      await updateServiceWorker(true)
    } catch (err) {
      clearTimeout(timeout)
      console.error('No se pudo aplicar la actualización.', err)
      setIsUpdating(false)
      setError(true)
    }
  }

  const handleDismiss = () => {
    sessionStorage.setItem('udp-update-dismissed', 'true')
    setDismissed(true)
  }

  // Show immediately when needRefresh is true
  if ((!needRefresh && !isDevTesting) || dismissed) return null

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-[340px] max-h-[85dvh] rounded-[22px] p-5 shadow-3xl flex flex-col gap-4 bg-white dark:bg-neutral-900 animate-in zoom-in-95 duration-300 border border-neutral-200/50 dark:border-neutral-800/50 overflow-hidden">
        
        <div className="flex flex-col items-center text-center mt-1 gap-2.5 flex-shrink-0">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${error ? 'bg-red-100 dark:bg-red-900/30 text-[#D41F2D]' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'}`}>
            {error ? <AlertTriangle size={24} strokeWidth={2} /> : <ArrowDownToLine size={24} strokeWidth={2} />}
          </div>
          <div>
            <h3 className="text-[18px] font-black tracking-tight text-neutral-900 dark:text-white leading-tight">
              {error ? 'Error al actualizar' : (newVersion ? `Actualización disponible (${newVersion})` : 'Actualización disponible')}
            </h3>
            <p className={`text-[13px] font-medium mt-0.5 leading-snug px-2 ${error ? 'text-red-600 dark:text-red-400' : 'text-neutral-500'}`}>
              {error 
                ? 'No se pudo aplicar la actualización. Por favor, recarga la página o intenta de nuevo.' 
                : 'Se descargó una nueva versión de la aplicación.'}
            </p>
          </div>
        </div>

        {!error && (
          <div className="flex-1 min-h-0 overflow-y-auto bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-3.5 border border-neutral-100 dark:border-neutral-800 pr-2">
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
        )}

        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              if (isDevTesting) {
                const url = new URL(window.location.href)
                url.searchParams.delete('test-pwa')
                window.location.href = url.toString()
              } else {
                void handleUpdate()
              }
            }}
            disabled={isUpdating}
            aria-busy={isUpdating}
            className="w-full py-3 px-4 bg-[#D41F2D] hover:bg-[#b01a25] text-white rounded-full text-sm font-bold transition-all active:scale-95 shadow-sm disabled:cursor-wait disabled:opacity-70"
          >
            {isUpdating ? 'Actualizando…' : (error ? 'Reintentar' : 'Actualizar ahora')}
          </button>
          {!isUpdating && (
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2.5 px-4 text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-full text-sm font-semibold transition-colors"
            >
              Más tarde
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
