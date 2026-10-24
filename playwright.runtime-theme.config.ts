import { defineConfig } from '@playwright/test'
import { webServers } from './e2e/servers'

// E2E_MOCK_PORT and E2E_APP_PORT move the servers when another run is using these ports
const mockPort = Number(process.env.E2E_MOCK_PORT ?? 4335)
const appPort = Number(process.env.E2E_APP_PORT ?? 3235)

// e2e/runtime-theme.spec.ts: the build made for Bogotá (E2E_BUILD=1, built with MICELIO_THEME_DIRS=test/fixtures/themes/alternates)
// serving the data-only fixture theme chosen at boot (#402)
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'runtime-theme.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${appPort}`, colorScheme: 'light', viewport: { width: 1280, height: 800 } },
  webServer: webServers({ mockPort, appPort, theme: 'alternates', themeDirs: 'test/fixtures/themes/alternates' }),
})
