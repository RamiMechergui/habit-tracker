import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * UpdateToast — Notifies users when a new service worker is available.
 * Shows a toast with a "Refresh" button to activate the update.
 */
export default function UpdateToast() {
  const [showUpdate, setShowUpdate] = useState(false);
  const [registration, setRegistration] = useState(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkUpdate = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        setRegistration(reg);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A new SW is installed but waiting — show update toast
              setShowUpdate(true);
            }
          });
        });
      } catch (err) {
        console.warn('[UpdateToast] SW check failed:', err);
      }
    };

    checkUpdate();
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div className="update-toast">
      <RefreshCw size={16} className="update-toast-icon" />
      <span>A new version is available</span>
      <button className="update-toast-btn" onClick={handleUpdate}>
        Refresh
      </button>
    </div>
  );
}
