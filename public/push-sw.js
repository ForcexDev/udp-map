/* global self, URL */

// Debe coincidir con VITE_VAPID_PUBLIC_KEY (clave pública, no es secreta).
// Si se rota el par VAPID, actualizar acá también.
const VAPID_PUBLIC_KEY = 'BMsTXlUoAaxx9brDhqgGzaboSa-kzRSaUYHpXZAenxCWA6-rwTNes_iRUtr7wQtZsC_AIuMUSvXrYsNOFFjQuZQ'

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
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }).catch((err) => console.error('[push-sw] No se pudo re-suscribir tras pushsubscriptionchange:', err))
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'UDP Map', body: event.data?.text() || 'Tienes una nueva notificación.' }
  }

  const title = data.title || 'UDP Map'
  const options = {
    body: data.body || 'Tienes una nueva notificación.',
    icon: '/pwa-192x192.png',
    // El badge NO es un icono a color: Android lo usa como máscara de alfa y
    // pinta de blanco todo pixel opaco. Aquí estaba `pwa-64x64.png`, que es un
    // cuadrado rojo enteramente opaco, así que en la barra de estado salía una
    // mancha blanca sólida — el "logo en blanco" que se reportaba.
    // `notification-badge.png` es la silueta del pin sobre transparente.
    badge: '/notification-badge.png',
    tag: data.notificationId || `${data.type || 'notification'}:${Date.now()}`,
    renotify: false,
    timestamp: Date.now(),
    lang: 'es',
    data: {
      url: data.url || '/',
      notificationId: data.notificationId || null,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // El destino se resuelve SIEMPRE contra nuestro origen. Si el payload trae
  // una URL absoluta a otro sitio, `new URL(url, origin)` la respetaría y el
  // toque en la notificación abriría una web ajena.
  const requested = event.notification.data?.url || '/'
  const parsed = new URL(requested, self.location.origin)
  const target = new URL(
    parsed.origin === self.location.origin ? parsed.href : '/',
    self.location.origin,
  )
  const notificationId = event.notification.data?.notificationId
  if (notificationId) target.searchParams.set('notification', notificationId)

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existingWindow = windows.find((client) => new URL(client.url).origin === self.location.origin)

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
  })())
})
