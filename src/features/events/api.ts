import { supabase } from '@/shared/lib/supabase'
import type { EventRsvp } from '@/shared/types/database'

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
