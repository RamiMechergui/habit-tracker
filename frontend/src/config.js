import { Capacitor } from '@capacitor/core';

export const API_URL = Capacitor.isNativePlatform() 
  ? 'https://habit-tracker-production-3ba1.up.railway.app' 
  : '';
