import { supabase } from '@/shared/lib/supabase'
import { isMissingFunction } from '@/shared/utils/rpcErrors'
import type { Profile, Pin, Role, ModeratorCapability } from '@/shared/types/database'
import type { DashboardStats, ActivityEntry, ActivityFeed, AdminUserFilter, AdminPinFilter } from './types'
import { demoDb } from '@/features/pins/demoStore'
import { REASON_LABELS } from '@/features/moderation/labels'
import type { ContentReport } from '@/shared/types/database'

/** Sanitizador estricto contra inyecciones de sintaxis PostgREST (.or, .ilike, etc.) */
function sanitizePostgrestSearch(input?: string): string {
  if (!input) return ''
  return input.replace(/[%(),.:'"/\\]/g, '').trim()
}

// Datos Mock para Modo Demo
const MOCK_PROFILES: Profile[] = [
  { id: 'demo-admin', email: 'admin@mail.udp.cl', name: 'Admin Demo', role: 'admin', faculty_id: 'ingenieria', career: 'Ingeniería Civil Informática', year: 2021, karma: 250, avatar_url: null, created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
  { id: 'demo-mod', email: 'mod@mail.udp.cl', name: 'Moderador Demo', role: 'moderator', faculty_id: 'derecho', career: 'Derecho', year: 2022, karma: 180, avatar_url: null, created_at: new Date(Date.now() - 20 * 86400000).toISOString() },
  { id: 'demo-student', email: 'estudiante@mail.udp.cl', name: 'Estudiante Demo', role: 'student', faculty_id: 'medicina', career: 'Medicina', year: 2024, karma: 42, avatar_url: null, created_at: new Date(Date.now() - 10 * 86400000).toISOString() },
  { id: 'demo-4', email: 'sofia.valdes@mail.udp.cl', name: 'Sofía Valdés', role: 'student', faculty_id: 'psicologia', career: 'Psicología', year: 2023, karma: 95, avatar_url: null, created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
]

export async function fetchDashboardStats(): Promise<DashboardStats> {
  if (!supabase) {
    return {
      totalUsers: MOCK_PROFILES.length,
      roleCounts: { admin: 1, moderator: 1, student: 2, guest: 0 },
      totalPins: demoDb.pins.length,
      activePins: demoDb.pins.filter(p => !p.expires_at || new Date(p.expires_at) > new Date()).length,
      pinsToday: 2,
      upcomingEvents: demoDb.pins.filter(p => p.type === 'event').length,
      pendingReports: 1,
      totalKarma: 567,
      pushSubscribers: 3,
    }
  }

  const [usersRes, pinsRes, reportsRes, pushSubsRes] = await Promise.all([
    supabase.from('profiles').select('role, karma'),
    supabase.from('pins').select('id, type, expires_at, created_at, starts_at'),
    supabase.from('content_reports').select('status'),
    supabase.rpc('admin_count_push_subscribers'),
  ])

  const profiles = usersRes.data ?? []
  const pins = pinsRes.data ?? []
  const reports = reportsRes.data ?? []
  const pushSubscribersCount = pushSubsRes.data ?? 0

  const roleCounts: Record<Role, number> = { admin: 0, moderator: 0, student: 0, guest: 0 }
  let totalKarma = 0
  profiles.forEach((p: { role: Role | null; karma: number | null }) => {
    const r = p.role ?? 'student'
    roleCounts[r] = (roleCounts[r] || 0) + 1
    totalKarma += p.karma || 0
  })

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  return {
    totalUsers: profiles.length,
    roleCounts,
    totalPins: pins.length,
    activePins: pins.filter(p => !p.expires_at || new Date(p.expires_at) > now).length,
    pinsToday: pins.filter(p => p.created_at?.startsWith(todayStr)).length,
    upcomingEvents: pins.filter(p => p.type === 'event' && p.starts_at && new Date(p.starts_at) >= now).length,
    pendingReports: reports.filter(r => r.status === 'pending').length,
    totalKarma,
    pushSubscribers: pushSubscribersCount,
  }
}

export async function fetchAdminUsers(filter?: AdminUserFilter): Promise<Profile[]> {
  const safeSearch = sanitizePostgrestSearch(filter?.search)

  if (!supabase) {
    let list = [...MOCK_PROFILES]
    if (filter?.role && filter.role !== 'all') list = list.filter(u => u.role === filter.role)
    if (safeSearch) {
      const q = safeSearch.toLowerCase()
      list = list.filter(u => u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
    }
    return list
  }

  let query = supabase.from('profiles').select('*').order('created_at', { ascending: false })
  if (filter?.role && filter.role !== 'all') query = query.eq('role', filter.role)
  if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function adminSetUserRole(targetUserId: string, newRole: Role): Promise<void> {
  if (!supabase) {
    const target = MOCK_PROFILES.find(u => u.id === targetUserId)
    if (target) target.role = newRole
    return
  }

  const { error } = await supabase.rpc('admin_set_user_role', {
    target_user_id: targetUserId,
    new_role: newRole,
  })
  if (error) throw error
}

export async function fetchAdminPins(filter?: AdminPinFilter): Promise<Pin[]> {
  const safeSearch = sanitizePostgrestSearch(filter?.search)

  if (!supabase) {
    let list = [...demoDb.pins]
    if (filter?.type && filter.type !== 'all') list = list.filter(p => p.type === filter.type)
    if (safeSearch) {
      const q = safeSearch.toLowerCase()
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q))
    }
    return list
  }

  let query = supabase.from('pins').select('*, pin_photos(*)').order('created_at', { ascending: false })
  if (filter?.type && filter.type !== 'all') query = query.eq('type', filter.type)
  if (safeSearch) query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Pin[]
}

/**
 * Asigna planta a varios pines de una vez, desde el editor de mapeo.
 *
 * `floor` no está entre los campos que protege protect_pin_sensitive_fields, y
 * la policy pins_mod_update deja a moderadores y admins escribir sobre
 * cualquier pin: no hace falta ninguna RPC para esto.
 *
 * Las actualizaciones van en serie y no en un upsert masivo porque un upsert
 * sobre `pins` exigiría mandar la fila completa, y con ella campos protegidos
 * que el trigger revertiría en silencio.
 */
export async function adminSetPinFloors(
  updates: { pinId: string; floor: number | null }[],
): Promise<void> {
  if (updates.length === 0) return

  if (!supabase) {
    for (const { pinId, floor } of updates) {
      const pin = demoDb.pins.find((p) => p.id === pinId)
      if (pin) pin.floor = floor
    }
    return
  }

  for (const { pinId, floor } of updates) {
    const { error } = await supabase.from('pins').update({ floor }).eq('id', pinId)
    if (error) throw error
  }
}

export async function adminDeletePin(pinId: string): Promise<void> {
  if (!supabase) {
    demoDb.pins = demoDb.pins.filter(p => p.id !== pinId)
    return
  }
  const { error } = await supabase.from('pins').delete().eq('id', pinId)
  if (error) throw error
}

/**
 * A cuántos dispositivos llega una difusión. Es la misma RPC que usa el
 * dashboard, pero sin sus otras tres consultas, y no sale de la lista de
 * `fetchPushSubscribers` porque PostgREST corta esa lista en 1000 filas.
 */
export async function fetchPushSubscriberCount(): Promise<number> {
  if (!supabase) return 3
  const { data, error } = await supabase.rpc('admin_count_push_subscribers')
  if (error) throw error
  return data ?? 0
}

export interface PushSubscriber {
  userId: string
  /** El identificador del dispositivo. Es lo que se da de baja. */
  endpoint: string
  name: string | null
  role: string | null
  /** El `user_agent` crudo. Resumirlo es cosa de la interfaz. */
  userAgent: string | null
  createdAt: string
}

/**
 * Quiénes reciben los avisos push.
 */
export async function fetchPushSubscribers(): Promise<PushSubscriber[]> {
  if (!supabase) {
    return [
      { userId: 'demo-admin', endpoint: 'https://push.example/demo-1', name: 'Admin Demo', role: 'admin', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/141', createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
      { userId: 'demo-mod', endpoint: 'https://push.example/demo-2', name: 'Moderador Demo', role: 'moderator', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2) Safari', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
      { userId: 'demo-student', endpoint: 'https://push.example/demo-3', name: 'Estudiante Demo', role: 'student', userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/141', createdAt: new Date(Date.now() - 3600000).toISOString() },
    ]
  }

  const { data, error } = await supabase.rpc('admin_push_subscribers')
  if (error) throw error

  return ((data ?? []) as Array<{ user_id: string; endpoint: string; name: string | null; role: string | null; user_agent: string | null; created_at: string }>)
    .map((row) => ({
      userId: row.user_id,
      endpoint: row.endpoint,
      name: row.name,
      role: row.role,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }))
}

/**
 * Da de baja un dispositivo concreto.
 *
 * Para las suscripciones que ya no puede quitar su dueño —un teléfono perdido,
 * un navegador que nadie va a volver a abrir—, que si no se quedan inflando el
 * "llegará a N dispositivos" para siempre.
 */
export async function deletePushSubscriberDevice(endpoint: string): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.rpc('admin_delete_push_subscription', { p_endpoint: endpoint })
  if (error) throw new Error(error.message || 'No se pudo dar de baja el dispositivo.')
}

// ── Permisos por moderador ──────────────────────────────────────────────────
//
// "Moderador" era un paquete cerrado: dárselo a alguien para que ayudara a
// mapear le entregaba de paso el poder de borrar cualquier hilo del foro. Eso
// empuja a no dar el rol a nadie, y así el trabajo se queda sin hacer.

export const CAPABILITIES = [
  { id: 'mapping', label: 'Mapeo', hint: 'Trazar edificios, plantas y áreas' },
  { id: 'reports', label: 'Denuncias', hint: 'Ver y resolver la cola de moderación' },
  { id: 'verify', label: 'Verificar', hint: 'Hacer permanentes los pines y alargar plazos' },
  { id: 'content', label: 'Contenido', hint: 'Editar y borrar publicaciones ajenas' },
  { id: 'official', label: 'Oficial', hint: 'Marcar eventos y publicar como entidad' },
] as const

/** Qué piezas tiene concedidas alguien. `null` si falta la migración. */
export async function fetchUserCapabilities(userId: string): Promise<ModeratorCapability[] | null> {
  if (!supabase) return ['mapping']

  const { data, error } = await supabase.rpc('admin_user_capabilities', { p_user_id: userId })
  if (error) {
    if (isMissingFunction(error)) return null
    throw error
  }
  return ((data ?? []) as { capability: ModeratorCapability }[]).map((row) => row.capability)
}

export async function setUserCapability(
  userId: string,
  capability: ModeratorCapability,
  granted: boolean,
): Promise<void> {
  if (!supabase) return

  const { error } = await supabase.rpc('admin_set_capability', {
    p_user_id: userId,
    p_capability: capability,
    p_granted: granted,
  })
  if (error) {
    if (isMissingFunction(error)) {
      throw new Error('Repartir permisos necesita la migración 20260831000200 aplicada en Supabase.')
    }
    throw new Error(error.message || 'No se pudo cambiar el permiso.')
  }
}

/** Lo que responde `admin_activity_log`. */
interface ActivityLogRow {
  id: number
  actor_name: string | null
  action: ActivityEntry['action']
  summary: string
  created_at: string
}

/**
 * El registro de actividad.
 *
 * Intenta el registro de verdad y, si la migración 20260828000000 todavía no
 * está aplicada, cae al apaño anterior: leer los últimos pines y denuncias
 * VIVOS y mezclarlos. Ese apaño no es un registro —lo borrado no aparece, y
 * nada dice quién lo hizo— así que el `fromLog: false` viaja hasta la pantalla
 * para que lo advierta en vez de disimularlo.
 */
export async function fetchRecentActivity(): Promise<ActivityFeed> {
  if (!supabase) {
    return {
      fromLog: true,
      entries: [
        { id: '1', action: 'pin_created', actorName: 'Estudiante Demo', summary: 'Sala libre en la FIC', timestamp: new Date(Date.now() - 5 * 60000).toISOString() },
        { id: '2', action: 'report_filed', actorName: 'Sofía Valdés', summary: `Denuncia por ${REASON_LABELS.inappropriate}`, timestamp: new Date(Date.now() - 25 * 60000).toISOString() },
        { id: '3', action: 'pin_verified', actorName: 'Moderador Demo', summary: 'Microondas del casino', timestamp: new Date(Date.now() - 90 * 60000).toISOString() },
        { id: '4', action: 'role_changed', actorName: 'Admin Demo', summary: 'Sofía Valdés: student → moderator', timestamp: new Date(Date.now() - 26 * 3600000).toISOString() },
      ],
    }
  }

  const { data, error } = await supabase.rpc('admin_activity_log', { p_limit: 100 })

  if (!error) {
    return {
      fromLog: true,
      entries: ((data ?? []) as ActivityLogRow[]).map((row) => ({
        id: String(row.id),
        action: row.action,
        actorName: row.actor_name,
        summary: row.summary,
        timestamp: row.created_at,
      })),
    }
  }

  // Cualquier error que no sea "la función no existe" sí es un problema.
  const faltaLaMigracion = error.code === 'PGRST202'
    || error.code === '42883'
    || /could not find the function|does not exist/i.test(error.message ?? '')
  if (!faltaLaMigracion) throw error

  return { fromLog: false, entries: await fetchLegacyActivity() }
}

/** El apaño de antes, mientras no exista `activity_log`. */
async function fetchLegacyActivity(): Promise<ActivityEntry[]> {
  if (!supabase) return []

  const [pinsRes, reportsRes] = await Promise.all([
    supabase.from('pins').select('id, title, created_at').order('created_at', { ascending: false }).limit(15),
    supabase.from('content_reports').select('id, reason, created_at').order('created_at', { ascending: false }).limit(15),
  ])

  const entries: ActivityEntry[] = [
    ...(pinsRes.data ?? []).map((p): ActivityEntry => ({
      id: `pin-${p.id}`,
      action: 'pin_created',
      actorName: null,
      summary: p.title,
      timestamp: p.created_at,
    })),
    ...(reportsRes.data ?? []).map((r): ActivityEntry => ({
      id: `rep-${r.id}`,
      action: 'report_filed',
      actorName: null,
      summary: REASON_LABELS[r.reason as ContentReport['reason']] ?? 'Motivo desconocido',
      timestamp: r.created_at,
    })),
  ]

  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/** Entregas de un aviso contadas por estado, tal como las lee send-push. */
export interface PushDeliveryCounts {
  pending: number
  sent: number
  failed: number
  expired: number
}

export interface PushRunResult {
  processed: number
  sent: number
  failed: number
  /**
   * Solo si se llamó con `notificationId` y el send-push es el nuevo. El viejo
   * ignora el cuerpo y no lo manda: por eso es opcional, y por eso el mensaje
   * de la prueba tiene un camino que no lo necesita.
   */
  notification?: {
    id: string
    deliveries: PushDeliveryCounts
    /** send-push no pudo leer las entregas: los conteos no son fiables. */
    error?: string
  }
}

/**
 * Vacía la cola de entregas llamando a la Edge Function.
 *
 * Está aparte porque la usan los dos envíos —la difusión y la prueba a uno
 * mismo— y porque encolar y entregar son pasos distintos: el trigger
 * `queue_notification_push` escribe en `notification_push_deliveries` y sin esta
 * llamada la cola espera al cron, que corre cada minuto. Esperar un minuto para
 * saber si el push funciona hace que nadie llegue a comprobarlo.
 *
 * `notificationId` acota la pasada a UN aviso y pide a send-push que cuente sus
 * entregas. Sin él la petición va exactamente como siempre, sin cuerpo: la
 * difusión crea un aviso por destinatario y no hay un id que dar.
 */
async function drainPushQueue(accessToken: string, notificationId?: string): Promise<PushRunResult> {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const res = await fetch(`${baseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    ...(notificationId ? { body: JSON.stringify({ notificationId }) } : {}),
  })

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errData.error || `Error del servidor de push: status ${res.status}`)
  }

  return (await res.json()) as PushRunResult
}

export interface SelfPushTestResult extends PushRunResult {
  /**
   * `false` si la base no creó el aviso: `create_notification` devuelve null
   * cuando las preferencias de la cuenta silencian los avisos del sistema. En
   * ese caso no hay nada que enviar y send-push ni se llama.
   */
  notificationCreated: boolean
}

/**
 * Una push de prueba a MI dispositivo y a ninguno más.
 *
 * Antes la única forma de probar era la difusión, que recorre todas las
 * suscripciones: comprobar "¿me llega a mí?" le hacía sonar el teléfono a la
 * universidad entera, así que en la práctica no se probaba nunca y los fallos
 * se descubrían por el reporte de un compañero.
 *
 * La RPC devuelve el id del aviso, y ese id se le pasa a send-push: así la
 * pasada es solo de esta prueba (no manda de paso lo que otros tuvieran en
 * cola) y la respuesta cuenta qué pasó con SUS entregas, que es lo único que
 * responde "¿por qué no me llegó?".
 */
export async function sendSelfPushTest(): Promise<SelfPushTestResult> {
  if (!supabase) {
    return {
      processed: 1,
      sent: 1,
      failed: 0,
      notificationCreated: true,
      notification: { id: 'demo', deliveries: { pending: 0, sent: 1, failed: 0, expired: 0 } },
    }
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa de administrador.')

  const { data, error } = await supabase.rpc('admin_send_test_push_to_self')
  if (error) throw new Error(error.message || 'No se pudo encolar la prueba.')

  const notificationId = typeof data === 'string' && data ? data : null
  if (!notificationId) {
    return { processed: 0, sent: 0, failed: 0, notificationCreated: false }
  }

  const run = await drainPushQueue(session.access_token, notificationId)
  return { ...run, notificationCreated: true }
}

/**
 * Un trozo del mensaje de la prueba: clave de i18n, texto en español de
 * respaldo y, si el trozo es de plural, el número.
 *
 * Se devuelven trozos y no una cadena porque la traducción es cosa de la
 * pantalla (`t`), y porque así lo que se decide —qué decir para cada resultado—
 * se puede probar sin montar React ni i18n.
 */
export interface PushMessagePart {
  key: string
  fallback: string
  count?: number
}

const countOf = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0

/**
 * Qué decirle a quien pulsó "Enviar prueba".
 *
 * Con send-push nuevo el mensaje sale de las entregas del aviso, que distinguen
 * cuatro situaciones que "sent > 0" mezclaba: sin dispositivos a los que
 * entregar, entregas aún pendientes, fallidas y caducadas. Sin ese conteo
 * (send-push viejo, que ignora el cuerpo, o uno que no pudo leerlo) queda el
 * mensaje de siempre, basado en lo que envió la pasada.
 */
export function describeSelfPushTest(result: SelfPushTestResult): PushMessagePart[] {
  if (!result.notificationCreated) {
    return [{
      key: 'admin.push.test.notCreated',
      fallback: 'No se creó el aviso de prueba: tus preferencias de notificación silencian los avisos del sistema.',
    }]
  }

  const info = result.notification
  if (!info || info.error || !info.deliveries) {
    return result.sent > 0
      ? [{
          key: 'admin.push.test.legacySent',
          fallback: 'Prueba enviada. Debería aparecer en tu pantalla en unos segundos.',
        }]
      : [{
          key: 'admin.push.test.legacyNone',
          fallback: 'La prueba se encoló pero no salió a ningún dispositivo.',
        }]
  }

  const sent = countOf(info.deliveries.sent)
  const pending = countOf(info.deliveries.pending)
  const failed = countOf(info.deliveries.failed)
  const expired = countOf(info.deliveries.expired)

  if (sent + pending + failed + expired === 0) {
    return [{
      key: 'admin.push.test.noDeliveries',
      fallback: 'El aviso se creó, pero no generó ninguna entrega: tu cuenta no tiene dispositivos con push, o tus preferencias de push silencian los avisos del sistema.',
    }]
  }

  const parts: PushMessagePart[] = []
  if (sent > 0) {
    parts.push({
      key: 'admin.push.test.sent',
      count: sent,
      fallback: sent === 1 ? 'Enviada a 1 dispositivo.' : `Enviada a ${sent} dispositivos.`,
    })
  }
  if (pending > 0) {
    parts.push({
      key: 'admin.push.test.pending',
      count: pending,
      fallback: pending === 1
        ? '1 entrega pendiente: el envío automático ya la está procesando.'
        : `${pending} entregas pendientes: el envío automático ya las está procesando.`,
    })
  }
  if (failed > 0) {
    parts.push({
      key: 'admin.push.test.failed',
      count: failed,
      fallback: failed === 1 ? '1 entrega fallida.' : `${failed} entregas fallidas.`,
    })
  }
  if (expired > 0) {
    parts.push({
      key: 'admin.push.test.expired',
      count: expired,
      fallback: expired === 1
        ? '1 entrega caducada: la suscripción de ese dispositivo ya no existe.'
        : `${expired} entregas caducadas: esas suscripciones ya no existen.`,
    })
  }

  if (failed > 0) {
    parts.push({
      key: 'admin.push.test.seeStats',
      fallback: 'El último error está más abajo, en las entregas por servicio.',
    })
  } else if (sent > 0 && pending === 0 && expired === 0) {
    parts.push({
      key: 'admin.push.test.sentHint',
      fallback: 'Debería aparecer en tu pantalla en unos segundos.',
    })
  }

  return parts
}

// ── Entregas por servicio ───────────────────────────────────────────────────
//
// Cada suscripción apunta a un servicio push distinto (Apple, Google, Mozilla,
// Microsoft) y fallan por razones distintas: un 403 masivo en uno solo es una
// clave VAPID rechazada por ese servicio, no un problema de la cola. Sumar todo
// en un número lo esconde.

/** Los días que abarca la vista. La RPC los acota a 1..90. */
export const PUSH_STATS_DAYS = 7

export interface PushServiceStat {
  /** El host del endpoint, o "(sin host)" para entregas anteriores a `push_host`. */
  host: string
  sent: number
  failed: number
  expired: number
  pending: number
  /** La entrega más reciente, del estado que sea. */
  lastAt: string | null
  /** El error más reciente de ese servicio, venga del estado que venga. */
  lastError: string | null
}

/**
 * Las entregas de los últimos días, una fila por servicio push y los que más
 * fallan primero. La RPC ya agrupa y ordena; aquí solo cambian los nombres.
 *
 * `null` mientras la migración 20261021000100 no esté aplicada (o si se
 * deshace): la tarjeta lo dice en vez de enseñar una lista vacía que parecería
 * "no hay entregas".
 */
export async function fetchPushDeliveryStats(days = PUSH_STATS_DAYS): Promise<PushServiceStat[] | null> {
  if (!supabase) {
    const ago = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString()
    return [
      { host: 'web.push.apple.com', sent: 412, failed: 3, expired: 0, pending: 2, lastAt: ago(1), lastError: 'HTTP 403: BadJwtToken' },
      { host: 'fcm.googleapis.com', sent: 880, failed: 0, expired: 12, pending: 0, lastAt: ago(4), lastError: 'HTTP 410: la suscripción ya no existe' },
      { host: 'updates.push.services.mozilla.com', sent: 37, failed: 0, expired: 0, pending: 0, lastAt: ago(60), lastError: null },
    ]
  }

  const { data, error } = await supabase.rpc('admin_push_delivery_stats', { p_days: days })
  if (error) {
    if (isMissingFunction(error)) return null
    throw error
  }

  return ((data ?? []) as Array<Omit<PushServiceStat, 'lastAt' | 'lastError'> & { last_at: string | null; last_error: string | null }>)
    .map(({ last_at, last_error, ...counts }) => ({ ...counts, lastAt: last_at, lastError: last_error }))
}

/**
 * Difunde un aviso a todo el que tenga push activado.
 *
 * `url` es la ruta interna a la que lleva tocar el aviso. Hasta la migración
 * 20260829000000 el RPC no lo aceptaba y clavaba '/', que es la razón de que
 * tocar un aviso de difusión no llevara a ninguna parte.
 */
export async function triggerServerPushTest(
  title?: string,
  body?: string,
  url = '/',
): Promise<PushRunResult> {
  if (!supabase) {
    return { processed: 1, sent: 1, failed: 0 }
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa de administrador.')

  const finalTitle = title || 'Notificación de prueba UDP Map'
  const finalBody = body || 'Mensaje de prueba enviado desde el panel de administración.'

  // 1. Encolar el aviso y sus entregas para cada suscriptor.
  const { error: rpcError } = await supabase.rpc('admin_broadcast_push_notification', {
    p_title: finalTitle,
    p_body: finalBody,
    p_url: url,
  })

  if (rpcError) {
    throw new Error(rpcError.message || rpcError.details || 'Error al ejecutar broadcast de notificaciones')
  }

  // 2. Vaciar la cola ya, sin esperar al cron del minuto.
  return drainPushQueue(session.access_token)
}
