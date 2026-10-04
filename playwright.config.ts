import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'html',
  use: { baseURL: 'http://127.0.0.1:3210', colorScheme: 'light' },
  webServer: [
    {
      command: 'node e2e/mock-strapi.mjs',
      port: 4310,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      // BogDev's site values: the defaults in nuxt.config.ts are empty
      command: [
        'HOST=127.0.0.1 PORT=3210',
        'NUXT_PUBLIC_STRAPI_URL=http://127.0.0.1:4310',
        'NUXT_PUBLIC_SITE_URL=https://bogdev.com.co',
        'NUXT_MEDIA_URL=https://resources.bogdev.com.co',
        'NUXT_PUBLIC_FEDIVERSE_HANDLE=@bogdev@api.bogdev.com.co',
        'NUXT_PUBLIC_FEDIVERSE_ACTOR_URL=https://api.bogdev.com.co/fediverse/user/devbog',
        'NUXT_PUBLIC_FEDIVERSE_ARTICLES_URL=https://api.bogdev.com.co/fediverse/articles',
        'npm run dev',
      ].join(' '),
      port: 3210,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
})
