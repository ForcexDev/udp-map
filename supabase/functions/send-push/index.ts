import { isAuthorized, supabase } from '../_shared/auth.ts'
import {
  type ClaimedDelivery,
  type DeliveryClose,
  type DeliveryResult,
  closeDelivery,
  diagnosticError,
  exhaustedReason,
  parseNotificationId,
  runWithConcurrency,
} from '../_shared/pushQueue.ts'
import {
  MAX_ATTEMPTS,
  MAX_PLAINTEXT_BYTES,
  type PushOutcome,
  classifyPushResponse,
  createVapidHeaderCache,
  encryptPayloadAes128Gcm,
  payloadByteLength,
  validateVapidKeys,
  validateVapidSubject,
} from '../_shared/webpush.ts'

// Supabase lo inyecta en el runtime de Edge Functions; no existe en Deno a secas
// ni en los tests, de ahí el `| undefined` y el typeof antes de usarlo.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined

const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')
// El `sub` del JWT se queda como en eba61ee, que es lo que hoy entrega en
// iPhone: si VAPID_SUBJECT no es un mailto:, se firma con el de respaldo. RFC
// 8292 §2.1 y Apple admiten también https:, pero cambiar el `sub` es cambiar lo
// que viaja, y eso solo se hace probando en un iPhone. El respaldo es el correo
// de la UDP, con la que el proyecto no está afiliado: el arreglo es poner en el
// secreto un mailto: propio del proyecto, que se usará tal cual.
const FALLBACK_VAPID_SUBJECT = 'mailto:soporte@udp.cl'
const rawVapidSubject = Deno.env.get('VAPID_SUBJECT')
const vapidSubject = rawVapidSubject?.startsWith('mailto:') ? rawVapidSubject : FALLBACK_VAPID_SUBJECT
if (vapidSubject !== rawVapidSubject) {
  console.warn(
    `[send-push] VAPID_SUBJECT no es un mailto: (${validateVapidSubject(rawVapidSubject) ?? rawVapidSubject}); ` +
      `se firma con ${FALLBACK_VAPID_SUBJECT}. Pon un mailto: propio del proyecto en el secreto.`,
  )
}

// Se valida una sola vez al cargar. Un par VAPID ausente o corrupto no es un
// fallo de cada entrega: cobrarlo como tal agotaba la cola en un par de horas.
const configProblem = validateVapidKeys(vapidPublicKey, vapidPrivateKey)

const appOrigin = new URL(Deno.env.get('APP_ORIGIN') || 'https://udp-map.vercel.app').origin

// Una sola instancia: la caché de cabeceras VAPID tiene que sobrevivir entre
// entregas para que reutilizar el JWT tenga algún efecto.
const getVapidHeader = configProblem
  ? null
  : createVapidHeaderCache(vapidPublicKey!, vapidPrivateKey!, vapidSubject)

async function sendWebPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  bodyBytes: Uint8Array,
  authorization: string,
): Promise<{ status: number; apnsId: string | null; retryAfter: string | null; errorText: string }> {
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(bodyBytes.byteLength),
      TTL: '86400',
      Urgency: 'high',
    },
    body: bodyBytes,
    // Un servicio push colgado no puede frenar el lote entero.
    signal: AbortSignal.timeout(10_000),
  })

  const responseBody = await response.text().catch(() => '')
  const apnsId = response.headers.get('apns-id') || response.headers.get('x-apns-id') || null

  return {
    status: response.status,
    apnsId,
    retryAfter: response.headers.get('retry-after'),
    // El estado ya no viaja dentro de un Error: lo clasifica quien llama.
    errorText: response.ok ? '' : responseBody || response.statusText,
  }
}

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3000',
  appOrigin,
]

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((o) => o.trim()).filter(Boolean)
  const allowed = [...DEFAULT_ALLOWED_ORIGINS, ...envOrigins].includes(origin)

  return {
    // Origen no permitido: se omite el header y el navegador bloquea la respuesta.
    ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(cors: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json; charset=utf-8' },
  })
}

