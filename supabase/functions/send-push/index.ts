import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const cronSecret = Deno.env.get('CRON_SECRET')!
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
const rawVapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:soporte@udp.cl'
// Apple Web Push (web.push.apple.com) exige o recomienda un URI mailto: válido en el claim sub.
const vapidSubject = rawVapidSubject.startsWith('mailto:') ? rawVapidSubject : 'mailto:soporte@udp.cl'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const encoder = new TextEncoder()

function base64UrlToBytes(b64url: string): Uint8Array {
  const clean = b64url.trim().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const padding = '='.repeat((4 - (clean.length % 4)) % 4)
  const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

async function hkdfDeriveBytes(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  byteLength: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    keyMaterial,
    byteLength * 8,
  )
  return new Uint8Array(bits)
}

/**
 * Cifra el payload Web Push según RFC 8291 (aes128gcm) y RFC 8188 usando Web Crypto API nativa.
 * Evita npm:web-push en Deno, cuyo polyfill de node:crypto corrompe el cifrado ECDH/GCM en iOS.
 */
async function encryptPayloadAes128Gcm(
  plaintext: string,
  p256dhBase64Url: string,
  authBase64Url: string,
): Promise<Uint8Array> {
  const uaPublicBytes = base64UrlToBytes(p256dhBase64Url)
  const authSecretBytes = base64UrlToBytes(authBase64Url)

  const uaPublicKey = await crypto.subtle.importKey(
    'raw',
    uaPublicBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )

  const asKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )

  const asPublicBytes = new Uint8Array(await crypto.subtle.exportKey('raw', asKeyPair.publicKey))
  const ecdhSecretBytes = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaPublicKey },
      asKeyPair.privateKey,
      256,
    ),
  )

  // RFC 8291 Sección 3.3: IKM = HKDF(salt=auth_secret, ikm=ecdh_secret, info="WebPush: info\0" || ua_public || as_public, L=32)
  const keyInfo = concatBytes(
    encoder.encode('WebPush: info\0'),
    uaPublicBytes,
    asPublicBytes,
  )
  const ikm = await hkdfDeriveBytes(ecdhSecretBytes, authSecretBytes, keyInfo, 32)

  // RFC 8291 Sección 3.4: CEK (16 bytes) y Nonce (12 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cekInfo = encoder.encode('Content-Encoding: aes128gcm\0')
  const nonceInfo = encoder.encode('Content-Encoding: nonce\0')

  const cekBytes = await hkdfDeriveBytes(ikm, salt, cekInfo, 16)
  const nonceBytes = await hkdfDeriveBytes(ikm, salt, nonceInfo, 12)

  const aesKey = await crypto.subtle.importKey('raw', cekBytes, { name: 'AES-GCM' }, false, ['encrypt'])
  const plaintextBytes = encoder.encode(plaintext)
  // Delimitador de registro final RFC 8188: 0x02
  const recordPlaintext = concatBytes(plaintextBytes, new Uint8Array([2]))

  const ciphertextBytes = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonceBytes, tagLength: 128 },
      aesKey,
      recordPlaintext,
    ),
  )

  // Cabecera aes128gcm (RFC 8188 Sección 2.1): salt (16B) || rs (4B uint32 BE) || idlen (1B) || keyid (65B)
  const header = new Uint8Array(21 + asPublicBytes.length)
  header.set(salt, 0)
  const view = new DataView(header.buffer)
  view.setUint32(16, 4096, false)
  header[20] = asPublicBytes.length
  header.set(asPublicBytes, 21)

  return concatBytes(header, ciphertextBytes)
}

/**
 * Genera la cabecera Authorization VAPID (RFC 8292) firmada con ES256 mediante Web Crypto API.
 */
async function createVapidAuthHeader(
  endpoint: string,
  vapidPubB64Url: string,
  vapidPrivB64Url: string,
  subject: string,
): Promise<string> {
  const pubBytes = base64UrlToBytes(vapidPubB64Url)
  if (pubBytes.length !== 65 || pubBytes[0] !== 4) {
    throw new Error('Invalid VAPID public key format (expected 65-byte uncompressed P-256 point)')
  }
  const x = bytesToBase64Url(pubBytes.slice(1, 33))
  const y = bytesToBase64Url(pubBytes.slice(33, 65))
  const d = bytesToBase64Url(base64UrlToBytes(vapidPrivB64Url))

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d, key_ops: ['sign'], ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

  const origin = new URL(endpoint).origin
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60

  const headerB64 = bytesToBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payloadB64 = bytesToBase64Url(encoder.encode(JSON.stringify({ aud: origin, exp, sub: subject })))
  const signingInput = `${headerB64}.${payloadB64}`

  const sigBytes = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      privateKey,
      encoder.encode(signingInput),
    ),
  )

  const jwt = `${signingInput}.${bytesToBase64Url(sigBytes)}`
  const cleanPub = bytesToBase64Url(pubBytes)
  return `vapid t=${jwt}, k=${cleanPub}`
}

