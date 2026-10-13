import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execFileSync } from 'node:child_process'

const releaseManifest = execFileSync('node', ['../scripts/release-notes.mjs', '--json'], { encoding: 'utf8' })

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'release-notes',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'release-manifest.json', source: releaseManifest })
    },
  }],
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