// Cuántas entregas se reclaman de una vez, y cuántos envíos viajan a la vez.
const BATCH_SIZE = 50
const SEND_CONCURRENCY = 10
// Reclamar es arrendar, no cerrar con candado: claim_push_deliveries adelanta
// next_attempt_at este tiempo y cuenta el intento. Si esta ejecución muere, la
// fila vuelve sola a ser reclamable al vencer, sin un estado 'processing' que
// alguien tenga que rescatar. Tiene que superar el peor lote: 50 / 10 = 5 tandas
// × 10 s de timeout del fetch = 50 s, más cifrado y cierre. Con menos, otra
// ejecución reclamaría filas que aún van en vuelo y las enviaría dos veces.
const LEASE_SECONDS = 120
// Cuánto tiempo se siguen empezando lotes. Solo frena los NUEVOS: el último puede
// empezar a los 40 s y acabar hacia los 90 s, dentro de su propio lease. Lo que
// quede en la cola lo toma la siguiente pasada del cron.
const TIME_BUDGET_MS = 40_000
// Además del reloj, un tope de trabajo. El límite de CPU de una Edge Function
// (2 s según la documentación de Supabase, sin contar la espera de red) lo gasta
// el cifrado de cada envío, no el tiempo: con un servicio push rápido, 40 s dan
// para miles de entregas, y una pasada que muere por CPU deja su lote en vuelo
// para reenviarse al vencer el lease. 6 lotes son 300 entregas por pasada, el
// triple del techo de antes (100); el cron se lleva el resto al minuto siguiente.
// Subirlo solo después de medir con una difusión real.
const MAX_BATCHES_PER_PASS = 6
// Entradas de `diagnostics` que se devuelven; el resto solo se cuenta.
const MAX_DIAGNOSTICS = 200

type VapidHeader = (endpoint: string) => Promise<string>

// El resultado de una entrega ya cerrado en papel: lo que se le dirá a
// finish_push_deliveries y lo que el diagnóstico necesita saber del envío.
interface Delivered {
  claimed: ClaimedDelivery
  result: DeliveryResult
  close: DeliveryClose
  httpStatus: number | null
  apnsId: string | null
}

interface QueueSummary {
  batches: number
  // Filas reclamadas en total; las que no se envían por una suscripción ya
  // caducada en esta pasada cuentan aquí y en `skipped`.
  processed: number
  skipped: number
  sent: number
  failed: number
  // Cierres que el fencing descartó: otra ejecución reclamó la fila después, o
  // el trigger la pasó a 'expired'.
  fenced: number
  expiredSubscriptions: number
  // Error de un reclamo; si es el primero, no hay nada que informar más que él.
  claimError: string | null
  closeErrors: string[]
  deleteErrors: Array<{ subscriptionId: string; error: string }>
  diagnostics: Array<Record<string, unknown>>
  diagnosticsOmitted: number
}

// Un único sitio para dejar lista una entrega: el cierre sale del mismo
// `attempts` que se reclamó, que es lo que hace de fencing en la base.
function settle(
  claimed: ClaimedDelivery,
  result: DeliveryResult,
  httpStatus: number | null = null,
  apnsId: string | null = null,
): Delivered {
  return {
    claimed,
    result,
    close: closeDelivery(claimed.delivery_id, claimed.attempts, result, Date.now(), claimed.endpoint),
    httpStatus,
    apnsId,
  }
}

