import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { ArrowDownToLine, CheckCircle2 } from 'lucide-react'
import changelogRaw from '../../../docs/CHANGELOG.md?raw'

const fallbackImprovements = changelogRaw
  .split('\n')
  .filter((line) => line.trim().startsWith('-'))
  .map((line) => line.replace(/^\s*-\s*/, '').trim())

const configuredRegistrations = new WeakSet<ServiceWorkerRegistration>()

function configureUpdateChecks(registration: ServiceWorkerRegistration) {
  if (configuredRegistrations.has(registration)) return
  configuredRegistrations.add(registration)

  let checking = false
  const checkForUpdate = async () => {
    if (checking || registration.installing || !navigator.onLine) return

    checking = true
    try {
      await registration.update()
    } catch (error) {
      console.error('No se pudo comprobar la actualización de la aplicación.', error)
    } finally {
      checking = false
    }
  }

  void checkForUpdate()

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate()
  })
  window.addEventListener('focus', () => void checkForUpdate())
  window.addEventListener('online', () => void checkForUpdate())

  // Detecta publicaciones nuevas incluso si la app permanece abierta.
  window.setInterval(() => void checkForUpdate(), 60 * 1000)
}

export function UpdatePrompt() {
  const [improvements, setImprovements] = useState(fallbackImprovements)
  const [updateInfoReady, setUpdateInfoReady] = useState(false)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      if (registration) configureUpdateChecks(registration)
    },
  })

  const isDevTesting = import.meta.env.DEV && window.location.search.includes('test-pwa')

  useEffect(() => {
    if (!needRefresh) {
      setImprovements(fallbackImprovements)
      setUpdateInfoReady(false)
      return
    }

    setImprovements([])
    const controller = new AbortController()

    async function loadLatestUpdateInfo() {
      try {
        const response = await fetch(`/update-info.json?v=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const data = await response.json() as { improvements?: unknown }
        if (Array.isArray(data.improvements)) {
          const latestImprovements = data.improvements.filter(
            (item): item is string => typeof item === 'string' && item.trim().length > 0,
          )
          if (latestImprovements.length > 0) setImprovements(latestImprovements)
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('No se pudieron cargar las novedades de la actualización.', error)
        }
      } finally {
        if (!controller.signal.aborted) setUpdateInfoReady(true)
      }
    }

    void loadLatestUpdateInfo()
    return () => controller.abort()
  }, [needRefresh])

  if ((!needRefresh && !isDevTesting) || (needRefresh && !updateInfoReady)) return null

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-[340px] max-h-[85dvh] rounded-[22px] p-5 shadow-3xl flex flex-col gap-4 bg-white dark:bg-neutral-900 animate-in zoom-in-95 duration-300 border border-neutral-200/50 dark:border-neutral-800/50 overflow-hidden">
        
        <div className="flex flex-col items-center text-center mt-1 gap-2.5 flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-900 dark:text-white flex-shrink-0">
            <ArrowDownToLine size={24} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[18px] font-black tracking-tight text-neutral-900 dark:text-white leading-tight">
              Actualización disponible
            </h3>
            <p className="text-[13px] text-neutral-500 font-medium mt-0.5 leading-snug px-2">
              Se descargó una nueva versión de la aplicación.
            </p>
          </div>
        </div>

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
          className="flex-shrink-0 w-full py-3 px-4 bg-[#D41F2D] hover:bg-[#b01a25] text-white rounded-full text-sm font-bold transition-all active:scale-95 shadow-sm"
        >
          Actualizar ahora
        </button>
      </div>
    </div>
  )
}
