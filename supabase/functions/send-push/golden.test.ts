// @vitest-environment jsdom
// jsdom y no node: setupFiles (src/test/setup.ts) toca `window` y falla en entorno node.
// Aquí no hay criptografía ni DOM, pero el motivo es el mismo que en webpush.test.ts.
//
// El cerrojo de la regla de oro del rework de push: nada de lo que viaja al
// servicio push cambia. Cifrado, cabeceras de la petición, `sub` del JWT VAPID,
// tope de tamaño y forma del payload híbrido son lo que hoy entrega en iPhone, y
// desde aquí no hay forma de probar iOS. Hasta ahora la regla la sostenía la
// disciplina de quien tocaba index.ts; esta prueba la sostiene con copias
// literales de cada pieza, tomadas de `git show 4eae308:supabase/functions/send-push/index.ts`
// (el último commit anterior al rework de la cola), y con el hash de
// `_shared/webpush.ts` tal como estaba en ese mismo commit.
//
// index.ts no se puede importar (es un punto de entrada de Deno: llama a Deno.env
// y Deno.serve al cargar), así que se lee como texto. Antes de comparar se
// normaliza, para que reordenar el archivo no sea un cambio: CRLF contra LF, la
// sangría de cada línea (el rework mudó estos bloques de dentro de un bucle a
// una función, y con ello cambió toda la sangría) y los comentarios de línea
// completa o de bloque, que no viajan. Un comentario al final de una línea de
// código sí cuenta como código.
//
// Si esta prueba falla es que cambió algo que viaja. No se arregla ajustando el
// test: se prueba en un iPhone y, solo si el cambio es a propósito, se actualiza
// la copia en el mismo commit. Para el hash, el mensaje de vitest enseña el
// valor nuevo. Detrás hay una segunda describe que comprueba que el cerrojo
// salta de verdad (cambia un carácter en memoria), para que no se oxide en silencio.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Por ruta y no con `new URL(...)`: en jsdom, URL es la de jsdom y fs no la acepta.
const here = dirname(fileURLToPath(import.meta.url))
const INDEX_PATH = join(here, 'index.ts')
const WEBPUSH_PATH = join(here, '..', '_shared', 'webpush.ts')

const AVISO =
  'esto viaja al servicio push y hoy funciona en iPhone; no se cambia sin probar en un iPhone, y si se cambia a propósito, se actualiza esta copia en el mismo commit'
const porque = (pieza: string) => `${pieza}: ${AVISO}`

// Las copias se guardan con su sangría para que se lea la estructura; `golden`
// la quita igual que la normalización del código fuente.
const golden = (...lineas: string[]) => lineas.map((l) => l.trim()).join('\n')

// --- Copias literales de 4eae308:supabase/functions/send-push/index.ts ---

const GOLDEN_SEND_WEB_PUSH = golden(
  'async function sendWebPushNotification(',
  '  subscription: { endpoint: string; p256dh: string; auth: string },',
  '  bodyBytes: Uint8Array,',
  '  authorization: string,',
  '): Promise<{ status: number; apnsId: string | null; retryAfter: string | null; errorText: string }> {',
  '  const response = await fetch(subscription.endpoint, {',
  "    method: 'POST',",
  '    headers: {',
  '      Authorization: authorization,',
  "      'Content-Encoding': 'aes128gcm',",
  "      'Content-Type': 'application/octet-stream',",
  "      'Content-Length': String(bodyBytes.byteLength),",
  "      TTL: '86400',",
  "      Urgency: 'high',",
  '    },',
  '    body: bodyBytes,',
  '    signal: AbortSignal.timeout(10_000),',
  '  })',
  "  const responseBody = await response.text().catch(() => '')",
  "  const apnsId = response.headers.get('apns-id') || response.headers.get('x-apns-id') || null",
  '  return {',
  '    status: response.status,',
  '    apnsId,',
  "    retryAfter: response.headers.get('retry-after'),",
  "    errorText: response.ok ? '' : responseBody || response.statusText,",
  '  }',
  '}',
)

const GOLDEN_NAVIGATE_URL = golden(
  'let navigateUrl = `${appOrigin}/`',
  'try {',
  "  const resolved = new URL(delivery.notification.url || '/', appOrigin)",
  '  if (resolved.origin === appOrigin) {',
  '    if (delivery.notification.id) {',
  "      resolved.searchParams.set('notification', delivery.notification.id)",
  '    }',
  '    navigateUrl = resolved.href',
  '  }',
  '} catch {',
  '  navigateUrl = `${appOrigin}/`',
  '}',
)

