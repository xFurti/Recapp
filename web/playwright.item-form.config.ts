import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testMatch: 'item-form.spec.ts',
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', isMobile: true, hasTouch: true } },
    {
      name: 'webkit',
      use: {
        ...devices['iPhone 13'],
        launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH }
          : {},
      },
    },
  ],
})
