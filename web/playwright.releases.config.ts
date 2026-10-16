import { defineConfig } from '@playwright/test'
import base from './playwright.config'

process.env.APP_VERSION = 'notes-e2e'

export default defineConfig({ ...base,
  testMatch: 'releases.spec.ts',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5197' },
  webServer: { command: 'APP_VERSION=notes-e2e npm run dev -- --host 127.0.0.1 --port 5197 --strictPort', url: 'http://127.0.0.1:5197', reuseExistingServer: false },
})
