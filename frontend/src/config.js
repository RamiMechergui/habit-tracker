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
  ? (envApiUrlNative || envApiUrl || '')
  : (envApiUrl || '');

/** Whether we are running inside a native Capacitor app (Android / iOS) */
export const IS_NATIVE = isNative;

// ── Native fetch helper ───────────────────────────────────────
// On Capacitor native builds, httpOnly cookies may not be forwarded by the
// WebView to cross-origin requests. This helper transparently adds the JWT
// as an Authorization: Bearer header so every request is authenticated even
// when the cookie bridge is unavailable.
let _cachedNativeToken = null;
const getNativeToken = async () => {
  if (!isNative) return null;
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
 * - On native: attaches Authorization: Bearer <token> header when a stored JWT exists
 * - On web: behaves identically to the native fetch
 */
export const nativeFetch = async (url, options = {}) => {
  if (!isNative) return fetch(url, options);
  const token = await getNativeToken();
  const headers = { ...(options.headers || {}) };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
};

