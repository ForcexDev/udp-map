/* global self, URL */

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
