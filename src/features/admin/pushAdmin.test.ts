import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SelfPushTestResult, PushDeliveryStatsRow } from './api'

// ─────────────────────────────────────────────────────────────────────────────
// Lo que decide el panel de push: qué se le dice a quien pulsa "Enviar prueba",
// cómo se agrupan las entregas por servicio y qué pasa cuando la base todavía
// no tiene la migración 20261021000100.
//
// `api.ts` se carga de nuevo en cada caso (`vi.resetModules`) para poder cambiar
// el cliente de Supabase entre casos, incluido el `null` del modo demo, que con
// un `vi.mock` fijo por archivo no se podría probar al lado del resto.
// ─────────────────────────────────────────────────────────────────────────────

const rpc = vi.fn()
const getSession = vi.fn()
const fetchMock = vi.fn()

async function loadApi(client: unknown = {
  rpc: (...args: unknown[]) => rpc(...args),
  auth: { getSession: () => getSession() },
}) {
  vi.resetModules()
  vi.doMock('@/shared/lib/supabase', () => ({ supabase: client }))
  return import('./api')
}

const UUID = '3f1c2c7e-5a53-4a54-9d1f-0f6a5b1d9c11'

function jsonResponse(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body }
}

beforeEach(() => {
  rpc.mockReset()
  fetchMock.mockReset()
  getSession.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok' } } })
  vi.stubGlobal('fetch', fetchMock)
})

// ── sendSelfPushTest ────────────────────────────────────────────────────────

describe('sendSelfPushTest con el id del aviso', () => {
  it('le pasa a send-push el id que devolvió la RPC y conserva el conteo de entregas', async () => {
    const { sendSelfPushTest } = await loadApi()
    rpc.mockResolvedValue({ data: UUID, error: null })
    const notification = { id: UUID, deliveries: { pending: 0, sent: 1, failed: 0, expired: 0 } }
    fetchMock.mockResolvedValue(jsonResponse({ processed: 1, sent: 1, failed: 0, notification }))

    const result = await sendSelfPushTest()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({ notificationId: UUID })
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(result.notificationCreated).toBe(true)
    expect(result.notification).toEqual(notification)
  })

  it('si la base no creó el aviso (preferencias silenciadas) no llama a send-push', async () => {
    const { sendSelfPushTest, describeSelfPushTest } = await loadApi()
    rpc.mockResolvedValue({ data: null, error: null })

    const result = await sendSelfPushTest()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.notificationCreated).toBe(false)
    expect(describeSelfPushTest(result).map((p) => p.key)).toEqual(['admin.push.test.notCreated'])
  })

  it('con un send-push viejo (sin `notification` en la respuesta) cae al mensaje de siempre', async () => {
    const { sendSelfPushTest, describeSelfPushTest } = await loadApi()
    rpc.mockResolvedValue({ data: UUID, error: null })
    fetchMock.mockResolvedValue(jsonResponse({ processed: 1, sent: 1, failed: 0 }))

    const result = await sendSelfPushTest()

    expect(result.notification).toBeUndefined()
    expect(describeSelfPushTest(result).map((p) => p.key)).toEqual(['admin.push.test.legacySent'])
  })

  it('un error de send-push llega con el texto del servidor', async () => {
    const { sendSelfPushTest } = await loadApi()
    rpc.mockResolvedValue({ data: UUID, error: null })
    fetchMock.mockResolvedValue(jsonResponse({ error: 'notificationId no es un uuid' }, false))

    await expect(sendSelfPushTest()).rejects.toThrow('notificationId no es un uuid')
  })
})

