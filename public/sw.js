/*
 * Service worker — push only.
 *
 * There is deliberately NO fetch handler here. A service worker that caches
 * assets is how a web app starts serving yesterday's JavaScript: people see an
 * old build, hard refreshes don't help, and it is miserable to debug. This one
 * exists solely so the browser can wake it to show a notification, so it never
 * sits between the app and the network.
 *
 * Keep it that way. If offline support is ever wanted, it belongs in a separate,
 * carefully versioned worker with a considered cache strategy — not bolted on
 * here.
 */

// Take over from any previous worker immediately rather than waiting for every
// tab to close, so a fix ships on the next visit.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'My Lighthouse', body: event.data.text() }
  }

  const title = payload.title || 'My Lighthouse'
  const options = {
    body: payload.body || '',
    icon: '/logo-square.png',
    badge: '/logo-square.png',
    // Same tag replaces an earlier notification rather than stacking five of
    // them, which is what makes a busy comment thread bearable.
    tag: payload.tag || 'lighthouse',
    renotify: Boolean(payload.renotify),
    data: { href: payload.href || '/dashboard' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href = (event.notification.data && event.notification.data.href) || '/dashboard'

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Reuse a window that is already open — opening a second copy of an
      // installed app is jarring.
      for (const client of all) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            try {
              await client.navigate(href)
            } catch {
              // Cross-origin or a client that refuses; focusing is enough.
            }
          }
          return
        }
      }
      await self.clients.openWindow(href)
    })(),
  )
})