// El objeto que recibe JSON.stringify: del `web_push: 8030,` a la última clave.
// Es el bloque Declarative Web Push más los campos planos que lee push-sw.js.
const GOLDEN_HIBRIDO = golden(
  'web_push: 8030,',
  'notification: {',
  "  title: delivery.notification.title || 'UDP Map',",
  "  body: delivery.notification.body || 'Tienes una nueva notificación.',",
  '  navigate: navigateUrl,',
  '  icon: `${appOrigin}/pwa-192x192.png`,',
  "  lang: 'es',",
  '  tag: delivery.notification.id,',
  '  data: {',
  "    url: delivery.notification.url || '/',",
  '    notificationId: delivery.notification.id,',
  '    type: delivery.notification.type,',
  '    category: delivery.notification.category,',
  '    payload: delivery.notification.payload,',
  '  },',
  '},',
  'notificationId: delivery.notification.id,',
  'title: delivery.notification.title,',
  'body: delivery.notification.body,',
  'url: delivery.notification.url,',
  'type: delivery.notification.type,',
  'category: delivery.notification.category,',
  'payload: delivery.notification.payload,',
)

// El `sub` del JWT VAPID: un mailto: o, si el secreto no lo es, este respaldo.
const GOLDEN_VAPID_SUBJECT = golden(
  "const FALLBACK_VAPID_SUBJECT = 'mailto:soporte@udp.cl'",
  "const rawVapidSubject = Deno.env.get('VAPID_SUBJECT')",
  "const vapidSubject = rawVapidSubject?.startsWith('mailto:') ? rawVapidSubject : FALLBACK_VAPID_SUBJECT",
)

// Dos líneas sueltas: lo que hay dentro del `if` del tope (cómo se cierra la
// entrega que no cabe) no viaja y cambió con el rework de la cola.
const GOLDEN_TOPE = 'if (payloadByteLength(payload) > MAX_PLAINTEXT_BYTES) {'
const GOLDEN_CIFRADO =
  'bodyBytes = await encryptPayloadAes128Gcm(payload, delivery.subscription.p256dh, delivery.subscription.auth)'

// sha256 de _shared/webpush.ts normalizado, tal como estaba en 4eae308.
const GOLDEN_WEBPUSH_SHA256 = '2e41256e5da6fb769b3e8acc787da1937f16220cdc58f973ce6bf5c6d5f9e64d'

// --- Lectura y normalización del código fuente ---

interface Linea {
  sangria: number
  texto: string
}

