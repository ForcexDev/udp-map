import type { Pin } from '@/shared/types/database'

/** Límite de creación por usuario en un día UTC. */
export const DAILY_PIN_LIMIT = 10

/** Instante exacto en que vuelve a estar disponible la cuota diaria (00:00 UTC). */
export function nextDailyPinReset(now = Date.now()): Date {
  const current = new Date(now)
  return new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth(),
    current.getUTCDate() + 1,
  ))
}

/** Cuenta pines creados por un usuario desde el inicio del día UTC. */
export function countPinsCreatedToday(
  pins: Pick<Pin, 'creator_id' | 'created_at'>[],
  userId: string,
  now = Date.now(),
): number {
  const day = new Date(now).toISOString().slice(0, 10)
  return pins.filter((pin) => pin.creator_id === userId && pin.created_at.slice(0, 10) === day).length
}

export function hasReachedDailyPinLimit(
  pins: Pick<Pin, 'creator_id' | 'created_at'>[],
  userId: string,
  now = Date.now(),
): boolean {
  return countPinsCreatedToday(pins, userId, now) >= DAILY_PIN_LIMIT
}
