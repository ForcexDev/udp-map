import { useEffect, useState } from 'react'
import { ArrowDownToLine, CheckCircle2 } from 'lucide-react'
import { shouldShowUpdate } from '@/shared/utils/pwa'
import { applyUpdate } from '@/shared/utils/swUpdate'

const DISMISSED_KEY = 'udp-update-dismissed-build'

type UpdateInfo = {
  buildId: string
  version: string | null
  improvements: string[]
}

// /update-info.json lo emite el plugin udp-map-update-info en cada build. No entra
// al precache del service worker (globPatterns no incluye .json) y se pide con
// cache: 'no-store', así que siempre refleja el despliegue vivo, no el instalado.
async function fetchUpdateInfo(signal: AbortSignal): Promise<UpdateInfo | null> {
  try {
    const response = await fetch('/update-info.json', { cache: 'no-store', signal })
    if (!response.ok) return null

    const data = await response.json() as Partial<UpdateInfo>
    if (typeof data.buildId !== 'string') return null

    return {
      buildId: data.buildId,
      version: typeof data.version === 'string' ? data.version : null,
      improvements: Array.isArray(data.improvements)
        ? data.improvements.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [],
    }
  } catch {
    return null
  }
}

export function UpdatePrompt() {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [dismissedBuildId, setDismissedBuildId] = useState(() => localStorage.getItem(DISMISSED_KEY))
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const check = () => {
      if (document.visibilityState !== 'visible') return
      void fetchUpdateInfo(controller.signal).then((data) => {
        if (data) setInfo(data)
      })
    }

    check()
    document.addEventListener('visibilitychange', check)
    return () => {
      controller.abort()
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  const handleDismiss = () => {
    if (!info) return
    localStorage.setItem(DISMISSED_KEY, info.buildId)
    setDismissedBuildId(info.buildId)
  }

  if (!info) return null
  if (!shouldShowUpdate({ currentBuildId: __BUILD_ID__, serverBuildId: info.buildId, dismissedBuildId })) {
    return null
  }

  return (
    // Móvil: hoja inferior por encima de la barra de navegación, como el resto
    // de la aplicación. Escritorio: tarjeta centrada — anclada abajo se veía
    // como una cajita perdida en la esquina de una pantalla ancha. El relleno
    // inferior que esquiva la barra vive en .update-prompt-anchor, que lo anula
    // a partir de 640px.
    <div className="update-prompt-anchor fixed inset-0 z-[999] flex justify-center items-end sm:items-center p-4 pointer-events-none">
      {/* animate-fade-in es la de la casa (index.css). Antes había aquí
          `animate-in slide-in-from-bottom-4`, de tailwindcss-animate, que este
          proyecto no usa: eran clases muertas y el aviso aparecía de golpe. */}
      <div className="w-full max-w-[340px] sm:max-w-[400px] max-h-[70dvh] rounded-[22px] p-5 shadow-3xl flex flex-col gap-4 bg-white dark:bg-neutral-900 animate-fade-in border border-neutral-200/50 dark:border-neutral-800/50 overflow-hidden pointer-events-auto">

        <div className="flex flex-col items-center text-center mt-1 gap-2.5 flex-shrink-0">
          <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white">
            <ArrowDownToLine size={24} strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-[18px] font-black tracking-tight text-neutral-900 dark:text-white leading-tight">
              {info.version ? `Actualización disponible (${info.version})` : 'Actualización disponible'}
            </h3>
            <p className="text-[13px] font-medium mt-0.5 leading-snug px-2 text-neutral-500">
              Hay una nueva versión de la aplicación.
            </p>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-3.5 border border-neutral-100 dark:border-neutral-800 pr-2">
          <ul className="flex flex-col gap-2.5">
            {info.improvements.length > 0 ? (
              info.improvements.map((item, idx) => (
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

        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            type="button"
            // Nada de rehabilitar el botón por temporizador. Antes se volvía a
            // habilitar a los 3 s aunque la descarga siguiera en curso, y eso
            // es literalmente lo que invitaba a pulsarlo otra vez, y otra.
            // `applyUpdate` termina SIEMPRE en `location.reload()`, así que la
            // pantalla se va sola: no hay estado del que haya que salir.
            onClick={() => {
              setIsUpdating(true)
              void applyUpdate()
            }}
            disabled={isUpdating}
            aria-busy={isUpdating}
            className="w-full py-3 px-4 bg-[#D41F2D] hover:bg-[#b01a25] text-white rounded-full text-sm font-bold transition-all active:scale-95 shadow-sm disabled:cursor-wait disabled:opacity-70"
          >
            {isUpdating ? 'Actualizando…' : 'Actualizar ahora'}
          </button>
          {isUpdating && (
            // La descarga puede tardar decenas de segundos con datos móviles.
            // Decirlo es lo que evita que se lea como "se quedó colgado".
            <p className="px-2 text-center text-[12px] font-medium leading-snug text-neutral-500">
              Descargando la versión nueva. Puede tardar unos segundos.
            </p>
          )}
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