function lineasSignificativas(fuente: string): Linea[] {
  return fuente
    .replace(/\r\n?/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((cruda) => ({ sangria: cruda.length - cruda.trimStart().length, texto: cruda.trim() }))
    .filter((l) => l.texto !== '' && !l.texto.startsWith('//'))
}

interface Piezas {
  sendWebPush: string | null
  navigateUrl: string | null
  hibrido: string | null
  aperturaHibrido: string | null
  vapidSubject: string | null
  lineasTope: number
  lineasCifrado: number
  hashWebpush: string
}

// Cada pieza es null si no se encuentran sus marcas: así la prueba falla con el
// mensaje de la regla y no con un TypeError dentro de este lector.
function leerPiezas(indexSrc: string, webpushSrc: string): Piezas {
  const ls = lineasSignificativas(indexSrc)
  const buscar = (pred: (l: Linea) => boolean, despuesDe = -1) =>
    ls.findIndex((l, i) => i > despuesDe && pred(l))
  const tramo = (desde: number, hasta: number, incluye = 0) =>
    desde < 0 || hasta < 0
      ? null
      : ls
          .slice(desde, hasta + incluye)
          .map((l) => l.texto)
          .join('\n')

  // La función termina en la primera `}` con la misma sangría que su primera línea.
  const fnIni = buscar((l) => l.texto.startsWith('async function sendWebPushNotification('))
  const fnFin = fnIni < 0 ? -1 : buscar((l) => l.texto === '}' && l.sangria === ls[fnIni].sangria, fnIni)

  // Llega hasta la `}` que cierra el catch, dos líneas después de su asignación.
  const navIni = buscar((l) => l.texto === 'let navigateUrl = `${appOrigin}/`')
  const navFin = navIni < 0 ? -1 : buscar((l) => l.texto === 'navigateUrl = `${appOrigin}/`', navIni)

  // El objeto acaba en el primer `})`: una clave añadida al final también se nota.
  const hibIni = buscar((l) => l.texto === 'web_push: 8030,')
  const hibFin = hibIni < 0 ? -1 : buscar((l) => l.texto === '})', hibIni)

  const vapIni = buscar((l) => l.texto.startsWith('const FALLBACK_VAPID_SUBJECT'))
  const vapFin = vapIni < 0 ? -1 : buscar((l) => l.texto.startsWith('const vapidSubject ='), vapIni)

  return {
    sendWebPush: tramo(fnIni, fnFin, 1),
    navigateUrl: tramo(navIni, navFin, 2),
    hibrido: tramo(hibIni, hibFin),
    aperturaHibrido: hibIni > 0 ? ls[hibIni - 1].texto : null,
    vapidSubject: tramo(vapIni, vapFin, 1),
    lineasTope: ls.filter((l) => l.texto === GOLDEN_TOPE).length,
    lineasCifrado: ls.filter((l) => l.texto === GOLDEN_CIFRADO).length,
    hashWebpush: createHash('sha256')
      .update(
        lineasSignificativas(webpushSrc)
          .map((l) => l.texto)
          .join('\n'),
      )
      .digest('hex'),
  }
}

const indexSrc = readFileSync(INDEX_PATH, 'utf8')
const webpushSrc = readFileSync(WEBPUSH_PATH, 'utf8')

describe('regla de oro: lo que viaja al servicio push no cambia', () => {
  const real = leerPiezas(indexSrc, webpushSrc)

  it('sendWebPushNotification: método, cabeceras y sus valores, cuerpo y signal', () => {
    expect(real.sendWebPush, porque('sendWebPushNotification')).toBe(GOLDEN_SEND_WEB_PUSH)
  })

  it('navigateUrl: de dónde sale el enlace que abre la notificación', () => {
    expect(real.navigateUrl, porque('cálculo de navigateUrl')).toBe(GOLDEN_NAVIGATE_URL)
  })

  it('payload híbrido: cada clave, su valor y su orden', () => {
    expect(real.hibrido, porque('objeto del payload híbrido')).toBe(GOLDEN_HIBRIDO)
    expect(real.aperturaHibrido, porque('el objeto híbrido es el argumento de JSON.stringify')).toMatch(
      /JSON\.stringify\(\{$/,
    )
  })

  it('VAPID_SUBJECT: el `sub` del JWT y su respaldo', () => {
    expect(real.vapidSubject, porque('bloque de VAPID_SUBJECT')).toBe(GOLDEN_VAPID_SUBJECT)
  })

  it('el tope de tamaño y la llamada que cifra siguen donde estaban', () => {
    expect(real.lineasTope, porque('comprobación del tope de tamaño del payload')).toBe(1)
    expect(real.lineasCifrado, porque('llamada a encryptPayloadAes128Gcm')).toBe(1)
  })

  it('_shared/webpush.ts (cifrado, VAPID, tope) es el mismo que en 4eae308', () => {
    expect(real.hashWebpush, porque('_shared/webpush.ts')).toBe(GOLDEN_WEBPUSH_SHA256)
  })
})

// Que la prueba de arriba pase no demuestra que sepa fallar: si el lector se
// rompiera y devolviera siempre lo mismo, el cerrojo quedaría puesto y abierto.
// Estas pruebas cambian el código fuente en memoria (index.ts del disco no se
// toca) y comprueban que cada pieza lo nota. Parten de las propias copias de
// arriba y no de un texto concreto, para no volverse un segundo aviso cuando
// alguien actualiza una copia a propósito.
describe('el cerrojo salta de verdad', () => {
  const base = leerPiezas(indexSrc, webpushSrc)

  it('no se fija en saltos de línea, en la sangría ni en los comentarios', () => {
    const reformateado = indexSrc
      .replace(/\r\n/g, '\n')
      .replace(/^/gm, '    // un comentario\n    ')
      .replace(/\n/g, '\r\n')
    expect(reformateado).not.toBe(indexSrc)
    expect(leerPiezas(reformateado, webpushSrc)).toEqual(base)

    // Los comentarios de bloque se prueban aparte: meterlos línea a línea
    // rompería los que ya hay en el archivo.
    const conBloques = `/** uno */\n${indexSrc}\n/* dos\n   tres */`
    expect(leerPiezas(conBloques, `${webpushSrc}\n/**\n * otro\n */\n// y otro\n`)).toEqual(base)
  })

  // Un carácter de más al final de una línea de la copia. En las copias de
  // varias líneas se toca la tercera, para no tocar la que abre ni la que cierra.
  // Si esa línea aparece en otro sitio de index.ts también se toca, y da igual:
  // lo que se exige es que la pieza cambie.
  const terceraLinea = (copia: string) => copia.split('\n')[2]
  const piezas: Array<[string, keyof Piezas, string]> = [
    ['sendWebPushNotification', 'sendWebPush', terceraLinea(GOLDEN_SEND_WEB_PUSH)],
    ['navigateUrl', 'navigateUrl', terceraLinea(GOLDEN_NAVIGATE_URL)],
    ['el payload híbrido', 'hibrido', terceraLinea(GOLDEN_HIBRIDO)],
    ['el bloque de VAPID_SUBJECT', 'vapidSubject', terceraLinea(GOLDEN_VAPID_SUBJECT)],
    ['el tope de tamaño', 'lineasTope', GOLDEN_TOPE],
    ['la llamada que cifra', 'lineasCifrado', GOLDEN_CIFRADO],
  ]

  it.each(piezas)('un carácter de más en %s se nota', (_nombre, clave, linea) => {
    // Con LF por delante: con CRLF el `!` caería detrás del `\r` y se perdería.
    const limpio = indexSrc.replace(/\r\n?/g, '\n')
    const tocado = limpio
      .split('\n')
      .map((l) => (l.trim() === linea ? `${l}!` : l))
      .join('\n')
    expect(tocado, `la línea «${linea}» ya no está en index.ts`).not.toBe(limpio)
    expect(leerPiezas(tocado, webpushSrc)[clave]).not.toEqual(base[clave])
  })

  it('un cambio en _shared/webpush.ts cambia el hash', () => {
    const tocado = `${webpushSrc}\nconst x = 1\n`
    expect(leerPiezas(indexSrc, tocado).hashWebpush).not.toBe(base.hashWebpush)
  })
})