// null = la fila no se envía y no se cierra (ver abajo).
async function deliver(
  claimed: ClaimedDelivery,
  expiredIds: Set<string>,
  vapidHeader: VapidHeader,
): Promise<Delivered | null> {
  // Su suscripción ya dio 404/410 en esta pasada: enviarle otra vez solo daría
  // otro 410. No se cierra: al borrar la suscripción, el trigger
  // push_subscriptions_expire_deliveries la pasa a 'expired'.
  if (expiredIds.has(claimed.subscription_id)) return null

  // El lease venció sin cierre demasiadas veces (la ejecución murió o no pudo
  // cerrar). Sin este corte, una fila que nunca se llega a cerrar seguiría
  // enviándose pasado el tope.
  if (claimed.attempts > MAX_ATTEMPTS) {
    return settle(claimed, { type: 'terminal', reason: exhaustedReason(claimed.attempts) })
  }

  // El reclamo devuelve columnas planas. Esta forma anidada es la que leen la URL
  // de navegación y el payload, cuyo texto fija golden.test.ts: no se reescriben.
  // Las columnas siguen planas en SQL porque un send-push anterior (20eee7e, la
  // vuelta atrás de docs/guias/despliegue.md, vuelta atrás) las lee así.
  const delivery = {
    notification: {
      id: claimed.notification_id,
      title: claimed.title,
      body: claimed.body,
      url: claimed.url,
      type: claimed.type,
      category: claimed.category,
      payload: claimed.payload,
    },
    subscription: { endpoint: claimed.endpoint, p256dh: claimed.p256dh, auth: claimed.auth },
  }

  let navigateUrl = `${appOrigin}/`
  try {
    const resolved = new URL(delivery.notification.url || '/', appOrigin)
    if (resolved.origin === appOrigin) {
      if (delivery.notification.id) {
        resolved.searchParams.set('notification', delivery.notification.id)
      }
      navigateUrl = resolved.href
    }
  } catch {
    navigateUrl = `${appOrigin}/`
  }

  // Payload híbrido: bloque Declarative Web Push (Push API del W3C, web_push: 8030)
  // + campos planos que lee push-sw.js. Es la forma que hoy entrega en iPhone: no
  // se toca sin probar allí. Con service worker instalado, quién pinta la
  // notificación en iOS 18.4+ no está claro (WebKit y el W3C se contradicen; ver
  // docs/historico/2026-10/auditoria-push.md), así que el SW sigue necesitando los campos planos.
  const payload = JSON.stringify({
        web_push: 8030,
        notification: {
          title: delivery.notification.title || 'UDP Map',
          body: delivery.notification.body || 'Tienes una nueva notificación.',
          navigate: navigateUrl,
          icon: `${appOrigin}/pwa-192x192.png`,
          lang: 'es',
          tag: delivery.notification.id,
          data: {
            url: delivery.notification.url || '/',
            notificationId: delivery.notification.id,
            type: delivery.notification.type,
            category: delivery.notification.category,
            payload: delivery.notification.payload,
          },
        },
        notificationId: delivery.notification.id,
        title: delivery.notification.title,
        body: delivery.notification.body,
        url: delivery.notification.url,
        type: delivery.notification.type,
        category: delivery.notification.category,
        payload: delivery.notification.payload,
      })

  if (payloadByteLength(payload) > MAX_PLAINTEXT_BYTES) {
    return settle(claimed, {
      type: 'terminal',
      reason: `payload demasiado grande (${payloadByteLength(payload)} B)`,
    })
  }

  // Cifrado y cabecera aparte del fetch: si lanzan es por datos de la
  // suscripción (p. ej. DataError con p256dh/auth corruptos) y reintentar
  // nunca lo arreglaría.
  let bodyBytes: Uint8Array
  let authorization: string
  try {
    bodyBytes = await encryptPayloadAes128Gcm(payload, delivery.subscription.p256dh, delivery.subscription.auth)
    authorization = await vapidHeader(delivery.subscription.endpoint)
  } catch (cryptoError) {
    return settle(claimed, {
      type: 'terminal',
      reason: `claves de la suscripción inválidas: ${
        cryptoError instanceof Error ? cryptoError.message : String(cryptoError)
      }`,
    })
  }

  let outcome: PushOutcome
  let httpStatus: number | null = null
  let apnsId: string | null = null
  let errorText = ''
  try {
    const result = await sendWebPushNotification(delivery.subscription, bodyBytes, authorization)
    httpStatus = result.status
    apnsId = result.apnsId
    errorText = result.errorText
    outcome = classifyPushResponse(result.status, result.retryAfter)
  } catch (networkError) {
    // Red caída o timeout: transitorio, se reintenta sin Retry-After.
    errorText = networkError instanceof Error ? networkError.message : String(networkError)
    outcome = { kind: 'retry', retryAfterMs: null }
  }

  // Se anota ya, no al cerrar el lote: las filas de esta misma suscripción que
  // aún no han empezado a enviarse se saltan en vez de recibir otro 410.
  if (outcome.kind === 'expired') expiredIds.add(claimed.subscription_id)
  if (outcome.kind === 'failed' && (httpStatus === 401 || httpStatus === 403)) {
    console.error('El servicio push rechazó la autenticación VAPID: revisar el par VAPID y VAPID_SUBJECT')
  }

  return settle(claimed, { type: 'push', outcome, httpStatus, errorText }, httpStatus, apnsId)
}

