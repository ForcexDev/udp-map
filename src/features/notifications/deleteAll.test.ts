import { describe, expect, it, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// "Vaciar todo" NO puede llevarse los avisos del equipo.
//
// El botón vive bajo "Tus avisos", enseña un recuento que solo cuenta los
// personales, y el diálogo promete borrar ESE número. La primera versión hacía
// un `delete().eq('user_id', …)` a secas, así que un administrador que vaciaba
// su bandeja destruía de paso la cola de denuncias —avisos de `audience:
// 'admin'` que ni se cuentan ni se enseñan ahí—.
//
// Es la clase de fallo que no se ve probando: hay que ser admin, tener avisos
// del equipo sin leer, y mirar otra pantalla para notar que faltan. Por eso
// queda fijado aquí.
// ─────────────────────────────────────────────────────────────────────────────

const filtros: Array<[string, unknown]> = []

const query = {
  delete: () => query,
  eq: (columna: string, valor: unknown) => {
    filtros.push([columna, valor])
    return query
  },
  then: (resolve: (r: { error: null }) => void) => resolve({ error: null }),
}

vi.mock('@/shared/lib/supabase', () => ({
  supabase: { from: () => query },
}))

const { deleteAllNotifications } = await import('./api')

beforeEach(() => {
  filtros.length = 0
})

describe('deleteAllNotifications', () => {
  it('acota el borrado a los avisos personales del usuario', async () => {
    await deleteAllNotifications('u-1', 'admin')

    expect(filtros).toContainEqual(['user_id', 'u-1'])
    // Sin este filtro, un admin se borraba la cola de denuncias sin saberlo.
    expect(filtros).toContainEqual(['audience', 'personal'])
  })

  it('nunca lanza un DELETE sin acotar', async () => {
    await deleteAllNotifications('u-2', 'student')
    expect(filtros.length).toBeGreaterThanOrEqual(2)
  })
})
