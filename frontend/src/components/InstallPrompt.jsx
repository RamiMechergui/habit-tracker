import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

/**
 * PWA Install Prompt — shows a beautiful custom banner
 * when the browser fires the `beforeinstallprompt` event.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Don't show if user dismissed it before (this session)
    if (sessionStorage.getItem('pwa-dismissed')) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('pwa-dismissed', '1');
  };

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="install-prompt">
      <div className="install-prompt-content">
        <img src="/logo_circle.png" alt="Evolvia" className="install-prompt-icon" />
        <div className="install-prompt-text">
          <strong>Install Evolvia</strong>
          <span>Add to home screen for the best experience</span>
        </div>
      </div>
      <div className="install-prompt-actions">
        <button className="install-prompt-btn" onClick={handleInstall}>
          <Download size={14} /> Install
        </button>
        <button className="install-prompt-close" onClick={handleDismiss} title="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
