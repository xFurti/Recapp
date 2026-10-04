import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testMatch: 'speech.spec.ts',
  use: { baseURL: base.use?.baseURL },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', launchOptions: base.use?.launchOptions } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'], launchOptions: base.use?.launchOptions } },
  ],
})
