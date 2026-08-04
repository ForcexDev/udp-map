import { useEffect, useRef, useState } from 'react'
import { Check, Clock, X } from 'lucide-react'

interface CustomTimePickerProps {
  /** 'HH:mm', o cadena vacía si aún no hay hora. */
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  /** Ofrece "sin hora" — para una hora de término opcional. */
  clearable?: boolean
  error?: boolean
  align?: 'left' | 'right'
}

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

/** Conserva un minuto guardado que no caiga en la rejilla de 5 (p. ej. 10:07). */
function minuteOptions(current: string): string[] {
  if (!current || MINUTES.includes(current)) return MINUTES
  return [...MINUTES, current].sort()
}

const COLUMN = 'flex-1 max-h-[168px] overflow-y-auto hide-scrollbar flex flex-col gap-0.5 pr-0.5'
const OPTION = 'h-8 shrink-0 rounded-lg text-xs font-bold tabular-nums transition-all cursor-pointer'

/**
 * Selector de hora con panel propio, hermano de CustomDateTimePicker.
 *
 * Ni `<input type="time">` ni `<select>` sirven aquí: en ambos el desplegable
 * lo dibuja el navegador y no admite CSS, así que aparecía una lista de sistema
 * que no se parecía a nada del resto de UDP Map. La única salida es no usar el
 * desplegable nativo y pintar el panel a mano, que es lo que ya hacía el
 * selector de fecha.
 */
export function CustomTimePicker({
  value,
  onChange,
  label,
  placeholder = '--:--',
  clearable = false,
  error = false,
  align = 'left',
}: CustomTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const hourRef = useRef<HTMLButtonElement>(null)
  const minuteRef = useRef<HTMLButtonElement>(null)

  const [hour = '', minute = ''] = value ? value.split(':') : []

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Abrir en 22:00 y ver la lista desde las 00 obliga a buscar a mano.
  useEffect(() => {
    if (!isOpen) return
    hourRef.current?.scrollIntoView({ block: 'center' })
    minuteRef.current?.scrollIntoView({ block: 'center' })
  }, [isOpen])

  const pickHour = (h: string) => onChange(`${h}:${minute || '00'}`)
  const pickMinute = (m: string) => onChange(`${hour || '00'}:${m}`)

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={label}
        aria-expanded={isOpen}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold shadow-sm outline-none transition-all ${
          error
            ? 'border-red-500 bg-red-50/50 text-red-900 dark:bg-red-950/30 dark:text-red-200'
            : isOpen
              ? 'border-[#D41F2D] bg-white ring-4 ring-red-500/10 dark:bg-neutral-900'
              : 'border-neutral-200 bg-neutral-50/80 hover:border-neutral-300 dark:border-neutral-700/80 dark:bg-neutral-800/80'
        }`}
      >
        <Clock size={14} className={value ? 'shrink-0 text-[#D41F2D]' : 'shrink-0 text-neutral-400'} />
        <span
          className={`tabular-nums ${
            value ? 'font-bold text-neutral-900 dark:text-white' : 'text-neutral-400'
          }`}
        >
          {value || placeholder}
        </span>
      </button>

      {isOpen && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-50 mt-2 w-[188px] animate-scale-in rounded-2xl border border-neutral-200 bg-white p-3 shadow-2xl dark:border-neutral-700/80 dark:bg-neutral-900`}
        >
          <div className="mb-2 flex gap-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
            <span className="flex-1">Hora</span>
            <span className="flex-1">Min</span>
          </div>

          <div className="flex gap-2">
            <div className={COLUMN}>
              {HOURS.map((h) => {
                const selected = h === hour
                return (
                  <button
                    key={h}
                    ref={selected ? hourRef : undefined}
                    type="button"
                    onClick={() => pickHour(h)}
                    className={`${OPTION} ${
                      selected
                        ? 'bg-[#D41F2D] font-extrabold text-white shadow-sm'
                        : 'text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {h}
                  </button>
                )
              })}
            </div>

            <div className={COLUMN}>
              {minuteOptions(minute).map((m) => {
                const selected = m === minute
                return (
                  <button
                    key={m}
                    ref={selected ? minuteRef : undefined}
                    type="button"
                    onClick={() => pickMinute(m)}
                    className={`${OPTION} ${
                      selected
                        ? 'bg-[#D41F2D] font-extrabold text-white shadow-sm'
                        : 'text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'
                    }`}
                  >
                    {m}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            {clearable && (
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setIsOpen(false)
                }}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-neutral-100 py-1.5 text-[10px] font-bold text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
              >
                <X size={12} /> Sin hora
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#D41F2D] py-1.5 text-[10px] font-bold text-white transition-colors hover:bg-[#b11a25]"
            >
              <Check size={12} /> Listo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