async function sendWebPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payloadText: string,
): Promise<{ status: number; apnsId: string | null; responseBody: string }> {
  const bodyBytes = await encryptPayloadAes128Gcm(payloadText, subscription.p256dh, subscription.auth)
  const authorization = await createVapidAuthHeader(
    subscription.endpoint,
    vapidPublicKey,
    vapidPrivateKey,
    vapidSubject,
  )

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
  })

  const responseBody = await response.text().catch(() => '')
  const apnsId = response.headers.get('apns-id') || response.headers.get('x-apns-id') || null

  if (!response.ok) {
    const err = new Error(
      `Push gateway responded ${response.status}: ${responseBody || response.statusText}`,
    ) as Error & { statusCode?: number; apnsId?: string | null }
    err.statusCode = response.status
    err.apnsId = apnsId
    throw err
  }

  return {
    status: response.status,
    apnsId,
    responseBody,
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
  'https://udp-map.vercel.app',
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
  let expired = 0
  const diagnostics: Array<Record<string, unknown>> = []

  for (const rawDelivery of data ?? []) {
    const delivery = rawDelivery as unknown as DeliveryRow
    const appOrigin = 'https://udp-map.vercel.app'
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

    // Formato híbrido Declarative Web Push (W3C / WebKit RFC 8030, clave mágica web_push: 8030)
    // + campos planos de respaldo para Service Workers clásicos.
    // En iOS 18.4+ / iOS 26 (webpushd), `web_push: 8030` hace que el demonio del sistema
    // muestre la notificación de forma nativa sin depender de despertar el Service Worker.
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

    try {
      const result = await sendWebPushNotification(
        {
          endpoint: delivery.subscription.endpoint,
          p256dh: delivery.subscription.p256dh,
          auth: delivery.subscription.auth,
        },
        payload,
      )

      await supabase
        .from('notification_push_deliveries')
        .update({
          status: 'sent',
          attempts: delivery.attempts + 1,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', delivery.id)
      sent += 1
      diagnostics.push({
        deliveryId: delivery.id,
        subscriptionId: delivery.subscription.id,
        endpointPrefix: delivery.subscription.endpoint.slice(0, 48),
        outcome: 'sent',
        httpStatus: result.status,
        apnsId: result.apnsId,
      })
    } catch (pushError) {
      const statusCode = typeof pushError === 'object' && pushError !== null && 'statusCode' in pushError
        ? Number((pushError as { statusCode?: number }).statusCode)
        : 0
      const apnsId = typeof pushError === 'object' && pushError !== null && 'apnsId' in pushError
        ? (pushError as { apnsId?: string | null }).apnsId ?? null
        : null
      const message = pushError instanceof Error ? pushError.message : String(pushError)

      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', delivery.subscription.id)
        expired += 1
        diagnostics.push({
          deliveryId: delivery.id,
          subscriptionId: delivery.subscription.id,
          endpointPrefix: delivery.subscription.endpoint.slice(0, 48),
          outcome: 'expired',
          httpStatus: statusCode,
          apnsId,
          error: message,
        })
        continue
      }

      const attempts = delivery.attempts + 1
      const terminal = attempts >= 5
      const retryAt = new Date(Date.now() + Math.min(60, 5 * (2 ** attempts)) * 60_000)
      await supabase
        .from('notification_push_deliveries')
        .update({
          status: terminal ? 'failed' : 'pending',
          attempts,
          next_attempt_at: retryAt.toISOString(),
          last_error: message.slice(0, 1000),
        })
        .eq('id', delivery.id)
      failed += 1
      diagnostics.push({
        deliveryId: delivery.id,
        subscriptionId: delivery.subscription.id,
        endpointPrefix: delivery.subscription.endpoint.slice(0, 48),
        outcome: terminal ? 'failed' : 'retry',
        httpStatus: statusCode,
        apnsId,
        error: message,
      })
    }
  }

  return json(cors, {
    engine: 'webcrypto-aes128gcm-v1',
    remindersCreated: remindersCreated ?? 0,
    processed: data?.length ?? 0,
    sent,
    failed,
    expiredSubscriptions: expired,
    reminderError: reminderError?.message ?? null,
    diagnostics,
  })
})
