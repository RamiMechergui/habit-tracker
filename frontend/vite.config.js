import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Determine API target for the Vite proxy.
// On EC2 the backend runs on localhost:5001; Docker overrides via VITE_API_TARGET.
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:5001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
    server: {
    host: true,
    port: 80,
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
