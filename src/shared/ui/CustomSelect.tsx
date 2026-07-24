import { useState, useRef, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export interface CustomSelectOption {
  value: string
  label: string
  icon?: ReactNode
}

interface CustomSelectProps {
  options: CustomSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  buttonClassName?: string
  dropdownClassName?: string
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  // El botón vive dentro de modales con overflow-y-auto: un menú `absolute`
  // se recorta contra ese borde. Portal a <body> + posición `fixed` calculada
  // desde el botón lo saca de ese contenedor y lo deja siempre visible.
  //
  // La posición se calcula UNA sola vez al abrir y el menú se queda quieto: en
  // móvil, tocar una opción hace que iOS colapse la barra de direcciones y
  // dispare `resize`/`scroll`. Si movíamos o cerrábamos el menú con esos eventos,
  // el `click` sintético caía sobre la opción de abajo (o el elemento de atrás):
  // por eso "no dejaba seleccionar y elegía la de abajo". Un menú inmóvil hace
  // que el dedo siempre dé en la opción que se ve.
  useEffect(() => {
    if (!isOpen || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const menuHeight = 240 // max-h-60
    const openUp = rect.bottom + menuHeight > window.innerHeight && rect.top > menuHeight
    setMenuStyle({
      top: openUp ? rect.top : rect.bottom,
      left: rect.left,
      width: rect.width,
      openUp,
    })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    function handlePointerOutside(e: Event) {
      const target = e.target as Node
      if (
        containerRef.current && !containerRef.current.contains(target)
        && menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    // pointerdown cubre mouse y touch (a diferencia de mousedown, que en táctil
    // llega con retardo/sintético). NO escuchamos scroll/resize: mover o cerrar
    // el menú por esos eventos es justo lo que rompía la selección táctil.
    document.addEventListener('pointerdown', handlePointerOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // El menú está portaleado a <body>, FUERA del Content de Radix Dialog. Radix
  // mete dos barreras a nivel `document` que golpean a cualquier cosa fuera del
  // Content:
  //   1. DismissableLayer: escucha pointerdown/focus y cierra el modal al ver un
  //      evento "afuera" ANTES de que corra el onClick de la opción.
  //   2. react-remove-scroll: escucha wheel/touchmove y hace preventDefault a
  //      todo scroll fuera del Content, así el menú no scrollea.
  // Ambas escuchan en fase de burbujeo sobre `document`. Cortamos la propagación
  // nativa de esos eventos en el nodo del menú: nunca llegan a `document`, así
  // Radix no los ve. El modal no se cierra Y el menú vuelve a scrollear.
  // Escuchamos sobre el nodo real (no vía React) porque el portal a <body> queda
  // fuera del árbol DOM donde React delega sus eventos.
  useEffect(() => {
    const node = menuRef.current
    if (!isOpen || !node) return
    const stop = (e: Event) => e.stopPropagation()
    const events = ['pointerdown', 'mousedown', 'focusin', 'wheel', 'touchmove'] as const
    events.forEach((name) => node.addEventListener(name, stop))
    return () => events.forEach((name) => node.removeEventListener(name, stop))
  }, [isOpen, menuStyle])

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {/* Botón Desplegable Principal */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700/80 bg-neutral-50 dark:bg-neutral-800/80 text-xs sm:text-sm font-semibold text-neutral-900 dark:text-white outline-none focus:border-[#D41F2D] transition-all cursor-pointer shadow-sm active:scale-[0.99] ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder || 'Seleccionar...'}</span>
        </span>
        <ChevronDown
          size={15}
          className={`text-neutral-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#D41F2D]' : ''}`}
        />
      </button>

      {/* Menú Flotante Personalizado — portal a <body> para no recortarse contra modales con overflow */}
      {isOpen && menuStyle && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: menuStyle.openUp ? undefined : menuStyle.top + 4,
            bottom: menuStyle.openUp ? window.innerHeight - menuStyle.top + 4 : undefined,
            left: menuStyle.left,
            width: menuStyle.width,
            // Radix Dialog (modal) apaga los pointer-events del <body> y solo los
            // reactiva dentro de su Content. Como el menú vive en <body> (portal),
            // sin esto heredaría pointer-events:none y los clicks lo ATRAVESARÍAN
            // hacia el elemento de atrás — el famoso "selecciona el de abajo".
            pointerEvents: 'auto',
          }}
          className={`z-50 max-h-60 overflow-y-auto bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700/80 rounded-xl shadow-2xl p-1.5 animate-scale-in hide-scrollbar ${dropdownClassName}`}
        >
          {options.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left cursor-pointer my-0.5 ${
                  isSelected
                    ? 'bg-[#D41F2D] text-white shadow-sm'
                    : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {option.icon}
                  <span className="truncate">{option.label}</span>
                </span>
                {isSelected && <Check size={14} className="shrink-0" />}
              </button>
            )
          })}
        </div>,
        document.body,
      )}
    </div>
  )
}
