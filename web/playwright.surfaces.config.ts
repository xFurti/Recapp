import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests', testMatch: 'surfaces.spec.ts', fullyParallel: true, workers: 2,
  use: {
    baseURL: process.env.SURFACE_BASE_URL || 'http://127.0.0.1:5208',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' },
  },
  webServer: process.env.SURFACE_BASE_URL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 5208 --strictPort', url: 'http://127.0.0.1:5208', reuseExistingServer: false,
  },
})
