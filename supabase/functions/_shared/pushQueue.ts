// Lógica pura de la cola de push: qué fila devuelve el reclamo, cómo se cierra
// cada entrega y cómo se reparte el trabajo. Sin APIs de Deno ni imports por URL,
// como webpush.ts, para probarla con vitest (pushQueue.test.ts) y usarla desde
// la Edge Function sin cambios.

import { MAX_ATTEMPTS, type PushOutcome, retryDelayMs } from './webpush.ts'

/**
 * Una fila de `claim_push_deliveries`, con los nombres de columna tal cual los
 * devuelve la base. `attempts` es el número de ESTE intento: la RPC ya lo
 * incrementó al reclamar, así que si la ejecución muere a mitad, el intento
 * queda contado igual.
 */
export interface ClaimedDelivery {
  delivery_id: string
  attempts: number
  notification_id: string
  title: string
  body: string
  url: string
  type: string
  category: string
  payload: Record<string, unknown>
  subscription_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Lo que espera `finish_push_deliveries` por cada entrega. `attempts` es el
 * reclamado y hace de *fencing*: si otra ejecución la reclamó después de vencer
 * el lease, el contador ya no coincide y este cierre no hace nada.
 */
export interface DeliveryClose {
  id: string
  attempts: number
  status: 'sent' | 'failed' | 'expired' | 'pending'
  next_attempt_at: string | null
  last_error: string | null
}

/**
 * Cómo terminó una entrega. O bien el servicio push respondió (o no llegó a
 * responder: `httpStatus` null en un fallo de red), o bien falló por algo
 * nuestro que reintentar no arregla: payload grande, claves de la suscripción
 * corruptas, intentos agotados.
 */
export type DeliveryResult =
  | { type: 'push'; outcome: PushOutcome; httpStatus: number | null; errorText: string }
  | { type: 'terminal'; reason: string }

/** Lo que cabe en `last_error`; la RPC de cierre lo vuelve a recortar con `left()`. */
const LAST_ERROR_MAX = 1000

// Una mitad de par sustituto suelta no es JSON válido para Postgres: un solo
// `last_error` recortado a mitad de un emoji haría fallar el cierre del lote
// entero, y con él las 50 entregas se reenviarían al vencer el lease.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

/**
 * Deja el texto en algo que `jsonb` acepte y que quepa en `last_error`. El
 * cuerpo de error lo escribe el servicio push, y un \u0000 suyo (jsonb lo
 * rechaza) rompería el cierre del lote igual que un par sustituto cortado.
 */
export function cleanLastError(text: string): string {
  return text.replace(/\u0000/g, '').slice(0, LAST_ERROR_MAX).replace(LONE_SURROGATE, '')
}

/**
 * Cambia el endpoint por su host dentro de un texto de error. La fila de la
 * entrega ahora sobrevive a la suscripción (SET NULL), y el fetch de Deno mete la
 * URL en el mensaje de un fallo de red: el endpoint es una URL de capacidad, así
 * que en la base solo queda el host, igual que en `push_host`. `split('/')[2]` es
 * el mismo trozo que `split_part(endpoint, '/', 3)` en SQL.
 */
export function redactEndpoint(text: string, endpoint: string): string {
  if (!endpoint) return text
  return text.split(endpoint).join(endpoint.split('/')[2] || '<endpoint>')
}

/** Motivo de una entrega que ya no se intenta: el lease venció sin cierre demasiadas veces. */
export function exhaustedReason(attempts: number): string {
  return `intentos agotados: ${attempts} reclamos sin cerrar la entrega`
}

// uuid en su forma canónica. Postgres admitiría también llaves o guiones de
// menos, pero aquí el valor viene del panel (que lo recibe de la propia base), y
// aceptar solo la canónica evita pasarle texto libre al filtro de la consulta.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Lee `notificationId` del cuerpo de send-push. El cuerpo es opcional: el cron
 * manda `{}`, y un cuerpo vacío o que no es JSON llega aquí como `null`, y todo
 * eso cuenta como "sin aviso concreto". Lo único que se rechaza es un
 * `notificationId` presente y mal formado: callarlo dejaría que el panel creyera
 * que vació el aviso que pidió cuando en realidad vació la cola entera.
 */
export function parseNotificationId(
  body: unknown,
): { ok: true; notificationId: string | null } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: true, notificationId: null }
  }
  const value = (body as Record<string, unknown>).notificationId
  if (value === undefined || value === null) return { ok: true, notificationId: null }
  if (typeof value !== 'string' || !UUID.test(value)) {
    return { ok: false, error: 'notificationId tiene que ser un uuid.' }
  }
  return { ok: true, notificationId: value.toLowerCase() }
}