// Una fila no puede tumbar el lote: si lanzara dentro del pool, el cierre en
// bloque no llegaría a hacerse y las 50 entregas quedarían sin cerrar hasta que
// venza el lease (y se reenviarían). Lo inesperado se cobra como un reintento.
async function processDelivery(
  claimed: ClaimedDelivery,
  expiredIds: Set<string>,
  vapidHeader: VapidHeader,
): Promise<Delivered | null> {
  try {
    return await deliver(claimed, expiredIds, vapidHeader)
  } catch (unexpected) {
    console.error('Error inesperado al procesar la entrega', claimed.delivery_id, unexpected)
    return settle(claimed, {
      type: 'push',
      outcome: { kind: 'retry', retryAfterMs: null },
      httpStatus: null,
      errorText: `error inesperado: ${unexpected instanceof Error ? unexpected.message : String(unexpected)}`,
    })
  }
}

// Cierra un lote, con un reintento. Reintentar es seguro por el fencing: una fila
// que el primer intento sí llegó a cerrar ya no está 'pending' y el segundo no la
// toca (solo que entonces cuenta como `fenced`, aunque se cerró bien). Sin el
// reintento, un corte breve de la base dejaba hasta 50 entregas ya enviadas para
// reenviarse al vencer el lease.
async function finishBatch(closes: DeliveryClose[]) {
  const first = await supabase.rpc('finish_push_deliveries', { p_results: closes })
  if (!first.error) return first
  console.error('Falló el cierre de un lote; se reintenta una vez', first.error)
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  return supabase.rpc('finish_push_deliveries', { p_results: closes })
}

