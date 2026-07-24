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
    badge: '/pwa-64x64.png',
    tag: data.notificationId || `${data.type || 'notification'}:${Date.now()}`,
    renotify: false,
    data: {
      url: data.url || '/',
      notificationId: data.notificationId || null,
    },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = new URL(event.notification.data?.url || '/', self.location.origin)
  const notificationId = event.notification.data?.notificationId
  if (notificationId) target.searchParams.set('notification', notificationId)

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existingWindow = windows.find((client) => new URL(client.url).origin === target.origin)

    if (existingWindow) {
      await existingWindow.navigate(target.href)
      return existingWindow.focus()
    }
    return self.clients.openWindow(target.href)
  })())
})
