/**
 * Service Worker for Evolvia — sw.js
 *
 * Strategies:
 *   • App shell + static assets → Cache-first
 *   • API calls → Network-first, fall back to cache
 *   • Navigation (HTML) → Network-first, fall back to offline.html
 *   • Background sync → replay offline mutations
 */

const CACHE_NAME = 'evolvia-v3';

// App-shell assets to pre-cache on install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/offline.html',
  '/logo.png',
  '/logo_circle.png',
  '/manifest.json'
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

// ─── Message handler (SKIP_WAITING from UpdateToast) ────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Fetch ──────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET for caching (mutations are handled by the app + sync queue)
  if (request.method !== 'GET') return;

  // Navigation requests → Network-first, fall back to offline.html
  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
    return;
  }

  // API requests → Network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets → Cache-first
  event.respondWith(cacheFirst(request));
});

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // Try cached version of the exact page
    const cached = await caches.match(request);
    if (cached) return cached;

    // For SPA routing, fall back to the app shell (/index.html)
    const indexCached = await caches.match('/index.html');
    if (indexCached) return indexCached;

    // Absolute fallback
    return caches.match('/offline.html');
  }
}

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
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(
      JSON.stringify({ offline: true, message: 'You are offline' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
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

// ─── Push Notifications ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/logo_circle.png',
      badge: '/logo_circle.png',
      data: {
        url: data.url || '/daily',
        taskId: data.taskId
      },
      vibrate: [200, 100, 200],
      actions: [
        { action: 'complete', title: '✅ Complete' },
        { action: 'snooze', title: '⏳ Snooze (10m)' },
        { action: 'open', title: 'Open App' }
      ]
    };
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { action, notification } = event;
  const taskId = notification.data?.taskId;
  const urlToOpen = notification.data?.url || '/daily';

  if (action === 'complete' || action === 'snooze') {
    event.waitUntil(
      fetch('/api/notifications/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, action }),
      }).then(response => {
        if (!response.ok) throw new Error('Action failed');
        console.log(`[SW] Task ${action} success`);
      }).catch(err => {
        console.error(`[SW] Task ${action} failed:`, err);
      })
    );
    return;
  }

  // Default: Open App
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});


