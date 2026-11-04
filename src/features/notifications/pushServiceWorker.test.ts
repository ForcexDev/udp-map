import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
// El service worker de push (`public/push-sw.js`), cargado con un `self` falso.
//
// Es JavaScript suelto que se sirve tal cual, sin pasar por TypeScript ni por
// el compilador, y es lo que decide si una notificación aparece en el teléfono.
// Hasta ahora nada lo probaba: un error de lectura del payload se veía solo en
// un iPhone.
//
// Las reglas que se fijan:
//
//  1. Con el payload HÍBRIDO que envía `send-push` hoy, la notificación sale
//     exactamente igual que con el service worker anterior. El `oráculo` de
//     abajo es ese código, copiado, y es lo que impide que adelgazar el
//     payload cambie lo que se pinta sin que nadie se entere.
//  2. El payload DECLARATIVO puro (sin campos planos) pinta lo mismo.
//  3. Lo que no se pueda leer o pintar muestra una notificación mínima: Safari
//     revoca el permiso a quien recibe pushes que no muestran nada.
//  4. El clic no cambió.
// ─────────────────────────────────────────────────────────────────────────────

const ORIGIN = 'https://udp-map.vercel.app'
const SOURCE = readFileSync(path.resolve(process.cwd(), 'public/push-sw.js'), 'utf8')

type Handler = (event: unknown) => void

function loadServiceWorker() {
  const handlers: Record<string, Handler> = {}
  const showNotification = vi.fn().mockResolvedValue(undefined)
  const subscribe = vi.fn().mockResolvedValue({})
  const clients = {
    matchAll: vi.fn().mockResolvedValue([]),
    openWindow: vi.fn().mockResolvedValue(null),
  }
  const self = {
    addEventListener: (type: string, handler: Handler) => {
      handlers[type] = handler
    },
    registration: { showNotification, pushManager: { subscribe } },
    location: { origin: ORIGIN },
    clients,
  }
  new Function('self', SOURCE)(self)
  return { handlers, showNotification, subscribe, clients }
}

/** Un evento `push`. `payload` string = texto crudo (para probar JSON roto); `undefined` = sin datos. */
function pushEvent(payload?: unknown) {
  const pending: Promise<unknown>[] = []
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload)
  return {
    data: payload === undefined ? null : { json: () => JSON.parse(raw), text: () => raw },
    waitUntil: (promise: Promise<unknown>) => {
      pending.push(promise)
    },
    settled: () => Promise.all(pending),
  }
}

async function receive(sw: ReturnType<typeof loadServiceWorker>, payload?: unknown) {
  const event = pushEvent(payload)
  sw.handlers.push(event)
  await event.settled()
}

// ── El payload que envía send-push ──────────────────────────────────────────

interface Aviso {
  id: string
  title: string
  body: string
  url: string
  type: string
  category: string
  payload: Record<string, unknown>
}

const AVISO: Aviso = {
  id: '0b1c2d3e-aaaa-4bbb-8ccc-1234567890ab',
  title: 'Evento próximo',
  body: '“Feria UDP” comienza mañana',
  url: '/eventos?event=42',
  type: 'event_reminder',
  category: 'events',
  payload: { eventId: '42' },
}

/** El payload híbrido tal cual lo arma send-push/index.ts. */
function hybridPayload(aviso: Aviso) {
  return {
    web_push: 8030,
    notification: {
      title: aviso.title || 'UDP Map',
      body: aviso.body || 'Tienes una nueva notificación.',
      navigate: `${ORIGIN}${aviso.url || '/'}`,
      icon: `${ORIGIN}/pwa-192x192.png`,
      lang: 'es',
      tag: aviso.id,
      data: {
        url: aviso.url || '/',
        notificationId: aviso.id,
        type: aviso.type,
        category: aviso.category,
        payload: aviso.payload,
      },
    },
    notificationId: aviso.id,
    title: aviso.title,
    body: aviso.body,
    url: aviso.url,
    type: aviso.type,
    category: aviso.category,
    payload: aviso.payload,
  }
}

/** El payload declarativo puro: SOLO `web_push` y `notification`, sin planos ni `payload`. */
function declarativePayload(aviso: Aviso) {
  return {
    web_push: 8030,
    notification: {
      title: aviso.title || 'UDP Map',
      body: aviso.body || 'Tienes una nueva notificación.',
      navigate: `${ORIGIN}${aviso.url || '/'}`,
      icon: `${ORIGIN}/pwa-192x192.png`,
      lang: 'es',
      tag: aviso.id,
      data: {
        url: aviso.url || '/',
        notificationId: aviso.id,
        type: aviso.type,
        category: aviso.category,
      },
    },
  }
}

/**
 * El oráculo: lo que hacía el `push` del service worker anterior (HEAD en
 * 699dbd4), que leía SOLO los campos planos. Copiado a propósito y no importado:
 * si alguien cambia el real, esto tiene que seguir diciendo qué era "igual".
 */
