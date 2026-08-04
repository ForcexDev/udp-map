/**
 * En qué momento de su vida está un evento.
 *
 * Vive aparte de expiry.ts a propósito: `expiryState` responde "¿este pin
 * sigue existiendo?" y esto responde "¿está pasando ahora?". Antes el mapa
 * mezclaba las dos y un evento a punto de terminar parpadeaba como si acabara
 * de empezar.
 */
export type EventPhase = 'unscheduled' | 'upcoming' | 'live' | 'ended'

export function eventPhase(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: number = Date.now(),
): EventPhase {
  if (!startsAt) return 'unscheduled'

  const start = new Date(startsAt).getTime()
  if (Number.isNaN(start)) return 'unscheduled'
  if (now < start) return 'upcoming'

  if (endsAt) {
    const end = new Date(endsAt).getTime()
    if (!Number.isNaN(end) && now >= end) return 'ended'
  }

  return 'live'
}

export function isEventLive(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  return eventPhase(startsAt, endsAt, now) === 'live'
}

/**
 * ¿Cae el evento dentro del día indicado? Un evento de varios días cuenta en
 * todos ellos, no solo en el que empieza.
 */
export function eventTouchesDay(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  day: Date,
): boolean {
  if (!startsAt) return false
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime()
  const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1

  const start = new Date(startsAt).getTime()
  if (Number.isNaN(start)) return false
  const end = endsAt ? new Date(endsAt).getTime() : start

  return start <= dayEnd && (Number.isNaN(end) ? start : end) >= dayStart
}
