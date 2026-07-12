import { useState } from 'react'
import type { ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin, Check, Mic, Sparkles, Trophy, GraduationCap, Tent } from 'lucide-react'
import type { Pin, EventRsvp } from '@/shared/types/database'
import { categoryById } from '@/shared/data/campusData'

interface EventCalendarProps {
  events: Pin[]
  userRSVPs: EventRsvp[]
  onRSVPChange: (pinId: string, status: 'going' | 'interested' | null) => void
  onSelectEvent: (pin: Pin) => void
}

const EVENT_ICONS: Record<string, ElementType> = {
  charla: Mic,
  fiesta: Sparkles,
  'deporte-evento': Trophy,
  ayudantia: GraduationCap,
  feria: Tent,
}

export function EventCalendar({ events, userRSVPs, onRSVPChange, onSelectEvent }: EventCalendarProps) {
  const { t } = useTranslation()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay()

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  // Check if a day has events
  const getEventsForDay = (day: number) => {
    return events.filter((e) => {
      if (!e.starts_at) return false
      const eDate = new Date(e.starts_at)
      return (
        eDate.getDate() === day &&
        eDate.getMonth() === month &&
        eDate.getFullYear() === year
      )
    })
  }

  const selectedDayEvents = selectedDate
    ? events.filter((e) => {
        if (!e.starts_at) return false
        const eDate = new Date(e.starts_at)
        return (
          eDate.getDate() === selectedDate.getDate() &&
          eDate.getMonth() === selectedDate.getMonth() &&
          eDate.getFullYear() === selectedDate.getFullYear()
        )
      })
    : events

  const formatMonthName = (date: Date) => {
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-6xl mx-auto p-4">
      {/* Calendar Area */}
      <div className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold capitalize text-neutral-900 dark:text-white">
            {formatMonthName(currentDate)}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
            <span key={i} className="text-[11px] font-black text-neutral-400 dark:text-neutral-500 uppercase">
              {d}
            </span>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {/* Empty spaces for offset */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {/* Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dayEvents = getEventsForDay(day)
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
                onClick={() => setSelectedDate(new Date(year, month, day))}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-2xl text-sm font-semibold transition-all ${
                  isSelected
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-md'
                    : isToday
                    ? 'bg-[#D41F2D]/10 text-[#D41F2D] border border-[#D41F2D]/20'
                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                <span className={dayEvents.length > 0 ? '-translate-y-0.5' : ''}>{day}</span>
                {dayEvents.length > 0 && (
                  <span
                    className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${
                      isSelected
                        ? 'bg-white dark:bg-neutral-900'
                        : 'bg-[#D41F2D]'
                    }`}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Events List Area */}
      <div className="w-full lg:w-96 flex flex-col gap-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="font-bold text-neutral-900 dark:text-white">
            {selectedDate
              ? t('events.onDate', { date: selectedDate.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) })
              : t('events.upcoming')}
          </h3>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs font-semibold text-[#D41F2D] hover:underline"
            >
              {t('events.showAll', 'Ver todos')}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto max-h-[400px] lg:max-h-[500px] flex flex-col gap-3 pr-1">
          {selectedDayEvents.length === 0 ? (
            <div className="bg-neutral-50 dark:bg-neutral-900/50 rounded-3xl border border-neutral-100 dark:border-neutral-800/80 p-8 text-center text-neutral-400 dark:text-neutral-500 flex flex-col items-center gap-2">
              <CalendarIcon size={32} strokeWidth={1.5} />
              <p className="text-sm font-medium">{t('events.noEvents', 'No hay eventos programados')}</p>
            </div>
          ) : (
            selectedDayEvents.map((event) => {
              const cat = categoryById(event.category_id)
              const Icon = cat ? (EVENT_ICONS[cat.id] ?? CalendarIcon) : CalendarIcon
              const rsvp = userRSVPs.find((r) => r.pin_id === event.id)
              const userStatus = rsvp?.status ?? null

              return (
                <div
                  key={event.id}
                  className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => onSelectEvent(event)}
                      className="text-left font-bold text-[15px] leading-snug text-neutral-900 dark:text-white hover:text-[#D41F2D] transition-colors flex items-start gap-2.5"
                    >
                      <Icon size={16} className="mt-0.5 shrink-0" style={{ color: cat?.color }} />
                      <span>{event.title}</span>
                    </button>
                    {event.is_official && (
                      <span className="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex-shrink-0">
                        {t('events.official', 'Oficial')}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                    {event.starts_at && (
                      <div className="flex items-center gap-1.5">
                        <Clock size={14} className="flex-shrink-0" />
                        <span>
                          {new Date(event.starts_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          {event.ends_at && ` - ${new Date(event.ends_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                      </div>
                    )}
                    {event.faculty_id && (
                      <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="flex-shrink-0" />
                        <span className="capitalize">{event.faculty_id}</span>
                      </div>
                    )}
                  </div>

                  {/* RSVP buttons */}
                  <div className="flex gap-2 mt-1 border-t border-neutral-100 dark:border-neutral-800 pt-3">
                    <button
                      onClick={() => onRSVPChange(event.id, userStatus === 'going' ? null : 'going')}
                      className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        userStatus === 'going'
                          ? 'bg-[#D41F2D] text-white shadow-sm'
                          : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {userStatus === 'going' && <Check size={12} />}
                      {t('events.rsvpGoing', 'Asistiré')}
                    </button>
                    <button
                      onClick={() => onRSVPChange(event.id, userStatus === 'interested' ? null : 'interested')}
                      className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        userStatus === 'interested'
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm'
                          : 'bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {userStatus === 'interested' && <Check size={12} />}
                      {t('events.rsvpInterested', 'Me interesa')}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
