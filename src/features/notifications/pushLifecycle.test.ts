import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

// ─────────────────────────────────────────────────────────────────────────────
// El ciclo de vida del push en el dispositivo: activar, desactivar, sincronizar
// con el servidor, y qué pasa con la sesión.
//
// `pushStore.test.ts` prueba con qué estado NACE el store (el parpadeo). Esto
// prueba lo que ocurre después, y casi todo es una regla que costó entender:
//
//  - «Activadas» sale del navegador; lo que sabe el servidor va aparte.
//  - Se desuscribe el navegador ANTES de tocar el servidor.
//  - Una página no repite el registro del mismo endpoint en menos de una hora.
//  - El arranque nunca da de baja nada.
//  - La pista de iOS sale aunque Safari no tenga la API de push.
//
// El navegador y Supabase son dobles: aquí no hay red ni service worker.
// ─────────────────────────────────────────────────────────────────────────────

const api = vi.hoisted(() => ({
  registerPushSubscription: vi.fn(),
  deletePushSubscription: vi.fn(),
  getPushSessionUserId: vi.fn(),
}))
vi.mock('./api', () => api)

const VAPID_PUBLIC_KEY = 'BMsTXlUoAaxx9brDhqgGzaboSa-kzRSaUYHpXZAenxCWA6-rwTNes_iRUtr7wQtZsC_AIuMUSvXrYsNOFFjQuZQ'
const NEW_ENDPOINT = 'https://push.example/nuevo'
const OLD_ENDPOINT = 'https://push.example/viejo'

interface FakeBrowser {
  /** La suscripción que ve `getSubscription()`; `unsubscribe()` la quita. */
  current: FakeSubscription | null
  subscribe: ReturnType<typeof vi.fn>
  requestPermission: ReturnType<typeof vi.fn>
}

interface FakeSubscription {
  endpoint: string
  unsubscribe: ReturnType<typeof vi.fn>
}

function makeSubscription(browser: FakeBrowser, endpoint: string): FakeSubscription {
  const subscription: FakeSubscription = {
    endpoint,
    unsubscribe: vi.fn(async () => {
      browser.current = null
      return true
    }),
  }
  return subscription
}

interface BrowserOptions {
  permission?: NotificationPermission
  /** El endpoint con el que el navegador ya está suscrito, si lo está. */
  endpoint?: string | null
  /** Lo que contesta el diálogo de permisos. */
  answer?: NotificationPermission
}

function stubBrowser({ permission = 'granted', endpoint = null, answer = 'granted' }: BrowserOptions = {}): FakeBrowser {
  const browser: FakeBrowser = {
    current: null,
    subscribe: vi.fn(),
    requestPermission: vi.fn(async () => answer),
  }
  if (endpoint) browser.current = makeSubscription(browser, endpoint)
  browser.subscribe.mockImplementation(async () => {
    browser.current = makeSubscription(browser, NEW_ENDPOINT)
    return browser.current
  })

  const registration = {
    pushManager: {
      getSubscription: vi.fn(async () => browser.current),
      subscribe: browser.subscribe,
    },
  }
  vi.stubGlobal('Notification', { permission, requestPermission: browser.requestPermission })
  vi.stubGlobal('PushManager', class {})
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve(registration),
      getRegistration: vi.fn(async () => registration),
    },
  })
  return browser
}

/** Módulos nuevos para cada prueba: el store y sus memorias viven a nivel de módulo. */
async function freshStore() {
  vi.resetModules()
  return import('./pushStore')
}

beforeEach(() => {
  localStorage.clear()
  api.registerPushSubscription.mockReset().mockResolvedValue(undefined)
  api.deletePushSubscription.mockReset().mockResolvedValue(undefined)
  api.getPushSessionUserId.mockReset().mockResolvedValue('user-1')
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', VAPID_PUBLIC_KEY)
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  Reflect.deleteProperty(navigator, 'serviceWorker')
  Reflect.deleteProperty(navigator, 'userAgent')
  Reflect.deleteProperty(navigator, 'standalone')
})