/**
 * Convierte el resultado de una entrega en lo que se le manda a
 * `finish_push_deliveries`. `now` entra como argumento para que el reintento sea
 * determinista; los textos de `last_error` son los que escribía index.ts antes
 * de reclamar con RPC. Con `endpoint`, se quita del texto antes de recortarlo
 * (ver `redactEndpoint`).
 */
export function closeDelivery(
  id: string,
  attempts: number,
  result: DeliveryResult,
  now: number,
  endpoint = '',
): DeliveryClose {
  const close = (
    status: DeliveryClose['status'],
    lastError: string | null,
    nextAttemptAt: string | null = null,
  ): DeliveryClose => ({
    id,
    attempts,
    status,
    next_attempt_at: nextAttemptAt,
    last_error: lastError === null ? null : cleanLastError(redactEndpoint(lastError, endpoint)),
  })

  if (result.type === 'terminal') return close('failed', result.reason)

  const { outcome, httpStatus, errorText } = result
  switch (outcome.kind) {
    case 'sent':
      return close('sent', null)
    case 'expired':
      // Antes la fila desaparecía con el CASCADE; ahora queda, y esto es lo que
      // la explica.
      return close('expired', `suscripción expirada (${httpStatus ?? '?'})${errorText ? `: ${errorText}` : ''}`)
    case 'failed':
      return close('failed', `${outcome.reason}: ${errorText}`)
    case 'retry': {
      // Sin respuesta ni mensaje de error no hay nada que decir de la red; antes
      // esto escribía "respuesta undefined".
      const lastError = errorText || (httpStatus === null ? 'sin respuesta del servicio push' : `respuesta ${httpStatus}`)
      // `attempts` ya incluye este intento (se contó al reclamar).
      if (attempts >= MAX_ATTEMPTS) return close('failed', lastError)
      return close(
        'pending',
        lastError,
        new Date(now + retryDelayMs(attempts, outcome.retryAfterMs)).toISOString(),
      )
    }
  }
}

/**
 * El `error` del diagnóstico del panel. No es `last_error`: en un 400 el
 * diagnóstico enseña el motivo sin el cuerpo de la respuesta, como siempre.
 */
export function diagnosticError(result: DeliveryResult): string | undefined {
  if (result.type === 'terminal') return result.reason
  switch (result.outcome.kind) {
    case 'sent':
      return undefined
    case 'failed':
      return result.outcome.reason
    default:
      return result.errorText
  }
}

/**
 * Ejecuta `worker` sobre cada elemento con como mucho `limit` en vuelo y
 * devuelve los resultados en el orden de entrada, no en el de llegada. El
 * worker no debe lanzar: si lo hace, la promesa se rechaza y el resto de
 * resultados se pierde (en send-push cada fila se envuelve para que no pase).
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  // JS es de un solo hilo: entre `next` y `next += 1` nadie más corre, así que
  // cada índice lo toma un solo worker.
  const run = async () => {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index], index)
    }
  }
  const size = Math.min(items.length, Math.max(1, Math.floor(limit) || 1))
  await Promise.all(Array.from({ length: size }, run))
  return results
}
