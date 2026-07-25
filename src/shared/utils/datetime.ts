interface RelativeTime {
  direction: 'past' | 'future'
  unit: 'minute' | 'hour' | 'day'
  value: number
}

/** Descompone una diferencia de tiempo para traducirla en la UI (time.* en i18n). */
export function relativeTime(target: string | number | Date, now: number = Date.now()): RelativeTime {
  const t = new Date(target).getTime()
  const diff = t - now
  const abs = Math.abs(diff)
  const direction = diff >= 0 ? 'future' : 'past'
  const minutes = Math.round(abs / 60_000)
  if (minutes < 60) return { direction, unit: 'minute', value: Math.max(minutes, 1) }
  const hours = Math.round(minutes / 60)
  if (hours < 24) return { direction, unit: 'hour', value: hours }
  return { direction, unit: 'day', value: Math.round(hours / 24) }
}
