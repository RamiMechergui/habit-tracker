/**
 * syncManager.js — Background sync for Evolvio
 *
 * When the app goes offline, mutations are queued in IndexedDB.
 * When connectivity is restored, this module replays them in order.
 */

import { dequeueSyncAll, removeSyncItem } from './offlineDb.js';

import { API_URL, nativeFetch } from './config.js';
import { Network } from '@capacitor/network';

// Shadow global fetch so all sync operations use the native-aware helper
const fetch = nativeFetch;

let isSyncing = false;
let onSyncComplete = null; // callback set by Store to refresh state
let listenerStarted = false; // guards against duplicate listeners/intervals

// ─── Retry backoff state ───────────────────────────────────────────────────
const BASE_BACKOFF_MS = 15_000;          // 15s
const MAX_BACKOFF_MS = 15 * 60_000;      // 15min
let consecutiveFailures = 0;
let nextAttemptAt = 0;

/**
 * Register a callback that fires after a successful background sync.
 * The Store uses this to re-fetch fresh data from the server.
 */
export function onSyncDone(cb) {
  onSyncComplete = cb;
}

/**
 * Attempt to replay every queued mutation against the backend.
 * Skips silently if already syncing, offline, or inside the backoff window.
 */
export async function replayQueue() {
  if (isSyncing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (Date.now() < nextAttemptAt) return;
  isSyncing = true;

  try {
    const queue = await dequeueSyncAll();
    if (queue.length === 0) {
      consecutiveFailures = 0;
      nextAttemptAt = 0;
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

    if (!allSucceeded) {
      // Back off exponentially so a dead backend doesn't cause a retry storm.
      consecutiveFailures += 1;
      const delay = Math.min(BASE_BACKOFF_MS * Math.pow(2, consecutiveFailures - 1), MAX_BACKOFF_MS);
      nextAttemptAt = Date.now() + delay;
      console.log(`[Sync] Next replay attempt in ${Math.round(delay / 1000)}s`);
    } else {
      consecutiveFailures = 0;
      nextAttemptAt = 0;
      // Only refresh from server if ALL queued items were processed successfully.
      // Otherwise the token is likely stale — wait for the next attempt.
      if (onSyncComplete) {
        try { await onSyncComplete(); } catch { /* ignore */ }
      }
    }
  } catch (err) {
    console.error('[Sync] Replay error:', err);
  } finally {
    isSyncing = false;
  }
}

/**
 * Start listening for connectivity changes.
 * Safe to call more than once — only the first call wires up listeners.
 */
export function startSyncListener() {
  if (listenerStarted) return;
  listenerStarted = true;

  // Replay immediately if we're already online
  replayQueue();

  // Listen for online events (Standard Browser)
  window.addEventListener('online', () => {
    console.log('[Sync] Back online (Browser) — starting replay…');
    consecutiveFailures = 0;
    nextAttemptAt = 0;
    replayQueue();
  });

  // Listen for online events (Capacitor Android/iOS)
  Network.addListener('networkStatusChange', status => {
    console.log('[Sync] Network status changed:', status.connected);
    if (status.connected) {
      consecutiveFailures = 0;
      nextAttemptAt = 0;
      replayQueue();
    }
  });

  // Periodic check every 30 seconds (catches edge cases).
  // replayQueue self-throttles via the backoff window when the server is down.
  setInterval(() => {
    if (navigator.onLine) replayQueue();
  }, 30_000);
}

// Throttle service-worker sync registrations so rapid queueing doesn't spam.
let lastBgSyncRequest = 0;
const BG_SYNC_THROTTLE_MS = 30_000;

/**
 * Request the service worker to do a background sync (if supported).
 * Falls back to replayQueue() for browsers without SyncManager.
 */
export async function requestBackgroundSync() {
  const now = Date.now();
  if (now - lastBgSyncRequest < BG_SYNC_THROTTLE_MS) return;
  lastBgSyncRequest = now;

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
