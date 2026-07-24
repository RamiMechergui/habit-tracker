import { Preferences } from '@capacitor/preferences';

/**
 * Resolve the correct API base URL depending on the runtime context:
 *
 * - **Native (Android / iOS)**: window.Capacitor.isNativePlatform() === true
 *   at runtime inside the WebView. Use the hardcoded EC2 backend URL.
 *
 * - **Web (browser)**: Use empty string so fetch uses same-origin / nginx proxy.
 *
 * IMPORTANT: We detect native at RUNTIME (not build time) using window.Capacitor
 * so that Vite does NOT tree-shake away the EC2 URL during the production build.
 */

// The deployed EC2 backend (proxied through Nginx on port 80).
const NATIVE_BACKEND_URL = 'http://54.91.207.131';

export const API_URL = (() => {
  // During build-time (Node.js), window is undefined. We return the EC2 URL
  // to force Vite to keep it in the built bundle instead of tree-shaking it.
  if (typeof window === 'undefined') {
    return NATIVE_BACKEND_URL;
  }
  
  // If running inside the Android app WebView (configured hostname in capacitor.config.json)
  if (window.location.hostname === 'app.evolvio.app') {
    return NATIVE_BACKEND_URL;
  }
  
  // Fallback for browser / local dev proxy
  return '';
})();




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
    // If network error and this was an API call, try same-origin fallback
    try {
      if (typeof window !== 'undefined' && String(url).includes('/api/')) {
        const u = new URL(url, window.location.origin);
        const path = `${u.pathname}${u.search}`;
        return await fetch(path, opts);
      }
    } catch (_) {}
    throw err;
  }

  // If the backend returned HTML (likely the SPA) for an API endpoint,
  // retry the same-origin /api path. This handles misconfigured API_URL
  // that points to the frontend host instead of the API host.
  try {
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('text/html') && String(url).includes('/api/')) {
      if (typeof window !== 'undefined') {
        const u = new URL(url, window.location.origin);
        const path = `${u.pathname}${u.search}`;
        try {
          const fb = await fetch(path, opts);
          return fb;
        } catch (_) {
          // fallback failed — return original response
          return res;
        }
      }
    }
  } catch (e) {
    // ignore parsing errors and return original response
  }

  return res;
};

// Helpful debug log in development
if (import.meta.env.DEV) {
  try { console.info('[App] API_URL =', API_URL); } catch (_) {}
}

