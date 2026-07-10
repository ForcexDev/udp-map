// Edge Function `expire-pins` (Deno) — Sprint 2, Dev B.
//
// Borra pines temporales vencidos Y sus archivos del Storage (el DELETE en
// cascade de Postgres limpia fotos/comentarios/votos, pero NO los archivos:
// esta función evita la fuga de Storage detectada en la auditoría v1).
//
// Programar cada 30 min (Dashboard → Edge Functions → Schedules, o pg_cron+pg_net).
// Requiere SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (inyectadas por Supabase).

import { createClient } from 'jsr:@supabase/supabase-js@2'

const BUCKET = 'pin-photos'

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // 1. Pines vencidos con sus fotos
  const { data: expired, error } = await supabase
    .from('pins')
    .select('id, pin_photos(url)')
    .eq('is_permanent', false)
    .lt('expires_at', new Date().toISOString())

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
  if (!expired || expired.length === 0) {
    return new Response(JSON.stringify({ deleted: 0, files: 0 }))
  }

  // 2. Borrar archivos del Storage (url pública → ruta interna)
  const paths = expired
    .flatMap((pin) => (pin.pin_photos ?? []) as { url: string }[])
    .map((photo) => photo.url.split(`/${BUCKET}/`)[1])
    .filter((p): p is string => Boolean(p))

  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths)
    if (storageError) {
      // No abortar: preferimos borrar los rows igualmente y loguear la fuga
      console.error('storage cleanup failed', storageError.message)
    }
  }

  // 3. Borrar los pines (cascade limpia satélites)
  const ids = expired.map((p) => p.id)
  const { error: deleteError } = await supabase.from('pins').delete().in('id', ids)
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ deleted: ids.length, files: paths.length }))
})
