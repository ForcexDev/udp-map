// =============================================================================
// storage-gc — vacía la cola de archivos huérfanos de Storage
// =============================================================================
// Postgres no puede borrar un archivo de Storage: borrar la fila de
// storage.objects elimina el metadato pero deja el binario en S3, invisible y
// facturable. Por eso el trigger on_pin_photo_deleted solo encola la ruta en
// public.storage_cleanup_queue, y el borrado real lo hace esta función, que sí
// habla con la API de Storage.
//
// La invoca un cron cada 10 minutos con la misma cabecera x-cron-secret que
// send-push, de modo que reutiliza los secretos de Vault que ya existen.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cronSecret = Deno.env.get('CRON_SECRET')!

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Cuántos archivos se procesan por ejecución. Con el cron cada 10 minutos da
// margen de sobra para el ritmo real de borrados.
const BATCH_SIZE = 200

// Tras estos intentos se deja de reintentar y la fila se marca procesada con su
// error a la vista, para que un fallo permanente no bloquee la cola para siempre.
const MAX_ATTEMPTS = 5

interface QueueRow {
  id: number
  bucket_id: string
  path: string
  attempts: number
}

async function isAuthorized(req: Request): Promise<boolean> {
  const providedSecret = req.headers.get('x-cron-secret')
  if (cronSecret && providedSecret === cronSecret) return true

  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false

  const token = authorization.slice('Bearer '.length)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  return profile?.role === 'admin'
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!await isAuthorized(req)) return json({ error: 'Unauthorized' }, 401)

  const { data, error } = await supabase
    .from('storage_cleanup_queue')
    .select('id, bucket_id, path, attempts')
    .is('processed_at', null)
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  if (error) {
    console.error('No se pudo leer la cola de limpieza', error)
    return json({ error: error.message }, 500)
  }

  const rows = (data ?? []) as QueueRow[]
  if (rows.length === 0) return json({ deleted: 0, failed: 0 })

  // Un bucket por lote: hoy solo existe pin-photos, pero agrupar evita tener
  // que tocar esto si mañana hay otro.
  const byBucket = new Map<string, QueueRow[]>()
  for (const row of rows) {
    const list = byBucket.get(row.bucket_id) ?? []
    list.push(row)
    byBucket.set(row.bucket_id, list)
  }

  let deleted = 0
  let failed = 0

  for (const [bucket, bucketRows] of byBucket) {
    const { error: removeError } = await supabase
      .storage
      .from(bucket)
      .remove(bucketRows.map((r) => r.path))

    if (removeError) {
      console.error(`Fallo borrando ${bucketRows.length} archivos de ${bucket}`, removeError)
      failed += bucketRows.length
      // Se anota el intento en cada fila para que el reintento tenga límite.
      for (const row of bucketRows) {
        await supabase
          .from('storage_cleanup_queue')
          .update({
            attempts: row.attempts + 1,
            last_error: removeError.message,
            // Agotados los intentos, se cierra la fila para no volver sobre ella.
            ...(row.attempts + 1 >= MAX_ATTEMPTS ? { processed_at: new Date().toISOString() } : {}),
          })
          .eq('id', row.id)
      }
      continue
    }

    // remove() no falla por un archivo que ya no está, que es justo lo que
    // queremos: la cola es idempotente y reprocesarla no rompe nada.
    const { error: markError } = await supabase
      .from('storage_cleanup_queue')
      .update({ processed_at: new Date().toISOString() })
      .in('id', bucketRows.map((r) => r.id))

    if (markError) {
      // Los archivos ya no están; solo quedó la cola sin marcar. La siguiente
      // pasada los reintentará sin consecuencias.
      console.error('Archivos borrados pero no se pudo marcar la cola', markError)
    }

    deleted += bucketRows.length
  }

  return json({ deleted, failed })
})
