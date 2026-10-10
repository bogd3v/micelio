import { defineConfig } from '@playwright/test'

// e2e/contract: the frontend's server routes against a real CMS (the demo image of micelio-cms), started by `npm run test:contract`
// (scripts/contract/run.mjs), which sets CONTRACT_CMS_URL and CONTRACT_STRAPI_TOKEN. Needs the production build (`npm run build`).
const cmsUrl = process.env.CONTRACT_CMS_URL
const token = process.env.CONTRACT_STRAPI_TOKEN
if (!cmsUrl || !token) throw new Error('Run the contract suite with `npm run test:contract`: it starts the CMS and sets CONTRACT_CMS_URL and CONTRACT_STRAPI_TOKEN')
const appPort = Number(process.env.CONTRACT_APP_PORT ?? 3270)
const proxyPort = Number(process.env.CONTRACT_PROXY_PORT ?? 3271)
const mockPort = Number(process.env.CONTRACT_MOCK_PORT ?? 3272)
// Every request the frontend sends to the CMS goes through the recording proxy: e2e/contract/mock-shape.spec.ts repeats them on the mock
const recordFile = process.env.CONTRACT_RECORD_FILE ?? 'test-results-contract/strapi-requests.jsonl'

export default defineConfig({
  testDir: 'e2e/contract',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // The seed is the same every run: a retry would hide a response that changed
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: `http://127.0.0.1:${appPort}` },
  webServer: [
    {
      command: `PROXY_PORT=${proxyPort} TARGET_URL=${cmsUrl} RECORD_FILE=${recordFile} node scripts/contract/recording-proxy.mjs`,
      port: proxyPort,
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      command: `MOCK_PORT=${mockPort} node e2e/mock-strapi.mjs`,
      port: mockPort,
      reuseExistingServer: false,
      timeout: 15_000,
    },
    {
      command: `HOST=127.0.0.1 PORT=${appPort} NUXT_PUBLIC_STRAPI_URL=http://127.0.0.1:${proxyPort} NUXT_STRAPI_API_TOKEN=${token} NUXT_PUBLIC_SITE_URL=http://127.0.0.1:${appPort} NUXT_TRUST_PROXY=false node .output/server/index.mjs`,
      port: appPort,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
})
