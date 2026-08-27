import { supabase } from '@/shared/lib/supabase'
import type { AppNotification, NotificationCategory, Role } from '@/shared/types/database'

const demoRead = new Set<string>()
const deletedDemoIds = new Set<string>()

/** El catálogo completo del modo demo, sin filtrar por lo borrado. */
function demoSeed(userId: string, role: Role): AppNotification[] {
  const now = Date.now()
  const personal: AppNotification[] = [
    {
      id: 'demo-achievement', user_id: userId, actor_id: null,
      type: 'achievement', category: 'profile', audience: 'personal',
      title: 'Nuevo logro desbloqueado', body: 'Explorador', url: '/perfil?tab=badges',
      payload: { badgeId: 'explorer' }, dedupe_key: 'achievement:explorer',
      read_at: demoRead.has('demo-achievement') ? new Date().toISOString() : null,
      created_at: new Date(now - 10 * 60_000).toISOString(),
    },
    {
      id: 'demo-forum', user_id: userId, actor_id: null,
      type: 'forum_reply', category: 'forum', audience: 'personal',
      title: 'Nueva respuesta en el foro', body: 'Cata respondió en “Datos y algoritmos”',
      url: '/foro?thread=demo-1', payload: { threadId: 'demo-1' }, dedupe_key: 'forum_reply:demo',
      read_at: demoRead.has('demo-forum') ? new Date().toISOString() : null,
      created_at: new Date(now - 35 * 60_000).toISOString(),
    },
    {
      id: 'demo-event', user_id: userId, actor_id: null,
      type: 'event_reminder', category: 'events', audience: 'personal',
      title: 'Evento próximo', body: '“Feria UDP” comienza dentro de 12 días',
      url: '/eventos', payload: {}, dedupe_key: 'event_reminder:demo',
      read_at: demoRead.has('demo-event') ? new Date().toISOString() : null,
      created_at: new Date(now - 2 * 60 * 60_000).toISOString(),
    },
    {
      id: 'demo-announcement', user_id: userId, actor_id: null,
      type: 'announcement', category: 'system', audience: 'personal',
      title: 'Corte de agua en Ejército 441',
      body: 'Los baños del segundo piso estarán cerrados hasta las 16:00.',
      url: '/', payload: {}, dedupe_key: 'announcement:demo',
      read_at: demoRead.has('demo-announcement') ? new Date().toISOString() : null,
      created_at: new Date(now - 26 * 60 * 60_000).toISOString(),
    },
  ]

  if (role === 'admin') {
    personal.unshift({
      id: 'demo-admin-report', user_id: userId, actor_id: null,
      type: 'moderation_report', category: 'moderation', audience: 'admin',
      title: 'Nuevo contenido reportado', body: 'Hay un reporte esperando revisión.',
      url: '/admin/moderacion', payload: { reportId: 'demo-report' }, dedupe_key: 'moderation_report:demo',
      read_at: demoRead.has('demo-admin-report') ? new Date().toISOString() : null,
      created_at: new Date(now - 5 * 60_000).toISOString(),
    })
  }
  return personal
}

function demoNotifications(userId: string, role: Role): AppNotification[] {
  return demoSeed(userId, role).filter((n) => !deletedDemoIds.has(n.id))
}

export async function fetchNotifications(userId: string, role: Role): Promise<AppNotification[]> {
  if (!supabase) return demoNotifications(userId, role)

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return (data ?? []) as AppNotification[]
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  if (!supabase) {
    demoRead.add(notificationId)
    return
  }
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
  if (error) throw error
}

export async function toggleNotificationRead(notificationId: string, currentReadAt: string | null): Promise<void> {
  if (!supabase) {
    if (currentReadAt) {
      demoRead.delete(notificationId)
    } else {
      demoRead.add(notificationId)
    }
    return
  }
  const nextReadAt = currentReadAt ? null : new Date().toISOString()
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: nextReadAt })
    .eq('id', notificationId)
  if (error) throw error
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!supabase) {
    for (const notification of demoSeed(userId, 'admin')) demoRead.add(notification.id)
    return
  }
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
}

export async function deleteNotification(notificationId: string): Promise<void> {
  if (!supabase) {
    deletedDemoIds.add(notificationId)
    return
  }
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', notificationId)
  if (error) throw error
}

/**
 * Vaciar la bandeja de golpe.
 *
 * El filtro por `user_id` es redundante con la política `notifications_delete_own`
 * —RLS ya impide tocar las de otro—, pero va explícito a propósito: un DELETE
 * sin `where` contra una tabla compartida no debería depender de que la política
 * esté bien puesta para no ser una catástrofe.
 */
export async function deleteAllNotifications(userId: string, role: Role): Promise<void> {
  if (!supabase) {
    for (const notification of demoSeed(userId, role)) {
      if (notification.audience === 'personal') deletedDemoIds.add(notification.id)
    }
    return
  }
  // `audience = 'personal'` NO es cosmético. El botón vive bajo "Tus avisos",
  // enseña un recuento de avisos personales y promete borrar ESE número. Sin
  // este filtro el DELETE se llevaba también los de `audience: 'admin'` —la
  // cola de denuncias del equipo, que ni se cuenta ni se enseña ahí—, así que
  // un administrador que vaciaba su bandeja destruía de paso avisos de trabajo
  // que nunca vio mencionados en la confirmación.
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', userId)
    .eq('audience', 'personal')
  if (error) throw error
}

export async function markCategoryRead(userId: string, category: NotificationCategory): Promise<void> {
  if (!supabase) {
    for (const notification of demoNotifications(userId, 'admin')) {
      if (notification.category === category) demoRead.add(notification.id)
    }
    return
  }
  // El `user_id` es redundante con la política RLS, igual que en el borrado
  // masivo. Va explícito por el mismo motivo: un UPDATE cuyo alcance depende
  // solo de que la política esté bien puesta es una bomba esperando un descuido.
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('category', category)
    .is('read_at', null)
  if (error) throw error
}

export async function registerPushSubscription(subscription: PushSubscription): Promise<void> {
  if (!supabase) throw new Error('Web Push requiere una conexión a Supabase.')
  const serialized = subscription.toJSON()
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
    throw new Error('El navegador entregó una suscripción incompleta.')
  }

  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: serialized.endpoint,
    p_p256dh: serialized.keys.p256dh,
    p_auth: serialized.keys.auth,
    p_user_agent: navigator.userAgent,
  })
  if (error) throw error
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}

export async function removeCurrentBrowserPushSubscription(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await deletePushSubscription(subscription.endpoint)
  await subscription.unsubscribe()
}

export async function markNotificationFromUrl(): Promise<void> {
  const url = new URL(window.location.href)
  const notificationId = url.searchParams.get('notification')
  if (!notificationId) return

  await markNotificationRead(notificationId)
  url.searchParams.delete('notification')
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}
