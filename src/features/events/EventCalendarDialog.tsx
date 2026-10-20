import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog } from '@/shared/ui/Dialog'
import type { Pin } from '@/shared/types/database'
import { eventTouchesDay } from '@/shared/utils/eventState'

interface EventCalendarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  events: Pin[]
  selectedDay: Date | null
  onSelectDay: (day: Date) => void
}

const WEEKDAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/**
 * El calendario dejó de ser la vista principal de Eventos y pasó a ser lo que
 * de verdad aporta: un salto a una fecha concreta. La agenda responde "qué hay
 * pronto" sin que nadie tenga que mirar un mes vacío.
 */
export function EventCalendarDialog({
  open,
  onOpenChange,
  events,
  selectedDay,
  onSelectDay,
}: EventCalendarDialogProps) {
  const { t, i18n } = useTranslation()
  const [cursor, setCursor] = useState(() => selectedDay ?? new Date())

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const today = new Date()

  // Un solo recorrido por mes en vez de uno por casilla.
  const daysWithEvents = useMemo(() => {
    const set = new Set<number>()
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      if (events.some((e) => eventTouchesDay(e.starts_at, e.ends_at, date))) set.add(day)
    }
    return set
  }, [events, year, month, daysInMonth])

  const monthName = cursor.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-CL', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('events.goToDate', 'Ir a una fecha')}
      contentClassName="!bg-white dark:!bg-[#1E222D] border border-[#E6E0D5] dark:border-white/[0.07] sm:max-w-sm rounded-3xl"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="m-0 text-base font-bold capitalize text-stone-900 dark:text-stone-100">{monthName}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label={t('events.prevMonth', 'Mes anterior')}
            className="cursor-pointer rounded-xl p-2 text-stone-600 transition-colors hover:bg-[#EFECE4] dark:text-stone-300 dark:hover:bg-white/[0.08]"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label={t('events.nextMonth', 'Mes siguiente')}
            className="cursor-pointer rounded-xl p-2 text-stone-600 transition-colors hover:bg-[#EFECE4] dark:text-stone-300 dark:hover:bg-white/[0.08]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-xs font-semibold text-stone-400 dark:text-stone-500">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const date = new Date(year, month, day)
          const isSelected = selectedDay ? sameDay(date, selectedDay) : false
          const isToday = sameDay(date, today)

          return (
            <button
              key={day}
              onClick={() => {
                onSelectDay(date)
                onOpenChange(false)
              }}
              className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl text-xs font-semibold tabular-nums transition-all ${
                isSelected
                  ? 'bg-stone-900 text-[#FAF8F5] shadow-xs dark:bg-stone-100 dark:text-stone-950'
                  : isToday
                    ? 'border border-[#F2D0CE] bg-[#FBECEB] text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300'
                    : 'text-stone-700 hover:bg-[#EFECE4] dark:text-stone-300 dark:hover:bg-white/[0.08]'
              }`}
            >
              <span className={daysWithEvents.has(day) ? '-translate-y-0.5' : ''}>{day}</span>
              {daysWithEvents.has(day) && (
                <span
                  className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                    isSelected ? 'bg-white dark:bg-stone-950' : 'bg-[#C22B38] dark:bg-[#D93846]'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>
    </Dialog>
  )
}
