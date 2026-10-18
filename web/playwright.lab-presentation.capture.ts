import { defineConfig } from '@playwright/test'

// Explicit visual-evidence capture; excluded from the normal *.spec.ts suite.
export default defineConfig({
  testDir: './tests',
  testMatch: 'lab-presentation.capture.ts',
  fullyParallel: true,
  use: {
    baseURL: 'http://127.0.0.1:5299',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : undefined,
  },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5299 --strictPort', url: 'http://127.0.0.1:5299', reuseExistingServer: false },
})
