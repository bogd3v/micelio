import { defineConfig, devices } from '@playwright/test'
import { previewTlsDir } from './e2e/preview/tls'
import { webServers } from './e2e/servers'

// e2e/preview on Chromium, Firefox and WebKit against the production build (`npm run build`): the CSP that lets the admin frame a draft
// (ADR 0019) is only sent there. The admin is a page on localhost, the frontend is on 127.0.0.1: two sites, so the grant cookie is a
// third-party, partitioned one, as in the CMS admin. Both are served over https with a throwaway certificate (e2e/preview/tls.ts): the cookie
// is `Secure`, and Playwright's Linux WebKit stores none from an http page.
process.env.E2E_BUILD = '1'
const mockPort = Number(process.env.PREVIEW_MOCK_PORT ?? 4336)
const appPort = Number(process.env.PREVIEW_APP_PORT ?? 3236)
const adminPort = Number(process.env.PREVIEW_ADMIN_PORT ?? 4436)

export default defineConfig({
  testDir: 'e2e/preview',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `https://127.0.0.1:${appPort}`, colorScheme: 'light', ignoreHTTPSErrors: true },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: webServers({ mockPort, appPort, preview: { adminPort, tlsDir: previewTlsDir() }, siteUrl: `https://127.0.0.1:${appPort}` }),
})
