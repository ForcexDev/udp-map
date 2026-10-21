import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  MAX_ATTEMPTS,
  MAX_PLAINTEXT_BYTES,
  type PushOutcome,
  classifyPushResponse,
  createVapidHeaderCache,
  encryptPayloadAes128Gcm,
  payloadByteLength,
  retryDelayMs,
  validateVapidKeys,
  validateVapidSubject,
} from '../_shared/webpush.ts'

// Sin estas dos no hay nada que hacer: fallar al cargar el módulo
// con un mensaje claro, en vez de un `undefined` que explota más adelante.
function requireEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta la variable de entorno ${name}`)
  return value
}

const supabaseUrl = requireEnv('SUPABASE_URL')
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
// Opcional: isAuthorized ya comprueba que exista antes de compararlo.
const cronSecret = Deno.env.get('CRON_SECRET')
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

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

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

interface DeliveryRow {
  id: string
  attempts: number
  notification: {
    id: string
    title: string
    body: string
    url: string
    type: string
    category: string
    payload: Record<string, unknown>
  }
  subscription: {
    id: string
    endpoint: string
    p256dh: string
    auth: string
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

async function isAuthorized(req: Request): Promise<boolean> {
  const providedSecret = req.headers.get('x-cron-secret')
  if (cronSecret && providedSecret === cronSecret) return true

  const authorization = req.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return false

  const token = authorization.slice('Bearer '.length)
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()
  return profile?.role === 'admin'
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }
  if (req.method !== 'POST') return json(cors, { error: 'Method not allowed' }, 405)
  if (!await isAuthorized(req)) return json(cors, { error: 'Unauthorized' }, 401)

  const { data: remindersCreated, error: reminderError } = await supabase
    .rpc('enqueue_upcoming_event_notifications')

  if (reminderError) {
    console.error('Could not enqueue event reminders', reminderError)
  }

  // Después de los recordatorios, que no dependen de VAPID y alimentan la
  // bandeja; antes de tocar la cola, para no gastar intentos con una
  // configuración que no puede enviar nada.
  if (configProblem || !getVapidHeader) {
    console.error('Configuración VAPID inválida, no se procesa la cola:', configProblem)
    return json(cors, {
      error: configProblem,
      remindersCreated: remindersCreated ?? 0,
      reminderError: reminderError?.message ?? null,
    }, 500)
  }

  const { data, error } = await supabase
    .from('notification_push_deliveries')
    .select(`
      id,
      attempts,
      notification:notifications!inner(id, title, body, url, type, category, payload),
      subscription:push_subscriptions!inner(id, endpoint, p256dh, auth)
    `)
    .eq('status', 'pending')
    .lte('next_attempt_at', new Date().toISOString())
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) return json(cors, { error: error.message }, 500)

  let sent = 0
  let failed = 0
  const expiredIds = new Set<string>()
  const diagnostics: Array<Record<string, unknown>> = []

  // Un único sitio para armar el diagnóstico de cada entrega.
  const addDiagnostic = (
    delivery: DeliveryRow,
    outcome: 'sent' | 'expired' | 'failed' | 'retry',
    extra: { httpStatus?: number; apnsId?: string | null; error?: string; dbError?: string | null } = {},
  ) => {
    diagnostics.push({
      deliveryId: delivery.id,
      subscriptionId: delivery.subscription.id,
      endpointPrefix: delivery.subscription.endpoint.slice(0, 48),
      outcome,
      ...extra,
    })
  }

  // supabase-js devuelve { error } en vez de lanzar: sin esta comprobación un
  // update fallido se ignoraba y la entrega se reenviaba cada minuto.
  const dbErrorOf = (deliveryId: string, error: { message: string } | null): string | null => {
    if (!error) return null
    console.error('Error de base al actualizar la entrega', deliveryId, error)
    return error.message
  }

  // Escribe el estado final de una entrega que no se envió (fallo o reintento).
  const markUnsent = async (
    delivery: DeliveryRow,
    update: Record<string, unknown>,
  ): Promise<string | null> => {
    const { error: updateError } = await supabase
      .from('notification_push_deliveries')
      .update(update)
      .eq('id', delivery.id)
    return dbErrorOf(delivery.id, updateError)
  }

  for (const rawDelivery of data ?? []) {
    const delivery = rawDelivery as unknown as DeliveryRow

    // Su suscripción ya se borró en esta pasada (el CASCADE se llevó la fila):
    // enviarle otra vez solo daría otro 410.
    if (expiredIds.has(delivery.subscription.id)) continue

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
    // docs/PUSH_REWORK_REVIEW.md), así que el SW sigue necesitando los campos planos.
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

    const attempts = delivery.attempts + 1

    if (payloadByteLength(payload) > MAX_PLAINTEXT_BYTES) {
      const reason = `payload demasiado grande (${payloadByteLength(payload)} B)`
      const dbError = await markUnsent(delivery, {
        status: 'failed',
        attempts,
        last_error: reason.slice(0, 1000),
      })
      failed += 1
      addDiagnostic(delivery, 'failed', { error: reason, dbError })
      continue
    }

    // Cifrado y cabecera aparte del fetch: si lanzan es por datos de la
    // suscripción (p. ej. DataError con p256dh/auth corruptos) y reintentar
    // nunca lo arreglaría.
    let bodyBytes: Uint8Array
    let authorization: string
    try {
      bodyBytes = await encryptPayloadAes128Gcm(payload, delivery.subscription.p256dh, delivery.subscription.auth)
      authorization = await getVapidHeader(delivery.subscription.endpoint)
    } catch (cryptoError) {
      const reason = `claves de la suscripción inválidas: ${
        cryptoError instanceof Error ? cryptoError.message : String(cryptoError)
      }`
      const dbError = await markUnsent(delivery, {
        status: 'failed',
        attempts,
        last_error: reason.slice(0, 1000),
      })
      failed += 1
      addDiagnostic(delivery, 'failed', { error: reason, dbError })
      continue
    }

    let outcome: PushOutcome
    let httpStatus: number | undefined
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

    if (outcome.kind === 'sent') {
      const { error: updateError } = await supabase
        .from('notification_push_deliveries')
        .update({
          status: 'sent',
          attempts,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', delivery.id)
      sent += 1
      addDiagnostic(delivery, 'sent', { httpStatus, apnsId, dbError: dbErrorOf(delivery.id, updateError) })
      continue
    }

    if (outcome.kind === 'expired') {
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('id', delivery.subscription.id)
      expiredIds.add(delivery.subscription.id)
      addDiagnostic(delivery, 'expired', {
        httpStatus,
        apnsId,
        error: errorText,
        dbError: dbErrorOf(delivery.id, deleteError),
      })
      continue
    }

    if (outcome.kind === 'failed') {
      if (httpStatus === 401 || httpStatus === 403) {
        console.error('El servicio push rechazó la autenticación VAPID: revisar el par VAPID y VAPID_SUBJECT')
      }
      const dbError = await markUnsent(delivery, {
        status: 'failed',
        attempts,
        last_error: `${outcome.reason}: ${errorText}`.slice(0, 1000),
      })
      failed += 1
      addDiagnostic(delivery, 'failed', { httpStatus, apnsId, error: outcome.reason, dbError })
      continue
    }

    const terminal = attempts >= MAX_ATTEMPTS
    const retryAt = new Date(Date.now() + retryDelayMs(attempts, outcome.retryAfterMs))
    const dbError = await markUnsent(delivery, {
      status: terminal ? 'failed' : 'pending',
      attempts,
      next_attempt_at: retryAt.toISOString(),
      last_error: (errorText || `respuesta ${httpStatus}`).slice(0, 1000),
    })
    failed += 1
    addDiagnostic(delivery, terminal ? 'failed' : 'retry', { httpStatus, apnsId, error: errorText, dbError })
  }

  return json(cors, {
    engine: 'webcrypto-aes128gcm-v1',
    remindersCreated: remindersCreated ?? 0,
    processed: data?.length ?? 0,
    sent,
    failed,
    expiredSubscriptions: expiredIds.size,
    reminderError: reminderError?.message ?? null,
    diagnostics,
  })
})
