import { supabase } from '@/shared/lib/supabase'
import type { EventRsvp, Pin } from '@/shared/types/database'
import { demoDb } from '@/features/pins/demoStore'
import { useAuthStore } from '@/features/auth/authStore'

// Local demo database for RSVPs when Supabase is not available
const demoRSVPs = new Map<string, { user_id: string; status: 'going' | 'interested' }[]>()

export async function fetchUserRSVPs(userId: string): Promise<EventRsvp[]> {
  if (!supabase) {
    const list: EventRsvp[] = []
    demoRSVPs.forEach((rsvps, pinId) => {
      const found = rsvps.find((r) => r.user_id === userId)
      if (found) {
        list.push({ pin_id: pinId, user_id: userId, status: found.status })
      }
    })
    return list
  }

  const { data, error } = await supabase
    .from('event_rsvps')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching user RSVPs:', error)
    return []
  }

  return data as EventRsvp[]
}

export async function setRSVP(
  pinId: string,
  userId: string,
  status: 'going' | 'interested' | null,
): Promise<void> {
  if (!supabase) {
    let rsvps = demoRSVPs.get(pinId) ?? []
    rsvps = rsvps.filter((r) => r.user_id !== userId)
    if (status) {
      rsvps.push({ user_id: userId, status })
    }
    demoRSVPs.set(pinId, rsvps)
    return
  }

  if (status === null) {
    const { error } = await supabase
      .from('event_rsvps')
      .delete()
      .eq('pin_id', pinId)
      .eq('user_id', userId)

    if (error) throw error
  } else {
    const { error } = await supabase
      .from('event_rsvps')
      .upsert({ pin_id: pinId, user_id: userId, status })

    if (error) throw error
  }
}

// ── Cuánta gente va ──────────────────────────────────────────────────────────
//
// `event_rsvps` dejó de ser legible el 2026-08-26: quién va a qué evento es
// dato personal. Quedan dos lecturas, y cada una tiene su función en la base
// porque la autorización vive ahí, no aquí.

/** A partir de cuántas confirmaciones se enseña el número en público.
 *
 *  No es privacidad —la base devuelve el conteo exacto a cualquiera—, es
 *  diseño: a la escala de la UDP va a haber muchos eventos con números bajos, y
 *  "2 personas van" dice "esto no le importa a nadie" mucho más fuerte que no
 *  decir nada. A quien organiza se le enseña siempre, porque para preparar algo
 *  el 2 también sirve. */
export const RSVP_PUBLIC_THRESHOLD = 5

export interface EventRsvpCount {
  going: number
  interested: number
}

export interface EventAttendee {
  user_id: string
  name: string | null
  avatar_url: string | null
  status: 'going' | 'interested'
}

/** El conteo agregado de varios eventos de una vez, indexado por pin. */
export async function fetchEventRsvpCounts(
  pinIds: string[],
): Promise<Record<string, EventRsvpCount>> {
  const counts: Record<string, EventRsvpCount> = {}
  if (pinIds.length === 0) return counts

  if (!supabase) {
    pinIds.forEach((pinId) => {
      const rsvps = demoRSVPs.get(pinId) ?? []
      if (rsvps.length === 0) return
      counts[pinId] = {
        going: rsvps.filter((r) => r.status === 'going').length,
        interested: rsvps.filter((r) => r.status === 'interested').length,
      }
    })
    return counts
  }

  const { data, error } = await supabase.rpc('event_rsvp_counts', { p_pin_ids: pinIds })
  if (error) {
    console.error('Error fetching RSVP counts:', error)
    return counts
  }

  for (const row of (data ?? []) as { pin_id: string; going: number; interested: number }[]) {
    counts[row.pin_id] = { going: row.going, interested: row.interested }
  }
  return counts
}

/** Quién va, solo para quien organiza el evento. La base rechaza al resto. */
export async function fetchEventAttendees(pinId: string): Promise<EventAttendee[]> {
  if (!supabase) {
    // En demo solo existen las marcas del propio usuario, así que la lista sale
    // corta a propósito: no hay más gente a la que preguntarle.
    const { user } = useAuthStore.getState()
    return (demoRSVPs.get(pinId) ?? []).map((r) => ({
      user_id: r.user_id,
      name: r.user_id === user?.id ? (user?.name ?? null) : null,
      avatar_url: null,
      status: r.status,
    }))
  }

  const { data, error } = await supabase.rpc('event_attendees', { p_pin_id: pinId })
  if (error) throw error
  return (data ?? []) as EventAttendee[]
}

/**
 * Los eventos concretos que alguien marcó.
 *
 * Consulta acotada por ids y no `usePins`: la del mapa lleva los filtros
 * activos en su `queryKey`, así que "mis eventos" cambiaría según lo que
 * estuviera filtrado en el mapa — que no tiene nada que ver.
 */
export async function fetchEventsByIds(pinIds: string[]): Promise<Pin[]> {
  if (pinIds.length === 0) return []

  if (!supabase) {
    return demoDb.pins.filter((p) => pinIds.includes(p.id))
  }

  const { data, error } = await supabase
    .from('pins')
    .select('*, pin_photos(*)')
    .in('id', pinIds)
  if (error) throw error
  return (data ?? []) as Pin[]
}
