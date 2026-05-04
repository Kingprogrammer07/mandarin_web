// Minimal service worker — satisfies PWA install criteria without
// interfering with the app's own data fetching strategy.
const CACHE_NAME = 'mandarin-cargo-shell-v1';

self.addEventListener('install', () => {
  // Take control immediately without waiting for old tab to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Remove outdated cache versions so users always get fresh assets
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Network-first: always try the network; only fall back to cache for
// navigation requests (so the shell loads offline after first visit).
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Only cache same-origin navigations (the app shell), not API calls
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (event.request.mode === 'navigate') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// ─── Push notifications ─────────────────────────────────────────────────────
// Handles push messages from the backend (requires server-side Web Push).
// Falls back to a generic alert if payload shape is unexpected.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Mandarin Cargo', body: event.data.text() };
  }

  const title = payload.title || 'Mandarin Cargo';
  const options = {
    body: payload.body || 'Yangi navbat',
    icon: payload.icon || '/mandarin_cargo_logo.png',
    badge: payload.badge || '/mandarin_cargo_logo.png',
    tag: payload.tag || 'pickup-queue',
    requireInteraction: payload.requireInteraction ?? false,
    vibrate: payload.vibrate || [200, 100, 200],
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
