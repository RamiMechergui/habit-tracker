import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Resolve the correct API base URL depending on the runtime context:
 *
 * - **Native (Android / iOS)**: The Capacitor WebView cannot reach `localhost`.
 *   Use VITE_API_URL_NATIVE which must be your deployed server's absolute URL
 *   (e.g. https://your-backend.railway.app).
 *
 * - **Web (browser)**: Use VITE_API_URL if set, otherwise fall back to '' so
 *   all fetch calls use relative paths and rely on the same-origin nginx proxy.
 */
const isNative = Capacitor.isNativePlatform();

const envApiUrl       = import.meta.env.VITE_API_URL;
const envApiUrlNative = import.meta.env.VITE_API_URL_NATIVE;

if (isNative && !envApiUrlNative) {
  console.warn(
    '[App] Running on a native platform but VITE_API_URL_NATIVE is not set. ' +
    'API calls will likely fail. Set VITE_API_URL_NATIVE to your backend URL ' +
    '(e.g. https://your-backend.railway.app) in your .env file.'
  );
}

if (!envApiUrl && !import.meta.env.DEV && !isNative) {
  console.warn('[App] VITE_API_URL is not set in production. API requests may fail if /api is not proxied to the backend.');
}

export const API_URL = isNative
  ? (envApiUrlNative || envApiUrl || (import.meta.env.DEV ? 'http://localhost:5000' : window.location.origin))
  : (envApiUrl || (import.meta.env.DEV ? 'http://localhost:5001' : window.location.origin));

/** Whether we are running inside a native Capacitor app (Android / iOS) */
export const IS_NATIVE = isNative;

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
  } catch (_) {}
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

