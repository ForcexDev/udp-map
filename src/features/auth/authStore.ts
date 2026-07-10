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
}

interface AuthState {
  user: AuthUser | null
  role: Role
  loading: boolean
  init: () => void
  signInWithGoogle: () => Promise<void>
  signInDemo: (role: 'student' | 'admin') => void
  signOut: () => Promise<void>
}

const DEMO_KEY = 'udpmap.demoRole'

async function fetchProfile(userId: string): Promise<{ role: Role; name: string | null }> {
  if (!supabase) return { role: 'guest', name: null }
  const { data } = await supabase.from('profiles').select('role, name').eq('id', userId).single()
  
  let role = (data?.role as Role | undefined) ?? 'student'
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

  return { role, name: name ?? null }
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
      }
      set({ user, loading: false })
      void fetchProfile(su.id).then(({ role, name }) => {
        set((state) => ({
          role,
          user: state.user ? { ...state.user, name: name || state.user.name } : null
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

  signInDemo: (role) => {
    localStorage.setItem(DEMO_KEY, role)
    set({
      user: {
        id: `demo-${role}`,
        email: `${role}@mail.udp.cl`,
        name: role === 'admin' ? 'Admin Demo' : 'Estudiante Demo',
        avatarUrl: null,
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
}))

export function currentUserName(): string {
  return useAuthStore.getState().user?.name ?? i18n.t('auth.guest')
}
