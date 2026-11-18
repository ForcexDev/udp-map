import { useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'
import { SheetStateContext } from './sheetState'

/** De más escondido a más abierto. El orden IMPORTA: arrastrar mueve un paso. */
type SheetStop = 'peek' | 'compact' | 'expanded'

interface DraggableBottomSheetProps {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
  className?: string
  ariaLabel?: string
  /**
   * Fracción del alto disponible para un tercer punto de anclaje, más bajo que
   * el compacto: solo la cabecera asomando. Es opcional a propósito — sin él la
   * hoja se comporta exactamente como siempre (compacto ↔ expandido), y así
   * añadir el asomo a la ficha de facultad no le cambia el gesto a la de pin.
   */
  peekRatio?: number
}

export function DraggableBottomSheet({
  children,
  isOpen,
  onClose,
  className = '',
  ariaLabel,
  peekRatio,
}: DraggableBottomSheetProps) {
  const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 640 : false
  const [stop, setStop] = useState<SheetStop>(isDesktop ? 'expanded' : 'compact')
  // Desplazamiento del dedo mientras arrastra; `null` cuando no hay arrastre.
  // Durante el arrastre la transición CSS se apaga para que la hoja siga al dedo.
  const [dragOffset, setDragOffset] = useState<number | null>(null)
  const dragRef = useRef<{ startY: number; samples: { y: number; t: number }[] } | null>(null)
  // La hoja monta escondida y sube al siguiente frame: sin ese frame intermedio
  // el navegador no ve el cambio de posición y no anima la entrada.
  const [entered, setEntered] = useState(false)

  // Get the parent container's height instead of window to avoid bottom nav bar overlap,
  // but use window.innerHeight as an initial fallback to prevent full-screen flash on first render.
  const [maxSheetHeight, setMaxSheetHeight] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight - 72 : 0,
  )
  const [compactSheetHeight, setCompactSheetHeight] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight * 0.35 : 0,
  )
  const [peekSheetHeight, setPeekSheetHeight] = useState(() =>
    typeof window !== 'undefined' && peekRatio ? window.innerHeight * peekRatio : 0,
  )
  const containerRef = useRef<HTMLElement>(null)

  const [sheetHeight, setSheetHeight] = useState(0)
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateDimensions = () => {
      const parent = containerRef.current?.parentElement
      const h = parent ? parent.clientHeight : window.innerHeight
      const topOffset = 72
      setMaxSheetHeight(h - topOffset)
      setCompactSheetHeight(h * 0.35)
      if (peekRatio) setPeekSheetHeight(h * peekRatio)
    }

    updateDimensions()

    const parentObserver = new ResizeObserver(updateDimensions)
    if (containerRef.current?.parentElement) {
      parentObserver.observe(containerRef.current.parentElement)
    }
    window.addEventListener('resize', updateDimensions)

    return () => {
      parentObserver.disconnect()
      window.removeEventListener('resize', updateDimensions)
    }
  }, [peekRatio])

  // Measure the actual height of the sheet to avoid empty space
  useEffect(() => {
    if (!innerRef.current) return
    const sheetObserver = new ResizeObserver((entries) => {
      setSheetHeight(entries[0].borderBoxSize[0]?.blockSize || entries[0].contentRect.height)
    })
    sheetObserver.observe(innerRef.current)
    return () => sheetObserver.disconnect()
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const expandedY = 0
  const measured = sheetHeight || maxSheetHeight
  const compactY = Math.max(0, measured - compactSheetHeight)
  const peekY = Math.max(0, measured - peekSheetHeight)

  const stops: SheetStop[] = peekRatio ? ['peek', 'compact', 'expanded'] : ['compact', 'expanded']
  const yOf: Record<SheetStop, number> = { peek: peekY, compact: compactY, expanded: expandedY }
  const isExpanded = stop === 'expanded'

  /** Un paso hacia arriba o hacia abajo. Desde el más bajo, hacia abajo, cierra. */
  const step = (direction: 1 | -1) => {
    const index = stops.indexOf(stop)
    const next = index + direction
    if (next < 0) {
      onClose()
      return
    }
    setStop(stops[Math.min(next, stops.length - 1)])
  }

  const VELOCITY_THRESHOLD = 200 // px/s
  const OFFSET_THRESHOLD = 80 // px

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, samples: [{ y: e.clientY, t: e.timeStamp }] }
    setDragOffset(0)
  }

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    drag.samples.push({ y: e.clientY, t: e.timeStamp })
    // Solo los últimos ~100 ms cuentan para la velocidad del gesto.
    while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > 100) drag.samples.shift()
    setDragOffset(e.clientY - drag.startY)
  }

  const handleDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setDragOffset(null)
    const offset = e.clientY - drag.startY
    const first = drag.samples[0]
    const dt = (e.timeStamp - first.t) / 1000
    const velocity = dt > 0 ? (e.clientY - first.y) / dt : 0

    if (velocity > VELOCITY_THRESHOLD || offset > OFFSET_THRESHOLD) {
      step(-1)
    } else if (velocity < -VELOCITY_THRESHOLD || offset < -OFFSET_THRESHOLD) {
      step(1)
    }
    // Un arrastre que no llega al umbral no cambia de punto: la hoja vuelve
    // sola al que estaba. Antes se decidía por el signo del desplazamiento, y
    // un roce de dos píxeles al scrollear la plegaba.
  }

  const hiddenY = measured + 100
  const fallbackY: Record<SheetStop, number> = { peek: 600, compact: 500, expanded: 0 }
  const restY = !isOpen || !entered ? hiddenY : yOf[stop] || fallbackY[stop]
  let y = restY
  if (dragOffset !== null) {
    y = restY + dragOffset
    // Por encima del expandido cede poco, como un tope elástico.
    if (y < expandedY) y = expandedY + (y - expandedY) * 0.15
  }

  return (
    <aside
      ref={containerRef}
      aria-label={ariaLabel}
      aria-hidden={!isOpen || undefined}
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[400px] ${className}`}
      style={{
        height: 'auto',
        transform: `translateY(${y}px)`,
        transition: dragOffset === null ? 'transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)' : 'none',
        maxHeight: maxSheetHeight || '100%',
        // `pan-x` y no `none`. Con `none` el navegador desactiva TODO gesto
        // táctil dentro de la hoja, y eso se llevaba por delante el
        // desplazamiento horizontal de los chips de edificio: en el teléfono no
        // había forma de llegar al último. `touch-action` de un ancestro no se
        // puede reactivar desde dentro —se aplica la intersección—, así que
        // tiene que aflojarse aquí.
        //
        // Sigue bloqueando el gesto VERTICAL, que es lo que se quería evitar:
        // que arrastrar la hoja plegada mueva la página por detrás.
        touchAction: !isExpanded ? 'pan-x' : 'auto',
      }}
    >
      <div
        ref={innerRef}
        className="pointer-events-auto w-full flex flex-col rounded-t-[32px] border-t border-[#E5DEC9] bg-[#FAF8F5] shadow-[0_-14px_38px_rgba(28,25,23,0.10)] sm:rounded-[32px] sm:border dark:border-white/10 dark:bg-[#151820] overflow-hidden max-h-full"
      >
        {/* Drag Handle */}
        <div
          className="w-full flex justify-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="w-12 h-1.5 rounded-full bg-stone-300 dark:bg-stone-700 pointer-events-none" />
        </div>

        {/* Content wrapper */}
        <div
          className={`flex-1 no-scrollbar ${!isExpanded && !isDesktop ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'}`}
          onPointerDown={(e) => {
            // Allow scrolling without dragging the sheet if expanded or on desktop
            if (isExpanded || isDesktop) {
              e.stopPropagation()
            }
          }}
        >
          <SheetStateContext.Provider value={{ isExpanded, isDesktop }}>
            {children}
          </SheetStateContext.Provider>
        </div>
      </div>
    </aside>
  )
}
