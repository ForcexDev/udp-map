// @vitest-environment jsdom
// jsdom y no node: setupFiles (src/test/setup.ts) toca `window` y falla en entorno node.
// Aquí no hay criptografía, pero el motivo es el mismo que en webpush.test.ts.
import { describe, expect, it } from 'vitest'
import {
  type DeliveryResult,
  cleanLastError,
  closeDelivery,
  diagnosticError,
  exhaustedReason,
  parseNotificationId,
  redactEndpoint,
  runWithConcurrency,
} from './pushQueue'
import { MAX_ATTEMPTS, retryDelayMs } from './webpush'

const NOW = Date.parse('2026-10-21T12:00:00Z')
const ID = '5b0e0c3e-0d61-4c0b-9a58-7a3a8f0a1111'

const push = (
  outcome: Extract<DeliveryResult, { type: 'push' }>['outcome'],
  httpStatus: number | null,
  errorText = '',
): DeliveryResult => ({ type: 'push', outcome, httpStatus, errorText })

const ENDPOINT = 'https://web.push.apple.com/QGxhYmVsLWRlLWNhcGFjaWRhZA'

describe('redactEndpoint', () => {
  it('cambia cada aparición del endpoint por su host', () => {
    expect(redactEndpoint(`error sending request for url (${ENDPOINT}): ${ENDPOINT}`, ENDPOINT)).toBe(
      'error sending request for url (web.push.apple.com): web.push.apple.com',
    )
  })

  it('deja igual un texto sin el endpoint, o sin endpoint con el que comparar', () => {
    expect(redactEndpoint('timed out', ENDPOINT)).toBe('timed out')
    expect(redactEndpoint('timed out', '')).toBe('timed out')
  })
})

