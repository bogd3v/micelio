import type { PlaywrightTestConfig } from '@playwright/test'

interface Servers {
  mockPort: number
  appPort: number
  /** Answer site-setting with every module off (e2e/modules-off.spec.ts) */
  modulesOff?: boolean
  /** Answer site-setting with a default mode and an accent override (e2e/theme-overrides.spec.ts) */
  themeOverrides?: boolean
  /** Answer site-setting with the showcase page as homePage in each locale (e2e/home-page.spec.ts) */
  homePage?: boolean
  /** Answer site-setting with no value at all, and use neutral env values (e2e/empty-site.spec.ts) */
  emptySite?: boolean
  /** The site's origin when it is not the BogDev one: a Worker's CSP names it (e2e/playground) */
  siteUrl?: string
}

/** The mock Strapi and the Nuxt server (dev, or the build with E2E_BUILD=1) pointed at it, with BogDev's site values (neutral ones with `emptySite`). */
export function webServers({ mockPort, appPort, modulesOff = false, themeOverrides = false, homePage = false, emptySite = false, siteUrl = emptySite ? 'https://example.com' : 'https://bogdev.com.co' }: Servers): PlaywrightTestConfig['webServer'] {
  return [
    {
      command: `MOCK_PORT=${mockPort} MOCK_FRONTEND_URL=http://127.0.0.1:${appPort}${modulesOff ? ' MOCK_MODULES_OFF=1' : ''}${themeOverrides ? ' MOCK_THEME=1' : ''}${homePage ? ' MOCK_HOME_PAGE=1' : ''}${emptySite ? ' MOCK_EMPTY_SITE=1' : ''} node e2e/mock-strapi.mjs`,
      port: mockPort,
      reuseExistingServer: !process.env.CI,
      timeout: 15_000,
    },
    {
      // The defaults in nuxt.config.ts are empty
      command: [
        `HOST=127.0.0.1 PORT=${appPort}`,
        // /_theme exists in dev; a build needs it at build time too (modules/theme/specimen/setup.ts)
        'MICELIO_SPECIMEN=1',
        `NUXT_PUBLIC_STRAPI_URL=http://127.0.0.1:${mockPort}`,
        `NUXT_PUBLIC_SITE_URL=${siteUrl}`,
        ...(emptySite
          ? [
              'NUXT_MEDIA_URL=https://resources.example.com',
              'NUXT_PUBLIC_FEDIVERSE_HANDLE=@blog@cms.example.com',
              'NUXT_PUBLIC_FEDIVERSE_ACTOR_URL=https://cms.example.com/fediverse/user/blog',
              'NUXT_PUBLIC_FEDIVERSE_ARTICLES_URL=https://cms.example.com/fediverse/articles',
            ]
          : [
              'NUXT_MEDIA_URL=https://resources.bogdev.com.co',
              'NUXT_PUBLIC_FEDIVERSE_HANDLE=@bogdev@api.bogdev.com.co',
              'NUXT_PUBLIC_FEDIVERSE_ACTOR_URL=https://api.bogdev.com.co/fediverse/user/devbog',
              'NUXT_PUBLIC_FEDIVERSE_ARTICLES_URL=https://api.bogdev.com.co/fediverse/articles',
            ]),
        // A full SMTP setting keeps the newsletter module on; nothing is sent
        'NUXT_SMTP_HOST=127.0.0.1 NUXT_SMTP_PORT=1 NUXT_SMTP_USER=test NUXT_SMTP_PASS=test',
        emptySite ? 'NUXT_NEWSLETTER_FROM="Micelio <no-reply@micelio.test>"' : 'NUXT_NEWSLETTER_FROM="BogDev <no-reply@bogdev.test>"',
        // E2E_BUILD=1 serves .output from npm run build: no on-demand compiling, same CSP as production
        process.env.E2E_BUILD ? 'node .output/server/index.mjs' : 'npm run dev',
      ].join(' '),
      port: appPort,
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ]
}