// `notificationId` acota la pasada a las entregas de ese aviso (lo pide el panel
// para saber qué pasó con SU prueba); null recorre la cola entera, como el cron.
async function processQueue(vapidHeader: VapidHeader, notificationId: string | null): Promise<QueueSummary> {
  const startedAt = Date.now()
  // Dura toda la ejecución, no un lote: ver `deliver`.
  const expiredIds = new Set<string>()
  const summary: QueueSummary = {
    batches: 0,
    processed: 0,
    skipped: 0,
    sent: 0,
    failed: 0,
    fenced: 0,
    expiredSubscriptions: 0,
    claimError: null,
    closeErrors: [],
    deleteErrors: [],
    diagnostics: [],
    diagnosticsOmitted: 0,
  }

  while (summary.batches < MAX_BATCHES_PER_PASS && Date.now() - startedAt < TIME_BUDGET_MS) {
    const { data, error } = await supabase.rpc('claim_push_deliveries', {
      p_limit: BATCH_SIZE,
      p_lease_seconds: LEASE_SECONDS,
      // Solo viaja si hay aviso: la llamada del cron queda como siempre.
      ...(notificationId ? { p_notification_id: notificationId } : {}),
    })
    if (error) {
      console.error('No se pudo reclamar un lote de entregas', error)
      summary.claimError = error.message
      break
    }

    const claimed = (data ?? []) as ClaimedDelivery[]
    if (claimed.length === 0) break
    summary.batches += 1
    summary.processed += claimed.length

    const results = await runWithConcurrency(claimed, SEND_CONCURRENCY, (row) =>
      processDelivery(row, expiredIds, vapidHeader),
    )
    const delivered = results.filter((d): d is Delivered => d !== null)
    summary.skipped += results.length - delivered.length

    // Un solo cierre por lote. Solo cierra las filas cuyo `attempts` sigue siendo
    // el reclamado y que siguen 'pending'; devuelve las que sí cerró.
    // supabase-js devuelve { error } en vez de lanzar.
    const closedIds = new Set<string>()
    let closeError: string | null = null
    if (delivered.length > 0) {
      const { data: closedRows, error: finishError } = await finishBatch(delivered.map((d) => d.close))
      if (finishError) {
        console.error('No se pudo cerrar un lote de entregas', finishError)
        closeError = finishError.message
        summary.closeErrors.push(closeError)
      } else {
        for (const row of (closedRows ?? []) as Array<{ delivery_id: string }>) {
          closedIds.add(row.delivery_id)
        }
        summary.fenced += delivered.length - closedIds.size
      }
    }

    // Las suscripciones que dieron 404/410 se borran DESPUÉS del cierre: el
    // trigger BEFORE DELETE pasa a 'expired' el resto de sus entregas pendientes,
    // y si corriera antes, estas filas se cerrarían con el texto genérico del
    // trigger en vez del del servicio push. Se borran aunque el cierre haya
    // fallado: la suscripción está muerta igual.
    const deadSubscriptions = [
      ...new Set(
        delivered.filter((d) => d.close.status === 'expired').map((d) => d.claimed.subscription_id),
      ),
    ]
    const deleteErrors = new Map<string, string>()
    await Promise.all(deadSubscriptions.map(async (subscriptionId) => {
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', subscriptionId)
      if (deleteError) {
        console.error('No se pudo borrar una suscripción expirada', subscriptionId, deleteError)
        deleteErrors.set(subscriptionId, deleteError.message)
        summary.deleteErrors.push({ subscriptionId, error: deleteError.message })
      }
    }))

    for (const d of delivered) {
      const { status } = d.close
      if (status === 'sent') summary.sent += 1
      else if (status !== 'expired') summary.failed += 1

      if (summary.diagnostics.length >= MAX_DIAGNOSTICS) {
        summary.diagnosticsOmitted += 1
        continue
      }
      const dbErrors = [
        closeError,
        status === 'expired' ? deleteErrors.get(d.claimed.subscription_id) : undefined,
      ].filter(Boolean)
      summary.diagnostics.push({
        deliveryId: d.claimed.delivery_id,
        subscriptionId: d.claimed.subscription_id,
        endpointPrefix: d.claimed.endpoint.slice(0, 48),
        outcome: status === 'pending' ? 'retry' : status,
        httpStatus: d.httpStatus ?? undefined,
        apnsId: d.apnsId,
        error: diagnosticError(d.result),
        dbError: dbErrors.length > 0 ? dbErrors.join('; ') : null,
        // false: el fencing no la cerró (o el cierre falló) y el estado de la fila
        // no es el que dice `outcome`.
        closed: closedIds.has(d.claimed.delivery_id),
      })
    }

    // Sin poder cerrar, seguir enviando solo apilaría entregas que se repetirán
    // al vencer el lease. Un lote corto es que la cola se vació.
    if (closeError !== null || claimed.length < BATCH_SIZE) break
  }

  summary.expiredSubscriptions = expiredIds.size
  return summary
}

const DELIVERY_STATUSES = ['pending', 'sent', 'failed', 'expired'] as const
type DeliveryCounts = Record<(typeof DELIVERY_STATUSES)[number], number>

// Cómo quedaron las entregas de un aviso, por estado, para que el panel diga la
// verdad de SU prueba y no la de toda la pasada. Un conteo por estado y no un
// select de las filas: PostgREST corta en 1000 filas, y una difusión grande daría
// un total que parece bueno y no lo es. Nunca rechaza ni tumba la respuesta (la
// pasada ya se hizo y sus números son buenos): un fallo viaja dentro de
// `notification.error`.
async function countNotificationDeliveries(
  notificationId: string,
): Promise<{ id: string; deliveries: DeliveryCounts } | { id: string; error: string }> {
  try {
    const results = await Promise.all(
      DELIVERY_STATUSES.map((status) =>
        supabase
          .from('notification_push_deliveries')
          .select('id', { count: 'exact', head: true })
          .eq('notification_id', notificationId)
          .eq('status', status),
      ),
    )
    const failedQuery = results.find((r) => r.error)
    if (failedQuery?.error) {
      console.error('No se pudieron contar las entregas del aviso', notificationId, failedQuery.error)
      return { id: notificationId, error: failedQuery.error.message }
    }
    const deliveries = Object.fromEntries(
      DELIVERY_STATUSES.map((status, i) => [status, results[i].count ?? 0]),
    ) as DeliveryCounts
    return { id: notificationId, deliveries }
  } catch (unexpected) {
    console.error('Error inesperado al contar las entregas del aviso', notificationId, unexpected)
    return { id: notificationId, error: unexpected instanceof Error ? unexpected.message : String(unexpected) }
  }
}

