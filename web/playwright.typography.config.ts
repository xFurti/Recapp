import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: 'typography.spec.ts',
  outputDir: './test-results/typography',
  fullyParallel: true,
  workers: 3,
  use: {
    baseURL: 'http://127.0.0.1:5193',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium' },
  },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5193 --strictPort', url: 'http://127.0.0.1:5193', reuseExistingServer: false },
})
