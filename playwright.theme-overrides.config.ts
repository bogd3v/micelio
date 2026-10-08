import { defineConfig } from '@playwright/test'
import { webServers } from './e2e/servers'

// E2E_MOCK_PORT and E2E_APP_PORT move the servers when another run is using these ports
const mockPort = Number(process.env.E2E_MOCK_PORT ?? 4330)
const appPort = Number(process.env.E2E_APP_PORT ?? 3230)

// e2e/theme-overrides.spec.ts against a mock Strapi whose site-setting has a default mode, an accent override and a display font
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'theme-overrides.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${appPort}`, colorScheme: 'light' },
  webServer: webServers({ mockPort, appPort, themeOverrides: true }),
})
