import { create } from 'zustand'
import { supabase, isSupabaseConfigured } from '@/shared/lib/supabase'
import type { Role } from '@/shared/types/database'
import { isUdpEmail } from './permissions'
import i18n from '@/shared/lib/i18n'

export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  faculty_id?: string | null
  career?: string | null
}

interface AuthState {
  user: AuthUser | null
  role: Role
  loading: boolean
  init: () => void
  signInWithGoogle: () => Promise<void>
  signInWithIdToken: (idToken: string) => Promise<void>
  signInDemo: (role: 'student' | 'admin') => void
  signOut: () => Promise<void>
  updateProfile: (facultyId: string, career: string) => Promise<void>
}

const DEMO_KEY = 'udpmap.demoRole'

async function fetchProfile(userId: string): Promise<{ role: Role; name: string | null; faculty_id: string | null; career: string | null }> {
  if (!supabase) return { role: 'guest', name: null, faculty_id: null, career: null }
  const { data } = await supabase.from('profiles').select('role, name, faculty_id, career').eq('id', userId).single()
  
  const role = (data?.role as Role | undefined) ?? 'student'
  let name = data?.name as string | undefined

  // Auto-format full uppercase names (like Google Auth defaults)
  if (name && name === name.toUpperCase()) {
    const words = name.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    // If it has 3+ words (e.g. EZEQUIEL LEANDRO MORALES HERRERA), pick 1st and 3rd.
    const shortName = words.length >= 3 ? `${words[0]} ${words[2]}` : words.join(' ')
    if (shortName !== name) {
      name = shortName
      supabase.from('profiles').update({ name: shortName }).eq('id', userId).then()
    }
  }

  const faculty_id = data?.faculty_id as string | undefined ?? null
  const career = data?.career as string | undefined ?? null

  return { role, name: name ?? null, faculty_id, career }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: 'guest',
  loading: isSupabaseConfigured,

  init: () => {
    if (!supabase) {
      // Modo demo: restaurar sesión demo persistida
      const demoRole = localStorage.getItem(DEMO_KEY)
      if (demoRole === 'student' || demoRole === 'admin') {
        set({
          user: {
            id: `demo-${demoRole}`,
            email: `${demoRole}@mail.udp.cl`,
            name: demoRole === 'admin' ? 'Admin Demo' : 'Estudiante Demo',
            avatarUrl: null,
            faculty_id: 'ingenieria',
            career: 'Ingeniería Civil Informática',
          },
          role: demoRole,
          loading: false,
        })
      }
      return
    }

    supabase.auth.onAuthStateChange((_event, session) => {
      const su = session?.user
      if (!su?.email) {
        set({ user: null, role: 'guest', loading: false })
        return
      }
      // Solo comunidad UDP: cerrar sesión a dominios ajenos (también validado en DB)
      if (!isUdpEmail(su.email)) {
        void supabase!.auth.signOut()
        useAuthStore.getState().signOut()
        return
      }
      const user: AuthUser = {
        id: su.id,
        email: su.email,
        name: (su.user_metadata?.full_name as string | undefined) ?? su.email.split('@')[0],
        avatarUrl: (su.user_metadata?.avatar_url as string | undefined) ?? null,
        faculty_id: undefined,
        career: undefined,
      }
      set({ user, loading: false })
      void fetchProfile(su.id).then(({ role, name, faculty_id, career }) => {
        set((state) => ({
          role,
          user: state.user ? { ...state.user, name: name || state.user.name, faculty_id, career } : null
        }))
      })
    })
  },

  signInWithGoogle: async () => {
    if (!supabase) return
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { hd: 'mail.udp.cl', prompt: 'select_account' },
      },
    })
  },

  signInWithIdToken: async (idToken: string) => {
    if (!supabase) return
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    })
    if (error) {
      console.error('Error in Google ID Token sign in:', error.message)
    }
  },

  signInDemo: (role) => {
    localStorage.setItem(DEMO_KEY, role)
    set({
      user: {
        id: `demo-${role}`,
        email: `${role}@mail.udp.cl`,
        name: role === 'admin' ? 'Admin Demo' : 'Estudiante Demo',
        avatarUrl: null,
        faculty_id: 'ingenieria',
        career: 'Ingeniería Civil Informática',
      },
      role,
      loading: false,
    })
  },

  signOut: async () => {
    localStorage.removeItem(DEMO_KEY)
    if (supabase) await supabase.auth.signOut()
    set({ user: null, role: 'guest', loading: false })
  },

  updateProfile: async (facultyId, career) => {
    const { user } = useAuthStore.getState()
    if (!user || !supabase) return
    
    await supabase.from('profiles').update({ faculty_id: facultyId, career }).eq('id', user.id)
    set((state) => ({
      user: state.user ? { ...state.user, faculty_id: facultyId, career } : null
    }))
  },
}))

export function currentUserName(): string {
  return useAuthStore.getState().user?.name ?? i18n.t('auth.guest')
}
