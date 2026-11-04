/* global self, URL */

// Debe coincidir con VITE_VAPID_PUBLIC_KEY (clave pública, no es secreta).
// Si se rota el par VAPID, actualizar acá también. Ya solo es el RESPALDO de
// `pushsubscriptionchange`: lo normal es leer la clave de la suscripción perdida.
const VAPID_PUBLIC_KEY =
  'BMsTXlUoAaxx9brDhqgGzaboSa-kzRSaUYHpXZAenxCWA6-rwTNes_iRUtr7wQtZsC_AIuMUSvXrYsNOFFjQuZQ'

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

// El navegador puede invalidar/rotar el endpoint sin avisar a la página
// (frecuente en iOS). Sin este listener, la suscripción local queda huérfana
// y el servidor sigue mandando al endpoint muerto hasta que expira solo.
// La sincronización con el backend (RPC autenticada) ocurre la próxima vez
// que la app se abre en primer plano — ver usePushSubscription.ts.
//
// OJO: Safari de iOS NO dispara este evento (MDN lo da como no implementado), así
// que en el iPhone —donde más rota el endpoint— esto no corre jamás. Lo que de
// verdad cubre iOS es que la página compare su endpoint con el último que el
// servidor confirmó (`p_old_endpoint`, en pushStore.ts). Este listener ayuda en
// los navegadores que sí lo disparan.
self.addEventListener('pushsubscriptionchange', (event) => {
  // La clave con la que se firmó la suscripción perdida, antes que la constante:
  // así no hay una copia de la clave pública que se pueda quedar vieja. Sin
  // `oldSubscription` (hay navegadores que no la traen) se cae a la constante.
  const applicationServerKey =
    event.oldSubscription?.options?.applicationServerKey || urlBase64ToUint8Array(VAPID_PUBLIC_KEY)

  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })
      .catch((err) =>
        console.error('[push-sw] No se pudo re-suscribir tras pushsubscriptionchange:', err),
      ),
  )
})

// Lo que se muestra cuando el aviso no se puede leer o no se puede pintar tal
// cual. Mostrar ALGO es obligatorio: Safari revoca el permiso de push a quien
// recibe pushes que no acaban en una notificación visible, y con eso se pierden
// todos los avisos futuros, no solo este.
const FALLBACK_TITLE = 'UDP Map'
const FALLBACK_BODY = 'Tienes una nueva notificación.'
const NOTIFICATION_ICON = '/pwa-192x192.png'
// El badge NO es un icono a color: Android lo usa como máscara de alfa y
// pinta de blanco todo pixel opaco. Aquí estaba `pwa-64x64.png`, que es un
// cuadrado rojo enteramente opaco, así que en la barra de estado salía una
// mancha blanca sólida — el "logo en blanco" que se reportaba.
// `notification-badge.png` es la silueta del pin sobre transparente.
const NOTIFICATION_BADGE = '/notification-badge.png'

async function showPush(event) {
  try {
    const parsed = event.data ? event.data.json() : {}
    const data = parsed && typeof parsed === 'object' ? parsed : {}

    // Dos formas de payload conviven: el bloque declarativo (`notification`,
    // Declarative Web Push) y los campos planos de la raíz. Se lee CAMPO A CAMPO
    // y manda el bloque. Quedarse con `data.notification || data` entero era un
    // error: un bloque al que le falte un solo campo (la `tag`, por ejemplo)
    // dejaría de caer a los planos y el clic abriría `/` sin marcar el aviso.
    const n = data.notification || {}
    const nd = n.data || {}
    const notificationId = nd.notificationId || data.notificationId || null

    await self.registration.showNotification(n.title || data.title || FALLBACK_TITLE, {
      body: n.body || data.body || FALLBACK_BODY,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_BADGE,
      tag: n.tag || notificationId || `${nd.type || data.type || 'notification'}:${Date.now()}`,
      renotify: false,
      timestamp: Date.now(),
      lang: 'es',
      data: {
        url: nd.url || data.url || '/',
        notificationId,
      },
    })
  } catch (err) {
    console.error('[push-sw] No se pudo mostrar el aviso tal cual; se muestra uno mínimo:', err)
    await self.registration.showNotification(FALLBACK_TITLE, {
      body: FALLBACK_BODY,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_BADGE,
      lang: 'es',
      data: { url: '/', notificationId: null },
    })
  }
}

self.addEventListener('push', (event) => {
  event.waitUntil(showPush(event))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // El destino se resuelve SIEMPRE contra nuestro origen. Si el payload trae
  // una URL absoluta a otro sitio, `new URL(url, origin)` la respetaría y el
  // toque en la notificación abriría una web ajena.
  let target = new URL(event.notification.data?.url || '/', self.location.origin)
  if (target.origin !== self.location.origin) target = new URL('/', self.location.origin)
  const notificationId = event.notification.data?.notificationId
  if (notificationId) target.searchParams.set('notification', notificationId)

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existingWindow = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      )

      // Enfocar primero y navegar después. `navigate()` lanza cuando el cliente
      // no lo está controlando —pasa en la PWA instalada de iOS—, y como antes
      // iba delante del `focus()`, esa excepción se llevaba por delante también
      // el enfoque: el toque en la notificación no hacía absolutamente nada.
      if (existingWindow) {
        try {
          await existingWindow.focus()
        } catch (err) {
          console.error('[push-sw] No se pudo enfocar la ventana existente:', err)
        }
        try {
          await existingWindow.navigate(target.href)
          return
        } catch (err) {
          console.error('[push-sw] navigate() no disponible, se abre ventana nueva:', err)
        }
      }
      return self.clients.openWindow(target.href)
    })(),
  )
})
