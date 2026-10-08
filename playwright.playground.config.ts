import { defineConfig, devices } from '@playwright/test'
import { webServers } from './e2e/servers'

// e2e/playground on Chromium, Firefox and WebKit: whether each applies the Worker's own CSP is what the suite proves (ADR 0004).
// It needs the production build (`npm run build`): the policies are only sent there. The site URL is the origin it is served from,
// because the Worker's connect-src names it.
process.env.E2E_BUILD = '1'
const mockPort = Number(process.env.PLAYGROUND_MOCK_PORT ?? 4332)
const appPort = Number(process.env.PLAYGROUND_APP_PORT ?? 3232)

export default defineConfig({
  testDir: 'e2e/playground',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  // WebKit compiles the 870 KB SQLite module slowly: a crowd of browsers starves the runs that time themselves
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${appPort}`, colorScheme: 'light' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: webServers({ mockPort, appPort, siteUrl: `http://127.0.0.1:${appPort}` }),
})
