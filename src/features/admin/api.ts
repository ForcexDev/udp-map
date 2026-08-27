import { supabase } from '@/shared/lib/supabase'
import type { Profile, Pin, Role } from '@/shared/types/database'
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

export interface PushSubscriber {
  userId: string
  name: string | null
  role: string | null
  /** El `user_agent` crudo. Resumirlo es cosa de la interfaz. */
  userAgent: string | null
  createdAt: string
}

/**
 * Quiénes reciben los avisos push.
 *
 * `null` mientras la migración 20260829000100 no esté aplicada: la pantalla
 * enseña entonces solo el número, como hasta ahora, y lo dice.
 */
export async function fetchPushSubscribers(): Promise<PushSubscriber[] | null> {
  if (!supabase) {
    return [
      { userId: 'demo-admin', name: 'Admin Demo', role: 'admin', userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/141', createdAt: new Date(Date.now() - 4 * 86400000).toISOString() },
      { userId: 'demo-mod', name: 'Moderador Demo', role: 'moderator', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2) Safari', createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
      { userId: 'demo-student', name: 'Estudiante Demo', role: 'student', userAgent: 'Mozilla/5.0 (Linux; Android 15) Chrome/141', createdAt: new Date(Date.now() - 3600000).toISOString() },
    ]
  }

  const { data, error } = await supabase.rpc('admin_push_subscribers')
  if (error) {
    if (isMissingFunction(error)) return null
    throw error
  }

  return ((data ?? []) as Array<{ user_id: string; name: string | null; role: string | null; user_agent: string | null; created_at: string }>)
    .map((row) => ({
      userId: row.user_id,
      name: row.name,
      role: row.role,
      userAgent: row.user_agent,
      createdAt: row.created_at,
    }))
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

/**
 * "La función no existe" llega por dos caminos y hay que mirar los dos: `42883`
 * es el código de Postgres, pero una RPC desconocida ni llega a Postgres —
 * PostgREST la corta antes con un 404 y `PGRST202`.
 */
function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return error.code === '42883'
    || error.code === 'PGRST202'
    || /could not find the function|does not exist/i.test(error.message ?? '')
}

interface PushRunResult {
  processed: number
  sent: number
  failed: number
}

/**
 * Vacía la cola de entregas llamando a la Edge Function.
 *
 * Está aparte porque la usan los dos envíos —la difusión y la prueba a uno
 * mismo— y porque encolar y entregar son pasos distintos: el trigger
 * `queue_notification_push` escribe en `notification_push_deliveries` y sin esta
 * llamada la cola espera al cron, que corre cada minuto. Esperar un minuto para
 * saber si el push funciona hace que nadie llegue a comprobarlo.
 */
async function drainPushQueue(accessToken: string): Promise<PushRunResult> {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const res = await fetch(`${baseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errData.error || `Error del servidor de push: status ${res.status}`)
  }

  return (await res.json()) as PushRunResult
}

/**
 * Una push de prueba a MI dispositivo y a ninguno más.
 *
 * Antes la única forma de probar era la difusión, que recorre todas las
 * suscripciones: comprobar "¿me llega a mí?" le hacía sonar el teléfono a la
 * universidad entera, así que en la práctica no se probaba nunca y los fallos
 * se descubrían por el reporte de un compañero.
 */
export async function sendSelfPushTest(): Promise<PushRunResult> {
  if (!supabase) return { processed: 1, sent: 1, failed: 0 }

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa de administrador.')

  const { error } = await supabase.rpc('admin_send_test_push_to_self')
  if (error) {
    // "La función no existe" llega por dos caminos distintos y hay que mirar
    // los dos: `42883` es el código de Postgres, pero una RPC desconocida ni
    // siquiera llega a Postgres — PostgREST la corta antes con un 404 y
    // `PGRST202`. Comprobar solo el primero, que fue el primer intento, dejaba
    // salir el texto crudo en inglés ("Could not find the function … in the
    // schema cache"), que no le dice a nadie qué tiene que hacer.
    if (isMissingFunction(error)) {
      throw new Error('Falta aplicar la migración 20260827000000 en Supabase (SQL Editor).')
    }
    throw new Error(error.message || 'No se pudo encolar la prueba.')
  }

  return drainPushQueue(session.access_token)
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
  let { error: rpcError } = await supabase.rpc('admin_broadcast_push_notification', {
    p_title: finalTitle,
    p_body: finalBody,
    p_url: url,
  })

  if (rpcError && isMissingFunction(rpcError)) {
    // La firma de tres argumentos todavía no existe. Sin destino elegido se
    // puede seguir con la vieja; con destino elegido, callarse y mandarlo a la
    // nada sería peor que no mandarlo.
    if (url !== '/') {
      throw new Error('Vincular un pin necesita la migración 20260829000000 aplicada en Supabase.')
    }
    ;({ error: rpcError } = await supabase.rpc('admin_broadcast_push_notification', {
      p_title: finalTitle,
      p_body: finalBody,
    }))
  }

  if (rpcError) {
    throw new Error(rpcError.message || rpcError.details || 'Error al ejecutar broadcast de notificaciones')
  }

  // 2. Vaciar la cola ya, sin esperar al cron del minuto.
  return drainPushQueue(session.access_token)
}
