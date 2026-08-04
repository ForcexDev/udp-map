/**
 * Los errores que devuelve Supabase no son instancias de `Error`: son objetos
 * planos con `message` y `code`. Hacer `error instanceof Error ? ... :
 * String(error)` sobre uno de ellos produce "[object Object]", que fue
 * exactamente lo que pasaba con los mensajes de las funciones de la base.
 */
export function dbErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return ''
}

/**
 * Distingue un mensaje escrito para el usuario de uno técnico que no debería
 * salir de los logs.
 *
 * El criterio es el SQLSTATE: `raise exception` en plpgsql sin código explícito
 * produce siempre `P0001`, y ese es justo el que usan nuestras funciones para
 * explicar por qué rechazan algo. Los fallos que no queremos enseñar traen otro
 * — 23505 clave duplicada, 42501 permiso denegado, 23503 clave foránea — así
 * que la regla separa las dos familias sin tener que mantener una lista de
 * mensajes conocidos, que se desincronizaría a la primera.
 */
export function isUserFacingDbError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false
  return (err as { code?: unknown }).code === 'P0001'
}
