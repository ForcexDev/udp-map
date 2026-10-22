import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Cerrar sesión y el push del dispositivo.
//
// Antes `signOut` borraba la fila del servidor y DESPUÉS desuscribía el
// navegador: si el borrado fallaba, la desuscripción no ocurría y el aparato
// seguía recibiendo los avisos de la cuenta que acababa de salir. Además dejaba
// el store de push como estaba, con «Activadas» pintado para nadie.
//
// Aquí el authStore y el pushStore son los de verdad; solo son dobles el
// navegador, la API de datos y el cliente de Supabase.
// ─────────────────────────────────────────────────────────────────────────────

const api = vi.hoisted(() => ({
  registerPushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
  getPushSessionUserId: vi.fn(),
}))
vi.mock('@/features/notifications/api', () => api)

const supa = vi.hoisted(() => ({
  auth: { signOut: vi.fn(), onAuthStateChange: vi.fn() },
}))
vi.mock('@/shared/lib/supabase', () => ({ supabase: supa, isSupabaseConfigured: true }))

const ENDPOINT = 'https://push.example/dispositivo'

function stubBrowserSubscribed() {
  const subscription = {
    endpoint: ENDPOINT,
    unsubscribe: vi.fn(async () => true),
  }
  const registration = { pushManager: { getSubscription: vi.fn(async () => subscription) } }
  vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
  vi.stubGlobal('PushManager', class {})
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve(registration),
      getRegistration: vi.fn(async () => registration),
    },
  })
  return subscription
}

async function freshModules() {
  vi.resetModules()
  const push = await import('./pushStore')
  const auth = await import('@/features/auth/authStore')
  return { ...push, useAuthStore: auth.useAuthStore }
}

beforeEach(() => {
  localStorage.clear()
  api.registerPushSubscription.mockReset().mockResolvedValue(undefined)
  api.deletePushSubscription.mockReset().mockResolvedValue(undefined)
  api.getPushSessionUserId.mockReset().mockResolvedValue('user-1')
  supa.auth.signOut.mockReset().mockResolvedValue({ error: null })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('signOut', () => {
  it('desuscribe el navegador, borra la fila y SOLO DESPUÉS cierra la sesión', async () => {
    const subscription = stubBrowserSubscribed()
    const { useAuthStore, usePushStore } = await freshModules()
    usePushStore.setState({ state: 'subscribed', endpoint: ENDPOINT, serverSync: 'ok' })

    await useAuthStore.getState().signOut()

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
    expect(api.deletePushSubscription).toHaveBeenCalledWith(ENDPOINT)
    const order = [
      subscription.unsubscribe.mock.invocationCallOrder[0],
      api.deletePushSubscription.mock.invocationCallOrder[0],
      supa.auth.signOut.mock.invocationCallOrder[0],
    ]
    // Navegador, servidor, sesión: el borrado necesita la sesión viva.
    expect(order).toEqual([...order].sort((a, b) => a - b))

    expect(useAuthStore.getState().user).toBeNull()
  })

  it('deja el store de push reiniciado, no con «Activadas» para nadie', async () => {
    stubBrowserSubscribed()
    localStorage.setItem('udpmap.push.endpoint', ENDPOINT)
    const { useAuthStore, usePushStore } = await freshModules()
    usePushStore.setState({ state: 'subscribed', endpoint: ENDPOINT, serverSync: 'ok' })

    await useAuthStore.getState().signOut()

    const push = usePushStore.getState()
    expect(push.state).toBe('idle')
    expect(push.endpoint).toBeNull()
    expect(push.serverSync).toBe('unknown')
    expect(localStorage.getItem('udpmap.push.endpoint')).toBeNull()
  })

  it('aunque el servidor no responda, el navegador queda desuscrito y la sesión se cierra', async () => {
    const subscription = stubBrowserSubscribed()
    api.deletePushSubscription.mockRejectedValue(new Error('sin conexión'))
    const { useAuthStore } = await freshModules()

    await useAuthStore.getState().signOut()

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
    expect(supa.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('aunque el navegador no pueda desuscribir, la sesión se cierra igual', async () => {
    const subscription = stubBrowserSubscribed()
    subscription.unsubscribe.mockRejectedValue(new Error('no se pudo'))
    const { useAuthStore } = await freshModules()

    await useAuthStore.getState().signOut()

    expect(supa.auth.signOut).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().user).toBeNull()
  })
})
