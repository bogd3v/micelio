import { defineConfig } from '@playwright/test'

// e2e/landing against the output of `NUXT_PUBLIC_SITE_MODE=landing npm run generate`, which scripts/test-landing.mjs
// builds against the mock Strapi (a home page, no articles; stopped afterwards: the site has no Strapi at runtime)
const appPort = Number(process.env.LANDING_APP_PORT ?? 3280)

export default defineConfig({
  testDir: 'e2e/landing',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${appPort}`, colorScheme: 'light' },
  webServer: {
    command: `HOST=127.0.0.1 PORT=${appPort} node scripts/static-serve.mjs .output/public`,
    port: appPort,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
})
