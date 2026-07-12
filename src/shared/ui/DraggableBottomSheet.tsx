import { motion, useDragControls } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import type { ReactNode } from 'react'

interface DraggableBottomSheetProps {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
  className?: string
  ariaLabel?: string
}

export function DraggableBottomSheet({
  children,
  isOpen,
  onClose,
  className = '',
  ariaLabel,
}: DraggableBottomSheetProps) {
  const isDesktop = typeof window !== 'undefined' ? window.innerWidth >= 640 : false
  const [isExpanded, setIsExpanded] = useState(isDesktop)
  const dragControls = useDragControls()

  // Get the parent container's height instead of window to avoid bottom nav bar overlap,
  // but use window.innerHeight as an initial fallback to prevent full-screen flash on first render.
  const [maxSheetHeight, setMaxSheetHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight - 72 : 0)
  const [compactSheetHeight, setCompactSheetHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight * 0.35 : 0)
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
  }, [])

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
  const compactY = Math.max(0, (sheetHeight || maxSheetHeight) - compactSheetHeight)

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    const velocityThreshold = 200
    const offsetThreshold = 80
    
    if (info.velocity.y > velocityThreshold || info.offset.y > offsetThreshold) {
      if (isExpanded) {
        setIsExpanded(false)
      } else {
        onClose()
      }
    } else if (info.velocity.y < -velocityThreshold || info.offset.y < -offsetThreshold) {
      setIsExpanded(true)
    } else {
      setIsExpanded(info.offset.y < 0)
    }
  }

  if (!isOpen) return null

  return (
    <motion.aside
      ref={containerRef}
      aria-label={ariaLabel}
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[400px] ${className}`}
      initial="hidden"
      animate={isExpanded ? 'expanded' : 'compact'}
      exit="hidden"
      variants={{
        hidden: { y: (sheetHeight || maxSheetHeight) + 100 },
        compact: { y: compactY || 500 },
        expanded: { y: expandedY }
      }}
      transition={{ type: 'tween', ease: [0.25, 1, 0.5, 1], duration: 0.4 }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: expandedY, bottom: compactY > 0 ? compactY + 800 : 800 }}
      dragElastic={0.15}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      style={{
        height: 'auto',
        maxHeight: maxSheetHeight || '100%',
        touchAction: !isExpanded ? 'none' : 'auto'
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
          {children}
        </div>
      </div>
    </motion.aside>
  )
}
