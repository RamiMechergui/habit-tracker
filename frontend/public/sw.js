/**
 * Service Worker for Evolvia — sw.js
 *
 * Placed in /public so Vite serves it at the root.
 * Strategy:
 *   • App shell + static assets → Cache-first
 *   • API calls → Network-first, fall back to cache
 *   • Background sync → replay offline mutations
 */

const CACHE_NAME = 'evolvia-v1';

// App-shell assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/logo.png',
  '/logo_circle.png'
];

// ─── Install ────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing…');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch ──────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET for caching (mutations are handled by the app + sync queue)
  if (request.method !== 'GET') return;

  // API requests → Network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets → Cache-first
  event.respondWith(cacheFirst(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // If offline and not cached, return a basic offline response
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    // Cache successful GET API responses for offline fallback
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Network failed — try the cache
    const cached = await caches.match(request);
    if (cached) return cached;

    // Nothing cached either — return an error JSON so the app can handle it
    return new Response(
      JSON.stringify({ offline: true, message: 'You are offline' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// ─── Background Sync ────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'evolvia-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const clients = await self.clients.matchAll({ type: 'window' });
  for (const client of clients) {
    client.postMessage({ type: 'SYNC_REPLAY' });
  }
}

// ─── Push notification placeholder (for future use) ─────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Evolvia', body: 'Time to log your habits!' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo_circle.png',
      badge: '/logo_circle.png'
    })
  );
});