describe('closeDelivery', () => {
  it('no guarda el endpoint en last_error, aunque el error de red lo traiga', () => {
    const close = closeDelivery(
      ID,
      1,
      push({ kind: 'retry', retryAfterMs: null }, null, `error sending request for url (${ENDPOINT})`),
      NOW,
      ENDPOINT,
    )
    expect(close.last_error).toBe('error sending request for url (web.push.apple.com)')
  })

  it('sent: cierra sin error ni próxima fecha, y conserva el intento reclamado', () => {
    expect(closeDelivery(ID, 3, push({ kind: 'sent' }, 201), NOW)).toEqual({
      id: ID,
      attempts: 3,
      status: 'sent',
      next_attempt_at: null,
      last_error: null,
    })
  })

  it('expired: deja el estado HTTP y el texto del servicio en last_error', () => {
    const close = closeDelivery(ID, 1, push({ kind: 'expired' }, 410, 'Gone'), NOW)
    expect(close.status).toBe('expired')
    expect(close.last_error).toBe('suscripción expirada (410): Gone')
    expect(close.next_attempt_at).toBeNull()
    expect(closeDelivery(ID, 1, push({ kind: 'expired' }, 404), NOW).last_error).toBe('suscripción expirada (404)')
  })

  it('failed por respuesta: motivo + texto, como escribía index.ts', () => {
    const close = closeDelivery(
      ID,
      2,
      push({ kind: 'failed', reason: 'autenticación VAPID rechazada (403)' }, 403, 'forbidden'),
      NOW,
    )
    expect(close).toEqual({
      id: ID,
      attempts: 2,
      status: 'failed',
      next_attempt_at: null,
      last_error: 'autenticación VAPID rechazada (403): forbidden',
    })
  })

  it('fallo terminal propio: failed con el motivo tal cual', () => {
    for (const reason of [
      'payload demasiado grande (4100 B)',
      'claves de la suscripción inválidas: DataError',
      exhaustedReason(6),
    ]) {
      expect(closeDelivery(ID, 1, { type: 'terminal', reason }, NOW)).toEqual({
        id: ID,
        attempts: 1,
        status: 'failed',
        next_attempt_at: null,
        last_error: reason,
      })
    }
  })

  describe('retry', () => {
    it('antes del tope queda pending con el backoff de siempre', () => {
      const close = closeDelivery(ID, 1, push({ kind: 'retry', retryAfterMs: null }, 503, 'busy'), NOW)
      expect(close.status).toBe('pending')
      expect(close.last_error).toBe('busy')
      expect(close.next_attempt_at).toBe(new Date(NOW + retryDelayMs(1, null)).toISOString())
      expect(close.next_attempt_at).toBe('2026-10-21T12:10:00.000Z')
    })

    it('respeta Retry-After acotado por retryDelayMs', () => {
      const close = closeDelivery(ID, 1, push({ kind: 'retry', retryAfterMs: 120_000 }, 429, 'slow down'), NOW)
      expect(close.next_attempt_at).toBe('2026-10-21T12:02:00.000Z')
      const huge = closeDelivery(ID, 1, push({ kind: 'retry', retryAfterMs: 24 * 3600_000 }, 429, 'x'), NOW)
      expect(huge.next_attempt_at).toBe('2026-10-21T13:00:00.000Z')
    })

    it('el penúltimo intento todavía reintenta', () => {
      const close = closeDelivery(ID, MAX_ATTEMPTS - 1, push({ kind: 'retry', retryAfterMs: null }, 500, 'boom'), NOW)
      expect(close.status).toBe('pending')
      expect(close.next_attempt_at).not.toBeNull()
    })

    it('attempts = MAX_ATTEMPTS es el último intento: failed, sin próxima fecha', () => {
      const close = closeDelivery(ID, MAX_ATTEMPTS, push({ kind: 'retry', retryAfterMs: null }, 500, 'boom'), NOW)
      expect(close).toEqual({
        id: ID,
        attempts: MAX_ATTEMPTS,
        status: 'failed',
        next_attempt_at: null,
        last_error: 'boom',
      })
    })

    it('attempts > MAX_ATTEMPTS también es failed', () => {
      const close = closeDelivery(ID, MAX_ATTEMPTS + 2, push({ kind: 'retry', retryAfterMs: null }, 500, 'boom'), NOW)
      expect(close.status).toBe('failed')
      expect(close.next_attempt_at).toBeNull()
    })

    it('sin texto de error usa el estado HTTP; sin respuesta, un texto propio', () => {
      expect(closeDelivery(ID, 1, push({ kind: 'retry', retryAfterMs: null }, 502, ''), NOW).last_error).toBe(
        'respuesta 502',
      )
      expect(closeDelivery(ID, 1, push({ kind: 'retry', retryAfterMs: null }, null, ''), NOW).last_error).toBe(
        'sin respuesta del servicio push',
      )
    })

    it('un fallo de red lleva el mensaje del error', () => {
      const close = closeDelivery(
        ID,
        1,
        push({ kind: 'retry', retryAfterMs: null }, null, 'The operation was aborted due to timeout'),
        NOW,
      )
      expect(close.status).toBe('pending')
      expect(close.last_error).toBe('The operation was aborted due to timeout')
    })
  })

  it('recorta last_error a 1000 en cada rama que lo escribe', () => {
    const long = 'x'.repeat(5000)
    const results: DeliveryResult[] = [
      push({ kind: 'expired' }, 410, long),
      push({ kind: 'failed', reason: 'petición rechazada por el servicio push (400)' }, 400, long),
      push({ kind: 'retry', retryAfterMs: null }, 500, long),
      push({ kind: 'retry', retryAfterMs: null }, 500, long),
      { type: 'terminal', reason: long },
    ]
    const attemptsFor = [1, 1, 1, MAX_ATTEMPTS, 1]
    results.forEach((result, i) => {
      expect(closeDelivery(ID, attemptsFor[i], result, NOW).last_error).toHaveLength(1000)
    })
  })
})

describe('cleanLastError', () => {
  it('no corta un emoji por la mitad: Postgres rechaza el par sustituto suelto', () => {
    const cut = cleanLastError('a'.repeat(999) + '🚀')
    expect(cut).toBe('a'.repeat(999))
    // Y lo que sale es JSON bien formado de ida y vuelta.
    expect(JSON.parse(JSON.stringify(cut))).toBe(cut)
  })

  it('conserva un emoji entero si cabe', () => {
    expect(cleanLastError('a'.repeat(998) + '🚀')).toHaveLength(1000)
  })

  it('quita los NUL, que jsonb no admite', () => {
    expect(cleanLastError('a\u0000b')).toBe('ab')
  })

  it('quita una mitad suelta aunque no sea por el recorte', () => {
    expect(cleanLastError('a\uD83Db')).toBe('ab')
    expect(cleanLastError('a\uDE80b')).toBe('ab')
  })
})

