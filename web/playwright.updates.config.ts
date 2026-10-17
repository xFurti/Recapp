import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({ ...base,
  testMatch: 'updates.spec.ts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5201' },
  webServer: { command: 'APP_VERSION=updates-e2e npm run dev -- --host 127.0.0.1 --port 5201 --strictPort', url: 'http://127.0.0.1:5201', reuseExistingServer: false },
})
