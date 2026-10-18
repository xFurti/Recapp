import { defineConfig } from '@playwright/test'

const capture = process.env.MEMBERS_CAPTURE
export default defineConfig({
  testDir: './tests', testMatch: 'members.spec.ts', fullyParallel: true, workers: 2,
  use: {
    baseURL: 'http://127.0.0.1:5191',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: {
    command: capture ? `npm run preview -- --host 127.0.0.1 --port 5191 --strictPort${capture === 'before' ? ' --outDir /tmp/recapp-141-before-dist' : ''}` : 'npm run dev -- --host 127.0.0.1 --port 5191 --strictPort',
    url: 'http://127.0.0.1:5191', reuseExistingServer: false,
  },
})
