// Minimal service worker — satisfies PWA install criteria and acts as a
// cache to dramatically reduce repeated edge fetches for the app shell and
// hashed asset chunks. Cache-first for static assets; stale-while-revalidate
// for navigations so users still receive shell updates without forcing a
// duplicate network fetch on every page load.
const CACHE_NAME = 'mandarin-cargo-shell-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

const STATIC_ASSET_PATTERN = /\.(?:js|css|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|webp|ico|mp3|wav|ogg|json)$/i;

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never touch cross-origin or API traffic — the app handles those itself.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // ── App-shell navigations ────────────────────────────────────────────────
  // Stale-while-revalidate: respond from cache instantly, refresh in the
  // background so the next navigation sees the new HTML.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // ── Hashed static assets ─────────────────────────────────────────────────
  // Cache-first: Vite emits content-hashed filenames, so a cache hit is
  // always safe. Only fall back to the network on a miss.
  if (STATIC_ASSET_PATTERN.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const response = await fetch(event.request);
          if (response.ok) {
            cache.put(event.request, response.clone()).catch(() => {});
          }
          return response;
        } catch (err) {
          const fallback = await cache.match(event.request);
          if (fallback) return fallback;
          throw err;
        }
      })
    );
  }
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