function previousServiceWorker(data: Record<string, unknown>): [string, Record<string, unknown>] {
  return [
    (data.title as string) || 'UDP Map',
    {
      body: (data.body as string) || 'Tienes una nueva notificación.',
      icon: '/pwa-192x192.png',
      badge: '/notification-badge.png',
      tag:
        (data.notificationId as string) ||
        `${(data.type as string) || 'notification'}:${Date.now()}`,
      renotify: false,
      timestamp: Date.now(),
      lang: 'es',
      data: {
        url: (data.url as string) || '/',
        notificationId: (data.notificationId as string) || null,
      },
    },
  ]
}

const MINIMAL: [string, Record<string, unknown>] = [
  'UDP Map',
  {
    body: 'Tienes una nueva notificación.',
    icon: '/pwa-192x192.png',
    badge: '/notification-badge.png',
    lang: 'es',
    data: { url: '/', notificationId: null },
  },
]

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-21T15:00:00Z'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('push: payload híbrido (el que se envía hoy)', () => {
  it.each([
    ['un aviso completo', AVISO],
    ['sin URL', { ...AVISO, url: '' }],
    ['la URL raíz', { ...AVISO, url: '/' }],
    ['sin título', { ...AVISO, title: '' }],
    ['sin cuerpo', { ...AVISO, body: '' }],
    [
      'una difusión con tipo distinto',
      { ...AVISO, type: 'announcement', category: 'system', url: '/mapa?pin=7' },
    ],
  ])('%s: pinta exactamente lo mismo que el service worker anterior', async (_caso, aviso) => {
    const sw = loadServiceWorker()
    const payload = hybridPayload(aviso)

    await receive(sw, payload)

    expect(sw.showNotification).toHaveBeenCalledTimes(1)
    expect(sw.showNotification.mock.calls[0]).toEqual(previousServiceWorker(payload))
  })

  it('el aviso lleva su id como tag y como destino del clic', async () => {
    const sw = loadServiceWorker()

    await receive(sw, hybridPayload(AVISO))

    const [title, options] = sw.showNotification.mock.calls[0]
    expect(title).toBe('Evento próximo')
    expect(options.tag).toBe(AVISO.id)
    expect(options.data).toEqual({ url: '/eventos?event=42', notificationId: AVISO.id })
  })
})

describe('push: payload declarativo puro', () => {
  it('pinta los mismos valores que el híbrido', async () => {
    const hybrid = loadServiceWorker()
    await receive(hybrid, hybridPayload(AVISO))

    const declarative = loadServiceWorker()
    await receive(declarative, declarativePayload(AVISO))

    expect(declarative.showNotification.mock.calls[0]).toEqual(
      hybrid.showNotification.mock.calls[0],
    )
  })

  it('sin campos planos, el destino y la marca del aviso salen del bloque', async () => {
    const sw = loadServiceWorker()

    await receive(sw, declarativePayload(AVISO))

    const [, options] = sw.showNotification.mock.calls[0]
    expect(options.tag).toBe(AVISO.id)
    expect(options.data).toEqual({ url: '/eventos?event=42', notificationId: AVISO.id })
  })

  it('un bloque al que le falta un campo cae al plano de la raíz, no a los valores por defecto', async () => {
    // Lo que rompía leer `data.notification || data` entero: con un bloque sin
    // `data` ni `tag`, el clic abría `/` y el aviso quedaba sin marcar.
    const sw = loadServiceWorker()

    await receive(sw, {
      notification: { title: 'Solo título' },
      notificationId: AVISO.id,
      url: '/foro?thread=3',
      body: 'Cuerpo plano',
    })

    const [title, options] = sw.showNotification.mock.calls[0]
    expect(title).toBe('Solo título')
    expect(options.body).toBe('Cuerpo plano')
    expect(options.tag).toBe(AVISO.id)
    expect(options.data).toEqual({ url: '/foro?thread=3', notificationId: AVISO.id })
  })

  it('un payload vacío o sin datos muestra el aviso genérico, con el tag por tipo y hora de siempre', async () => {
    const sw = loadServiceWorker()
    await receive(sw, {})
    expect(sw.showNotification.mock.calls[0]).toEqual(previousServiceWorker({}))

    const sinDatos = loadServiceWorker()
    await receive(sinDatos)
    expect(sinDatos.showNotification.mock.calls[0]).toEqual(previousServiceWorker({}))
  })

  it('un JSON válido que no es un objeto no rompe nada', async () => {
    const sw = loadServiceWorker()

    await receive(sw, 'null')
    await receive(sw, '"hola"')

    expect(sw.showNotification).toHaveBeenCalledTimes(2)
    expect(sw.showNotification.mock.calls[0]).toEqual(previousServiceWorker({}))
    expect(sw.showNotification.mock.calls[1]).toEqual(previousServiceWorker({}))
  })
})

