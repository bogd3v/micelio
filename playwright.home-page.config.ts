import { defineConfig } from '@playwright/test'
import { webServers } from './e2e/servers'

// e2e/home-page.spec.ts against a mock Strapi whose site-setting sets the showcase page as homePage in each locale
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'home-page.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://127.0.0.1:3231', colorScheme: 'light' },
  webServer: webServers({ mockPort: 4331, appPort: 3231, homePage: true }),
})