describe('activar', () => {
  it('pide el permiso sin ningún await por delante', async () => {
    // En Safari el permiso solo se concede dentro de la activación del gesto del
    // clic, y un `await` de más antes de `requestPermission()` la puede agotar.
    const browser = stubBrowser({ permission: 'default' })
    const { subscribeToPush } = await freshStore()

    const activando = subscribeToPush()
    expect(browser.requestPermission).toHaveBeenCalledTimes(1)
    await activando
  })

  it('entre el permiso y subscribe() solo espera al navegador, nunca al servidor', async () => {
    // El mismo riesgo un paso más allá: si entre `requestPermission()` y
    // `subscribe()` se colara una espera de red (la sesión, el registro), Safari
    // podría dar el gesto por agotado y rechazar la suscripción. Lo único que
    // puede ir en medio es lo de siempre: el service worker y getSubscription().
    const browser = stubBrowser({ permission: 'default' })
    let serverCallsBeforeSubscribe = -1
    browser.subscribe.mockImplementation(async () => {
      serverCallsBeforeSubscribe = api.getPushSessionUserId.mock.calls.length
        + api.registerPushSubscription.mock.calls.length
        + api.deletePushSubscription.mock.calls.length
      browser.current = makeSubscription(browser, NEW_ENDPOINT)
      return browser.current
    })
    const { subscribeToPush } = await freshStore()

    await subscribeToPush()

    expect(browser.subscribe).toHaveBeenCalledTimes(1)
    expect(serverCallsBeforeSubscribe).toBe(0)
    expect(browser.requestPermission.mock.invocationCallOrder[0])
      .toBeLessThan(browser.subscribe.mock.invocationCallOrder[0])
  })

  it('suscribe, registra en el servidor y deja las dos verdades en orden', async () => {
    const browser = stubBrowser({ permission: 'default' })
    const { subscribeToPush, usePushStore } = await freshStore()

    await subscribeToPush()

    expect(browser.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) }),
    )
    expect(api.registerPushSubscription).toHaveBeenCalledWith(browser.current, null)
    const store = usePushStore.getState()
    expect(store.state).toBe('subscribed')
    expect(store.serverSync).toBe('ok')
    expect(store.endpoint).toBe(NEW_ENDPOINT)
    expect(store.operation).toBeNull()
    // Lo que el servidor confirmó queda recordado para detectar una rotación.
    expect(localStorage.getItem('udpmap.push.endpoint')).toBe(NEW_ENDPOINT)
  })

  it('si el servidor falla no dice «activadas»: error, y reintentar vuelve a activar', async () => {
    stubBrowser({ permission: 'default' })
    api.registerPushSubscription.mockRejectedValueOnce(new Error('fallo de red'))
    const { subscribeToPush, usePushStore } = await freshStore()

    await subscribeToPush()

    const fallo = usePushStore.getState()
    expect(fallo.state).toBe('error')
    expect(fallo.serverSync).toBe('failed')
    expect(fallo.operation).toBe('subscribe')
    expect(fallo.error).toBeTruthy()

    // «Reintentar» repite esta misma operación y ahora sí llega.
    await subscribeToPush()
    expect(usePushStore.getState().state).toBe('subscribed')
    expect(usePushStore.getState().serverSync).toBe('ok')
  })

  it('sin sesión queda suscrito, pero la tarjeta sabe que el servidor no se enteró', async () => {
    stubBrowser({ permission: 'default' })
    api.getPushSessionUserId.mockResolvedValue(null)
    const { subscribeToPush, usePushStore } = await freshStore()

    await subscribeToPush()

    expect(api.registerPushSubscription).not.toHaveBeenCalled()
    expect(usePushStore.getState().state).toBe('subscribed')
    expect(usePushStore.getState().serverSync).toBe('no-session')
  })

  it('un permiso denegado se queda en «bloqueadas» y no registra nada', async () => {
    stubBrowser({ permission: 'default', answer: 'denied' })
    const { subscribeToPush, usePushStore } = await freshStore()

    await subscribeToPush()

    expect(usePushStore.getState().state).toBe('denied')
    expect(api.registerPushSubscription).not.toHaveBeenCalled()
  })
})

