import { supabase } from './supabase'

export type PublicProfile = { name?: string | null; avatar_url?: string | null }

/**
 * profiles_public: RLS solo deja leer el perfil propio o el de un admin en la
 * tabla base, así que el autor/creador de contenido ajeno se resuelve por la vista.
 * Devuelve un Map vacío en modo demo o si no hay ids que resolver.
 */
export async function fetchPublicProfiles(
  ids: (string | null | undefined)[],
): Promise<Map<string, PublicProfile>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))]
  if (!supabase || unique.length === 0) return new Map()

  const { data, error } = await supabase
    .from('profiles_public')
    .select('id, name, avatar_url')
    .in('id', unique)

  if (error) throw error
  return new Map((data ?? []).map((p) => [p.id as string, p as PublicProfile]))
}
