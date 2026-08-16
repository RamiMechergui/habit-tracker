import { Preferences } from '@capacitor/preferences';

/**
 * Resolve the correct API base URL depending on the runtime context:
 *
 * - **Native (Android / iOS)**: window.Capacitor.isNativePlatform() === true
 *   at runtime inside the WebView. Use the production HTTPS backend URL.
 *
 * - **Web (browser)**: Use empty string so fetch uses same-origin / nginx proxy.
 *
 * IMPORTANT: We detect native at RUNTIME (not build time) using window.Capacitor
 * so that Vite does NOT tree-shake away the backend URL during the production build.
 */

// The deployed production backend. Must be the HTTPS domain (NOT the raw EC2 IP):
// the IP redirects HTTP→HTTPS and serves a certificate for evolvio.ink, so native
// clients that validate TLS fail the handshake against the IP host.
const NATIVE_BACKEND_URL = import.meta.env.VITE_API_URL_NATIVE || import.meta.env.VITE_API_URL || 'https://evolvio.ink';

// Optional build-time override for web deployments (Render/docker-compose).
// Render sets VITE_API_URL to the API service host; docker-compose sets
// VITE_API_TARGET for the dev proxy. When set, the browser uses it directly
// instead of assuming the frontend host proxies /api.
const WEB_API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_TARGET || '';

// True only inside a native Capacitor WebView (Android/iOS app), where the
// local page origin has no backend behind it, so relative `/api/...` image
// URLs would never resolve. Detected via the runtime bridge so it works no
// matter which hostname Capacitor serves the shell from (app.evolvio.app or
// localhost).
export const isNativePlatform = () => {
  try {
    return typeof window !== 'undefined' && !!window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform();
  } catch (_) {
    return false;
  }
};

export const API_URL = (() => {
  // During build-time (Node.js), window is undefined. We return the backend URL
  // to force Vite to keep it in the built bundle instead of tree-shaking it.
  if (typeof window === 'undefined') {
    return NATIVE_BACKEND_URL;
  }

  // Native Capacitor WebView (Android/iOS app) — regardless of the local
  // origin (app.evolvio.app or localhost), always call the HTTPS backend.
  if (isNativePlatform() || window.location.hostname === 'app.evolvio.app') {
    return NATIVE_BACKEND_URL;
  }

  // Fallback for browser / local dev proxy
  return WEB_API_URL;
})();

// Base used to absolutize relative image URLs for DISPLAY inside the editor.
// Empty on the web when using the same-origin nginx proxy, otherwise the
// configured API base; absolute on native so the WebView can reach the backend.
export const EDITOR_IMAGE_BASE = isNativePlatform() ? NATIVE_BACKEND_URL : (WEB_API_URL || '');




// ── Native fetch helper ───────────────────────────────────────
// On Capacitor native builds, httpOnly cookies may not be forwarded by the
// WebView to cross-origin requests. This helper transparently adds the JWT
// as an Authorization: Bearer header so every request is authenticated even
// when the cookie bridge is unavailable.
let _cachedNativeToken = null;
const getNativeToken = async () => {
  if (_cachedNativeToken) return _cachedNativeToken;
  try {
    const { value } = await Preferences.get({ key: 'user_session' });
    if (value) {
      const parsed = JSON.parse(value);
      _cachedNativeToken = parsed?.token || null;
    }
  } catch (_) {
    // Capacitor Preferences may not be available in plain browser — fallback to localStorage
    try {
      const raw = localStorage.getItem('user_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        _cachedNativeToken = parsed?.token || null;
      }
    } catch (_2) {}
  }
  return _cachedNativeToken;
};

export const invalidateNativeTokenCache = () => {
  _cachedNativeToken = null;
};

/**
 * Drop-in replacement for fetch() that:
 * - Attaches Authorization: Bearer <token> header when a stored JWT exists
 * - Works identically on both native Capacitor and standard Web browser
 */
export const nativeFetch = async (url, options = {}) => {
  const token = await getNativeToken();
  const headers = { ...(options.headers || {}) };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Ensure credentials are included by default so cookies are sent
  const opts = { ...options, headers };
  if (!opts.credentials) opts.credentials = 'include';
  // Also set lowercase header to be robust in different environments
  if (token && !headers['authorization']) headers['authorization'] = headers['Authorization'];
  // Primary request using configured URL/header options
  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    // If native platform encounters an SSL error (CertPathValidatorException) or connection error on HTTPS:
    if (isNativePlatform() && String(url).startsWith('https://')) {
      // Fallback 1: Try HTTP direct IP endpoint (bypasses SSL validation issues)
      const httpIpUrl = String(url).replace(/^https:\/\/[^/]+/i, 'http://54.91.207.131');
      try {
        const fallbackRes = await fetch(httpIpUrl, opts);
        return fallbackRes;
      } catch (_) {
        // Fallback 2: Try HTTP domain endpoint
        try {
          const httpDomainUrl = String(url).replace(/^https:/i, 'http:');
          return await fetch(httpDomainUrl, opts);
        } catch (_) {}
      }
    }

    // On web (not native platform), try same-origin fallback if relative path works
    if (!isNativePlatform() && typeof window !== 'undefined' && String(url).includes('/api/')) {
      try {
        const u = new URL(url, window.location.origin);
        const path = `${u.pathname}${u.search}`;
        return await fetch(path, opts);
      } catch (_) {}
    }
    throw err;
  }

  // If the backend returned HTML (likely the SPA) for an API endpoint:
  try {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html') && String(url).includes('/api/')) {
      if (!isNativePlatform() && typeof window !== 'undefined' && window.location.hostname !== 'app.evolvio.app') {
        const u = new URL(url, window.location.origin);
        const path = `${u.pathname}${u.search}`;
        try {
          const fb = await fetch(path, opts);
          return fb;
        } catch (_) {
          return res;
        }
      } else if (isNativePlatform()) {
        // Try cleartext HTTP IP fallback if HTTPS returned HTML/redirect page
        const httpIpUrl = String(url).replace(/^https:\/\/[^/]+/i, 'http://54.91.207.131');
        if (httpIpUrl !== url) {
          try {
            const fbRes = await fetch(httpIpUrl, opts);
            const fbCt = (fbRes.headers.get('content-type') || '').toLowerCase();
            if (!fbCt.includes('text/html')) return fbRes;
          } catch (_) {}
        }
        throw new Error(`API server returned HTML instead of JSON. Check backend server URL (${NATIVE_BACKEND_URL}).`);
      }
    }
  } catch (e) {
    if (isNativePlatform()) throw e;
  }

  return res;
};

// Helpful debug log in development
if (import.meta.env.DEV) {
  try { console.info('[App] API_URL =', API_URL); } catch (_) {}
}