describe('desactivar', () => {
  it('desuscribe el navegador ANTES de tocar el servidor, y reinicia el store', async () => {
    const browser = stubBrowser({ endpoint: NEW_ENDPOINT })
    localStorage.setItem('udpmap.push.endpoint', NEW_ENDPOINT)
    const { unsubscribeFromPush, usePushStore } = await freshStore()
    usePushStore.setState({ state: 'subscribed', endpoint: NEW_ENDPOINT, serverSync: 'ok' })
    const subscription = browser.current!

    await unsubscribeFromPush()

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
    expect(api.deletePushSubscription).toHaveBeenCalledWith(NEW_ENDPOINT)
    // Al revés, un borrado fallido abortaba la baja y el navegador seguía
    // recibiendo los avisos de la cuenta que salía.
    expect(subscription.unsubscribe.mock.invocationCallOrder[0])
      .toBeLessThan(api.deletePushSubscription.mock.invocationCallOrder[0])

    const store = usePushStore.getState()
    expect(store.state).toBe('idle')
    expect(store.endpoint).toBeNull()
    expect(store.serverSync).toBe('unknown')
    expect(localStorage.getItem('udpmap.push.endpoint')).toBeNull()
  })

  it('aunque el servidor falle, el dispositivo queda dado de baja', async () => {
    const browser = stubBrowser({ endpoint: NEW_ENDPOINT })
    api.deletePushSubscription.mockRejectedValue(new Error('sin conexión'))
    const { unsubscribeFromPush, usePushStore } = await freshStore()
    const subscription = browser.current!

    await unsubscribeFromPush()

    expect(subscription.unsubscribe).toHaveBeenCalled()
    expect(usePushStore.getState().state).toBe('idle')
    expect(usePushStore.getState().error).toBeNull()
  })

  it('también da de baja el endpoint anterior si el navegador rotó', async () => {
    stubBrowser({ endpoint: NEW_ENDPOINT })
    localStorage.setItem('udpmap.push.endpoint', OLD_ENDPOINT)
    const { unsubscribeFromPush } = await freshStore()

    await unsubscribeFromPush()

    expect(api.deletePushSubscription).toHaveBeenCalledWith(OLD_ENDPOINT)
    expect(api.deletePushSubscription).toHaveBeenCalledWith(NEW_ENDPOINT)
  })

  it('mientras desactiva, el store lo dice (no «Activando…»)', async () => {
    const browser = stubBrowser({ endpoint: NEW_ENDPOINT })
    const { unsubscribeFromPush, usePushStore } = await freshStore()
    const subscription = browser.current!
    let soltar: () => void = () => {}
    subscription.unsubscribe.mockImplementation(() => new Promise<boolean>((resolve) => {
      soltar = () => resolve(true)
    }))

    const desactivando = unsubscribeFromPush()
    await vi.waitFor(() => expect(subscription.unsubscribe).toHaveBeenCalled())

    expect(usePushStore.getState().state).toBe('loading')
    expect(usePushStore.getState().operation).toBe('unsubscribe')

    soltar()
    await desactivando
    expect(usePushStore.getState().operation).toBeNull()
  })

  it('si falla el navegador: error de DESACTIVAR, y reintentar repite desactivar', async () => {
    const browser = stubBrowser({ endpoint: NEW_ENDPOINT })
    const { unsubscribeFromPush, usePushStore } = await freshStore()
    const subscription = browser.current!
    subscription.unsubscribe.mockRejectedValueOnce(new Error('no se pudo'))

    await unsubscribeFromPush()

    const fallo = usePushStore.getState()
    expect(fallo.state).toBe('error')
    // El hook decide a qué vuelve «Reintentar» mirando esto. Antes volvía a activar.
    expect(fallo.operation).toBe('unsubscribe')
    expect(fallo.error).toMatch(/desactivar/i)
    // El servidor se intenta igual: es lo que corta la entrega a este aparato.
    expect(api.deletePushSubscription).toHaveBeenCalledWith(NEW_ENDPOINT)

    await unsubscribeFromPush()
    expect(usePushStore.getState().state).toBe('idle')
  })
})

