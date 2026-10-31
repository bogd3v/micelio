import { defineConfig } from '@playwright/test'
import { webServers } from './e2e/servers'

// E2E_MOCK_PORT and E2E_APP_PORT move the servers when another run is using these ports
const mockPort = Number(process.env.E2E_MOCK_PORT ?? 4336)
const appPort = Number(process.env.E2E_APP_PORT ?? 3236)

// e2e/theme-switch.spec.ts: the theme the site settings name changes while the server runs, with no restart and no rebuild (#403).
// The same build as runtime-theme.spec.ts: its built-in store holds the build's theme and the fixture theme.
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'theme-switch.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${appPort}`, colorScheme: 'light', viewport: { width: 1280, height: 800 } },
  webServer: webServers({ mockPort, appPort, theme: 'alternates', themeDirs: 'test/fixtures/themes/alternates', themeSwitch: true }),
})
