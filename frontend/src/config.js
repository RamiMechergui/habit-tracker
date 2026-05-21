import { Capacitor } from '@capacitor/core';

const origin = typeof window !== 'undefined' ? window.location.origin : '';
const envApiUrl = import.meta.env.VITE_API_URL;

if (!envApiUrl && !import.meta.env.DEV) {
  console.warn('[App] VITE_API_URL is not set in production. API requests may fail if /api is not proxied to the backend.');
}

// Prefer an explicit VITE_API_URL when provided.
// If not provided, default to an empty string so requests use relative paths (e.g. /api/login).
export const API_URL = envApiUrl || '';
