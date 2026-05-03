import { useState, useEffect, useCallback } from 'react';

const VAPID_KEY_URL = '/api/notifications/vapidPublicKey';
const SUBSCRIBE_URL = '/api/notifications/subscribe';

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = useCallback(async () => {
    if (!isSupported) return;
    setLoading(true);

    try {
      // 1. Request Permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);
      if (permissionResult !== 'granted') {
        throw new Error('Permission not granted for notifications');
      }

      // 2. Register/Get Service Worker
      const registration = await navigator.serviceWorker.ready;

      // 3. Get VAPID Public Key from server
      const response = await fetch(VAPID_KEY_URL);
      const { publicKey } = await response.json();

      // 4. Subscribe with PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // 5. Send Subscription to backend
      await fetch(SUBSCRIBE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription)
      });

      setIsSubscribed(true);
      console.log('[Push] Subscribed successfully');
    } catch (err) {
      console.error('[Push] Subscription failed:', err);
    } finally {
      setLoading(false);
    }
  }, [isSupported]);

  const checkSubscription = useCallback(async () => {
    if (!isSupported) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setIsSubscribed(!!subscription);
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
