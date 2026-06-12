import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { HabitProvider } from './Store.jsx'

import Chart from 'chart.js/auto';
import annotationPlugin from 'chartjs-plugin-annotation';

Chart.register(annotationPlugin);

import ErrorBoundary from './components/ErrorBoundary.jsx'
import { API_URL } from './config.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <HabitProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HabitProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)

// ── Debug ───────────────────────────────────────────────────────────────────
console.log('[App] Resolved API_URL =', API_URL);

// ── Service Worker ──────────────────────────────────────────────────────────
// vite-plugin-pwa (injectRegister: 'auto') handles SW registration automatically.
// We only need to wire up the background-sync message relay here.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Listen for SW messages (e.g., background sync triggers from sw.js)
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_REPLAY') {
        import('./syncManager.js').then(({ replayQueue }) => replayQueue());
      }
    });
  });
}
