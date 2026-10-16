import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Resolved from this file, so the build works from any working directory.
const releaseScript = fileURLToPath(new URL('../scripts/release-notes.mjs', import.meta.url))
const releaseManifest = execFileSync(process.execPath, [releaseScript, '--json'], { encoding: 'utf8' })

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
