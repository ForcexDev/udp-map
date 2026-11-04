import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search } from 'lucide-react'

interface CustomSelectOption {
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
  /**
   * Añade un buscador dentro del menú. Se activa a mano y no por número de
   * opciones: un buscador que aparece solo cuando la lista crece cambia de
   * forma sin avisar, y con tres opciones estorba más de lo que ayuda.
   */
  searchable?: boolean
  searchPlaceholder?: string
}

/** Sin tildes y en minúsculas: "psicologia" tiene que encontrar "Psicología". */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder,
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  searchable = false,
  searchPlaceholder = 'Buscar…',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuStyle, setMenuStyle] = useState<{
    top: number
    left: number
    width: number
    openUp: boolean
  } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  const visibleOptions = useMemo(() => {
    if (!searchable || !query.trim()) return options
    const q = normalize(query.trim())
    return options.filter((opt) => normalize(opt.label).includes(q))
  }, [options, query, searchable])

  // La búsqueda se descarta al cerrar. Reabrir el menú y encontrarlo filtrado
  // por lo que escribiste hace tres minutos se lee como que faltan opciones.
  useEffect(() => {
    if (!isOpen) setQuery('')
  }, [isOpen])

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
        containerRef.current &&
        !containerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
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
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Botón Desplegable Principal */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-w-0 flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-2xl border border-[#E6E0D5] bg-white text-xs sm:text-sm font-semibold text-stone-900 outline-none transition-all cursor-pointer shadow-xs active:scale-[0.99] hover:bg-[#FAF8F5] focus:border-[#C22B38] dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-100 dark:hover:bg-[#252A37] dark:focus:border-[#D93846] ${buttonClassName}`}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selectedOption?.icon}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder || 'Seleccionar...'}
          </span>
        </span>
        <ChevronDown
          size={15}
          className={`text-stone-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#C22B38] dark:text-[#D93846]' : ''}`}
        />
      </button>

      {/* Menú Flotante Personalizado — portal a <body> para no recortarse contra modales con overflow */}
      {isOpen &&
        menuStyle &&
        createPortal(
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
            // z-[4520]: tiene que ganarle al Overlay (z-4500) y al Content
            // (z-4510) de Radix Dialog. Con z-50 el menú quedaba pintado DETRÁS
            // del overlay cuando el CustomSelect vivía dentro de un modal
            // (ProfileSetupModal), así que "no dejaba seleccionar la facultad".
            className={`z-[4520] max-h-60 overflow-y-auto bg-white dark:bg-[#1E222D] border border-[#E6E0D5] dark:border-white/[0.09] rounded-2xl premium-shadow p-1.5 animate-scale-in hide-scrollbar ${dropdownClassName}`}
          >
            {searchable && (
              // `sticky` y no fuera del contenedor con scroll: así el campo se
              // queda a la vista mientras recorres una lista larga.
              <div className="sticky top-0 z-10 -m-1.5 mb-1 border-b border-[#E6E0D5] bg-white p-2 dark:border-white/[0.07] dark:bg-[#1E222D]">
                <div className="flex items-center gap-2 rounded-xl bg-[#EFECE4] px-2.5 py-1.5 dark:bg-white/[0.08]">
                  <Search size={13} className="shrink-0 text-stone-400 dark:text-stone-500" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter elige la primera coincidencia: escribir "psico" y
                      // pulsar Enter es el gesto que espera quien ya sabe cuál
                      // quiere y no viene a mirar la lista.
                      if (e.key !== 'Enter') return
                      e.preventDefault()
                      const first = visibleOptions[0]
                      if (!first) return
                      onChange(first.value)
                      setIsOpen(false)
                    }}
                    placeholder={searchPlaceholder}
                    className="w-full min-w-0 bg-transparent text-xs font-semibold text-stone-900 outline-none placeholder:font-normal placeholder:text-stone-400 dark:text-stone-100 dark:placeholder:text-stone-500"
                  />
                </div>
              </div>
            )}

            {visibleOptions.length === 0 && (
              <p className="px-3 py-4 text-center text-xs font-medium text-stone-400 dark:text-stone-500">
                Nada coincide con «{query.trim()}».
              </p>
            )}

            {visibleOptions.map((option) => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setIsOpen(false)
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer my-0.5 ${
                    isSelected
                      ? 'bg-[#C22B38] text-white shadow-xs dark:bg-[#D93846]'
                      : 'text-stone-700 dark:text-stone-200 hover:bg-[#EFECE4] dark:hover:bg-white/[0.08]'
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