describe('sincronizar con el servidor', () => {
  it('sin cambio de endpoint no manda p_old_endpoint', async () => {
    const browser = stubBrowser({ endpoint: NEW_ENDPOINT })
    localStorage.setItem('udpmap.push.endpoint', NEW_ENDPOINT)
    const { syncPushSubscription, usePushStore } = await freshStore()

    await syncPushSubscription()

    expect(api.registerPushSubscription).toHaveBeenCalledWith(browser.current, null)
    expect(usePushStore.getState().serverSync).toBe('ok')
  })

  it('con cambio de endpoint manda el anterior y recuerda el nuevo', async () => {
    const browser = stubBrowser({ endpoint: NEW_ENDPOINT })
    localStorage.setItem('udpmap.push.endpoint', OLD_ENDPOINT)
    const { syncPushSubscription } = await freshStore()

    await syncPushSubscription()

    expect(api.registerPushSubscription).toHaveBeenCalledWith(browser.current, OLD_ENDPOINT)
    expect(localStorage.getItem('udpmap.push.endpoint')).toBe(NEW_ENDPOINT)
  })

  it('un registro que falla no pisa el endpoint recordado ni lanza', async () => {
    stubBrowser({ endpoint: NEW_ENDPOINT })
    localStorage.setItem('udpmap.push.endpoint', OLD_ENDPOINT)
    api.registerPushSubscription.mockRejectedValue(new Error('500'))
    const { syncPushSubscription, usePushStore } = await freshStore()

    await expect(syncPushSubscription()).resolves.toBeUndefined()

    expect(usePushStore.getState().serverSync).toBe('failed')
    // Si se guardara el nuevo sin que el servidor lo supiera, la próxima
    // rotación perdería la pista de la fila vieja.
    expect(localStorage.getItem('udpmap.push.endpoint')).toBe(OLD_ENDPOINT)
  })

  it('sin sesión no llama a la RPC y lo anota', async () => {
    stubBrowser({ endpoint: NEW_ENDPOINT })
    api.getPushSessionUserId.mockResolvedValue(null)
    const { syncPushSubscription, usePushStore } = await freshStore()

    await syncPushSubscription()

    expect(api.registerPushSubscription).not.toHaveBeenCalled()
    expect(usePushStore.getState().serverSync).toBe('no-session')
  })

  it('no repite el registro del mismo usuario y endpoint en menos de una hora', async () => {
    stubBrowser({ endpoint: NEW_ENDPOINT })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T10:00:00Z'))
    const { syncPushSubscription, usePushStore } = await freshStore()

    await syncPushSubscription()
    await syncPushSubscription()
    expect(api.registerPushSubscription).toHaveBeenCalledTimes(1)
    expect(usePushStore.getState().serverSync).toBe('ok')

    // Pasada la hora, vuelve a registrar: así la base se entera de que el
    // dispositivo sigue vivo.
    vi.setSystemTime(new Date('2026-10-21T11:01:00Z'))
    await syncPushSubscription()
    expect(api.registerPushSubscription).toHaveBeenCalledTimes(2)

    // Y el botón de reintentar salta el control siempre.
    await syncPushSubscription({ force: true })
    expect(api.registerPushSubscription).toHaveBeenCalledTimes(3)
  })

  it('otro usuario en el mismo endpoint sí se registra', async () => {
    stubBrowser({ endpoint: NEW_ENDPOINT })
    const { syncPushSubscription } = await freshStore()

    await syncPushSubscription()
    api.getPushSessionUserId.mockResolvedValue('user-2')
    await syncPushSubscription()

    expect(api.registerPushSubscription).toHaveBeenCalledTimes(2)
  })

  it('dos resincronizaciones simultáneas hacen una sola RPC', async () => {
    stubBrowser({ endpoint: NEW_ENDPOINT })
    const { syncPushSubscription } = await freshStore()

    await Promise.all([syncPushSubscription(), syncPushSubscription()])

    expect(api.registerPushSubscription).toHaveBeenCalledTimes(1)
  })
})

describe('la pista de iOS', () => {
  function stubSafariTab() {
    // Una pestaña de Safari en iPhone: sin service worker, sin PushManager y sin
    // Notification. Es justo donde la pista tiene que salir.
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 Version/18.4 Mobile/15E148 Safari/604.1',
    })
  }

  it('el store nace en «ios-not-installed» aunque no exista la API de push', async () => {
    stubSafariTab()
    const { usePushStore, pushApiSupported } = await freshStore()

    expect(pushApiSupported()).toBe(false)
    expect(usePushStore.getState().state).toBe('ios-not-installed')
  })

  it('resolvePushState y subscribeToPush mantienen la pista y no piden permiso', async () => {
    stubSafariTab()
    const { usePushStore, resolvePushState, subscribeToPush } = await freshStore()

    await resolvePushState()
    expect(usePushStore.getState().state).toBe('ios-not-installed')

    await subscribeToPush()
    expect(usePushStore.getState().state).toBe('ios-not-installed')
  })

  it('instalada en la pantalla de inicio pero sin API, es «no soportado»', async () => {
    stubSafariTab()
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
    const { usePushStore } = await freshStore()

    expect(usePushStore.getState().state).toBe('unsupported')
  })
})