// Una pasada entera sobre la cola. Nunca rechaza: la espera el panel o, en
// segundo plano, nadie, y en los dos casos tiene que terminar en una respuesta
// o en una línea de log.
async function drainQueue(
  vapidHeader: VapidHeader,
  notificationId: string | null,
): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const summary = await processQueue(vapidHeader, notificationId)
    // Si falla el primer reclamo la base no responde y no hay nada que contar;
    // si falla uno posterior, ya hay trabajo hecho y se informa junto a él.
    if (summary.claimError !== null && summary.batches === 0) {
      return { status: 500, body: { error: summary.claimError } }
    }
    return {
      status: 200,
      body: {
        processed: summary.processed,
        sent: summary.sent,
        failed: summary.failed,
        expiredSubscriptions: summary.expiredSubscriptions,
        diagnostics: summary.diagnostics,
        batches: summary.batches,
        skipped: summary.skipped,
        fenced: summary.fenced,
        diagnosticsOmitted: summary.diagnosticsOmitted,
        claimError: summary.claimError,
        closeErrors: summary.closeErrors,
        deleteErrors: summary.deleteErrors,
        // Después de la pasada, con el cierre ya hecho: lo que se lee es el estado
        // final, no el de antes de empezar.
        ...(notificationId ? { notification: await countNotificationDeliveries(notificationId) } : {}),
      },
    }
  } catch (unexpected) {
    console.error('La pasada de send-push terminó con una excepción', unexpected)
    return {
      status: 500,
      body: { error: unexpected instanceof Error ? unexpected.message : String(unexpected) },
    }
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }
  if (req.method !== 'POST') return json(cors, { error: 'Method not allowed' }, 405)
  const caller = await isAuthorized(req)
  if (!caller) return json(cors, { error: 'Unauthorized' }, 401)

  // Solo el panel puede pedir un aviso concreto. El cron manda `{}` y, aunque un
  // día mandara otra cosa, no se lee: su pasada es siempre la cola entera, y un
  // cuerpo raro no puede hacer que el minuto se pierda con un 400.
  let notificationId: string | null = null
  if (caller === 'admin') {
    // Tolerante: un cuerpo vacío o que no es JSON es "sin aviso", no un error.
    const body: unknown = await req.json().catch(() => null)
    const parsed = parseNotificationId(body)
    if (!parsed.ok) return json(cors, { error: parsed.error }, 400)
    notificationId = parsed.notificationId
  }

  // Antes de tocar la cola, para no gastar intentos con una configuración que no
  // puede enviar nada. Los recordatorios de eventos ya no pasan por aquí: los
  // encola su propio cron (`udp-map-event-reminders`), que no depende de VAPID.
  if (configProblem || !getVapidHeader) {
    console.error('Configuración VAPID inválida, no se procesa la cola:', configProblem)
    return json(cors, { error: configProblem }, 500)
  }

  const pass = drainQueue(getVapidHeader, notificationId)

  // pg_net corta la petición del cron a los 5 s y una pasada puede durar más de
  // un minuto: se contesta ya y la pasada sigue en segundo plano. El panel sí
  // espera, porque es quien enseña el resultado. Sin EdgeRuntime (otro runtime,
  // o en local) tampoco hay segundo plano, así que se espera en línea.
  if (caller === 'cron' && typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(pass.then(({ status, body }) => {
      const { diagnostics: _diagnostics, ...resumen } = body
      const log = status === 200 ? console.log : console.error
      log('[send-push] pasada terminada', JSON.stringify(resumen))
    }))
    return json(cors, { accepted: true }, 202)
  }

  const { status, body } = await pass
  return json(cors, body, status)
})
