import { useState, useEffect, useCallback } from 'react';

const VAPID_KEY_URL = '/api/notifications/vapidPublicKey';
const SUBSCRIBE_URL = '/api/notifications/subscribe';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const supported = typeof window !== 'undefined' && 
                        'serviceWorker' in navigator && 
                        'PushManager' in window;
      setIsSupported(supported);
      if (supported && typeof window.Notification !== 'undefined') {
        setPermission(window.Notification.permission);
      }
    } catch (err) {
      console.warn('[Push] Support check failed:', err);
      setIsSupported(false);
    }
  }, []);

  const urlBase64ToUint8Array = (base64String) => {
    try {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    } catch (e) {
      return new Uint8Array();
    }
  };

  const subscribe = useCallback(async () => {
    if (!isSupported || typeof window.Notification === 'undefined') return;
    setLoading(true);

    try {
      // 1. Request Permission
      const permissionResult = await window.Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        throw new Error('Permission not granted');
      }

      // 2. Register/Get Service Worker
      const registration = await navigator.serviceWorker.ready;
      if (!registration.pushManager) {
        throw new Error('PushManager not available on this registration');
      }

      // 3. Get VAPID Public Key from server
      const response = await fetch(VAPID_KEY_URL);
      if (!response.ok) throw new Error('Failed to fetch VAPID key');
      const { publicKey } = await response.json();

      // 4. Subscribe with PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 5. Send Subscription to backend
      await fetch(SUBSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const checkSubscription = useCallback(async () => {
    if (!isSupported) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration.pushManager) {
        const subscription = await registration.pushManager.getSubscription();
        setIsSubscribed(!!subscription);
      }
    } catch (err) {
      console.warn('[Push] Check subscription failed:', err);
    }
  }, [isSupported]);


  useEffect(() => {
    if (isSupported) {
      checkSubscription();
    }
  }, [isSupported, checkSubscription]);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe
  };
}
