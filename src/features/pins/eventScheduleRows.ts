import type { PinScheduleDraft, PinScheduleItem } from '@/shared/types/database'

export const MAX_SCHEDULE_ITEMS = 20

/** Una fila tal como se edita: día e "hora de pared" separados del ISO. */
export interface ScheduleRow {
  key: string
  /** 'YYYY-MM-DD' */
  day: string
  /** 'HH:mm' */
  start: string
  /** 'HH:mm' — opcional */
  end: string
  title: string
  subtitle: string
}

const pad = (n: number) => String(n).padStart(2, '0')

export function emptyRow(day: string): ScheduleRow {
  return { key: crypto.randomUUID(), day, start: '', end: '', title: '', subtitle: '' }
}

/** 'YYYY-MM-DD' + 'HH:mm' → ISO, interpretado en la zona del navegador. */
export function toIso(day: string, time: string): string | null {
  if (!day || !time) return null
  const d = new Date(`${day}T${time}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function localDay(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function localTime(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Filas guardadas → filas editables. */
export function rowsFromItems(items: PinScheduleItem[]): ScheduleRow[] {
  return items.map((item) => ({
    key: item.id,
    day: localDay(item.starts_at),
    start: localTime(item.starts_at),
    end: item.ends_at ? localTime(item.ends_at) : '',
    title: item.title,
    subtitle: item.subtitle ?? '',
  }))
}

/** Filas editables → lo que va a la base. Descarta filas a medio llenar. */
export function draftsFromRows(rows: ScheduleRow[]): PinScheduleDraft[] {
  return rows
    .filter((r) => r.title.trim() && r.day && r.start)
    .map((r) => ({
      starts_at: toIso(r.day, r.start) as string,
      ends_at: r.end ? toIso(r.day, r.end) : null,
      title: r.title.trim(),
      subtitle: r.subtitle.trim() || null,
      sort_order: 0,
    }))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .map((item, i) => ({ ...item, sort_order: i }))
}

/**
 * Valida contra el rango del evento. Devuelve el mensaje del primer problema,
 * o null. Se valida al enviar y no por tecla: a medio escribir una hora casi
 * siempre está "mal" y avisar en ese momento es ruido.
 */
export function validateRows(
  rows: ScheduleRow[],
  eventStartIso: string | null,
  eventEndIso: string | null,
): string | null {
  const filled = rows.filter((r) => r.title.trim() || r.start || r.subtitle.trim())
  if (filled.length === 0) return null
  if (filled.length > MAX_SCHEDULE_ITEMS) {
    return `El programa admite hasta ${MAX_SCHEDULE_ITEMS} bloques.`
  }

  for (const row of filled) {
    if (!row.title.trim()) return 'Cada bloque del programa necesita un título.'
    if (!row.start) return `Falta la hora de inicio de "${row.title.trim()}".`

    const startIso = toIso(row.day, row.start)
    if (!startIso) return `La hora de "${row.title.trim()}" no es válida.`

    if (row.end) {
      const endIso = toIso(row.day, row.end)
      if (!endIso) return `La hora de término de "${row.title.trim()}" no es válida.`
      if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
        return `En "${row.title.trim()}" el término va antes que el inicio.`
      }
    }

    // Un bloque fuera del evento casi siempre es un error de tipeo (la hora
    // correcta con el día equivocado), y quedaría invisible en la interfaz.
    if (eventStartIso && eventEndIso) {
      const t = new Date(startIso).getTime()
      if (t < new Date(eventStartIso).getTime() || t > new Date(eventEndIso).getTime()) {
        return `"${row.title.trim()}" queda fuera del horario del evento.`
      }
    }
  }
  return null
}

/** Los días que abarca el evento, para el selector de las filas. */
export function daysBetween(startLocal: string, endLocal: string): string[] {
  if (!startLocal) return []
  const start = new Date(startLocal)
  const end = endLocal ? new Date(endLocal) : start
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []

  const days: string[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  // Tope defensivo: un evento de un año no debe generar 365 opciones.
  while (cursor <= last && days.length < 31) {
    days.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}
