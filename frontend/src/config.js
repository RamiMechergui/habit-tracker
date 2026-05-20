import { Capacitor } from '@capacitor/core';

const origin = typeof window !== 'undefined' ? window.location.origin : '';

// Prefer an explicit VITE_API_URL when provided.
// Otherwise use a same-origin API path so the app avoids localhost fallback.
export const API_URL = import.meta.env.VITE_API_URL || `${origin}/api`;
