import { defineConfig } from '@playwright/test'
import { webServers } from './e2e/servers'

// e2e/theme-overrides.spec.ts against a mock Strapi whose site-setting has a default mode, an accent override and a display font
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'theme-overrides.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:3230', colorScheme: 'light' },
  webServer: webServers({ mockPort: 4330, appPort: 3230, themeOverrides: true }),
})
