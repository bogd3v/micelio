import { defineConfig } from '@playwright/test'
import { webServers } from './e2e/servers'

// e2e/modules-off.spec.ts against a mock Strapi whose site-setting turns every module off
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'modules-off.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:3220', colorScheme: 'light' },
  webServer: webServers({ mockPort: 4320, appPort: 3220, modulesOff: true }),
})
