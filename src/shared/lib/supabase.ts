import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * Cliente Supabase, o `null` en MODO DEMO (sin variables de entorno).
 * En modo demo la capa de servicios (features/pins/api.ts) usa datos locales.
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const isSupabaseConfigured = supabase !== null

export const PHOTOS_BUCKET = 'pin-photos'
