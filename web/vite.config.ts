import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Must match api/config.py app_version, so the browser can tell it is running an older build.
    __APP_VERSION__: JSON.stringify(process.env.RENDER_GIT_COMMIT || process.env.APP_VERSION || 'dev'),
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
