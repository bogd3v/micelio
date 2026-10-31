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
  /** Answer site-setting with this privacy jurisdiction (e2e/privacy.spec.ts) */
  privacyJurisdiction?: string
  /** Publish articles in garden, kitchen (English only) and invierno (Spanish only), categories no site constant knows (e2e/categories.spec.ts) */
  categoryArticles?: boolean
  /** Answer site-setting with no value at all, and use neutral env values (e2e/empty-site.spec.ts) */
  emptySite?: boolean
  /** The site's origin when it is not the BogDev one: a Worker's CSP names it (e2e/playground) */
  siteUrl?: string
  /** Serve this installed theme instead of the build's (`NUXT_PUBLIC_THEME` read at boot; e2e/runtime-theme.spec.ts) */
  theme?: string
  /** Let a test change the theme the site settings name (`POST /__mock/theme`), and cache the site settings for one second (e2e/theme-switch.spec.ts) */
  themeSwitch?: boolean
  /** Extra theme directories (`MICELIO_THEME_DIRS`): dev compiles them; a build must have been made with them */
  themeDirs?: string
  /**
   * Turn the preview of drafts on for an admin page served at `https://localhost:<adminPort>` by `e2e/preview/admin-server.mjs`, and let the mock Strapi make preview tokens (e2e/preview).
   * The site and the admin page are served over https with the certificate in `tlsDir` (`e2e/preview/tls.ts`): the grant cookie is `Secure`, and Playwright's Linux WebKit stores none from an http page.
   */
  preview?: { adminPort: number, tlsDir: string }
}

/** The mock Strapi and the Nuxt server (dev, or the build with E2E_BUILD=1) pointed at it, with BogDev's site values (neutral ones with `emptySite`). */
export function webServers({ mockPort, appPort, modulesOff = false, themeOverrides = false, homePage = false, privacyJurisdiction = '', categoryArticles = false, emptySite = false, siteUrl = emptySite ? 'https://example.com' : 'https://bogdev.com.co', theme, themeDirs, themeSwitch = false, preview }: Servers): PlaywrightTestConfig['webServer'] {
  const scheme = preview ? 'https' : 'http'
  return [
    {
      command: `MOCK_PORT=${mockPort} MOCK_FRONTEND_URL=${scheme}://127.0.0.1:${appPort}${modulesOff ? ' MOCK_MODULES_OFF=1' : ''}${themeOverrides ? ' MOCK_THEME=1' : ''}${themeSwitch ? ' MOCK_THEME_SWITCH=1' : ''}${homePage ? ' MOCK_HOME_PAGE=1' : ''}${privacyJurisdiction ? ` MOCK_PRIVACY_JURISDICTION=${privacyJurisdiction}` : ''}${categoryArticles ? ' MOCK_CATEGORY_ARTICLES=1' : ''}${emptySite ? ' MOCK_EMPTY_SITE=1' : ''}${preview ? ' MOCK_PREVIEW=1' : ''} node e2e/mock-strapi.mjs`,
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
        'NUXT_STRAPI_API_TOKEN=e2e-api-token',
        ...(theme ? [`NUXT_PUBLIC_THEME=${theme}`] : []),
        // The site settings are cached for 60 s; a test waits for a switch, not for the cache
        ...(themeSwitch ? ['NUXT_SITE_CACHE_SECONDS=1'] : []),
        ...(themeDirs ? [`MICELIO_THEME_DIRS=${themeDirs}`] : []),
        ...(preview
          ? [
              `NUXT_PREVIEW_ADMIN_ORIGIN=https://localhost:${preview.adminPort}`,
              // Nitro takes the PEM text itself, not a path
              `NITRO_SSL_CERT="$(cat "${preview.tlsDir}/cert.pem")" NITRO_SSL_KEY="$(cat "${preview.tlsDir}/key.pem")"`,
            ]
          : []),
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
    // The admin side of the preview: a page on another site that frames the draft, as the CMS admin does
    ...(preview
      ? [{
          command: `ADMIN_PORT=${preview.adminPort} ADMIN_TLS_DIR="${preview.tlsDir}" node e2e/preview/admin-server.mjs`,
          port: preview.adminPort,
          reuseExistingServer: !process.env.CI,
          timeout: 15_000,
        }]
      : []),
  ]
}
