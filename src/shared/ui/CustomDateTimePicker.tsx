import { useState, useRef, useEffect } from 'react'
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, Check } from 'lucide-react'

interface CustomDateTimePickerProps {
  value: string // Formato ISO local o YYYY-MM-DDTHH:mm
  onChange: (val: string) => void
  placeholder?: string
  error?: boolean
  className?: string
  align?: 'left' | 'right'
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]
const DAY_SHORT_NAMES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']

export function CustomDateTimePicker({
  value,
  onChange,
  placeholder = 'Seleccionar fecha y hora...',
  error = false,
  className = '',
  align = 'left',
}: CustomDateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Parse current date or fallback to now
  const parsedDate = value ? new Date(value) : new Date()
  const isValidDate = value && !isNaN(parsedDate.getTime())

  const [viewDate, setViewDate] = useState<Date>(isValidDate ? parsedDate : new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(isValidDate ? parsedDate : null)
  
  // Time states (24h)
  const [hours, setHours] = useState<number>(isValidDate ? parsedDate.getHours() : 12)
  const [minutes, setMinutes] = useState<number>(isValidDate ? parsedDate.getMinutes() : 0)

  useEffect(() => {
    if (value) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        setSelectedDate(d)
        setViewDate(d)
        setHours(d.getHours())
        setMinutes(d.getMinutes())
      }
    }
  }, [value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // Calendar calculations
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1))
  }

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1))
  }

  const updateDateTime = (newDate: Date, newHours: number, newMinutes: number) => {
    const d = new Date(newDate)
    d.setHours(newHours, newMinutes, 0, 0)

    // Formatear a YYYY-MM-DDTHH:mm para compatibilidad con datetime-local
    const yearStr = d.getFullYear()
    const monthStr = String(d.getMonth() + 1).padStart(2, '0')
    const dayStr = String(d.getDate()).padStart(2, '0')
    const hoursStr = String(d.getHours()).padStart(2, '0')
    const minutesStr = String(d.getMinutes()).padStart(2, '0')

    const formatted = `${yearStr}-${monthStr}-${dayStr}T${hoursStr}:${minutesStr}`
    onChange(formatted)
  }

  const handleDaySelect = (day: number) => {
    const newDate = new Date(year, month, day)
    setSelectedDate(newDate)
    updateDateTime(newDate, hours, minutes)
  }

  const handleQuickSelect = (offsetDays: number) => {
    const target = new Date()
    target.setDate(target.getDate() + offsetDays)
    setSelectedDate(target)
    setViewDate(target)
    updateDateTime(target, hours, minutes)
  }

  const handleHourChange = (h: number) => {
    setHours(h)
    if (selectedDate) {
      updateDateTime(selectedDate, h, minutes)
    }
  }

  const handleMinuteChange = (m: number) => {
    setMinutes(m)
    if (selectedDate) {
      updateDateTime(selectedDate, hours, m)
    }
  }

  // Display label formatting
  const formatDisplay = () => {
    if (!selectedDate || isNaN(selectedDate.getTime())) return placeholder
    const dayName = DAY_SHORT_NAMES[selectedDate.getDay()]
    const dayNum = selectedDate.getDate()
    const monthName = MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)
    const hoursStr = String(hours).padStart(2, '0')
    const minutesStr = String(minutes).padStart(2, '0')
    return `${dayName} ${dayNum} ${monthName} ${selectedDate.getFullYear()}, ${hoursStr}:${minutesStr} hrs`
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs text-sm font-semibold outline-none ${
          error
            ? 'border-rose-500 bg-rose-50/50 text-rose-900 dark:bg-rose-950/30 dark:text-rose-200'
            : isOpen
              ? 'border-[#C22B38] ring-4 ring-[#C22B38]/10 bg-white dark:bg-[#1E222D] text-stone-900 dark:text-stone-100 dark:border-[#D93846]'
              : 'border-[#E6E0D5] dark:border-white/[0.07] bg-white dark:bg-[#1E222D] text-stone-800 dark:text-stone-200 hover:border-stone-300 dark:hover:border-white/20'
        }`}
      >
        <span className="flex items-center gap-2.5 truncate">
          <CalendarIcon size={16} className={selectedDate ? 'text-[#C22B38] dark:text-[#D93846]' : 'text-stone-400'} />
          <span className={selectedDate ? 'font-semibold text-stone-900 dark:text-stone-100 tabular-nums' : 'text-stone-400'}>
            {formatDisplay()}
          </span>
        </span>
        <Clock size={15} className="text-stone-400 shrink-0" />
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 z-50 w-full sm:w-[320px] bg-white dark:bg-[#1E222D] border border-[#E6E0D5] dark:border-white/[0.09] rounded-2xl premium-shadow p-4 animate-scale-in`}>
          {/* Header Mes y Año */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#E6E0D5] dark:border-white/[0.07]">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-xl hover:bg-[#EFECE4] dark:hover:bg-white/[0.08] text-stone-600 dark:text-stone-300 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-[#EFECE4] dark:hover:bg-white/[0.08] text-stone-600 dark:text-stone-300 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex items-center justify-between gap-1 mb-3">
            <button
              type="button"
              onClick={() => handleQuickSelect(0)}
              className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-xl bg-[#EFECE4] dark:bg-white/[0.08] text-stone-700 dark:text-stone-300 hover:bg-[#C22B38] hover:text-white dark:hover:bg-[#D93846] transition-all text-center"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(1)}
              className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-xl bg-[#EFECE4] dark:bg-white/[0.08] text-stone-700 dark:text-stone-300 hover:bg-[#C22B38] hover:text-white dark:hover:bg-[#D93846] transition-all text-center"
            >
              Mañana
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelect(7)}
              className="flex-1 py-1.5 px-2 text-xs font-semibold rounded-xl bg-[#EFECE4] dark:bg-white/[0.08] text-stone-700 dark:text-stone-300 hover:bg-[#C22B38] hover:text-white dark:hover:bg-[#D93846] transition-all text-center"
            >
              En 1 sem
            </button>
          </div>

          {/* Días de la semana */}
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-stone-400 dark:text-stone-500 mb-1">
            {DAY_SHORT_NAMES.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Grid de días del mes */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} />
            ))}

            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1
              const isSelected =
                selectedDate &&
                selectedDate.getDate() === day &&
                selectedDate.getMonth() === month &&
                selectedDate.getFullYear() === year

              const isToday =
                new Date().getDate() === day &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDaySelect(day)}
                  className={`h-8 rounded-xl text-xs font-semibold tabular-nums flex items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#C22B38] text-white shadow-xs font-bold scale-105 dark:bg-[#D93846]'
                      : isToday
                        ? 'border border-[#C22B38] text-[#C22B38] dark:border-[#D93846] dark:text-[#D93846] font-bold'
                        : 'text-stone-800 dark:text-stone-200 hover:bg-[#EFECE4] dark:hover:bg-white/[0.08]'
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Selector de Hora y Minutos */}
          <div className="pt-3 border-t border-[#E6E0D5] dark:border-white/[0.07] flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
              <Clock size={14} className="text-[#C22B38] dark:text-[#D93846]" />
              Hora:
            </div>

            <div className="flex items-center gap-2">
              {/* Selector Horas */}
              <select
                value={hours}
                onChange={(e) => handleHourChange(Number(e.target.value))}
                className="bg-[#EFECE4] dark:bg-white/[0.08] border border-[#E6E0D5] dark:border-white/[0.09] rounded-xl px-2 py-1 text-xs font-semibold tabular-nums text-stone-900 dark:text-stone-100 outline-none cursor-pointer"
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, '0')} hrs
                  </option>
                ))}
              </select>

              <span className="font-semibold text-stone-400">:</span>

              {/* Selector Minutos */}
              <select
                value={minutes}
                onChange={(e) => handleMinuteChange(Number(e.target.value))}
                className="bg-[#EFECE4] dark:bg-white/[0.08] border border-[#E6E0D5] dark:border-white/[0.09] rounded-xl px-2 py-1 text-xs font-semibold tabular-nums text-stone-900 dark:text-stone-100 outline-none cursor-pointer"
              >
                {[0, 15, 30, 45].map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')} min
                  </option>
                ))}
              </select>

              {/* Botón Listo */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="ml-1 bg-[#C22B38] hover:bg-[#A82430] dark:bg-[#D93846] dark:hover:bg-[#C22B38] text-white p-1.5 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                <Check size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
