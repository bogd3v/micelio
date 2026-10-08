import { defineConfig } from '@playwright/test'
import { webServers } from './e2e/servers'

// E2E_MOCK_PORT and E2E_APP_PORT move the servers when another run is using these ports
const mockPort = Number(process.env.E2E_MOCK_PORT ?? 4310)
const appPort = Number(process.env.E2E_APP_PORT ?? 3210)

export default defineConfig({
  testDir: 'e2e',
  // Needs its own servers with every module off: playwright.modules-off.config.ts
  // theme-overrides.spec.ts: playwright.theme-overrides.config.ts, a mock Strapi that serves a theme
  // home-page.spec.ts: playwright.home-page.config.ts, a mock Strapi whose site settings name a home page
  // e2e/theme runs in playwright.theme.config.ts (per theme and mode, in the Playwright image)
  // e2e/static runs in playwright.static.config.ts against a generated site (npm run test:static)
  // e2e/playground runs in playwright.playground.config.ts (Chromium, Firefox and WebKit, against the build)
  // e2e/scene runs in playwright.scene.config.ts (Chromium, Firefox and WebKit, against the build)
  // e2e/landing runs in playwright.landing.config.ts against a generated landing (npm run test:landing)
  testIgnore: ['modules-off.spec.ts', 'theme-overrides.spec.ts', 'home-page.spec.ts', 'theme/**', 'static/**', 'landing/**', 'playground/**', 'scene/**'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // The build (E2E_BUILD=1) keeps up with one worker per core; nuxt dev does not
  workers: process.env.E2E_BUILD ? '100%' : undefined,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: { baseURL: `http://127.0.0.1:${appPort}`, colorScheme: 'light' },
  webServer: webServers({ mockPort, appPort }),
})
