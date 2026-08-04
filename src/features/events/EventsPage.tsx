import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarDays, CalendarX2, Plus, Radio, X } from 'lucide-react'
import { useUIStore } from '@/shared/stores/uiStore'
import { usePins } from '@/features/pins/usePins'
import { fetchScheduleCounts } from '@/features/pins/api'
import { useUserRSVPs, useSetRSVP } from './useEvents'
import { useGuard } from '@/features/auth/useGuard'
import { useNowTick } from '@/shared/lib/useNowTick'
import { eventPhase, eventTouchesDay } from '@/shared/utils/eventState'
import { EventCard } from './EventCard'
import { EventCalendarDialog } from './EventCalendarDialog'

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
    <div className="h-full overflow-y-auto bg-neutral-50 dark:bg-neutral-950 pb-16">
      <div className="mx-auto w-full max-w-3xl px-4 pt-safe-page">
        {/* Cabecera */}
        <div className="mb-5 flex flex-col gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="pr-2">
            <h1 className="text-2xl font-black text-neutral-900 dark:text-white">
              {t('events.title', 'Eventos')}
            </h1>
            <p className="mt-1 text-xs font-medium text-neutral-400 dark:text-neutral-500">
              {t('events.subtitle', 'Descubre y asiste a las actividades de los campus UDP')}
            </p>
          </div>
          <button
            onClick={handleCreateEvent}
            className="flex w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#D41F2D] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all hover:bg-[#b11a25] active:scale-95 sm:w-auto"
          >
            <Plus size={16} />
            {t('events.createEvent', 'Crear Evento')}
          </button>
        </div>

        {isLoading && (
          <div className="flex h-64 items-center justify-center text-sm font-semibold text-neutral-500">
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
            {/* En vivo: lo primero, porque es lo único accionable ahora mismo */}
            {liveEvents.length > 0 && (
              <section className="mb-5">
                <h2 className="mb-2.5 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-[#D41F2D]">
                  <Radio size={13} />
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
                      onSelect={handleSelectEvent}
                      onRSVPChange={handleRSVPChange}
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
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-bold text-white dark:bg-white dark:text-neutral-900"
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
                      className={`shrink-0 cursor-pointer rounded-full px-3.5 py-2 text-xs font-bold transition-colors ${
                        range === r.id
                          ? 'bg-[#D41F2D] text-white shadow-sm'
                          : 'border border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800'
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
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 sm:w-auto sm:px-3.5 sm:text-xs sm:font-bold"
              >
                <CalendarDays size={16} />
                <span className="hidden sm:inline">{t('events.goToDate', 'Ir a una fecha')}</span>
              </button>
            </div>

            {/* Agenda */}
            {groups.length === 0 ? (
              <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-2 rounded-3xl border border-neutral-100 bg-white p-12 text-center shadow-sm dark:border-neutral-800/80 dark:bg-neutral-900/50">
                <CalendarX2 size={40} strokeWidth={1.5} className="text-neutral-300 dark:text-neutral-700" />
                <h3 className="mt-2 font-bold text-neutral-700 dark:text-neutral-300">
                  {t('events.noEventsTitle', 'No hay eventos por aquí')}
                </h3>
                <p className="text-xs font-medium text-neutral-400">
                  {pickedDay || range !== 'all'
                    ? t('events.noEventsInRange', 'Prueba con otro rango de fechas.')
                    : t('events.noEventsDesc', '¡Crea el primero y aparecerá en el mapa!')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {groups.map((group) => (
                  <section key={dayKey(group.date)}>
                    <h2 className="sticky top-0 z-10 -mx-4 mb-2.5 bg-neutral-50/90 px-4 py-1.5 text-[11px] font-black uppercase tracking-widest text-neutral-400 backdrop-blur-sm dark:bg-neutral-950/90">
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
                          onSelect={handleSelectEvent}
                          onRSVPChange={handleRSVPChange}
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
    </div>
  )
}
