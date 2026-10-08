import { defineConfig, devices } from '@playwright/test'
import { webServers } from './e2e/servers'

// e2e/native-ui on Chromium, Firefox and WebKit: dialogs and the account popover rely on the engines' own focus and dismiss rules (#245).
const mockPort = Number(process.env.NATIVE_UI_MOCK_PORT ?? 4334)
const appPort = Number(process.env.NATIVE_UI_APP_PORT ?? 3234)

export default defineConfig({
  testDir: 'e2e/native-ui',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.E2E_BUILD ? '100%' : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${appPort}`, colorScheme: 'light' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // WebKit drops a Secure cookie on 127.0.0.1 over http, but keeps it on localhost
    { name: 'webkit', use: { ...devices['Desktop Safari'], baseURL: `http://localhost:${appPort}` } },
  ],
  webServer: webServers({ mockPort, appPort }),
})
