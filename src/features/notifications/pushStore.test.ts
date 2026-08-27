import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// Estas pruebas cubren EL BUG: la pestaña de avisos parpadeaba entre «Activar»
// y «Desactivar» al volver a abrirla, con las notificaciones ya activadas.
//
// La causa no era de pintura: el estado vivía en un `useState` dentro del hook,
// los consumidores se desmontan (el Sidebar se cierra, Radix desmonta la
// pestaña inactiva) y cada reaparición volvía a empezar en "no suscrito" hasta
// que el service worker y una llamada de red respondían.
//
// Por eso lo que se prueba aquí es CON QUÉ ESTADO NACE el store, que es lo que
// se pinta en el primer frame, y no solo dónde acaba.
// ─────────────────────────────────────────────────────────────────────────────

interface StubOptions {
  permission?: NotificationPermission
  /** Lo que devuelve `pushManager.getSubscription()`. */
  subscription?: { endpoint: string } | null
  /** Sin esto se simula un navegador que no soporta push. */
  supported?: boolean
}

function stubPushEnvironment({
  permission = 'granted',
  subscription = { endpoint: 'https://push.example/abc' },
  supported = true,
}: StubOptions = {}) {
  if (!supported) {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'serviceWorker')
    return
  }

  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn() })
  vi.stubGlobal('PushManager', class {})
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: { getSubscription: () => Promise.resolve(subscription) },
      }),
    },
  })
}

async function freshStore() {
  vi.resetModules()
  return import('./pushStore')
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

describe('el estado inicial del store', () => {
  it('arranca en «suscrito» si el permiso está dado y ya lo estaba: es lo que evita el parpadeo', async () => {
    localStorage.setItem('udpmap.push.subscribed', 'true')
    stubPushEnvironment({ permission: 'granted' })

    const { usePushStore } = await freshStore()

    // Nada de red todavía, y aun así la interfaz ya sabe qué pintar. Antes esto
    // era 'idle', o sea el botón «Activar» durante medio segundo.
    expect(usePushStore.getState().state).toBe('subscribed')
  })

  it('no inventa una suscripción cuando no hay recuerdo de ella', async () => {
    stubPushEnvironment({ permission: 'granted' })
    const { usePushStore } = await freshStore()
    // 'unknown' pinta esqueleto: no sabemos, y decir «Activar» sería mentir.
    expect(usePushStore.getState().state).toBe('unknown')
  })

  it('sin permiso concedido, el recuerdo no manda', async () => {
    localStorage.setItem('udpmap.push.subscribed', 'true')
    stubPushEnvironment({ permission: 'default' })
    const { usePushStore } = await freshStore()
    expect(usePushStore.getState().state).toBe('idle')
  })

  it('bloqueadas en el navegador se ve desde el primer frame', async () => {
    localStorage.setItem('udpmap.push.subscribed', 'true')
    stubPushEnvironment({ permission: 'denied' })
    const { usePushStore } = await freshStore()
    expect(usePushStore.getState().state).toBe('denied')
  })

  it('un navegador sin Web Push se declara no soportado', async () => {
    stubPushEnvironment({ supported: false })
    const { usePushStore } = await freshStore()
    expect(usePushStore.getState().state).toBe('unsupported')
  })
})

describe('resolvePushState', () => {
  it('corrige el recuerdo cuando el navegador ya no tiene suscripción', async () => {
    localStorage.setItem('udpmap.push.subscribed', 'true')
    stubPushEnvironment({ permission: 'granted', subscription: null })

    const { usePushStore, resolvePushState } = await freshStore()
    expect(usePushStore.getState().state).toBe('subscribed')

    await resolvePushState()

    expect(usePushStore.getState().state).toBe('idle')
    // Y el recuerdo se corrige, para que la próxima carga no vuelva a mentir.
    expect(localStorage.getItem('udpmap.push.subscribed')).toBe('false')
  })

  it('guarda el endpoint para el diagnóstico del panel', async () => {
    stubPushEnvironment({ permission: 'granted', subscription: { endpoint: 'https://push.example/xyz' } })

    const { usePushStore, resolvePushState } = await freshStore()
    await resolvePushState()

    expect(usePushStore.getState().state).toBe('subscribed')
    expect(usePushStore.getState().endpoint).toBe('https://push.example/xyz')
  })

  it('no se cuelga para siempre si no hay service worker registrado', async () => {
    // `navigator.serviceWorker.ready` NO rechaza cuando no hay service worker:
    // se queda pendiente eternamente. Pasa en el servidor de desarrollo, donde
    // vite-plugin-pwa solo inyecta el service worker en la compilación. Sin
    // límite de espera, «Activar» pedía el permiso, lo conseguía, y se quedaba
    // en «Activando…» sin un solo error en la consola.
    vi.useFakeTimers()
    try {
      vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
      vi.stubGlobal('PushManager', class {})
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: { ready: new Promise(() => {}) }, // la que nunca resuelve
      })

      const { usePushStore, resolvePushState } = await freshStore()
      const resolved = resolvePushState()
      await vi.advanceTimersByTimeAsync(11_000)
      await resolved

      expect(usePushStore.getState().state).toBe('idle')
    } finally {
      vi.useRealTimers()
    }
  })

  it('se resuelve una sola vez aunque la pidan varios paneles a la vez', async () => {
    const getSubscription = vi.fn().mockResolvedValue({ endpoint: 'https://push.example/abc' })
    vi.stubGlobal('Notification', { permission: 'granted', requestPermission: vi.fn() })
    vi.stubGlobal('PushManager', class {})
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription } }) },
    })

    const { resolvePushState } = await freshStore()
    await Promise.all([resolvePushState(), resolvePushState(), resolvePushState()])

    // Tres llamadas concurrentes comparten UNA resolución. La cota es 3 y no 1
    // porque la resincronización en segundo plano consulta también, y si ha
    // arrancado ya o no depende de los tiempos; lo que no puede pasar es que
    // haya una resolución por cada quien pregunta, que serían tres —y con
    // ellas, tres llamadas de red a Supabase cada vez que se abre el panel.
    expect(getSubscription.mock.calls.length).toBeLessThan(3)
    expect(getSubscription).toHaveBeenCalled()
  })
})
