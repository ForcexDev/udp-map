import { localizedName } from '@/shared/utils/localized'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, CalendarCheck, Check, MapPin, Star } from 'lucide-react'
import type { Pin } from '@/shared/types/database'
import { FACULTIES } from '@/shared/data/campusData'
import { eventPhase } from '@/shared/utils/eventState'

// ─────────────────────────────────────────────────────────────────────────────
// "Mis eventos".
//
// ROADMAP §13.1, punto 2: hasta ahora pulsar "Asistiré" guardaba una fila y no
// cambiaba NADA en pantalla salvo el propio botón. Un botón que no deja rastro
// en ningún sitio tuyo se siente como que no hizo nada, y esa era la queja.
//
// Se parte en "por venir" y "ya pasaron" y no en una lista sola porque lo que
// se viene a mirar aquí es lo primero: qué tengo esta semana. Lo pasado se
// queda porque responde la otra pregunta que uno se hace —"¿fui a eso?"— y
// borrarlo no ahorraría nada.
// ─────────────────────────────────────────────────────────────────────────────

export interface MyEvent {
  pin: Pin
  status: 'going' | 'interested' | null
}

interface MyEventsListProps {
  events: MyEvent[]
  loading: boolean
  onViewOnMap: (pin: Pin) => void
}

/** Cuándo ocurre, en una línea. Sin año si es de este. */
function whenLabel(pin: Pin): string {
  const iso = pin.starts_at ?? pin.created_at
  const date = new Date(iso)
  const esteAno = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(esteAno ? {} : { year: 'numeric' }),
  })
}

export function MyEventsList({ events, loading, onViewOnMap }: MyEventsListProps) {
  const { t } = useTranslation()
  const now = Date.now()

  const { proximos, pasados } = useMemo(() => {
    const proximos: MyEvent[] = []
    const pasados: MyEvent[] = []
    for (const item of events) {
      // `eventPhase` es la misma regla que usa la agenda de Eventos. No se
      // reimplementa aquí: si cambia qué cuenta como "terminado", cambia en un
      // sitio y las dos pantallas siguen de acuerdo.
      const fase = eventPhase(item.pin.starts_at, item.pin.ends_at, now)
      if (fase === 'ended') pasados.push(item)
      else proximos.push(item)
    }
    const porFecha = (a: MyEvent, b: MyEvent) =>
      new Date(a.pin.starts_at ?? 0).getTime() - new Date(b.pin.starts_at ?? 0).getTime()
    return {
      proximos: proximos.sort(porFecha),
      // Los pasados al revés: lo más reciente primero, que es lo que se busca.
      pasados: pasados.sort((a, b) => porFecha(b, a)),
    }
  }, [events, now])

  if (loading) {
    return (
      <p className="px-5 py-8 text-center text-sm font-semibold text-neutral-400">
        {t('common.loading', 'Cargando…')}
      </p>
    )
  }

  if (events.length === 0) {
    return (
      <div className="mx-5 flex flex-col items-center gap-2 rounded-3xl border border-dashed border-neutral-200 p-10 text-center dark:border-neutral-800">
        <CalendarDays size={34} strokeWidth={1.5} className="text-neutral-300 dark:text-neutral-700" />
        <p className="mt-1 font-bold text-neutral-700 dark:text-neutral-300">
          {t('profile.noEvents', 'Todavía no marcaste ningún evento')}
        </p>
        <p className="max-w-[18rem] text-xs font-medium leading-relaxed text-neutral-400">
          {t('profile.noEventsHint', 'Cuando marques “Asistiré” o “Me interesa” en Eventos, aparecerán aquí.')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 px-5">
      {proximos.length > 0 && (
        <Section
          title={t('profile.eventsUpcoming', 'Por venir')}
          events={proximos}
          onViewOnMap={onViewOnMap}
          now={now}
        />
      )}
      {pasados.length > 0 && (
        <Section
          title={t('profile.eventsPast', 'Ya pasaron')}
          events={pasados}
          onViewOnMap={onViewOnMap}
          now={now}
          faded
        />
      )}
    </div>
  )
}

function Section({
  title,
  events,
  onViewOnMap,
  now,
  faded,
}: {
  title: string
  events: MyEvent[]
  onViewOnMap: (pin: Pin) => void
  now: number
  faded?: boolean
}) {
  const { t, i18n } = useTranslation()

  return (
    <section>
      <h3 className="mb-2.5 text-[11px] font-black uppercase tracking-widest text-neutral-400">
        {title}
      </h3>
      <ul className={`m-0 flex list-none flex-col gap-2 p-0 ${faded ? 'opacity-60' : ''}`}>
        {events.map(({ pin, status }) => {
          const faculty = pin.faculty_id ? FACULTIES.find((f) => f.id === pin.faculty_id) : null
          const live = eventPhase(pin.starts_at, pin.ends_at, now) === 'live'
          return (
            <li key={pin.id}>
              <button
                type="button"
                onClick={() => onViewOnMap(pin)}
                className="flex w-full cursor-pointer items-start gap-3 rounded-3xl border border-neutral-200 bg-white p-3.5 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-900"
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                    status === 'going'
                      ? 'bg-red-50 text-[#D41F2D] dark:bg-red-950/30'
                      : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                  }`}
                >
                  {status === 'going' ? <CalendarCheck size={18} /> : <Star size={18} />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="min-w-0 truncate text-sm font-extrabold text-neutral-900 dark:text-white">
                      {pin.title}
                    </span>
                    {live && (
                      <span className="shrink-0 rounded-full bg-[#D41F2D] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white">
                        {t('events.live', 'En vivo')}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    {whenLabel(pin)}
                    {faculty && ` · ${localizedName(faculty, i18n.language)}`}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-[11px] font-bold text-neutral-400">
                    {status === 'going' ? <Check size={11} /> : <Star size={11} />}
                    {status === 'going'
                      ? t('events.rsvpGoing', 'Asistiré')
                      : t('events.rsvpInterested', 'Me interesa')}
                  </span>
                </span>

                <MapPin size={15} className="mt-1 shrink-0 text-neutral-300 dark:text-neutral-600" />
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
