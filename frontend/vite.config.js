import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Backend URL configuration
// Change this to match your backend server
const BACKEND_URL = process.env.VITE_BACKEND_URL || 'http://localhost:8000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true, // This allows external connections
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.ngrok-free.app', // Allow all ngrok domains
      '.ngrok.io', // Allow older ngrok domains
      'adf8e2880b2d.ngrok-free.app' // Your specific ngrok domain
    ],
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
        cookieDomainRewrite: {
          '*': ''  // Remove domain restrictions
        },
        cookiePathRewrite: '/'
      }
    }
  }
})
