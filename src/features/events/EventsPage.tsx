import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, CalendarX2, Plus, Radio, X } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { usePins } from '@/features/pins/usePins'
import { fetchScheduleCounts } from '@/features/pins/api'
import { useUserRSVPs, useSetRSVP, useEventRsvpCounts } from './useEvents'
import { useGuard } from '@/features/auth/useGuard'
import { useNowTick } from '@/shared/lib/useNowTick'
import { eventPhase, eventTouchesDay } from '@/shared/utils/eventState'
import { EventCard } from './EventCard'
import { EventCalendarDialog } from './EventCalendarDialog'
import { EventAttendeesDialog } from './EventAttendeesDialog'
import { useAuthStore } from '@/features/auth/authStore'

import type { Pin } from '@/shared/types/database'

type Range = 'today' | 'week' | 'month' | 'all'

const DAY_MS = 24 * 60 * 60 * 1000

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

export function EventsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const startPickingLocation = useUIStore((s) => s.startPickingLocation)
  const selectPin = useUIStore((s) => s.selectPin)
  const guard = useGuard()
  const now = useNowTick()

  const { pins, isLoading, error } = usePins()
  const { data: userRSVPs = [] } = useUserRSVPs()
  const rsvpMutation = useSetRSVP()

  const [range, setRange] = useState<Range>('all')
  const [pickedDay, setPickedDay] = useState<Date | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [attendeesOf, setAttendeesOf] = useState<Pin | null>(null)
  const userId = useAuthStore((s) => s.user?.id)

  // usePins ya descarta lo vencido y un evento vence al terminar, así que aquí
  // solo llegan eventos por venir o en curso: no hace falta filtrar el pasado.
  const events = useMemo(
    () =>
      pins
        .filter((p) => p.type === 'event')
        .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? '')),
    [pins],
  )

  const eventIds = useMemo(() => events.map((e) => e.id).sort(), [events])
  const { data: scheduleCounts = {} } = useQuery({
    queryKey: ['schedule-counts', eventIds],
    queryFn: () => fetchScheduleCounts(eventIds),
    enabled: eventIds.length > 0,
  })
  const { data: rsvpCounts = {} } = useEventRsvpCounts(eventIds)

  useEffect(() => {
    const linkedEventId = searchParams.get('event')
    if (!linkedEventId || isLoading) return
    const linkedEvent = events.find((event) => event.id === linkedEventId)
    if (linkedEvent) {
      selectPin(linkedEvent.id)
      navigate(`/mapa?pin=${linkedEvent.id}`, { replace: true })
    }
  }, [events, isLoading, navigate, searchParams, selectPin])

  const handleCreateEvent = () => {
    if (!guard('pin.create.event')) return
    startPickingLocation('event')
    navigate('/mapa')
  }

  const handleSelectEvent = (event: Pin) => {
    selectPin(event.id)
    navigate('/mapa')
  }

  const handleRSVPChange = (pinId: string, status: 'going' | 'interested' | null) => {
    rsvpMutation.mutate({ pinId, status })
  }

  const liveEvents = useMemo(
    () => events.filter((e) => eventPhase(e.starts_at, e.ends_at, now) === 'live'),
    [events, now],
  )

  // Lo que está en vivo ya tiene su franja arriba; repetirlo en la agenda solo
  // pondría la misma tarjeta dos veces en pantalla.
  const upcoming = useMemo(
    () => events.filter((e) => eventPhase(e.starts_at, e.ends_at, now) !== 'live'),
    [events, now],
  )

  const filtered = useMemo(() => {
    if (pickedDay) {
      return upcoming.filter((e) => eventTouchesDay(e.starts_at, e.ends_at, pickedDay))
    }
    if (range === 'all') return upcoming

    const today = new Date(now)
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const limit =
      range === 'today' ? start + DAY_MS : range === 'week' ? start + 7 * DAY_MS : start + 30 * DAY_MS

    return upcoming.filter((e) => {
      if (!e.starts_at) return false
      const s = new Date(e.starts_at).getTime()
      const end = e.ends_at ? new Date(e.ends_at).getTime() : s
      return s < limit && end >= start
    })
  }, [upcoming, range, pickedDay, now])

  // Agrupado por día de inicio. Un evento de varios días se anuncia el día que
  // empieza; anunciarlo en todos llenaría la agenda de repeticiones.
  const groups = useMemo(() => {
    const map = new Map<string, { date: Date; items: Pin[] }>()
    for (const event of filtered) {
      if (!event.starts_at) continue
      const d = new Date(event.starts_at)
      const key = dayKey(d)
      const group = map.get(key)
      if (group) {
        group.items.push(event)
      } else {
        map.set(key, { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), items: [event] })
      }
    }
    return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [filtered])

  const groupLabel = (date: Date) => {
    const today = new Date(now)
    if (sameDay(date, today)) return t('events.today', 'Hoy')
    if (sameDay(date, new Date(now + DAY_MS))) return t('events.tomorrow', 'Mañana')
    return date.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-CL', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    })
  }

  const rsvpOf = (pinId: string) => userRSVPs.find((r) => r.pin_id === pinId)?.status ?? null

  const RANGES: { id: Range; label: string }[] = [
    { id: 'today', label: t('events.rangeToday', 'Hoy') },
    { id: 'week', label: t('events.rangeWeek', 'Esta semana') },
    { id: 'month', label: t('events.rangeMonth', 'Este mes') },
    { id: 'all', label: t('events.rangeAll', 'Todos') },
  ]

  return (
    <div className="h-full overflow-y-auto bg-[#FAF8F5] pb-16 dark:bg-[#151820]">
      <div className="mx-auto w-full max-w-3xl px-4 pt-safe-page">
        {/* Cabecera */}
        <div className="mb-5 flex flex-col gap-4 border-b border-[#E5DEC9] pb-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="pr-2">
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
              {t('events.title', 'Eventos')}
            </h1>
            <p className="mt-1 text-xs font-medium text-stone-500 dark:text-stone-400">
              {t('events.subtitle', 'Descubre y asiste a las actividades de los campus UDP')}
            </p>
          </div>
          <button
            onClick={handleCreateEvent}
            className="flex w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-[#C22B38] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#a8242f] active:scale-95 sm:w-auto dark:bg-[#D93846] dark:hover:bg-[#c22b38]"
          >
            <Plus size={16} />
            {t('events.createEvent', 'Crear Evento')}
          </button>
        </div>

        {isLoading && (
          <div className="flex h-64 items-center justify-center text-sm font-semibold text-stone-500">
            {t('common.loading')}
          </div>
        )}

        {error && (
          <div className="flex h-64 items-center justify-center text-sm font-semibold text-red-500">
            {t('common.error')}
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* Marcar asistencia NO es anónimo: quien organiza abre "Quién va" y
                ve nombre y avatar de cada persona, en las dos listas. Hay que
                decirlo, pero UNA vez: puesto en cada tarjeta —como estaba— se
                repetía tantas veces como eventos hubiera y dejaba de leerse. */}
            {userId && (
              <p className="mb-4 rounded-2xl bg-[#EFECE4] px-4 py-2.5 text-xs font-medium leading-snug text-stone-600 dark:bg-white/[0.08] dark:text-stone-300">
                {t('events.rsvpVisibility', 'Al marcar “Asistiré” o “Me interesa”, quien organiza el evento verá tu nombre.')}
              </p>
            )}

            {/* En vivo: lo primero, porque es lo único accionable ahora mismo */}
            {liveEvents.length > 0 && (
              <section className="mb-5">
                <h2 className="mb-2.5 flex items-center gap-2 text-xs font-bold text-[#C22B38] dark:text-[#D93846]">
                  <Radio size={14} />
                  {t('events.liveNow', 'En vivo ahora')}
                </h2>
                <div className="flex flex-col gap-3">
                  {liveEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      userStatus={rsvpOf(event.id)}
                      scheduleCount={scheduleCounts[event.id] ?? 0}
                      now={now}
                      rsvpCount={rsvpCounts[event.id]}
                      isOrganizer={Boolean(userId) && event.creator_id === userId}
                      onSelect={handleSelectEvent}
                      onRSVPChange={handleRSVPChange}
                      onShowAttendees={setAttendeesOf}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Filtros: el calendario dejó de ocupar media pantalla y pasó a ser
                lo que aporta de verdad, un salto a una fecha concreta.

                El botón del calendario va FUERA del contenedor que scrollea:
                dentro, las píldoras lo empujaban fuera de pantalla en móvil y
                quedaba inalcanzable. */}
            <div className="mb-5 flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
                {pickedDay ? (
                  <button
                    onClick={() => setPickedDay(null)}
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-[#FAF8F5] shadow-xs dark:bg-stone-100 dark:text-stone-950"
                  >
                    {pickedDay.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'es-CL', {
                      day: 'numeric',
                      month: 'short',
                    })}
                    <X size={13} />
                  </button>
                ) : (
                  RANGES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setRange(r.id)}
                      className={`shrink-0 cursor-pointer rounded-2xl px-3.5 py-2 text-xs font-semibold transition-all ${
                        range === r.id
                          ? 'bg-[#C22B38] text-white shadow-xs dark:bg-[#D93846]'
                          : 'border border-[#E6E0D5] bg-white text-stone-600 hover:bg-[#FAF8F5] dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-300 dark:hover:bg-white/[0.04]'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={() => setCalendarOpen(true)}
                aria-label={t('events.goToDate', 'Ir a una fecha')}
                title={t('events.goToDate', 'Ir a una fecha')}
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-2xl border border-[#E6E0D5] bg-white text-stone-600 transition-colors hover:bg-[#FAF8F5] dark:border-white/[0.07] dark:bg-[#1E222D] dark:text-stone-300 dark:hover:bg-white/[0.04] sm:w-auto sm:px-3.5 sm:text-xs sm:font-semibold"
              >
                <CalendarDays size={16} />
                <span className="hidden sm:inline">{t('events.goToDate', 'Ir a una fecha')}</span>
              </button>
            </div>

            {/* Agenda */}
            {groups.length === 0 ? (
              <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-2 rounded-3xl border border-[#E6E0D5] bg-white p-12 text-center shadow-xs dark:border-white/[0.07] dark:bg-[#1E222D]">
                <CalendarX2 size={40} strokeWidth={1.5} className="text-stone-400 dark:text-stone-600" />
                <h3 className="mt-2 text-base font-bold text-stone-800 dark:text-stone-200">
                  {t('events.noEventsTitle', 'No hay eventos por aquí')}
                </h3>
                <p className="text-xs font-medium text-stone-500 dark:text-stone-400">
                  {pickedDay || range !== 'all'
                    ? t('events.noEventsInRange', 'Prueba con otro rango de fechas.')
                    : t('events.noEventsDesc', '¡Crea el primero y aparecerá en el mapa!')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {groups.map((group) => (
                  <section key={dayKey(group.date)}>
                    <h2 className="sticky top-0 z-10 -mx-4 mb-2.5 bg-[#FAF8F5]/90 px-4 py-1.5 text-xs font-bold text-stone-500 backdrop-blur-md dark:bg-[#151820]/90 dark:text-stone-400">
                      {groupLabel(group.date)}
                    </h2>
                    <div className="flex flex-col gap-3">
                      {group.items.map((event) => (
                        <EventCard
                          key={event.id}
                          event={event}
                          userStatus={rsvpOf(event.id)}
                          scheduleCount={scheduleCounts[event.id] ?? 0}
                          now={now}
                          rsvpCount={rsvpCounts[event.id]}
                          isOrganizer={Boolean(userId) && event.creator_id === userId}
                          onSelect={handleSelectEvent}
                          onRSVPChange={handleRSVPChange}
                          onShowAttendees={setAttendeesOf}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <EventCalendarDialog
        open={calendarOpen}
        onOpenChange={setCalendarOpen}
        events={events}
        selectedDay={pickedDay}
        onSelectDay={setPickedDay}
      />

      <EventAttendeesDialog
        pinId={attendeesOf?.id ?? null}
        eventTitle={attendeesOf?.title ?? ''}
        onClose={() => setAttendeesOf(null)}
      />
    </div>
  )
}
