import { describe, expect, it, vi, beforeEach } from 'vitest'

// Los errores de la RPC de la prueba llegan tal cual: la migración que la crea
// (20260827000000) ya está en producción, así que un error ya no es «falta la
// migración», y disfrazarlo de eso escondería el motivo real.

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

describe('sendSelfPushTest cuando la RPC falla', () => {
  it('cuenta el error de la base tal cual', async () => {
    rpc.mockResolvedValue({
      error: {
        code: '42501',
        message: 'Solo los administradores pueden lanzar una prueba de push.',
      },
    })
    await expect(sendSelfPushTest()).rejects.toThrow(
      'Solo los administradores pueden lanzar una prueba de push.',
    )
  })

  it('sin sesión no llega a llamar a la RPC', async () => {
    getSession.mockResolvedValueOnce({ data: { session: null } })
    await expect(sendSelfPushTest()).rejects.toThrow(/sesión activa/)
    expect(rpc).not.toHaveBeenCalled()
  })
})
