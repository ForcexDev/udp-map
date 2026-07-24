import { supabase } from '@/shared/lib/supabase'
import type { Profile, Pin, Role } from '@/shared/types/database'
import type { DashboardStats, ActivityEntry, AdminUserFilter, AdminPinFilter } from './types'
import { demoDb } from '@/features/pins/demoStore'

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

export async function adminDeletePin(pinId: string): Promise<void> {
  if (!supabase) {
    demoDb.pins = demoDb.pins.filter(p => p.id !== pinId)
    return
  }
  const { error } = await supabase.from('pins').delete().eq('id', pinId)
  if (error) throw error
}

export async function fetchRecentActivity(): Promise<ActivityEntry[]> {
  if (!supabase) {
    return [
      { id: '1', type: 'pin_created', title: 'Nuevo reporte de Sala Libre en FIC', timestamp: new Date(Date.now() - 5 * 60000).toISOString() },
      { id: '2', type: 'report_submitted', title: 'Reporte de contenido inapropiado', timestamp: new Date(Date.now() - 25 * 60000).toISOString() },
    ]
  }

  const [pinsRes, reportsRes] = await Promise.all([
    supabase.from('pins').select('id, title, created_at').order('created_at', { ascending: false }).limit(15),
    supabase.from('content_reports').select('id, reason, created_at').order('created_at', { ascending: false }).limit(15),
  ])

  const activity: ActivityEntry[] = [
    ...(pinsRes.data ?? []).map((p): ActivityEntry => ({
      id: `pin-${p.id}`,
      type: 'pin_created',
      title: `Pin publicado: "${p.title}"`,
      timestamp: p.created_at,
    })),
    ...(reportsRes.data ?? []).map((r): ActivityEntry => ({
      id: `rep-${r.id}`,
      type: 'report_submitted',
      title: `Reporte de moderación enviado (${r.reason})`,
      timestamp: r.created_at,
    })),
  ]

  return activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

export async function triggerServerPushTest(title?: string, body?: string): Promise<{ processed: number; sent: number; failed: number }> {
  if (!supabase) {
    return { processed: 1, sent: 1, failed: 0 }
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hay sesión activa de administrador.')

  // 1. Encolar notificaciones y entregas push para todos los suscriptores activos
  const { error: rpcError } = await supabase.rpc('admin_broadcast_push_notification', {
    p_title: title || 'Notificación de prueba UDP Map',
    p_body: body || 'Mensaje de prueba enviado desde el panel de administración.',
  })
  if (rpcError) {
    throw new Error(rpcError.message || rpcError.details || 'Error al ejecutar broadcast de notificaciones')
  }

  // 2. Invocar la Edge Function send-push para procesar el envío Web Push a los dispositivos
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const res = await fetch(`${baseUrl}/functions/v1/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  })

  if (!res.ok) {
    const errData = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(errData.error || `Error del servidor de push: status ${res.status}`)
  }

  return (await res.json()) as { processed: number; sent: number; failed: number }
}