describe('diagnosticError', () => {
  it('enseña el motivo en un failed y el texto del servicio en el resto', () => {
    expect(diagnosticError(push({ kind: 'sent' }, 201))).toBeUndefined()
    expect(diagnosticError(push({ kind: 'expired' }, 410, 'Gone'))).toBe('Gone')
    expect(diagnosticError(push({ kind: 'failed', reason: 'motivo' }, 400, 'cuerpo'))).toBe('motivo')
    expect(diagnosticError(push({ kind: 'retry', retryAfterMs: null }, 503, 'busy'))).toBe('busy')
    expect(diagnosticError({ type: 'terminal', reason: 'payload demasiado grande (5000 B)' })).toBe(
      'payload demasiado grande (5000 B)',
    )
  })
})

describe('exhaustedReason', () => {
  it('dice cuántos reclamos se gastaron', () => {
    expect(exhaustedReason(6)).toContain('6')
  })
})

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

describe('runWithConcurrency', () => {
  it('nunca tiene más de `limit` en vuelo y los usa todos', async () => {
    let inFlight = 0
    let peak = 0
    const results = await runWithConcurrency(Array.from({ length: 25 }, (_, i) => i), 10, async (n) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await sleep(2)
      inFlight -= 1
      return n
    })
    expect(peak).toBe(10)
    expect(inFlight).toBe(0)
    expect(results).toHaveLength(25)
  })

  it('devuelve los resultados en el orden de entrada aunque terminen al revés', async () => {
    // Los primeros tardan más: llegan los últimos.
    const delays = [30, 20, 10, 1, 1]
    const finished: number[] = []
    const results = await runWithConcurrency(delays, 5, async (ms, index) => {
      await sleep(ms)
      finished.push(index)
      return `r${index}`
    })
    expect(results).toEqual(['r0', 'r1', 'r2', 'r3', 'r4'])
    expect(finished).not.toEqual([0, 1, 2, 3, 4])
  })

  it('con limit 1 es secuencial', async () => {
    const order: string[] = []
    await runWithConcurrency(['a', 'b', 'c'], 1, async (item) => {
      order.push(`start ${item}`)
      await sleep(1)
      order.push(`end ${item}`)
    })
    expect(order).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c'])
  })

  it('procesa cada elemento exactamente una vez y le pasa su índice', async () => {
    const seen: Array<[string, number]> = []
    await runWithConcurrency(['x', 'y', 'z', 'w'], 3, async (item, index) => {
      seen.push([item, index])
      await sleep(1)
    })
    expect(seen.sort((a, b) => a[1] - b[1])).toEqual([['x', 0], ['y', 1], ['z', 2], ['w', 3]])
  })

  it('un límite mayor que la lista, vacío o inválido no rompe nada', async () => {
    expect(await runWithConcurrency([], 10, async () => 1)).toEqual([])
    expect(await runWithConcurrency([1, 2], 100, async (n) => n * 2)).toEqual([2, 4])
    expect(await runWithConcurrency([1, 2], 0, async (n) => n * 2)).toEqual([2, 4])
    expect(await runWithConcurrency([1, 2], Number.NaN, async (n) => n * 2)).toEqual([2, 4])
  })
})

describe('parseNotificationId', () => {
  it('un cuerpo sin aviso concreto cuenta como "sin notificationId"', () => {
    // El cron manda `{}`; un cuerpo vacío o que no es JSON llega como null.
    for (const body of [{}, null, undefined, 'texto', 42, [], [ID], { otra: 'cosa' }]) {
      expect(parseNotificationId(body)).toEqual({ ok: true, notificationId: null })
    }
  })

  it('notificationId nulo es lo mismo que ausente', () => {
    expect(parseNotificationId({ notificationId: null })).toEqual({ ok: true, notificationId: null })
    expect(parseNotificationId({ notificationId: undefined })).toEqual({ ok: true, notificationId: null })
  })

  it('acepta un uuid y lo devuelve en minúsculas', () => {
    expect(parseNotificationId({ notificationId: ID })).toEqual({ ok: true, notificationId: ID })
    expect(parseNotificationId({ notificationId: ID.toUpperCase() })).toEqual({ ok: true, notificationId: ID })
  })

  it('rechaza lo presente pero mal formado, en vez de vaciar la cola entera', () => {
    for (const notificationId of ['', 'abc', ID.slice(1), `${ID} `, `${ID}; drop`, 7, true, {}, [ID]]) {
      expect(parseNotificationId({ notificationId })).toEqual({
        ok: false,
        error: 'notificationId tiene que ser un uuid.',
      })
    }
  })
})
