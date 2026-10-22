// @vitest-environment jsdom
// jsdom y no node: setupFiles (src/test/setup.ts) toca `window` y falla en entorno node.
// Aquí no hay criptografía, pero el motivo es el mismo que en webpush.test.ts.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type PayloadNotification, buildDeclarativePayload, parsePayloadFormat } from './pushPayload'

const ORIGIN = 'https://udp-map.vercel.app'
const ID = '5b0e0c3e-0d61-4c0b-9a58-7a3a8f0a1111'
const NAVIGATE = `${ORIGIN}/mapa?notification=${ID}`

const notification: PayloadNotification = {
  id: ID,
  title: 'Evento en 1 hora',
  body: 'Charla de bienvenida en el Aula Magna',
  url: '/mapa',
  type: 'event_reminder',
  category: 'events',
}

describe('parsePayloadFormat', () => {
  it('sin secreto, o vacío, es híbrido y sin aviso', () => {
    for (const raw of [undefined, null, '', '   ']) {
      expect(parsePayloadFormat(raw)).toEqual({ format: 'hybrid', warning: null })
    }
  })

  it('reconoce los dos valores, sin importar mayúsculas ni espacios sobrantes', () => {
    expect(parsePayloadFormat('hybrid')).toEqual({ format: 'hybrid', warning: null })
    expect(parsePayloadFormat('declarative')).toEqual({ format: 'declarative', warning: null })
    expect(parsePayloadFormat(' Declarative\n')).toEqual({ format: 'declarative', warning: null })
  })

  it('un valor desconocido cae a híbrido y lo dice, con el valor a la vista', () => {
    const { format, warning } = parsePayloadFormat('declarativo')
    expect(format).toBe('hybrid')
    expect(warning).toContain('PUSH_PAYLOAD_FORMAT="declarativo"')
    expect(warning).toContain('híbrido')
  })

  it('no vuelca un secreto desmesurado entero en el log', () => {
    const { warning } = parsePayloadFormat('x'.repeat(500))
    expect(warning).not.toBeNull()
    expect(warning!.length).toBeLessThan(200)
  })
})

describe('buildDeclarativePayload', () => {
  it('tiene exactamente la forma y el orden del bloque declarativo', () => {
    expect(JSON.stringify(buildDeclarativePayload(notification, NAVIGATE, ORIGIN))).toBe(
      JSON.stringify({
        web_push: 8030,
        notification: {
          title: 'Evento en 1 hora',
          body: 'Charla de bienvenida en el Aula Magna',
          navigate: NAVIGATE,
          icon: `${ORIGIN}/pwa-192x192.png`,
          lang: 'es',
          tag: ID,
          data: {
            url: '/mapa',
            notificationId: ID,
            type: 'event_reminder',
            category: 'events',
          },
        },
      }),
    )
  })

  it('no lleva campos planos ni `payload`: solo web_push y notification', () => {
    const built = buildDeclarativePayload(
      // `payload` sobra a propósito: la fila reclamada lo trae y no debe colarse.
      { ...notification, payload: { secreto: 'no debe viajar' } } as PayloadNotification,
      NAVIGATE,
      ORIGIN,
    )
    expect(Object.keys(built)).toEqual(['web_push', 'notification'])
    expect(Object.keys(built.notification.data)).toEqual(['url', 'notificationId', 'type', 'category'])
    expect(JSON.stringify(built)).not.toContain('secreto')
  })

  it('usa los mismos respaldos que el híbrido con título, cuerpo y url vacíos', () => {
    const { notification: block } = buildDeclarativePayload(
      { ...notification, title: '', body: '', url: '' },
      `${ORIGIN}/`,
      ORIGIN,
    )
    expect(block.title).toBe('UDP Map')
    expect(block.body).toBe('Tienes una nueva notificación.')
    expect(block.data.url).toBe('/')
    expect(block.navigate).toBe(`${ORIGIN}/`)
  })

  it('el icono sale del origen de la app que se le pasa', () => {
    const { notification: block } = buildDeclarativePayload(notification, NAVIGATE, 'http://localhost:5173')
    expect(block.icon).toBe('http://localhost:5173/pwa-192x192.png')
  })

  it('pesa menos que el híbrido para el mismo aviso', () => {
    const declarative = JSON.stringify(buildDeclarativePayload(notification, NAVIGATE, ORIGIN))
    const hybrid = JSON.stringify(hybridPayload(notification, NAVIGATE, ORIGIN, { eventId: 'abc' }))
    expect(declarative.length).toBeLessThan(hybrid.length)
  })
})

// El bloque `notification` del híbrido, copiado de send-push/index.ts. El híbrido
// no puede vivir en _shared (no se mueve de sitio sin probar en un iPhone), así
// que la prueba lo reescribe, y la última prueba de abajo comprueba contra el
// código fuente que la copia no se ha desviado. Que lo que viaja siga igual que
// en 4eae308 NO lo vigila esta prueba sino send-push/golden.test.ts, con una
// copia literal de todo el objeto; la de abajo solo ata esta reescritura a ese
// código, y si el híbrido cambia a propósito hay que actualizar las dos.
function hybridPayload(
  n: PayloadNotification,
  navigateUrl: string,
  appOrigin: string,
  payload: Record<string, unknown>,
) {
  return {
    web_push: 8030,
    notification: {
      title: n.title || 'UDP Map',
      body: n.body || 'Tienes una nueva notificación.',
      navigate: navigateUrl,
      icon: `${appOrigin}/pwa-192x192.png`,
      lang: 'es',
      tag: n.id,
      data: {
        url: n.url || '/',
        notificationId: n.id,
        type: n.type,
        category: n.category,
        payload,
      },
    },
    notificationId: n.id,
    title: n.title,
    body: n.body,
    url: n.url,
    type: n.type,
    category: n.category,
    payload,
  }
}

describe('coincidencia con el bloque notification del híbrido', () => {
  const cases: Array<[string, PayloadNotification]> = [
    ['un aviso completo', notification],
    ['un aviso sin título, cuerpo ni url', { ...notification, title: '', body: '', url: '' }],
  ]

  it.each(cases)('%s: mismos valores, salvo `payload` dentro de data', (_name, n) => {
    const declarative = buildDeclarativePayload(n, NAVIGATE, ORIGIN)
    const { payload: _payload, ...dataWithoutPayload } = hybridPayload(n, NAVIGATE, ORIGIN, { a: 1 }).notification.data

    expect(declarative.web_push).toBe(8030)
    expect(declarative.notification).toEqual({
      ...hybridPayload(n, NAVIGATE, ORIGIN, { a: 1 }).notification,
      data: dataWithoutPayload,
    })
  })

  it('la copia de arriba sigue siendo la que hay en send-push/index.ts', () => {
    // Por ruta y no con `new URL(...)`: en jsdom, URL es la de jsdom y fs no la acepta.
    const here = dirname(fileURLToPath(import.meta.url))
    const source = readFileSync(join(here, '..', 'send-push', 'index.ts'), 'utf8')
    for (const line of [
      "title: delivery.notification.title || 'UDP Map',",
      "body: delivery.notification.body || 'Tienes una nueva notificación.',",
      'navigate: navigateUrl,',
      'icon: `${appOrigin}/pwa-192x192.png`,',
      "lang: 'es',",
      'tag: delivery.notification.id,',
      "url: delivery.notification.url || '/',",
      'notificationId: delivery.notification.id,',
      'type: delivery.notification.type,',
      'category: delivery.notification.category,',
    ]) {
      expect(source, `falta en send-push/index.ts: ${line}`).toContain(line)
    }
  })
})
