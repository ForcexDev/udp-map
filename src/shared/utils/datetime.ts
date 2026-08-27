interface RelativeTime {
  direction: 'past' | 'future'
  unit: 'minute' | 'hour' | 'day'
  value: number
}

/**
 * La clave de i18n que le toca a una diferencia ya descompuesta.
 *
 * Existe porque el singular de los días se escapaba en tres sitios a la vez:
 * `time.inDays` es "en {{n}} días" sin forma singular, así que un evento que
 * empieza mañana decía **"en 1 días"**. Minutos y horas no la necesitan porque
 * abrevian la unidad —"en 1 min", "hace 1 h"— y ahí el singular no se nota.
 *
 * Va aquí y no en cada componente para que el próximo que pinte un tiempo
 * relativo no tenga que volver a acordarse.
 */
export function relativeTimeKey({ direction, unit, value }: RelativeTime): string {
  const prefix = direction === 'future' ? 'in' : 'ago'
  if (unit === 'day') return `time.${prefix}${value === 1 ? 'Day' : 'Days'}`
  return `time.${prefix}${unit === 'minute' ? 'Minutes' : 'Hours'}`
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
