import { Capacitor } from '@capacitor/core';

// Prefer an explicit VITE_API_URL when provided; otherwise use a relative
// `/api` path so the frontend talks to the same origin (works for most
// static + proxy deployments and avoids accidental localhost fallbacks).
export const API_URL = import.meta.env.VITE_API_URL || '/api';
