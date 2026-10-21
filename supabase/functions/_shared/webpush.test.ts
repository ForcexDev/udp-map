// @vitest-environment jsdom
// jsdom y no node: setupFiles (src/test/setup.ts) toca `window` y falla en entorno node.
// Web Crypto es la misma en los dos, así que da igual para estas pruebas.
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAX_ATTEMPTS,
  MAX_PLAINTEXT_BYTES,
  classifyPushResponse,
  createVapidAuthHeader,
  createVapidHeaderCache,
  encryptPayloadAes128Gcm,
  parseRetryAfter,
  payloadByteLength,
  retryDelayMs,
  validateVapidKeys,
  validateVapidSubject,
} from './webpush'

const subtle = globalThis.crypto.subtle
const b64u = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'))
const toB64u = (u8: Uint8Array) => Buffer.from(u8).toString('base64url')

// Vectores del RFC 8291, Apéndice A.
const V = {
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  as_public: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  as_private: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  ua_public: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  final:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

afterEach(() => vi.restoreAllMocks())

async function newVapidPair() {
  const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const pubRaw = new Uint8Array(await subtle.exportKey('raw', kp.publicKey))
  const jwk = await subtle.exportKey('jwk', kp.privateKey)
  return { kp, pub: toB64u(pubRaw), priv: jwk.d as string }
}

describe('encryptPayloadAes128Gcm', () => {
  it('reproduce el mensaje final del RFC 8291 Apéndice A', async () => {
    const pub = b64u(V.as_public)
    const fixedPair = {
      privateKey: await subtle.importKey(
        'jwk',
        { kty: 'EC', crv: 'P-256', x: toB64u(pub.subarray(1, 33)), y: toB64u(pub.subarray(33, 65)), d: V.as_private, ext: true },
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits'],
      ),
      publicKey: await subtle.importKey('raw', pub, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
    }
    const realGen = subtle.generateKey.bind(subtle)
    const realRand = globalThis.crypto.getRandomValues.bind(globalThis.crypto)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(subtle, 'generateKey').mockImplementation(((alg: any, ...rest: any[]) =>
      alg?.name === 'ECDH' ? Promise.resolve(fixedPair) : (realGen as any)(alg, ...rest)) as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((arr: any) => {
      if (arr.length === 16) {
        arr.set(b64u(V.salt))
        return arr
      }
      return realRand(arr)
    }) as any)

    const out = await encryptPayloadAes128Gcm(Buffer.from(b64u(V.plaintext)).toString('utf8'), V.ua_public, V.auth)
    expect(toB64u(out)).toBe(V.final)
  })

  it('ida y vuelta con un descifrador independiente y texto multibyte', async () => {
    const ua = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
    const uaPubRaw = new Uint8Array(await subtle.exportKey('raw', ua.publicKey))
    const auth = globalThis.crypto.getRandomValues(new Uint8Array(16))
    const msg = JSON.stringify({ title: 'Ñandú «prueba» 🚀', body: 'áéíóú' })

    const body = await encryptPayloadAes128Gcm(msg, toB64u(uaPubRaw), toB64u(auth))

    // Lado UA, RFC 8291 §3.3-3.4.
    const salt = body.subarray(0, 16)
    const rs = new DataView(body.buffer, body.byteOffset).getUint32(16)
    const idlen = body[20]
    const asPub = body.subarray(21, 21 + idlen)
    const ct = body.subarray(21 + idlen)
    const asKey = await subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
    const ecdh = new Uint8Array(await subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256))
    const hk = async (ikm: Uint8Array, s: Uint8Array, info: Uint8Array, len: number) =>
      new Uint8Array(
        await subtle.deriveBits(
          { name: 'HKDF', hash: 'SHA-256', salt: s, info },
          await subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']),
          len * 8,
        ),
      )
    const ikm = await hk(ecdh, auth, Buffer.concat([Buffer.from('WebPush: info\0'), uaPubRaw, asPub]), 32)
    const cek = await hk(ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16)
    const nonce = await hk(ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12)
    const pt = new Uint8Array(
      await subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), ct),
    )

    expect(rs).toBe(4096)
    expect(idlen).toBe(65)
    expect(pt[pt.length - 1]).toBe(2)
    expect(Buffer.from(pt.subarray(0, pt.length - 1)).toString('utf8')).toBe(msg)
  })
})

describe('createVapidAuthHeader', () => {
  it('firma ES256 verificable con el formato y los claims de RFC 8292', async () => {
    const { kp, pub, priv } = await newVapidPair()
    const header = await createVapidAuthHeader('https://web.push.apple.com/QOmC9o2abc?x=1', pub, priv, 'mailto:a@b.cl')

    const m = /^vapid t=([^,]+), k=(.+)$/.exec(header)
    expect(m).not.toBeNull()
    const [h, p, s] = m![1].split('.')
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString())
    const sig = Buffer.from(s, 'base64url')
    const ok = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, kp.publicKey, sig, Buffer.from(`${h}.${p}`))
    const now = Math.floor(Date.now() / 1000)

    expect(ok).toBe(true)
    expect(sig.length).toBe(64)
    expect(claims.aud).toBe('https://web.push.apple.com')
    expect(claims.exp).toBeGreaterThan(now)
    expect(claims.exp - now).toBeLessThanOrEqual(86400)
    expect(m![2]).toBe(pub)
    expect(m![2]).not.toContain('=')
  })
})

