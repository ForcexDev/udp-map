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
      contentClassName="!bg-white dark:!bg-neutral-900 sm:max-w-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-black capitalize text-neutral-900 dark:text-white m-0">{monthName}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            aria-label={t('events.prevMonth', 'Mes anterior')}
            className="rounded-xl p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            aria-label={t('events.nextMonth', 'Mes siguiente')}
            className="rounded-xl p-2 text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-[11px] font-black uppercase text-neutral-400">
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
              className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl text-sm font-bold transition-all ${
                isSelected
                  ? 'bg-neutral-900 text-white shadow-md dark:bg-white dark:text-neutral-900'
                  : isToday
                    ? 'border border-[#D41F2D]/20 bg-[#D41F2D]/10 text-[#D41F2D]'
                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
              }`}
            >
              <span className={daysWithEvents.has(day) ? '-translate-y-0.5' : ''}>{day}</span>
              {daysWithEvents.has(day) && (
                <span
                  className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${
                    isSelected ? 'bg-white dark:bg-neutral-900' : 'bg-[#D41F2D]'
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
