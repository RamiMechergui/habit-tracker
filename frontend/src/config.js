import { Capacitor } from '@capacitor/core';

const origin = typeof window !== 'undefined' ? window.location.origin : '';
const envApiUrl = import.meta.env.VITE_API_URL;

if (!envApiUrl && !import.meta.env.DEV) {
  console.warn('[App] VITE_API_URL is not set in production. API requests may fail if /api is not proxied to the backend.');
}

// Prefer an explicit VITE_API_URL when provided.
// In development, allow relative `/api` so local dev with a proxy works.
// In production, an unset VITE_API_URL means the frontend may not be able to reach the backend.
export const API_URL = envApiUrl || (import.meta.env.DEV ? '/api' : `${origin}/api`);