describe('push: cuando algo falla se muestra una notificación mínima', () => {
  it('con JSON roto', async () => {
    const sw = loadServiceWorker()

    await receive(sw, '{esto no es json')

    expect(sw.showNotification).toHaveBeenCalledTimes(1)
    expect(sw.showNotification.mock.calls[0]).toEqual(MINIMAL)
  })

  it('si showNotification lanza con el aviso, se reintenta con la mínima', async () => {
    const sw = loadServiceWorker()
    sw.showNotification.mockRejectedValueOnce(new Error('opciones inválidas'))

    await receive(sw, hybridPayload(AVISO))

    expect(sw.showNotification).toHaveBeenCalledTimes(2)
    expect(sw.showNotification.mock.calls[0][0]).toBe('Evento próximo')
    expect(sw.showNotification.mock.calls[1]).toEqual(MINIMAL)
  })

  it('el fallo queda en la consola, no se traga', async () => {
    const sw = loadServiceWorker()

    await receive(sw, '{roto')

    expect(console.error).toHaveBeenCalled()
  })
})

describe('notificationclick (no ha cambiado)', () => {
  function clickEvent(data: { url?: string; notificationId?: string | null }) {
    const pending: Promise<unknown>[] = []
    return {
      notification: { close: vi.fn(), data },
      waitUntil: (promise: Promise<unknown>) => {
        pending.push(promise)
      },
      settled: () => Promise.all(pending),
    }
  }

  async function click(
    sw: ReturnType<typeof loadServiceWorker>,
    data: Parameters<typeof clickEvent>[0],
  ) {
    const event = clickEvent(data)
    sw.handlers.notificationclick(event)
    await event.settled()
    return event
  }

  it('sin ventana abierta, abre la app en el destino y marca el aviso', async () => {
    const sw = loadServiceWorker()

    const event = await click(sw, { url: '/eventos?event=42', notificationId: AVISO.id })

    expect(event.notification.close).toHaveBeenCalled()
    expect(sw.clients.openWindow).toHaveBeenCalledWith(
      `${ORIGIN}/eventos?event=42&notification=${AVISO.id}`,
    )
  })

  it('con una ventana de la app, la enfoca y navega en ella', async () => {
    const sw = loadServiceWorker()
    const windowClient = {
      url: `${ORIGIN}/mapa`,
      focus: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn().mockResolvedValue(undefined),
    }
    sw.clients.matchAll.mockResolvedValue([windowClient])

    await click(sw, { url: '/foro', notificationId: AVISO.id })

    expect(windowClient.focus).toHaveBeenCalled()
    expect(windowClient.navigate).toHaveBeenCalledWith(`${ORIGIN}/foro?notification=${AVISO.id}`)
    expect(sw.clients.openWindow).not.toHaveBeenCalled()
  })

  it('si navigate() lanza (PWA instalada de iOS), abre una ventana nueva tras enfocar', async () => {
    const sw = loadServiceWorker()
    const windowClient = {
      url: `${ORIGIN}/mapa`,
      focus: vi.fn().mockResolvedValue(undefined),
      navigate: vi.fn().mockRejectedValue(new Error('no controlado')),
    }
    sw.clients.matchAll.mockResolvedValue([windowClient])

    await click(sw, { url: '/foro', notificationId: null })

    expect(windowClient.focus).toHaveBeenCalled()
    expect(sw.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/foro`)
  })

  it('una URL de otro origen nunca se abre: se va a la raíz de la app', async () => {
    const sw = loadServiceWorker()

    await click(sw, { url: 'https://sitio-ajeno.example/phishing', notificationId: AVISO.id })

    expect(sw.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/?notification=${AVISO.id}`)
  })
})

describe('pushsubscriptionchange', () => {
  function changeEvent(oldSubscription?: unknown) {
    const pending: Promise<unknown>[] = []
    return {
      oldSubscription,
      waitUntil: (promise: Promise<unknown>) => {
        pending.push(promise)
      },
      settled: () => Promise.all(pending),
    }
  }

  it('re-suscribe con la clave de la suscripción que se perdió', async () => {
    const sw = loadServiceWorker()
    const key = new Uint8Array([4, 1, 2, 3]).buffer
    const event = changeEvent({ options: { applicationServerKey: key } })

    sw.handlers.pushsubscriptionchange(event)
    await event.settled()

    expect(sw.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: key })
  })

  it('sin suscripción anterior, cae a la clave pública incrustada (65 bytes, punto sin comprimir)', async () => {
    const sw = loadServiceWorker()
    const event = changeEvent(undefined)

    sw.handlers.pushsubscriptionchange(event)
    await event.settled()

    const { applicationServerKey } = sw.subscribe.mock.calls[0][0]
    expect(applicationServerKey).toBeInstanceOf(Uint8Array)
    expect(applicationServerKey).toHaveLength(65)
    expect(applicationServerKey[0]).toBe(4)
  })

  it('si la re-suscripción falla, lo registra y no revienta el evento', async () => {
    const sw = loadServiceWorker()
    sw.subscribe.mockRejectedValue(new Error('sin red'))
    const event = changeEvent(undefined)

    sw.handlers.pushsubscriptionchange(event)

    await expect(event.settled()).resolves.toBeDefined()
    expect(console.error).toHaveBeenCalled()
  })
})