describe('createVapidHeaderCache', () => {
  it('reutiliza la cabecera por origen hasta las 11 h', async () => {
    const { pub, priv } = await newVapidPair()
    let t = 1_000_000
    const get = createVapidHeaderCache(pub, priv, 'mailto:a@b.cl', () => t)

    const first = await get('https://web.push.apple.com/a')
    t += 10 * 3600_000 + 59 * 60_000
    expect(await get('https://web.push.apple.com/b')).toBe(first)

    // El JWT lleva exp en segundos: hay que dejar pasar un segundo real para que cambie.
    t += 2 * 60_000
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 5000 })
    try {
      const renewed = await get('https://web.push.apple.com/c')
      expect(renewed).not.toBe(first)
    } finally {
      vi.useRealTimers()
    }
  })

  it('usa una cabecera distinta para otro origen', async () => {
    const { pub, priv } = await newVapidPair()
    const get = createVapidHeaderCache(pub, priv, 'mailto:a@b.cl', () => 0)
    const a = await get('https://web.push.apple.com/x')
    const b = await get('https://fcm.googleapis.com/fcm/send/x')
    expect(a).not.toBe(b)
  })
})

describe('classifyPushResponse', () => {
  const now = Date.parse('2026-10-21T12:00:00Z')
  it.each([
    [201, null, { kind: 'sent' }],
    [404, null, { kind: 'expired' }],
    [410, null, { kind: 'expired' }],
    [400, null, { kind: 'failed', reason: 'petición rechazada por el servicio push (400)' }],
    [413, null, { kind: 'failed', reason: 'payload demasiado grande (413)' }],
    [401, null, { kind: 'failed', reason: 'autenticación VAPID rechazada (401)' }],
    [403, null, { kind: 'failed', reason: 'autenticación VAPID rechazada (403)' }],
    [429, '120', { kind: 'retry', retryAfterMs: 120_000 }],
    [503, 'Wed, 21 Oct 2026 12:05:00 GMT', { kind: 'retry', retryAfterMs: 300_000 }],
    [500, null, { kind: 'retry', retryAfterMs: null }],
    [418, null, { kind: 'retry', retryAfterMs: null }],
  ])('estado %i con Retry-After %s', (status, retryAfter, expected) => {
    expect(classifyPushResponse(status, retryAfter, now)).toEqual(expected)
  })
})

describe('parseRetryAfter', () => {
  const now = Date.parse('2026-10-21T12:00:00Z')
  it('entiende segundos, fecha HTTP y descarta lo demás', () => {
    expect(parseRetryAfter('30', now)).toBe(30_000)
    expect(parseRetryAfter('Wed, 21 Oct 2026 12:01:00 GMT', now)).toBe(60_000)
    expect(parseRetryAfter(null, now)).toBeNull()
    expect(parseRetryAfter('pronto', now)).toBeNull()
  })
  it('nunca devuelve negativos', () => {
    expect(parseRetryAfter('Wed, 21 Oct 2026 11:00:00 GMT', now)).toBe(0)
  })
})

describe('retryDelayMs', () => {
  it('sin Retry-After usa el backoff de siempre, con tope de 60 min', () => {
    expect(MAX_ATTEMPTS).toBe(5)
    expect(retryDelayMs(1, null)).toBe(10 * 60_000)
    expect(retryDelayMs(2, null)).toBe(20 * 60_000)
    expect(retryDelayMs(4, null)).toBe(60 * 60_000)
  })
  it('con Retry-After lo acota entre 1 y 60 min', () => {
    expect(retryDelayMs(1, 0)).toBe(60_000)
    expect(retryDelayMs(1, 5 * 60_000)).toBe(5 * 60_000)
    expect(retryDelayMs(1, 24 * 3600_000)).toBe(60 * 60_000)
  })
})

describe('validateVapidKeys', () => {
  it('acepta un par válido y rechaza lo demás sin lanzar', async () => {
    const { pub, priv } = await newVapidPair()
    expect(validateVapidKeys(pub, priv)).toBeNull()
    expect(validateVapidKeys(undefined, priv)).toMatch(/VAPID_PUBLIC_KEY/)
    expect(validateVapidKeys(pub, undefined)).toMatch(/VAPID_PRIVATE_KEY/)
    expect(validateVapidKeys(toB64u(new Uint8Array(33)), priv)).toMatch(/VAPID_PUBLIC_KEY/)
    expect(validateVapidKeys(pub, toB64u(new Uint8Array(16)))).toMatch(/VAPID_PRIVATE_KEY/)
    expect(validateVapidKeys('%%%basura%%%', priv)).not.toBeNull()
    expect(validateVapidKeys(pub, '%%%basura%%%')).not.toBeNull()
  })
})

describe('validateVapidSubject', () => {
  it('admite mailto: y https:', () => {
    expect(validateVapidSubject('mailto:a@b.cl')).toBeNull()
    expect(validateVapidSubject('https://udp-map.vercel.app')).toBeNull()
    expect(validateVapidSubject(undefined)).not.toBeNull()
    expect(validateVapidSubject('http://x.cl')).not.toBeNull()
    expect(validateVapidSubject('soporte@x.cl')).not.toBeNull()
  })
})

describe('tamaño del payload', () => {
  it('MAX_PLAINTEXT_BYTES sale del RFC 8291 §4 y payloadByteLength cuenta bytes UTF-8', () => {
    expect(MAX_PLAINTEXT_BYTES).toBe(4096 - 86 - 1 - 16)
    expect(MAX_PLAINTEXT_BYTES).toBe(3993)
    expect(payloadByteLength('abc')).toBe(3)
    expect(payloadByteLength('ñ')).toBe(2)
    expect(payloadByteLength('🚀')).toBe(4)
  })
})