describe('la difusión no cambia lo que manda a send-push', () => {
  it('va sin cuerpo, como siempre: no hay un id que dar', async () => {
    const { triggerServerPushTest } = await loadApi()
    rpc.mockResolvedValue({ data: 5, error: null })
    fetchMock.mockResolvedValue(jsonResponse({ processed: 5, sent: 5, failed: 0 }))

    await triggerServerPushTest('Hola', 'Mundo', '/')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(init.body).toBeUndefined()
  })

  it('el rechazo de la base por título o cuerpo largos llega tal cual', async () => {
    const { triggerServerPushTest } = await loadApi()
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'El título no puede pasar de 60 caracteres.' },
    })

    await expect(triggerServerPushTest('x'.repeat(61), 'cuerpo')).rejects.toThrow(
      'El título no puede pasar de 60 caracteres.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

// ── describeSelfPushTest ────────────────────────────────────────────────────

function selfResult(partial: Partial<SelfPushTestResult>): SelfPushTestResult {
  return { processed: 0, sent: 0, failed: 0, notificationCreated: true, ...partial }
}

function withDeliveries(deliveries: Partial<{ pending: number; sent: number; failed: number; expired: number }>, extra: Partial<SelfPushTestResult> = {}) {
  return selfResult({
    notification: { id: UUID, deliveries: { pending: 0, sent: 0, failed: 0, expired: 0, ...deliveries } },
    ...extra,
  })
}

describe('describeSelfPushTest', () => {
  it('enviada a todos: dice a cuántos y que debería verse en la pantalla', async () => {
    const { describeSelfPushTest } = await loadApi()
    const parts = describeSelfPushTest(withDeliveries({ sent: 1 }))
    expect(parts.map((p) => p.key)).toEqual(['admin.push.test.sent', 'admin.push.test.sentHint'])
    expect(parts[0]).toMatchObject({ count: 1, fallback: 'Enviada a 1 dispositivo.' })
  })

  it('el respaldo en español concuerda en plural', async () => {
    const { describeSelfPushTest } = await loadApi()
    const parts = describeSelfPushTest(withDeliveries({ sent: 3 }))
    expect(parts[0].fallback).toBe('Enviada a 3 dispositivos.')
  })

  it('sin ninguna entrega: no hay dispositivos con push o las preferencias lo silencian', async () => {
    const { describeSelfPushTest } = await loadApi()
    const parts = describeSelfPushTest(withDeliveries({}, { sent: 0 }))
    expect(parts.map((p) => p.key)).toEqual(['admin.push.test.noDeliveries'])
    expect(parts[0].fallback).toMatch(/dispositivos con push/)
    expect(parts[0].fallback).toMatch(/preferencias de push/)
  })

  it('solo pendientes: explica que el envío automático ya las está procesando', async () => {
    const { describeSelfPushTest } = await loadApi()
    const parts = describeSelfPushTest(withDeliveries({ pending: 2 }))
    expect(parts.map((p) => p.key)).toEqual(['admin.push.test.pending'])
    expect(parts[0].fallback).toMatch(/automático/)
  })

  it('con fallidas manda a mirar el último error y no promete que se verá en pantalla', async () => {
    const { describeSelfPushTest } = await loadApi()
    const parts = describeSelfPushTest(withDeliveries({ sent: 2, failed: 1 }))
    expect(parts.map((p) => p.key)).toEqual([
      'admin.push.test.sent',
      'admin.push.test.failed',
      'admin.push.test.seeStats',
    ])
  })

  it('caducadas: avisa de que la suscripción ya no existe, sin la promesa de la pantalla', async () => {
    const { describeSelfPushTest } = await loadApi()
    const parts = describeSelfPushTest(withDeliveries({ sent: 1, expired: 1 }))
    expect(parts.map((p) => p.key)).toEqual(['admin.push.test.sent', 'admin.push.test.expired'])
  })

  it('sin `notification` usa lo que envió la pasada, como antes', async () => {
    const { describeSelfPushTest } = await loadApi()
    expect(describeSelfPushTest(selfResult({ sent: 1, processed: 1 }))).toEqual([
      {
        key: 'admin.push.test.legacySent',
        fallback: 'Prueba enviada. Debería aparecer en tu pantalla en unos segundos.',
      },
    ])
    expect(describeSelfPushTest(selfResult({ sent: 0, processed: 1 }))).toEqual([
      {
        key: 'admin.push.test.legacyNone',
        fallback: 'La prueba se encoló pero no salió a ningún dispositivo.',
      },
    ])
  })

  it('si send-push no pudo leer las entregas, no se fía de sus conteos', async () => {
    const { describeSelfPushTest } = await loadApi()
    const result = selfResult({
      sent: 1,
      notification: { id: UUID, deliveries: { pending: 0, sent: 0, failed: 0, expired: 0 }, error: 'timeout' },
    })
    expect(describeSelfPushTest(result).map((p) => p.key)).toEqual(['admin.push.test.legacySent'])
  })

  it('un conteo que no es un número se trata como cero', async () => {
    const { describeSelfPushTest } = await loadApi()
    const result = selfResult({
      notification: {
        id: UUID,
        deliveries: { pending: undefined, sent: 1, failed: Number.NaN, expired: null } as never,
      },
    })
    expect(describeSelfPushTest(result).map((p) => p.key)).toEqual([
      'admin.push.test.sent',
      'admin.push.test.sentHint',
    ])
  })
})

// ── groupDeliveryStats ──────────────────────────────────────────────────────

const row = (partial: Partial<PushDeliveryStatsRow>): PushDeliveryStatsRow => ({
  push_host: 'web.push.apple.com',
  status: 'sent',
  total: 1,
  last_at: '2026-10-21T12:00:00Z',
  last_error: null,
  ...partial,
})

describe('groupDeliveryStats', () => {
  it('junta las filas (host, estado) en una por host', async () => {
    const { groupDeliveryStats } = await loadApi()
    const stats = groupDeliveryStats([
      row({ push_host: 'web.push.apple.com', status: 'sent', total: 10 }),
      row({ push_host: 'web.push.apple.com', status: 'failed', total: 2 }),
      row({ push_host: 'fcm.googleapis.com', status: 'sent', total: 30 }),
      row({ push_host: 'fcm.googleapis.com', status: 'expired', total: 4 }),
      row({ push_host: 'fcm.googleapis.com', status: 'pending', total: 1 }),
    ])

    const apple = stats.find((s) => s.host === 'web.push.apple.com')
    const google = stats.find((s) => s.host === 'fcm.googleapis.com')
    expect(apple).toMatchObject({ sent: 10, failed: 2, expired: 0, pending: 0 })
    expect(google).toMatchObject({ sent: 30, failed: 0, expired: 4, pending: 1 })
  })

  it('pone primero el servicio con fallos, aunque tenga menos entregas', async () => {
    const { groupDeliveryStats } = await loadApi()
    const stats = groupDeliveryStats([
      row({ push_host: 'fcm.googleapis.com', status: 'sent', total: 500 }),
      row({ push_host: 'web.push.apple.com', status: 'failed', total: 1 }),
    ])
    expect(stats.map((s) => s.host)).toEqual(['web.push.apple.com', 'fcm.googleapis.com'])
  })

  it('las entregas sin host (anteriores a push_host) van juntas bajo "(sin host)"', async () => {
    const { groupDeliveryStats } = await loadApi()
    const stats = groupDeliveryStats([
      row({ push_host: null, status: 'sent', total: 2 }),
      row({ push_host: '(sin host)', status: 'failed', total: 1 }),
    ])
    expect(stats).toHaveLength(1)
    expect(stats[0]).toMatchObject({ host: '(sin host)', sent: 2, failed: 1 })
  })

  it('el último error es el más reciente de cualquier estado, no el de la fila más reciente', async () => {
    const { groupDeliveryStats } = await loadApi()
    const stats = groupDeliveryStats([
      row({ status: 'sent', total: 9, last_at: '2026-10-21T12:00:00Z', last_error: null }),
      row({ status: 'failed', total: 1, last_at: '2026-10-21T08:00:00Z', last_error: 'HTTP 403' }),
      row({ status: 'expired', total: 1, last_at: '2026-10-20T08:00:00Z', last_error: 'HTTP 410' }),
    ])
    expect(stats[0].lastError).toBe('HTTP 403')
    expect(stats[0].lastAt).toBe('2026-10-21T12:00:00Z')
  })

  it('sin errores en ninguna fila, no inventa uno', async () => {
    const { groupDeliveryStats } = await loadApi()
    expect(groupDeliveryStats([row({})])[0].lastError).toBeNull()
  })

  it('acepta el total como texto (bigint) e ignora estados que no conoce', async () => {
    const { groupDeliveryStats } = await loadApi()
    const stats = groupDeliveryStats([
      row({ status: 'sent', total: '7' }),
      row({ status: 'processing', total: 99 }),
    ])
    expect(stats[0]).toMatchObject({ sent: 7, failed: 0, expired: 0, pending: 0 })
  })
})

// ── fetchPushDeliveryStats ──────────────────────────────────────────────────

describe('fetchPushDeliveryStats', () => {
  it('pide p_days a la RPC y devuelve una fila por servicio', async () => {
    const { fetchPushDeliveryStats } = await loadApi()
    rpc.mockResolvedValue({
      data: [row({ push_host: 'fcm.googleapis.com', status: 'sent', total: 3 })],
      error: null,
    })

    const stats = await fetchPushDeliveryStats(7)

    expect(rpc).toHaveBeenCalledWith('admin_push_delivery_stats', { p_days: 7 })
    expect(stats).toEqual([
      expect.objectContaining({ host: 'fcm.googleapis.com', sent: 3 }),
    ])
  })

  it.each([
    ['PGRST202 (el caso real: PostgREST corta antes de Postgres)', { code: 'PGRST202', message: 'x' }],
    ['42883 (Postgres)', { code: '42883', message: 'x' }],
    ['solo el texto', { message: 'Could not find the function public.admin_push_delivery_stats(p_days) in the schema cache' }],
  ])('si falta la migración devuelve null: %s', async (_name, error) => {
    const { fetchPushDeliveryStats } = await loadApi()
    rpc.mockResolvedValue({ data: null, error })
    expect(await fetchPushDeliveryStats()).toBeNull()
  })

  it('cualquier otro error se propaga: no es "falta la migración"', async () => {
    const { fetchPushDeliveryStats } = await loadApi()
    const error = { code: '42501', message: 'Solo los administradores pueden ver las entregas.' }
    rpc.mockResolvedValue({ data: null, error })
    await expect(fetchPushDeliveryStats()).rejects.toBe(error)
  })

  it('en modo demo (sin Supabase) devuelve datos de ejemplo con el servicio con fallos primero', async () => {
    const { fetchPushDeliveryStats, sendSelfPushTest, describeSelfPushTest } = await loadApi(null)

    const stats = await fetchPushDeliveryStats()
    expect(stats).not.toBeNull()
    expect(stats!.length).toBeGreaterThan(1)
    expect(stats![0].failed).toBeGreaterThan(0)
    expect(stats![0].lastError).toBeTruthy()

    // La prueba también funciona en demo, y dice algo con sentido.
    const result = await sendSelfPushTest()
    expect(describeSelfPushTest(result).map((p) => p.key)).toEqual([
      'admin.push.test.sent',
      'admin.push.test.sentHint',
    ])
    expect(rpc).not.toHaveBeenCalled()
  })
})
