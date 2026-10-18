import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: /archive\.spec\.ts/,
  fullyParallel: true,
  workers: 3,
  use: { baseURL: 'http://127.0.0.1:5196', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } } : {}) } },
    { name: 'webkit', use: { browserName: 'webkit', ...(process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH } } : {}) } },
  ],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5196 --strictPort', url: 'http://127.0.0.1:5196', reuseExistingServer: false },
})
