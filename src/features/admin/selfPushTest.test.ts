import { describe, expect, it, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// "La migración no está aplicada" tiene que decirse con esas palabras.
//
// Se comprobó en vivo contra Supabase: al pulsar "Enviar prueba" sin haber
// pegado la migración 20260827000000, la llamada vuelve con 404 y `PGRST202`
// —PostgREST corta la RPC desconocida antes de que llegue a Postgres, así que
// el `42883` de Postgres NUNCA aparece—. Mirando solo ese código salía el texto
// crudo en inglés, que no le dice a nadie qué tiene que hacer.
// ─────────────────────────────────────────────────────────────────────────────

const rpc = vi.fn()
const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } })

vi.mock('@/shared/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    auth: { getSession: () => getSession() },
  },
}))

const { sendSelfPushTest } = await import('./api')

beforeEach(() => {
  rpc.mockReset()
  vi.stubGlobal('fetch', vi.fn())
})

describe('sendSelfPushTest cuando falta la migración', () => {
  it('reconoce el 404 de PostgREST (PGRST202), que es el caso real', async () => {
    rpc.mockResolvedValue({
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.admin_send_test_push_to_self without parameters in the schema cache',
      },
    })
    await expect(sendSelfPushTest()).rejects.toThrow(/Falta aplicar la migración 20260827000000/)
  })

  it('reconoce también el 42883 de Postgres', async () => {
    rpc.mockResolvedValue({
      error: { code: '42883', message: 'function public.admin_send_test_push_to_self() does not exist' },
    })
    await expect(sendSelfPushTest()).rejects.toThrow(/Falta aplicar la migración/)
  })

  it('un error distinto se cuenta tal cual, sin culpar a la migración', async () => {
    rpc.mockResolvedValue({
      error: { code: '42501', message: 'Solo los administradores pueden lanzar una prueba de push.' },
    })
    await expect(sendSelfPushTest()).rejects.toThrow('Solo los administradores pueden lanzar una prueba de push.')
  })

  it('sin sesión no llega a llamar a la RPC', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } })
    await expect(sendSelfPushTest()).rejects.toThrow(/sesión activa/)
    expect(rpc).not.toHaveBeenCalled()
  })
})
