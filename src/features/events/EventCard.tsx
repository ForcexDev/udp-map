import type { ElementType } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Calendar as CalendarIcon,
  CalendarClock,
  Check,
  Clock,
  GraduationCap,
  Mic,
  MapPin,
  Sparkles,
  Tent,
  Trophy,
} from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { categoryById, FACULTIES } from '@/shared/data/campusData'
import { eventPhase } from '@/shared/utils/eventState'

const EVENT_ICONS: Record<string, ElementType> = {
  charla: Mic,
  fiesta: Sparkles,
  'deporte-evento': Trophy,
  ayudantia: GraduationCap,
  feria: Tent,
}

interface EventCardProps {
  event: Pin
  userStatus: 'going' | 'interested' | null
  scheduleCount: number
  now: number
  onSelect: (pin: Pin) => void
  onRSVPChange: (pinId: string, status: 'going' | 'interested' | null) => void
}

export function EventCard({ event, userStatus, scheduleCount, now, onSelect, onRSVPChange }: EventCardProps) {
  const { t, i18n } = useTranslation()

  const cat = categoryById(event.category_id)
  const Icon = cat ? (EVENT_ICONS[cat.id] ?? CalendarIcon) : CalendarIcon
  const phase = eventPhase(event.starts_at, event.ends_at, now)

  const faculty = event.faculty_id ? FACULTIES.find((f) => f.id === event.faculty_id) : null
  const facultyName = faculty ? (i18n.language === 'en' ? faculty.name_en : faculty.name) : null

  // 24 h, igual que la píldora de fecha del detalle del pin. Con 12 h, es-CL
  // devuelve "10:00 a. m. - 02:00 p. m." y ocupa dos líneas.
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div
      onClick={() => onSelect(event)}
      className={`group bg-white dark:bg-neutral-900 border rounded-3xl p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        phase === 'live'
          ? 'border-[#D41F2D]/40 ring-1 ring-[#D41F2D]/20'
          : 'border-neutral-200 dark:border-neutral-800'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <Icon size={16} className="mt-0.5 shrink-0" style={{ color: cat?.color }} />
          <h3 className="m-0 text-left text-[15px] font-extrabold leading-snug text-neutral-900 dark:text-white group-hover:text-[#D41F2D] transition-colors">
            {event.title}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {phase === 'live' && (
            <span className="flex items-center gap-1.5 rounded-full bg-[#D41F2D] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
              {t('events.live', 'En vivo')}
            </span>
          )}
          {event.is_official && (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              {t('events.official', 'Oficial')}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {event.starts_at && (
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="shrink-0" />
            <span>
              {time(event.starts_at)}
              {event.ends_at && ` - ${time(event.ends_at)}`}
            </span>
          </div>
        )}
        {facultyName && (
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="shrink-0" />
            <span className="truncate">{facultyName}</span>
          </div>
        )}
        {scheduleCount > 0 && (
          <div className="flex items-center gap-1.5">
            <CalendarClock size={14} className="shrink-0" />
            <span>
              {t('pin.schedule', 'Programa')} ·{' '}
              {t('pin.scheduleBlocks', { count: scheduleCount, defaultValue: `${scheduleCount} bloques` })}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-neutral-100 dark:border-neutral-800 pt-3">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRSVPChange(event.id, userStatus === 'going' ? null : 'going')
          }}
          className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all ${
            userStatus === 'going'
              ? 'bg-[#D41F2D] text-white shadow-sm'
              : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
          }`}
        >
          {userStatus === 'going' && <Check size={12} />}
          {t('events.rsvpGoing', 'Asistiré')}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRSVPChange(event.id, userStatus === 'interested' ? null : 'interested')
          }}
          className={`flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-xs font-bold transition-all ${
            userStatus === 'interested'
              ? 'bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900'
              : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
          }`}
        >
          {userStatus === 'interested' && <Check size={12} />}
          {t('events.rsvpInterested', 'Me interesa')}
        </button>
      </div>
    </div>
  )
}
