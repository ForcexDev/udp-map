import { supabase } from '@/shared/lib/supabase'
import type { Profile, Pin, Role } from '@/shared/types/database'
import { demoDb } from '../pins/demoStore'

export async function fetchPublicProfile(userId: string): Promise<Profile | null> {
  if (!supabase) {
    return {
      id: userId,
      email: 'demo@mail.udp.cl',
      name: 'Estudiante Demo',
      role: 'student',
      faculty_id: 'fic',
      career: 'Ingeniería Civil en Informática',
      year: 2024,
      karma: 42,
      avatar_url: null,
      created_at: new Date().toISOString()
    }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error || !data) {
    console.error('Error fetching public profile:', error)
    return null
  }
  return data
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
