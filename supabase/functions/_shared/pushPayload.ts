// Forma del payload que viaja al servicio push, además de la híbrida. Sin APIs de
// Deno ni imports por URL, como webpush.ts, para probarla con vitest
// (pushPayload.test.ts) y usarla desde la Edge Function sin cambios.
//
// El payload HÍBRIDO (bloque declarativo + campos planos) sigue construyéndose
// en send-push/index.ts, literal: es lo que hoy entrega en iPhone y no se mueve
// de sitio para que nadie lo toque al pasar. Aquí vive solo lo nuevo: el payload
// declarativo puro y la lectura del secreto que elige entre los dos.

/**
 * 'hybrid' es lo que se envía hoy. 'declarative' es el experimento de Push 6:
 * solo el bloque Declarative Web Push (`web_push: 8030`), sin campos planos, para
 * comprobar en un iPhone si se entrega igual sin ellos. No es el defecto porque
 * la forma que hoy entrega es la híbrida, y cambiarla sin probar allí es cambiar
 * lo que viaja.
 */
export type PayloadFormat = 'hybrid' | 'declarative'

/**
 * Lee PUSH_PAYLOAD_FORMAT. Ausente o vacío es 'hybrid' sin ruido; cualquier otro
 * valor que no sea uno de los dos también es 'hybrid', pero con `warning`: un
 * secreto mal escrito no puede cambiar lo que viaja a los teléfonos, y tampoco
 * puede pasar callado, porque quien lo puso creerá que está probando
 * 'declarative'. Se compara sin mayúsculas ni espacios sobrantes, que es lo que
 * más se cuela al pegar un secreto.
 */
export function parsePayloadFormat(raw: string | null | undefined): {
  format: PayloadFormat
  warning: string | null
} {
  const value = (raw ?? '').trim().toLowerCase()
  if (value === '' || value === 'hybrid') return { format: 'hybrid', warning: null }
  if (value === 'declarative') return { format: 'declarative', warning: null }
  return {
    format: 'hybrid',
    warning:
      `PUSH_PAYLOAD_FORMAT="${(raw ?? '').slice(0, 40)}" no es 'hybrid' ni 'declarative'; ` +
      `se envía el payload híbrido.`,
  }
}

/** Lo que el payload necesita del aviso: la fila de `notifications` sin el `payload` jsonb. */
export interface PayloadNotification {
  id: string
  title: string
  body: string
  url: string
  type: string
  category: string
}

/**
 * El bloque `notification` del payload declarativo. Mismas claves, mismo orden,
 * mismos valores y mismos respaldos que el bloque `notification` del híbrido de
 * send-push/index.ts; la diferencia es que `data` no lleva `payload`: el
 * navegador no lo usa y en un payload sin campos planos cada byte cuenta contra
 * el tope de 4 KB.
 */
export interface DeclarativePayload {
  web_push: 8030
  notification: {
    title: string
    body: string
    navigate: string
    icon: string
    lang: 'es'
    tag: string
    data: {
      url: string
      notificationId: string
      type: string
      category: string
    }
  }
}

/**
 * Construye el payload declarativo puro: SOLO `web_push` y `notification`. Sin
 * `title`/`body`/`url` planos ni `payload` en la raíz, que es lo que leía el
 * push-sw.js anterior; el actual lee primero este bloque y cae a los planos solo
 * si faltan, así que pinta lo mismo con cualquiera de los dos formatos.
 * `navigateUrl` ya viene resuelta por quien llama (contra `appOrigin`, con
 * `${appOrigin}/` si apunta a otro origen), igual que en el híbrido.
 */
export function buildDeclarativePayload(
  notification: PayloadNotification,
  navigateUrl: string,
  appOrigin: string,
): DeclarativePayload {
  return {
    web_push: 8030,
    notification: {
      title: notification.title || 'UDP Map',
      body: notification.body || 'Tienes una nueva notificación.',
      navigate: navigateUrl,
      icon: `${appOrigin}/pwa-192x192.png`,
      lang: 'es',
      tag: notification.id,
      data: {
        url: notification.url || '/',
        notificationId: notification.id,
        type: notification.type,
        category: notification.category,
      },
    },
  }
}
