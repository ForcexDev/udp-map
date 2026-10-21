// Web Push (RFC 8030 / 8291 / 8292) con Web Crypto puro: sin APIs de Deno ni
// imports por URL, para poder probarlo con vitest en node (webpush.test.ts) y
// usarlo desde la Edge Function sin cambios.

export const encoder = new TextEncoder()

export function base64UrlToBytes(b64url: string): Uint8Array {
  const clean = b64url.trim().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const padding = '='.repeat((4 - (clean.length % 4)) % 4)
  const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

export async function hkdfDeriveBytes(
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
 * Se dejó npm:web-push porque no publica versión desde la 3.6.7 (enero de 2024) y porque
 * esta implementación con Web Crypto es la que entrega hoy en iPhone; está validada contra
 * el Apéndice A del RFC 8291 en webpush.test.ts.
 */
export async function encryptPayloadAes128Gcm(
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
export async function createVapidAuthHeader(
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

/**
 * Tamaño máximo del texto plano: RFC 8291 §4 limita el cuerpo a 4096 octetos y
 * a eso se le restan 86 de cabecera (salt 16 + rs 4 + idlen 1 + keyid 65),
 * 1 del delimitador de padding y 16 del tag GCM. Más allá, el servicio push
 * responde 413, o peor, el registro no cabe en rs=4096 y no se puede descifrar.
 */
export const MAX_PLAINTEXT_BYTES = 3993

/** Bytes UTF-8 del texto: lo que cuenta para el límite es el cuerpo, no los caracteres. */
export function payloadByteLength(text: string): number {
  return encoder.encode(text).length
}

/**
 * Valida el par VAPID sin lanzar nunca. Devuelve el problema en español, o null
 * si está bien. Se usa al arrancar para no gastar la cola cobrando como fallo de
 * cada entrega algo que es un error de configuración.
 */
export function validateVapidKeys(
  publicKey: string | undefined,
  privateKey: string | undefined,
): string | null {
  if (!publicKey) return 'Falta VAPID_PUBLIC_KEY'
  if (!privateKey) return 'Falta VAPID_PRIVATE_KEY'
  try {
    const pub = base64UrlToBytes(publicKey)
    if (pub.length !== 65 || pub[0] !== 4) {
      return 'VAPID_PUBLIC_KEY inválida: debe ser un punto P-256 sin comprimir de 65 bytes (prefijo 0x04)'
    }
  } catch {
    return 'VAPID_PUBLIC_KEY inválida: no es base64url'
  }
  try {
    if (base64UrlToBytes(privateKey).length !== 32) {
      return 'VAPID_PRIVATE_KEY inválida: debe tener 32 bytes'
    }
  } catch {
    return 'VAPID_PRIVATE_KEY inválida: no es base64url'
  }
  return null
}

/** RFC 8292 §2.1: el claim sub es un mailto: o una URL https:. Apple acepta ambos. */
export function validateVapidSubject(subject: string | undefined): string | null {
  if (!subject) return 'Falta VAPID_SUBJECT (debe empezar por mailto: o https:)'
  if (subject.startsWith('mailto:') || subject.startsWith('https:')) return null
  return 'VAPID_SUBJECT inválido: debe empezar por mailto: o https:'
}

// createVapidAuthHeader firma con exp a 12 h; reutilizando hasta las 11 h
// siempre le queda más de 1 h de vida al token que se envía.
const VAPID_REUSE_MS = 11 * 60 * 60 * 1000

/**
 * Caché de cabeceras VAPID por origen del endpoint. Apple pide no renovar el
 * JWT más de una vez por hora y RFC 8292 §5 anima a reutilizarlo; firmar uno por
 * envío además cuesta un importKey y un sign de más en cada entrega.
 */
export function createVapidHeaderCache(
  publicKey: string,
  privateKey: string,
  subject: string,
  now: () => number = Date.now,
): (endpoint: string) => Promise<string> {
  const cache = new Map<string, { header: string; createdAt: number }>()
  return async (endpoint: string) => {
    const origin = new URL(endpoint).origin
    const hit = cache.get(origin)
    if (hit && now() - hit.createdAt < VAPID_REUSE_MS) return hit.header
    const createdAt = now()
    const header = await createVapidAuthHeader(endpoint, publicKey, privateKey, subject)
    cache.set(origin, { header, createdAt })
    return header
  }
}

export type PushOutcome =
  | { kind: 'sent' }
  | { kind: 'expired' }
  | { kind: 'failed'; reason: string }
  | { kind: 'retry'; retryAfterMs: number | null }

/** Retry-After admite segundos enteros o una fecha HTTP. Nunca devuelve negativos. */
export function parseRetryAfter(value: string | null, now: number): number | null {
  if (!value) return null
  const text = value.trim()
  if (/^\d+$/.test(text)) return Number(text) * 1000
  const date = Date.parse(text)
  if (Number.isNaN(date)) return null
  return Math.max(0, date - now)
}

/**
 * Decide qué hacer con la respuesta del servicio push. 401/403 NO son
 * "expirada": un par VAPID mal configurado da 403 en todas las entregas, y
 * tratarlo como 410 borraría todas las suscripciones.
 */
export function classifyPushResponse(
  status: number,
  retryAfter: string | null,
  now: number = Date.now(),
): PushOutcome {
  if (status >= 200 && status < 300) return { kind: 'sent' }
  if (status === 404 || status === 410) return { kind: 'expired' }
  if (status === 400) return { kind: 'failed', reason: 'petición rechazada por el servicio push (400)' }
  if (status === 413) return { kind: 'failed', reason: 'payload demasiado grande (413)' }
  if (status === 401 || status === 403) {
    return { kind: 'failed', reason: `autenticación VAPID rechazada (${status})` }
  }
  if (status === 429 || status >= 500) {
    return { kind: 'retry', retryAfterMs: parseRetryAfter(retryAfter, now) }
  }
  return { kind: 'retry', retryAfterMs: null }
}

export const MAX_ATTEMPTS = 5

/**
 * Espera antes del siguiente intento, en ms. Sin Retry-After, el backoff de
 * siempre (5·2^n minutos, tope 60); con él, ese valor acotado a 1–60 minutos
 * para que ni un 0 ni un día entero desordenen la cola.
 */
export function retryDelayMs(attempts: number, retryAfterMs: number | null): number {
  if (retryAfterMs === null) return Math.min(60, 5 * 2 ** attempts) * 60_000
  return Math.min(60 * 60_000, Math.max(60_000, retryAfterMs))
}
