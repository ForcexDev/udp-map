import { motion } from 'framer-motion'
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
  const [isExpanded, setIsExpanded] = useState(false)

  // Get the parent container's height instead of window to avoid bottom nav bar overlap,
  // but use window.innerHeight as an initial fallback to prevent full-screen flash on first render.
  const [maxSheetHeight, setMaxSheetHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight - 72 : 0)
  const [compactSheetHeight, setCompactSheetHeight] = useState(() => typeof window !== 'undefined' ? window.innerHeight * 0.35 : 0)
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const updateDimensions = () => {
      // Use parent if available, otherwise fallback to window
      const parent = containerRef.current?.parentElement
      const h = parent ? parent.clientHeight : window.innerHeight
      const topOffset = 72 // space for search bar
      setMaxSheetHeight(h - topOffset)
      setCompactSheetHeight(h * 0.35) // 35% of container
    }
    
    updateDimensions()
    
    const observer = new ResizeObserver(updateDimensions)
    if (containerRef.current?.parentElement) {
      observer.observe(containerRef.current.parentElement)
    }
    
    // Fallback resize listener for window
    window.addEventListener('resize', updateDimensions)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])
  
  // y values for framer motion (0 means fully expanded to maxSheetHeight)
  const expandedY = 0
  const compactY = maxSheetHeight - compactSheetHeight

  const handleDragEnd = (_event: any, info: PanInfo) => {
    const velocityThreshold = 200
    const offsetThreshold = 80
    const velocityY = info.velocity.y
    const offsetY = info.offset.y

    if (velocityY < -velocityThreshold || offsetY < -offsetThreshold) {
      // Dragged up
      setIsExpanded(true)
    } else if (velocityY > velocityThreshold || offsetY > offsetThreshold) {
      // Dragged down
      if (isExpanded) {
        setIsExpanded(false)
      } else {
        onClose()
      }
    }
    // If no threshold is met, Framer Motion automatically snaps back to the current 'animate' state
  }

  if (!isOpen) return null

  return (
    <motion.aside
      ref={containerRef}
      aria-label={ariaLabel}
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[400px] ${className}`}
      initial="hidden"
      animate={isExpanded ? 'expanded' : 'compact'}
      variants={{
        hidden: { y: maxSheetHeight || 1000 },
        compact: { y: compactY || 500 },
        expanded: { y: expandedY }
      }}
      transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.8, bounce: 0 }}
      drag="y"
      dragConstraints={{ top: expandedY, bottom: maxSheetHeight }}
      dragElastic={0.15}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      style={{
        height: maxSheetHeight || '100%',
        touchAction: !isExpanded ? 'none' : 'auto'
      }}
    >
      <div className="pointer-events-auto w-full h-full flex flex-col rounded-t-[32px] glass-hud shadow-[0_-8px_32px_rgba(0,0,0,0.15)] sm:rounded-[32px] overflow-hidden">
        {/* Drag Handle */}
        <div 
          className="w-full flex justify-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
        >
          <div className="w-12 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
        </div>

        {/* Content wrapper */}
        <div 
          className={`flex-1 no-scrollbar ${!isExpanded ? 'overflow-hidden' : 'overflow-y-auto overscroll-contain'}`}
          onPointerDown={(e) => {
            // If expanded, allow scrolling without dragging the sheet from the content
            if (isExpanded) {
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
