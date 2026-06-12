/**
 * sw.js — Evolvia Service Worker (Workbox + custom strategies)
 *
 * Built by vite-plugin-pwa using injectManifest strategy.
 * Workbox injects the precache manifest at build time (self.__WB_MANIFEST).
 *
 * Strategies:
 *   • App shell + static assets → Workbox precache (cache-first)
 *   • API calls                 → NetworkFirst, 5s timeout → cache
 *   • Navigation (HTML)         → NetworkFirst → index.html → offline.html
 *   • Uploads                   → CacheFirst (profile images etc.)
 *   • Background sync           → replay offline mutations via postMessage
 */

import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// ─── Core Setup ─────────────────────────────────────────────────────────────
self.skipWaiting();
clientsClaim();

// Precache all Vite-built assets (injected by vite-plugin-pwa at build time)
precacheAndRoute(self.__WB_MANIFEST || []);

// Clean stale caches from old versions
cleanupOutdatedCaches();

// ─── Message Handler (SKIP_WAITING from UpdateToast) ────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Navigation — SPA fallback to index.html ────────────────────────────────
// For any navigation request, serve the cached index.html (SPA shell)
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('/index.html'), {
    denylist: [/^\/api\//, /^\/uploads\//],
  })
);

// ─── API Routes — NetworkFirst with cache fallback ──────────────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'evolvia-api-v1',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24, // 24h
      }),
    ],
    fetchOptions: { credentials: 'include' },
  })
);

// ─── Uploads / Profile Images — CacheFirst ──────────────────────────────────
registerRoute(
  ({ url }) => url.pathname.startsWith('/uploads/'),
  new CacheFirst({
    cacheName: 'evolvia-uploads-v1',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      }),
    ],
  })
);

// ─── Google Fonts — StaleWhileRevalidate ────────────────────────────────────
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({
    cacheName: 'evolvia-fonts-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
    ],
  })
);

// ─── Background Sync — relay to app clients ─────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'evolvia-sync') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(notifyClientsToSync());
  }
});

async function notifyClientsToSync() {
  const allClients = await self.clients.matchAll({ type: 'window' });
  for (const client of allClients) {
    client.postMessage({ type: 'SYNC_REPLAY' });
  }
}

// ─── Offline fallback for non-precached navigations ─────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cached = await caches.match('/index.html');
        if (cached) return cached;
        return caches.match('/offline.html');
      })
    );
  }
});
