/**
 * ¿La RPC falló porque la función no existe, o sea, porque falta aplicar una
 * migración? Llega por dos caminos y hay que mirar los dos: `42883` es el código
 * de Postgres, pero una RPC desconocida ni siquiera llega a Postgres: PostgREST
 * la corta antes con un 404 y `PGRST202`.
 *
 * El texto solo cuenta si habla de una FUNCIÓN. Antes el panel aceptaba
 * cualquier "does not exist", y una columna o una tabla que faltaba se leía como
 * "falta la migración de esta función".
 */
export function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return (
    error.code === '42883' ||
    error.code === 'PGRST202' ||
    /could not find the function|function .* does not exist/i.test(error.message ?? '')
  )
}
