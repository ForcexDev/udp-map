import { motion, useDragControls } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
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
  const dragControls = useDragControls()

  // Get the parent container's height instead of window to avoid bottom nav bar overlap,
  // but use window.innerHeight as an initial fallback to prevent full-screen flash on first render.
  const [maxSheetHeight, setMaxSheetHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight - 72 : 0)
  const [compactSheetHeight, setCompactSheetHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight * 0.35 : 0)
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

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    const velocityThreshold = 200
    const offsetThreshold = 80

    if (info.velocity.y > velocityThreshold || info.offset.y > offsetThreshold) {
      step(-1)
    } else if (info.velocity.y < -velocityThreshold || info.offset.y < -offsetThreshold) {
      step(1)
    }
    // Un arrastre que no llega al umbral no cambia de punto: la hoja vuelve
    // sola al que estaba. Antes se decidía por el signo del desplazamiento, y
    // un roce de dos píxeles al scrollear la plegaba.
  }

  if (!isOpen) return null

  const lowestY = yOf[stops[0]]

  return (
    <motion.aside
      ref={containerRef}
      aria-label={ariaLabel}
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[400px] ${className}`}
      initial="hidden"
      animate={stop}
      exit="hidden"
      variants={{
        hidden: { y: measured + 100 },
        peek: { y: peekY || 600 },
        compact: { y: compactY || 500 },
        expanded: { y: expandedY },
      }}
      transition={{ type: 'tween', ease: [0.25, 1, 0.5, 1], duration: 0.4 }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: expandedY, bottom: lowestY > 0 ? lowestY + 800 : 800 }}
      dragElastic={0.15}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      style={{
        height: 'auto',
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
        touchAction: !isExpanded ? 'pan-x' : 'auto'
      }}
    >
      <div
        ref={innerRef}
        className="pointer-events-auto w-full flex flex-col rounded-t-[32px] glass-hud shadow-[0_-8px_32px_rgba(0,0,0,0.15)] sm:rounded-[32px] overflow-hidden max-h-full"
      >
        {/* Drag Handle */}
        <div
          className="w-full flex justify-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600 pointer-events-none" />
        </div>

        {/* Content wrapper */}
        <div
          className={`flex-1 no-scrollbar ${(!isExpanded && !isDesktop) ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'}`}
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
    </motion.aside>
  )
}
