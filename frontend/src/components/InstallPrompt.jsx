import React, { useState, useEffect } from 'react';
import { Download, X, Share, Plus } from 'lucide-react';

/**
 * PWA Install Prompt — Evolvio
 *
 * • Android/Desktop Chrome: catches `beforeinstallprompt`, shows banner
 * • iOS Safari: detects standalone-capable but not yet installed, shows manual steps
 * • Dismissal: persisted in localStorage for 30 days (not session-only)
 * • Already-installed: never shown (detected via display-mode: standalone)
 */

const DISMISS_KEY = 'evolvio-pwa-dismissed-until';
const DISMISS_DAYS = 30;

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

function isInStandaloneMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

function isDismissed() {
  const until = localStorage.getItem(DISMISS_KEY);
  if (!until) return false;
  return Date.now() < parseInt(until, 10);
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [, setInstalled] = useState(false);

  useEffect(() => {
    // Already running as installed PWA — no prompt needed
    if (isInStandaloneMode()) return;

    // User dismissed recently
    if (isDismissed()) return;

    if (isIOS()) {
      // iOS: show manual instructions after a short delay
      const t = setTimeout(() => setShowIOS(true), 3000);
      return () => clearTimeout(t);
    }

    // Android / Desktop Chrome: wait for browser event
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If already installed programmatically
    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setShow(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    const until = Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000;
    localStorage.setItem(DISMISS_KEY, String(until));
    setShow(false);
    setShowIOS(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
        setShow(false);
        setDeferredPrompt(null);
      }
    } finally {
      setInstalling(false);
    }
  };

  // ── Android / Desktop install banner ──────────────────────────────────────
  if (show && deferredPrompt) {
    return (
      <div className="install-prompt">
        <div className="install-prompt-content">
          <img src="/icons/icon-192x192.png" alt="Evolvio" className="install-prompt-icon" />
          <div className="install-prompt-text">
            <strong>Install Evolvio</strong>
            <span>Works offline · No app store needed</span>
          </div>
        </div>
        <div className="install-prompt-actions">
          <button
            className="install-prompt-btn"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="install-spinner" />
                Installing…
              </span>
            ) : (
              <>
                <Download size={14} />
                Install App
              </>
            )}
          </button>
          <button className="install-prompt-close" onClick={dismiss} title="Dismiss">
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── iOS Safari manual instructions ────────────────────────────────────────
  if (showIOS) {
    return (
      <div className="install-prompt install-prompt-ios">
        <button className="install-prompt-close" onClick={dismiss} title="Dismiss"
          style={{ position: 'absolute', top: '10px', right: '10px' }}>
          <X size={16} />
        </button>
        <div className="install-prompt-content">
          <img src="/icons/icon-192x192.png" alt="Evolvio" className="install-prompt-icon" />
          <div className="install-prompt-text">
            <strong>Install Evolvio on iOS</strong>
          </div>
        </div>
        <div className="install-prompt-ios-steps">
          <div className="install-prompt-ios-step">
            <span className="install-step-num">1</span>
            <span>Tap <Share size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> <strong>Share</strong> in Safari</span>
          </div>
          <div className="install-prompt-ios-step">
            <span className="install-step-num">2</span>
            <span>Tap <Plus size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> <strong>Add to Home Screen</strong></span>
          </div>
          <div className="install-prompt-ios-step">
            <span className="install-step-num">3</span>
            <span>Tap <strong>Add</strong> — done! 🎉</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
