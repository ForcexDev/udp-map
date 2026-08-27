import { supabase } from '@/shared/lib/supabase'
import type { NotificationCategory, NotificationPreference } from '@/shared/types/database'

// ─────────────────────────────────────────────────────────────────────────────
// Qué avisos quiere cada quien.
//
// Antes era todo o nada: o tenías el push activado y te llegaba absolutamente
// todo, o lo apagabas y no te enterabas de nada — ni de que respondieron tu
// hilo. Con ocho tipos de aviso, eso termina en gente apagándolo entero por una
// categoría que no le interesa, que es la peor forma de perder a alguien.
//
// LA AUSENCIA DE FILA ES "SÍ". No se siembra nada: solo existe fila cuando
// alguien cambia algo. Por eso `preferenceFor` devuelve todo en `true` cuando
// no encuentra nada, y no es un caso de error.
// ─────────────────────────────────────────────────────────────────────────────

/** Las categorías que se pueden ajustar. `moderation` NO está: los avisos del
 *  equipo no son silenciables, y ofrecer un interruptor que la base ignora
 *  sería mentir en la interfaz. */
export const TUNABLE_CATEGORIES: NotificationCategory[] = ['pins', 'forum', 'events', 'profile', 'system']

const demoPreferences = new Map<string, NotificationPreference>()

export function preferenceFor(
  preferences: NotificationPreference[],
  category: NotificationCategory,
): NotificationPreference {
  return preferences.find((p) => p.category === category)
    ?? { category, in_app: true, push: true }
}

export async function fetchNotificationPreferences(userId: string): Promise<NotificationPreference[]> {
  if (!supabase) return [...demoPreferences.values()]

  const { data, error } = await supabase
    .from('notification_preferences')
    .select('category, in_app, push')
    .eq('user_id', userId)
  // La tabla puede no existir todavía: sin la migración, todo sigue llegando y
  // la pantalla lo dice. No es motivo para romper el centro de avisos.
  if (error) {
    if (error.code === '42P01' || /does not exist/i.test(error.message ?? '')) return []
    throw error
  }
  return (data ?? []) as NotificationPreference[]
}

export async function setNotificationPreference(
  userId: string,
  preference: NotificationPreference,
): Promise<void> {
  // "Mándamelo al teléfono pero no lo guardes" no existe: la base lo impide con
  // un CHECK y aquí se respeta antes de llegar, para que el interruptor no
  // ofrezca un estado que va a ser rechazado.
  const normalized = preference.in_app ? preference : { ...preference, push: false }

  if (!supabase) {
    demoPreferences.set(normalized.category, normalized)
    return
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert({ user_id: userId, ...normalized, updated_at: new Date().toISOString() })
  if (error) throw error
}
