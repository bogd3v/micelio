import { defineConfig } from '@playwright/test'
import { webServers } from './e2e/servers'

export default defineConfig({
  testDir: 'e2e',
  // Needs its own servers with every module off: playwright.modules-off.config.ts
  // e2e/theme runs in playwright.theme.config.ts (per theme and mode, in the Playwright image)
  testIgnore: ['modules-off.spec.ts', 'theme/**'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // The build (E2E_BUILD=1) keeps up with one worker per core; nuxt dev does not
  workers: process.env.E2E_BUILD ? '100%' : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: { baseURL: 'http://127.0.0.1:3210', colorScheme: 'light' },
  webServer: webServers({ mockPort: 4310, appPort: 3210 }),
})
