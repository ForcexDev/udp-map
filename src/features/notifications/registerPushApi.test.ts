import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// El registro de la suscripción contra la base, con `p_old_endpoint`.
//
// Lo que importa aquí es el orden de despliegue: el frontend puede salir ANTES
// que la migración 20261021000100. Con la base vieja, una llamada con
// `p_old_endpoint` ni llega a Postgres (PostgREST no encuentra esa firma), y si
// el cliente no reintentara sin él, ningún dispositivo volvería a registrarse
// hasta que alguien aplicara la migración.
// ─────────────────────────────────────────────────────────────────────────────

const supa = vi.hoisted(() => ({
  rpc: vi.fn(),
  auth: { getSession: vi.fn() },
}))
vi.mock('@/shared/lib/supabase', () => ({ supabase: supa }))

import { getPushSessionUserId, registerPushSubscription } from './api'

const CURRENT = 'https://push.example/actual'
const OLD = 'https://push.example/anterior'

function fakeSubscription(endpoint = CURRENT): PushSubscription {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'clave-p256dh', auth: 'clave-auth' } }),
  } as unknown as PushSubscription
}

const BASE_PARAMS = {
  p_endpoint: CURRENT,
  p_p256dh: 'clave-p256dh',
  p_auth: 'clave-auth',
  p_user_agent: navigator.userAgent,
}

beforeEach(() => {
  supa.rpc.mockReset().mockResolvedValue({ error: null })
  supa.auth.getSession.mockReset()
})

describe('registerPushSubscription', () => {
  it('sin endpoint anterior manda solo los cuatro parámetros de siempre', async () => {
    await registerPushSubscription(fakeSubscription())

    expect(supa.rpc).toHaveBeenCalledTimes(1)
    expect(supa.rpc).toHaveBeenCalledWith('register_push_subscription', BASE_PARAMS)
  })

  it('con un endpoint anterior distinto manda p_old_endpoint', async () => {
    await registerPushSubscription(fakeSubscription(), OLD)

    expect(supa.rpc).toHaveBeenCalledTimes(1)
    expect(supa.rpc).toHaveBeenCalledWith('register_push_subscription', {
      ...BASE_PARAMS,
      p_old_endpoint: OLD,
    })
  })

  it('si el anterior es el mismo que el actual, no hay nada que mover', async () => {
    await registerPushSubscription(fakeSubscription(), CURRENT)

    expect(supa.rpc).toHaveBeenCalledWith('register_push_subscription', BASE_PARAMS)
  })

  it.each([
    ['PGRST202', { code: 'PGRST202', message: 'no existe' }],
    ['42883', { code: '42883', message: 'function does not exist' }],
    [
      'el mensaje de PostgREST',
      {
        code: 'PGRST999',
        message:
          'Could not find the function public.register_push_subscription(...) in the schema cache',
      },
    ],
  ])('con la base sin migrar (%s) reintenta sin p_old_endpoint', async (_caso, error) => {
    supa.rpc.mockResolvedValueOnce({ error })

    await expect(registerPushSubscription(fakeSubscription(), OLD)).resolves.toBeUndefined()

    expect(supa.rpc).toHaveBeenCalledTimes(2)
    expect(supa.rpc).toHaveBeenNthCalledWith(1, 'register_push_subscription', {
      ...BASE_PARAMS,
      p_old_endpoint: OLD,
    })
    expect(supa.rpc).toHaveBeenNthCalledWith(2, 'register_push_subscription', BASE_PARAMS)
  })

  it('cualquier otro error se lanza sin reintentar', async () => {
    const error = { code: '42501', message: 'permission denied' }
    supa.rpc.mockResolvedValueOnce({ error })

    await expect(registerPushSubscription(fakeSubscription(), OLD)).rejects.toBe(error)
    expect(supa.rpc).toHaveBeenCalledTimes(1)
  })

  it('si el reintento sin p_old_endpoint también falla, lanza ESE error', async () => {
    const segundo = { code: '23505', message: 'duplicado' }
    supa.rpc
      .mockResolvedValueOnce({ error: { code: 'PGRST202', message: 'x' } })
      .mockResolvedValueOnce({ error: segundo })

    await expect(registerPushSubscription(fakeSubscription(), OLD)).rejects.toBe(segundo)
  })

  it('una suscripción incompleta no llega a la base', async () => {
    const incompleta = {
      endpoint: CURRENT,
      toJSON: () => ({ endpoint: CURRENT }),
    } as unknown as PushSubscription

    await expect(registerPushSubscription(incompleta)).rejects.toThrow()
    expect(supa.rpc).not.toHaveBeenCalled()
  })
})

describe('getPushSessionUserId', () => {
  it('devuelve el id de quien tiene sesión', async () => {
    supa.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } })
    await expect(getPushSessionUserId()).resolves.toBe('user-1')
  })

  it('devuelve null sin sesión', async () => {
    supa.auth.getSession.mockResolvedValue({ data: { session: null } })
    await expect(getPushSessionUserId()).resolves.toBeNull()
  })

  it('en modo demo, sin Supabase, no hay sesión que consultar', async () => {
    vi.resetModules()
    vi.doMock('@/shared/lib/supabase', () => ({ supabase: null }))
    try {
      const demo = await import('./api')
      await expect(demo.getPushSessionUserId()).resolves.toBeNull()
    } finally {
      vi.doUnmock('@/shared/lib/supabase')
    }
  })
})
