import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: ['lab-presentation.spec.ts', 'lab-notes.spec.ts'],
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:5298',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : undefined,
  },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5298 --strictPort', url: 'http://127.0.0.1:5298', reuseExistingServer: false },
})
