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
  Users,
} from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { categoryById, FACULTIES } from '@/shared/data/campusData'
import { eventPhase } from '@/shared/utils/eventState'
import { RSVP_PUBLIC_THRESHOLD, type EventRsvpCount } from './api'

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
  /** Conteo agregado del evento. Ausente mientras la consulta va en camino. */
  rsvpCount?: EventRsvpCount
  /** Quien lo creó ve el número siempre y puede abrir la lista de nombres. */
  isOrganizer: boolean
  onSelect: (pin: Pin) => void
  onRSVPChange: (pinId: string, status: 'going' | 'interested' | null) => void
  onShowAttendees: (pin: Pin) => void
}

export function EventCard({
  event,
  userStatus,
  scheduleCount,
  now,
  rsvpCount,
  isOrganizer,
  onSelect,
  onRSVPChange,
  onShowAttendees,
}: EventCardProps) {
  const { t, i18n } = useTranslation()

  const cat = categoryById(event.category_id)
  const Icon = cat ? (EVENT_ICONS[cat.id] ?? CalendarIcon) : CalendarIcon
  const phase = eventPhase(event.starts_at, event.ends_at, now)

  const faculty = event.faculty_id ? FACULTIES.find((f) => f.id === event.faculty_id) : null
  const facultyName = faculty ? (i18n.language === 'en' ? faculty.name_en : faculty.name) : null

  // Quien organiza ve el número exacto siempre, porque para preparar algo el 2
  // también sirve. En público hay un umbral: a la escala de la UDP van a
  // abundar los eventos con números bajos, y "2 personas van" dice "esto no le
  // importa a nadie" mucho más fuerte que no decir nada. Ver RSVP_PUBLIC_THRESHOLD.
  const totalRsvp = (rsvpCount?.going ?? 0) + (rsvpCount?.interested ?? 0)
  const showRsvp = isOrganizer ? totalRsvp > 0 : totalRsvp >= RSVP_PUBLIC_THRESHOLD

  // 24 h, igual que la píldora de fecha del detalle del pin. Con 12 h, es-CL
  // devuelve "10:00 a. m. - 02:00 p. m." y ocupa dos líneas.
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false })

  return (
    <div
      onClick={() => onSelect(event)}
      className={`group flex cursor-pointer flex-col gap-3 rounded-2xl border bg-white p-4 shadow-xs transition-all hover:shadow-md dark:bg-[#1E222D] ${
        phase === 'live'
          ? 'border-[#C22B38]/40 ring-1 ring-[#C22B38]/20 dark:border-[#D93846]/40 dark:ring-[#D93846]/20'
          : 'border-[#E6E0D5] dark:border-white/[0.07]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <Icon size={16} className="mt-0.5 shrink-0" style={{ color: cat?.color }} />
          <h3 className="m-0 text-left text-[15px] font-bold leading-snug text-stone-900 transition-colors group-hover:text-[#C22B38] dark:text-stone-100 dark:group-hover:text-[#D93846]">
            {event.title}
          </h3>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {phase === 'live' && (
            <span className="flex items-center gap-1.5 rounded-xl border border-[#F2D0CE] bg-[#FBECEB] px-2.5 py-0.5 text-xs font-semibold text-[#B02330] dark:border-[#D93846]/30 dark:bg-[#D93846]/15 dark:text-rose-300">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C22B38] dark:bg-[#D93846] animate-pulse" />
              {t('events.live', 'En vivo')}
            </span>
          )}
          {event.is_official && (
            <span className="rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-400">
              {t('events.official', 'Oficial')}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
        {event.starts_at && (
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="shrink-0" />
            <span className="tabular-nums">
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
        {showRsvp && (
          <div className="flex items-center gap-1.5">
            <Users size={14} className="shrink-0" />
            {isOrganizer ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onShowAttendees(event)
                }}
                className="cursor-pointer font-semibold text-[#C22B38] hover:underline dark:text-[#D93846]"
              >
                {t('events.attendeesGoing', {
                  count: rsvpCount?.going ?? 0,
                  defaultValue: `${rsvpCount?.going ?? 0} van`,
                })}
                {(rsvpCount?.interested ?? 0) > 0 &&
                  ` · ${t('events.attendeesInterested', {
                    count: rsvpCount?.interested ?? 0,
                    defaultValue: `${rsvpCount?.interested ?? 0} interesados`,
                  })}`}
              </button>
            ) : (
              <span>
                {t('events.attendeesPublic', {
                  count: totalRsvp,
                  defaultValue: `${totalRsvp} personas apuntadas`,
                })}
              </span>
            )}
          </div>
        )}
        {scheduleCount > 0 && (
          <div className="flex items-center gap-1.5">
            <CalendarClock size={14} className="shrink-0" />
            <span>
              {t('pin.schedule', 'Programa')} ·{' '}
              {t('pin.scheduleBlocks', {
                count: scheduleCount,
                defaultValue: `${scheduleCount} bloques`,
              })}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-2 border-t border-[#E5DEC9] pt-3 dark:border-white/10">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRSVPChange(event.id, userStatus === 'going' ? null : 'going')
          }}
          className={`flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all ${
            userStatus === 'going'
              ? 'bg-[#C22B38] text-white shadow-xs dark:bg-[#D93846]'
              : 'bg-[#EFECE4] text-stone-700 hover:bg-[#e6e2d8] dark:bg-white/[0.08] dark:text-stone-200 dark:hover:bg-white/[0.12]'
          }`}
        >
          {userStatus === 'going' && <Check size={14} />}
          {t('events.rsvpGoing', 'Asistiré')}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRSVPChange(event.id, userStatus === 'interested' ? null : 'interested')
          }}
          className={`flex h-9 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-all ${
            userStatus === 'interested'
              ? 'bg-stone-900 text-[#FAF8F5] shadow-xs dark:bg-stone-100 dark:text-stone-950'
              : 'bg-[#EFECE4] text-stone-700 hover:bg-[#e6e2d8] dark:bg-white/[0.08] dark:text-stone-200 dark:hover:bg-white/[0.12]'
          }`}
        >
          {userStatus === 'interested' && <Check size={14} />}
          {t('events.rsvpInterested', 'Me interesa')}
        </button>
      </div>
    </div>
  )
}
