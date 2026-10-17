import { defineConfig } from '@playwright/test'
import base from './playwright.config'

const sharedUse = { ...base.use }
delete sharedUse.launchOptions

export default defineConfig({
  ...base,
  testMatch: 'contributions.spec.ts',
  use: { ...sharedUse, baseURL: 'http://127.0.0.1:5293' },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
          : undefined,
      },
    },
    {
      name: 'webkit',
      use: {
        browserName: 'webkit',
        // An empty object replaces the Chromium executable inherited from the base config.
        launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH }
          : {},
      },
    },
  ],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 5293 --strictPort', url: 'http://127.0.0.1:5293', reuseExistingServer: false },
})
