import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Determine API target based on environment
const apiTarget = process.env.VITE_API_TARGET || 'http://backend:5000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
    server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    watch: {
      usePolling: true,
      ignored: ['**/node_modules/**', '**/android/**', '**/.git/**', '**/src-tauri/**'],
    },
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
