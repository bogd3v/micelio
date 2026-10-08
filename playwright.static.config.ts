import { defineConfig, devices } from '@playwright/test'

// e2e/static against the output of `NUXT_PUBLIC_SITE_MODE=static npm run generate`, which scripts/test-static.mjs
// builds against the mock Strapi (stopped afterwards: a static site has no Strapi at runtime)
const appPort = Number(process.env.STATIC_APP_PORT ?? 3260)

// Chromium unless STATIC_BROWSERS lists others (`chromium,firefox,webkit`): the playground's Worker policy is proven on each (e2e/static/playground.spec.ts)
const DEVICES = { chromium: devices['Desktop Chrome'], firefox: devices['Desktop Firefox'], webkit: devices['Desktop Safari'] }
const browsers = (process.env.STATIC_BROWSERS ?? '').split(',').map(name => name.trim()).filter((name): name is keyof typeof DEVICES => name in DEVICES)

export default defineConfig({
  testDir: 'e2e/static',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${appPort}`, colorScheme: 'light' },
  ...(browsers.length && { projects: browsers.map(name => ({ name, use: DEVICES[name] })) }),
  webServer: {
    command: `HOST=127.0.0.1 PORT=${appPort} node scripts/static-serve.mjs .output/public`,
    port: appPort,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
})
