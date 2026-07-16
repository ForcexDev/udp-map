import { supabase } from '@/shared/lib/supabase'
import type { Profile, Pin, Role, UserBadge, Badge } from '@/shared/types/database'
import { demoDb } from '../pins/demoStore'

// Perfil público — solo campos seguros, sin email
const PROFILE_PUBLIC_FIELDS = 'id, name, role, faculty_id, career, year, karma, avatar_url, created_at'
// Leaderboard — mínimo necesario: identidad + karma + facultad para filtro
const LEADERBOARD_FIELDS = 'id, name, avatar_url, faculty_id, karma'

export async function fetchPublicProfile(userId: string): Promise<Profile | null> {
  if (!supabase) {
    return {
      id: userId,
      email: '',
      name: userId === 'demo-admin' ? 'Diego Portales' : 'Estudiante Demo',
      role: userId === 'demo-admin' ? 'admin' : 'student',
      faculty_id: userId === 'demo-admin' ? 'derecho' : 'fic',
      career: userId === 'demo-admin' ? 'Derecho' : 'Ingeniería Civil en Informática',
      year: 2024,
      karma: userId === 'demo-admin' ? 180 : 42,
      avatar_url: null,
      created_at: new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_PUBLIC_FIELDS)
    .eq('id', userId)
    .single()
  
  if (error || !data) {
    console.error('Error fetching public profile:', error)
    return null
  }
  return data as unknown as Profile
}

export async function fetchUserPins(userId: string): Promise<Pin[]> {
  if (!supabase) {
    return demoDb.pins.filter(p => p.creator_id === userId)
  }

  const { data, error } = await supabase
    .from('pins')
    .select('*, pin_photos(*)')
    .eq('creator_id', userId)
    .order('created_at', { ascending: false })
    .limit(30)
  
  if (error || !data) {
    console.error('Error fetching user pins:', error)
    return []
  }
  
  return data as unknown as Pin[]
}

export async function updateUserRole(userId: string, newRole: Role): Promise<boolean> {
  if (!supabase) {
    console.log('Demo mode: Role updated to', newRole)
    return true
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)
    
  if (error) {
    console.error('Error updating role:', error)
    return false
  }
  return true
}

export async function fetchUserBadges(userId: string): Promise<UserBadge[]> {
  if (!supabase) {
    if (userId.startsWith('demo-admin')) {
      return [
        { user_id: userId, badge_id: 'explorer', awarded_at: new Date().toISOString(), badge: { id: 'explorer', name: 'Explorador', name_en: 'Explorer', description: 'Crea 5 o más pines en el mapa', description_en: 'Create 5 or more pins on the map' } },
        { user_id: userId, badge_id: 'photographer', awarded_at: new Date().toISOString(), badge: { id: 'photographer', name: 'Fotógrafo', name_en: 'Photographer', description: 'Sube 3 o más fotos a tus pines', description_en: 'Upload 3 or more photos to your pins' } },
        { user_id: userId, badge_id: 'pioneer', awarded_at: new Date().toISOString(), badge: { id: 'pioneer', name: 'Pionero', name_en: 'Pioneer', description: 'Alcanza 100 o más puntos de Karma', description_en: 'Reach 100 or more Karma points' } }
      ]
    }
    return [
      { user_id: userId, badge_id: 'explorer', awarded_at: new Date().toISOString(), badge: { id: 'explorer', name: 'Explorador', name_en: 'Explorer', description: 'Crea 5 o más pines en el mapa', description_en: 'Create 5 or more pins on the map' } }
    ]
  }

  const { data, error } = await supabase
    .from('user_badges')
    .select('*, badge:badges(*)')
    .eq('user_id', userId)

  if (error || !data) {
    console.error('Error fetching user badges:', error)
    return []
  }
  return data as unknown as UserBadge[]
}

export async function fetchBadges(): Promise<Badge[]> {
  if (!supabase) {
    return [
      { id: 'explorer',     name: 'Explorador', name_en: 'Explorer',     description: 'Crea 5 o más pines en el mapa',     description_en: 'Create 5 or more pins on the map' },
      { id: 'photographer', name: 'Fotógrafo',  name_en: 'Photographer', description: 'Sube 3 o más fotos a tus pines',    description_en: 'Upload 3 or more photos to your pins' },
      { id: 'host',         name: 'Anfitrión',  name_en: 'Host',         description: 'Organiza 2 o más eventos',          description_en: 'Host 2 or more events' },
      { id: 'guardian',     name: 'Guardián',   name_en: 'Guardian',     description: 'Vota en 10 o más publicaciones',    description_en: 'Vote 10 or more times on posts' },
      { id: 'pioneer',      name: 'Pionero',    name_en: 'Pioneer',      description: 'Alcanza 100 o más puntos de Karma', description_en: 'Reach 100 or more Karma points' },
    ]
  }

  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .order('id')

  if (error || !data) {
    console.error('Error fetching all badges:', error)
    return []
  }
  return data
}

/** Solo disponible para usuarios autenticados. Devuelve nombre, foto y karma. */
export async function fetchLeaderboard(facultyId?: string): Promise<Profile[]> {
  if (!supabase) {
    // Modo demo — datos de muestra (sin email)
    const mockList: Profile[] = [
      { id: 'demo-admin',   email: '', name: 'Diego Portales',       role: 'admin',   faculty_id: 'derecho',    career: 'Derecho',                       year: 2020, karma: 180, avatar_url: null, created_at: new Date().toISOString() },
      { id: 'demo-2',       email: '', name: 'Sofía Valdés',         role: 'student', faculty_id: 'ingenieria', career: 'Ingeniería Civil Informática',   year: 2022, karma: 120, avatar_url: null, created_at: new Date().toISOString() },
      { id: 'demo-3',       email: '', name: 'Martín Silva',         role: 'student', faculty_id: 'medicina',   career: 'Medicina',                      year: 2021, karma: 95,  avatar_url: null, created_at: new Date().toISOString() },
      { id: 'demo-student', email: '', name: 'Estudiante Demo',      role: 'student', faculty_id: 'ingenieria', career: 'Ingeniería Civil Informática',   year: 2024, karma: 42,  avatar_url: null, created_at: new Date().toISOString() },
      { id: 'demo-4',       email: '', name: 'Clara Soto',           role: 'student', faculty_id: 'psicologia', career: 'Psicología',                    year: 2023, karma: 15,  avatar_url: null, created_at: new Date().toISOString() },
    ]
    const filtered = facultyId ? mockList.filter(u => u.faculty_id === facultyId) : mockList
    return filtered.sort((a, b) => b.karma - a.karma)
  }

  // Requiere usuario autenticado — la política RLS lo garantiza en el servidor,
  // pero también verificamos en cliente para no hacer requests innecesarios.
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return []

  let query = supabase
    .from('profiles')
    .select(LEADERBOARD_FIELDS)
    .order('karma', { ascending: false })
    .limit(50)

  if (facultyId) {
    query = query.eq('faculty_id', facultyId)
  }

  const { data, error } = await query
  if (error || !data) {
    console.error('Error fetching leaderboard:', error)
    return []
  }
  return data as unknown as Profile[]
}
