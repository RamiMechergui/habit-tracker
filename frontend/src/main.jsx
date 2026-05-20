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


// ── Service Worker Registration ──────────────────────────────────
// Log resolved API URL at startup to help debug deployment/runtime issues
console.log('[App] Resolved API_URL =', API_URL);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('[App] Service Worker registered:', registration.scope);

      // Listen for SW messages (e.g., background sync triggers)
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_REPLAY') {
          import('./syncManager.js').then(({ replayQueue }) => replayQueue());
        }
      });
    } catch (err) {
      console.warn('[App] Service Worker registration failed:', err);
    }
  });
}
