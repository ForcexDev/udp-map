// El cliente de servicio y la comprobación de quién llama, compartidos por
// send-push y storage-gc. Estaban copiados en las dos y ya se habían separado:
// storage-gc leía los secretos con `!` y se enteraba de que faltaban al primer
// uso, no al cargar. La versión de supabase-js va fija, la misma del lock: con
// `@2` cada despliegue podía traer una distinta.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.1'

// Sin estas no hay nada que hacer: fallar al cargar el módulo con un mensaje
// claro, en vez de un `undefined` que explota más adelante.
export function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta la variable de entorno ${name}`)
  return value
}

export const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Opcional: sin él solo entra un administrador con sesión.
const cronSecret = Deno.env.get('CRON_SECRET')

// Quién llama: el cron (con `x-cron-secret`) o un administrador con sesión. Se
// devuelve quién es, y no solo si pasa, porque send-push contesta distinto a cada
// uno: al cron antes de los 5 s de pg_net, y al panel con el resultado.
export async function isAuthorized(req: Request): Promise<'cron' | 'admin' | null> {
  const providedSecret = req.headers.get('x-cron-secret')
  if (cronSecret && providedSecret === cronSecret) return 'cron'

  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null

  const token = authorization.slice('Bearer '.length)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  return profile?.role === 'admin' ? 'admin' : null
}
