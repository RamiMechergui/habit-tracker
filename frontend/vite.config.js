import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Determine API target for the Vite proxy.
// On EC2 the backend runs on localhost:5001; Docker overrides via VITE_API_TARGET.
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:5001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Use injectManifest so we keep our custom service worker logic
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',

      // Let plugin handle SW registration
      injectRegister: 'auto',

      // Reload prompt behaviour (handled by our UpdateToast component)
      registerType: 'prompt',

      // The manifest is already in public/manifest.json — tell plugin not to generate one
      manifest: false,

      // Workbox injectManifest config
      injectManifest: {
        // Precache all Vite build output assets (incl. manifest.json so the
        // PWA install manifest is available offline)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,webp,json}'],
        // Don't precache huge files
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
      },

      // Dev options — enable SW in development for testing
      devOptions: {
        enabled: false, // set to true temporarily if you want to test SW in dev
        type: 'module',
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    watch: {
      usePolling: true,
      ignored: ['**/node_modules/**', '**/android/**', '**/.git/**', '**/src-tauri/**'],
    },
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
