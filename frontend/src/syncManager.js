/**
 * syncManager.js — Background sync for Evolvio
 *
 * When the app goes offline, mutations are queued in IndexedDB.
 * When connectivity is restored, this module replays them in order.
 */

import { dequeueSyncAll, removeSyncItem, clearSyncQueue } from './offlineDb.js';

import { API_URL, nativeFetch } from './config.js';
import { Network } from '@capacitor/network';

// Shadow global fetch so all sync operations use the native-aware helper
const fetch = nativeFetch;

let isSyncing = false;
let onSyncComplete = null; // callback set by Store to refresh state

/**
 * Register a callback that fires after a successful background sync.
 * The Store uses this to re-fetch fresh data from the server.
 */
export function onSyncDone(cb) {
  onSyncComplete = cb;
}

/**
 * Attempt to replay every queued mutation against the backend.
 * Skips silently if already syncing or if offline.
 */
export async function replayQueue() {
  if (isSyncing || !navigator.onLine) return;
  isSyncing = true;

  try {
    const queue = await dequeueSyncAll();
    if (queue.length === 0) {
      isSyncing = false;
      return;
    }

    console.log(`[Sync] Replaying ${queue.length} queued mutation(s)…`);

    let allSucceeded = true;
    for (const item of queue) {
      try {
        const fetchOpts = {
          method: item.method || 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        };

        if (item.body) {
          fetchOpts.body = typeof item.body === 'string'
            ? item.body
            : JSON.stringify(item.body);
        }

        const res = await fetch(`${API_URL}${item.url}`, fetchOpts);

        if (res.ok || res.status === 409) {
          // 409 = conflict / duplicate — safe to discard
          await removeSyncItem(item.id);
          console.log(`[Sync] ✓ ${item.method} ${item.url}`);
        } else {
          // Server error — stop processing, will retry later
          console.warn(`[Sync] Server returned ${res.status} for ${item.url}, will retry later`);
          allSucceeded = false;
          break;
        }
      } catch (fetchErr) {
        // Network error mid-sync — stop, we're probably offline again
        console.warn('[Sync] Network error during replay, stopping:', fetchErr.message);
        allSucceeded = false;
        break;
      }
    }

    // Only refresh from server if ALL queued items were processed successfully.
    // Otherwise the token is likely stale — wait for the next attempt.
    if (allSucceeded && onSyncComplete) {
      try { await onSyncComplete(); } catch (_) { /* ignore */ }
    }
  } catch (err) {
    console.error('[Sync] Replay error:', err);
  } finally {
    isSyncing = false;
  }
}

/**
 * Start listening for connectivity changes.
 * Call once at app boot.
 */
export function startSyncListener() {
  // Replay immediately if we're already online
  replayQueue();

  // Listen for online events (Standard Browser)
  window.addEventListener('online', () => {
    console.log('[Sync] Back online (Browser) — starting replay…');
    replayQueue();
  });

  // Listen for online events (Capacitor Android/iOS)
  Network.addListener('networkStatusChange', status => {
    console.log('[Sync] Network status changed:', status.connected);
    if (status.connected) {
      replayQueue();
    }
  });

  // Periodic check every 30 seconds (catches edge cases)
  setInterval(() => {
    if (navigator.onLine) replayQueue();
  }, 30_000);
}

/**
 * Request the service worker to do a background sync (if supported).
 * Falls back to replayQueue() for browsers without SyncManager.
 */
export async function requestBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('evolvio-sync');
      console.log('[Sync] Background sync registered with service worker');
    } catch (err) {
      console.warn('[Sync] Background sync registration failed, using fallback:', err);
      replayQueue();
    }
  } else {
    replayQueue();
  }
}