describe('la sesión', () => {
  async function freshSync() {
    const store = await freshStore()
    const hooks = await import('./usePushSubscription')
    return { ...store, ...hooks }
  }

  /** Deja pasar las promesas pendientes de la resolución y la resincronización. */
  const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

  it('el arranque hace UNA RPC de registro, no dos, y no repite al volver a primer plano', async () => {
    stubBrowser({ endpoint: NEW_ENDPOINT })
    const { usePushForegroundSync, usePushStore } = await freshSync()

    renderHook(() => usePushForegroundSync('user-1'))
    await vi.waitFor(() => expect(usePushStore.getState().state).toBe('subscribed'))
    await vi.waitFor(() => expect(api.registerPushSubscription).toHaveBeenCalledTimes(1))
    await flush()

    // Volver a primer plano con el mismo endpoint y usuario: ni una RPC más.
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    Reflect.deleteProperty(document, 'visibilityState')

    expect(api.registerPushSubscription).toHaveBeenCalledTimes(1)
  })

  it('el arranque (de null a un id) no da de baja nada y vuelve a resolver', async () => {
    const browser = stubBrowser({ endpoint: NEW_ENDPOINT })
    const { usePushForegroundSync, usePushStore } = await freshSync()
    const subscription = browser.current!

    const { rerender } = renderHook(({ id }) => usePushForegroundSync(id), {
      initialProps: { id: null as string | null },
    })
    await vi.waitFor(() => expect(usePushStore.getState().state).toBe('subscribed'))
    api.getPushSessionUserId.mockClear()

    // Llega la sesión guardada: la resolución anterior se hizo SIN ella.
    rerender({ id: 'user-1' })
    await vi.waitFor(() => expect(api.getPushSessionUserId).toHaveBeenCalled())
    await flush()

    expect(subscription.unsubscribe).not.toHaveBeenCalled()
    expect(api.deletePushSubscription).not.toHaveBeenCalled()
    expect(usePushStore.getState().state).toBe('subscribed')
    expect(usePushStore.getState().serverSync).toBe('ok')
  })

  it('de un id a null da de baja SOLO el navegador: el servidor ya no tiene sesión', async () => {
    const browser = stubBrowser({ endpoint: NEW_ENDPOINT })
    const { usePushForegroundSync, usePushStore } = await freshSync()
    const subscription = browser.current!

    const { rerender } = renderHook(({ id }) => usePushForegroundSync(id), {
      initialProps: { id: 'user-1' as string | null },
    })
    await vi.waitFor(() => expect(usePushStore.getState().state).toBe('subscribed'))
    await flush()

    rerender({ id: null })
    await vi.waitFor(() => expect(usePushStore.getState().state).toBe('idle'))

    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
    expect(api.deletePushSubscription).not.toHaveBeenCalled()
    expect(usePushStore.getState().endpoint).toBeNull()
    expect(usePushStore.getState().serverSync).toBe('unknown')
  })

  it('al volver una sesión después de perderla, se resuelve y sincroniza de nuevo', async () => {
    const browser = stubBrowser({ endpoint: NEW_ENDPOINT })
    const { usePushForegroundSync, usePushStore } = await freshSync()

    const { rerender } = renderHook(({ id }) => usePushForegroundSync(id), {
      initialProps: { id: 'user-1' as string | null },
    })
    await vi.waitFor(() => expect(usePushStore.getState().state).toBe('subscribed'))
    await flush()
    rerender({ id: null })
    await vi.waitFor(() => expect(usePushStore.getState().state).toBe('idle'))

    // Otra persona entra en el mismo aparato y el navegador vuelve a estar suscrito.
    browser.current = { endpoint: NEW_ENDPOINT, unsubscribe: vi.fn(async () => true) }
    api.getPushSessionUserId.mockResolvedValue('user-2')
    api.registerPushSubscription.mockClear()
    rerender({ id: 'user-2' })

    await vi.waitFor(() => expect(usePushStore.getState().state).toBe('subscribed'))
    await vi.waitFor(() => expect(api.registerPushSubscription).toHaveBeenCalledTimes(1))
  })
})
