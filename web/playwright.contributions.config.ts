import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testMatch: 'contributions.spec.ts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5293' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: {
      browserName: 'webkit',
      launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH }
        : undefined,
    } },
  ],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5293 --strictPort', url: 'http://127.0.0.1:5293', reuseExistingServer: false },
})
