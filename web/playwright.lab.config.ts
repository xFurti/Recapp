import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: 'lab-notes.spec.ts',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:5281' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : undefined } },
    { name: 'webkit', use: { browserName: 'webkit', launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } : undefined } },
  ],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5281 --strictPort', url: 'http://127.0.0.1:5281', reuseExistingServer: false },
})
