/**
 * Sven — Progressive Web App Service Worker
 *
 * Caching strategy:
 *   • App shell (/, /flutter_bootstrap.js, /manifest.json, icons)
 *     → Cache-first, background revalidate (stale-while-revalidate)
 *   • API calls (/v1/*, Firebase, sentry, analytics)
 *     → Network-only — never cache user data or AI responses
 *   • Flutter build artefacts (*.js, *.wasm, *.br, canvaskit)
 *     → Cache-first (content-hashed filenames are immutable)
 *   • Navigation requests (HTML pages)
 *     → Network-first, fallback to cached shell for offline mode
 */

const CACHE_NAME = 'sven-shell-v1';

/** Resources to pre-cache on install. */
const SHELL_URLS = [
  '/',
  '/flutter_bootstrap.js',
  '/manifest.json',
  '/icons/Icon-192.png',
  '/icons/Icon-512.png',
];

/** URL patterns that must NEVER be served from cache. */
const NETWORK_ONLY_PATTERNS = [
  /\/v1\//,               // Sven API
  /sven\.glyph\./,        // production gateway
  /dev\.sven\./           // dev gateway
];

// ── Lifecycle events ───────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch((err) => console.warn('[SW] Pre-cache failed (non-fatal):', err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => {
              console.log('[SW] Removing stale cache:', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch handling ─────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const method = event.request.method;

  // 1. Non-GET requests: pass through (POST/PUT/DELETE for API calls)
  if (method !== 'GET') return;

  // 2. Network-only patterns (API, gateways)
  if (NETWORK_ONLY_PATTERNS.some((re) => re.test(url))) return;

  // 3. Flutter build artefacts with content-hash in URL → cache-immutable
  if (/\.(js|wasm|br)(\?|$)/.test(url) || url.includes('canvaskit')) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // 4. Image / font assets → stale-while-revalidate
  if (/\.(png|jpg|jpeg|gif|webp|ico|svg|woff2?|ttf)(\?|$)/.test(url)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  // 5. HTML navigation → network-first, fallback to cached shell
  if (event.request.mode === 'navigate') {
    event.respondWith(networkFirstWithShellFallback(event.request));
    return;
  }

  // 6. Anything else (e.g., flutter_bootstrap.js, manifest) → stale-while-revalidate
  event.respondWith(staleWhileRevalidate(event.request));
});

// ── Strategy helpers ───────────────────────────────────────────────────────

/**
 * Cache-first: fast for immutable artefacts.
 * Falls back to network if not cached; stores the response for later.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

/**
 * Stale-while-revalidate: return cached copy instantly while fetching
 * a fresh copy in the background to update the cache.
 */
function staleWhileRevalidate(request) {
  return caches.open(CACHE_NAME).then((cache) => {
    return cache.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      });
      return cachedResponse || fetchPromise;
    });
  });
}

/**
 * Network-first: try the network; if it fails return the cached shell
 * (index.html) so the app can launch offline.
 */
async function networkFirstWithShellFallback(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
      return response;
    }
    throw new Error('Network response not ok');
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Last resort: serve the app shell so Flutter can handle routing
    const shell = await caches.match('/');
    return shell || new Response('Sven is offline. Please check your connection.', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// ── Push Notifications ─────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { title: 'Sven', body: event.data.text() };
  }

  const title = payload.title || 'Sven';
  const options = {
    body: payload.body || '',
    icon: '/icons/Icon-192.png',
    badge: '/icons/Icon-192.png',
    data: payload.data || {},
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open Sven' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return self.clients.openWindow('/');
      })
  );
});
