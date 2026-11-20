import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// AI_PROXY_URL lets local dev call the AI function (e.g. http://localhost:8787) instead of the deployed one.
const aiProxy = process.env.AI_PROXY_URL

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: aiProxy ? { proxy: { '/api': { target: aiProxy, changeOrigin: true } } } : undefined,
  // Unit tests start from a clean environment, so real keys present during a build are never used.
  test: { setupFiles: ['./infra/test-setup.mjs'] },
})
