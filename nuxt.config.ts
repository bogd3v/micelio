import { fileURLToPath } from 'node:url'
import { Locale } from './app/interfaces/locale'
import { SECURITY_HEADERS } from './app/helpers/securityHeaders'
import { isStaticMode, parseSiteMode } from './app/helpers/siteMode'
import { UPSTREAM_SOURCE_URL } from './app/helpers/source'
import { CSS_TARGETS } from './modules/theme/install/constants'

const privatePageHeaders = {
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow',
}

// The pages that open from an emailed link with a one-use secret in the query (a reset code, a newsletter token): no Referer leaves them
const tokenPageHeaders = { ...privatePageHeaders, 'referrer-policy': 'no-referrer' }

// CSS browser targets, shared by the Lightning CSS transformer, the minifier (build.cssTarget) and the theme compiler (modules/theme/install/)
// Lightning CSS encodes a version as (major << 16) | (minor << 8)
const LIGHTNINGCSS_TARGETS = Object.fromEntries(
  Object.entries(CSS_TARGETS).map(([browser, [major, minor = 0]]) => [browser, (major << 16) | (minor << 8)]),
)
const ESBUILD_TARGETS = Object.entries(CSS_TARGETS).map(
  ([browser, [major, minor]]) => `${browser === 'ios_saf' ? 'ios' : browser}${major}${minor ? `.${minor}` : ''}`,
)

// Read at build time: it changes what is built (ADR 0006); an invalid value fails the build
const siteMode = parseSiteMode(process.env.NUXT_PUBLIC_SITE_MODE)
const staticSite = isStaticMode(siteMode)

// Hosts @nuxt/image may optimise from (Strapi and its media host); static builds write _ipx/ at generate time
function imageDomains(...urls: Array<string | undefined>): string[] {
  const hosts = urls.flatMap((url) => {
    try {
      return url ? [new URL(url).host] : []
    } catch {
      return []
    }
  })
  return [...new Set(hosts)]
}

// Page revalidation (ADR 0001); a static site has no server to revalidate
const ISR_RULES = {
  '/': { isr: 300 },
  '/about': { isr: 3600 },
  '/blog': { isr: 300 },
  '/blog/**': { isr: 300 },
  '/es': { isr: 300 },
  '/es/about': { isr: 3600 },
  '/privacy': { isr: 3600 },
  '/es/privacy': { isr: 3600 },
  '/es/blog': { isr: 300 },
  '/es/blog/**': { isr: 300 },
}

// Module routes that are off in static modes (ADR 0006, section 2): not crawled, not generated
const STATIC_PRERENDER_IGNORE = [
  /^\/(es\/)?(account|drafts|newsletter|confirm|_theme)(\/|$)/,
  /^\/(api\/(auth|comments|drafts|newsletter|fediverse)|__nuxt_island)(\/|$)/,
]

// Blog filters are paths, not query strings (ADR 0006, section 7); they reuse the blog list page
const BLOG_LIST_PAGE = fileURLToPath(new URL('./app/pages/blog/index.vue', import.meta.url))
const BLOG_FILTER_ROUTES: { name: string, path: string }[] = [
  { name: 'blog-page', path: '/blog/page/:page(\\d+)' },
  { name: 'blog-category', path: '/blog/category/:category' },
  { name: 'blog-category-page', path: '/blog/category/:category/page/:page(\\d+)' },
  { name: 'blog-tag', path: '/blog/tag/:tag' },
  { name: 'blog-tag-page', path: '/blog/tag/:tag/page/:page(\\d+)' },
]

export default defineNuxtConfig({
  // The theme goes first: @nuxt/image reads image.dirs when it is set up (modules/theme/assets.ts)
  modules: ['./modules/theme', './modules/site-mode', './modules/islands', './modules/static-routes', './modules/static-search', '@nuxt/image', '@vueuse/nuxt', '@nuxtjs/i18n', '@nuxt/eslint'],
  ssr: true,
  devtools: { enabled: false },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      meta: [
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  // <micelio-*> are islands (ADR 0006, section 3), not Vue components
  vue: { compilerOptions: { isCustomElement: tag => tag.startsWith('micelio-') } },
  runtimeConfig: {
    strapiApiToken: '',
    // Visitor address for the CMS rate limits: docs/security.md, "Client IP"
    strapiForwarderSecret: '',
    trustProxy: 'private',
    proxyIpHeader: 'X-Forwarded-For',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    newsletterFrom: '',
    // Site-specific values come from NUXT_* variables (docs/operate/configure.md); empty defaults keep the core neutral
    mediaUrl: '',
    // The origin of the admin that may frame a draft (ADR 0019); empty turns the preview off. Server only, so no page carries it
    previewAdminOrigin: '',
    umamiUrl: '',
    umamiCollectPath: '/api/bd',
    siteCacheSeconds: 60,
    public: {
      strapiUrl: '',
      siteUrl: '',
      siteMode,
      // Resolved at build by modules/site-mode.ts from NUXT_PUBLIC_NEWSLETTER_FORM_ACTION/_FIELD (build env only, never overridden at runtime)
      newsletterProvider: { action: '', field: 'email', host: '', hidden: [] as { name: string, value: string }[] },
      umamiWebsiteId: '',
      umamiScriptPath: '/bd.js',
      fediverseHandle: '',
      fediverseActorUrl: '',
      fediverseArticlesUrl: '',
      sourceUrl: UPSTREAM_SOURCE_URL,
      fediverseLocale: Locale.SpanishColombia as string,
    },
  },
  // Caching strategy (node-server / Docker preset, no CDN in front):
  // - Pages: `isr` renders once and revalidates after the TTL via Nitro's
  //   storage cache. The page HTML embeds the useAsyncData payload, so
  //   visitors of a cached page never trigger Strapi calls.
  // - API routes: `Cache-Control` headers below are defensive; they only
  //   take effect if a shared cache/CDN is introduced later. Do not add
  //   Vercel-only headers (CDN-Cache-Control / Vercel-CDN-Cache-Control).
  routeRules: {
    // noScripts is a route rule, not features.noScripts: the global flag would drop island chunks (ADR 0006, section 3)
    '/**': staticSite ? { headers: SECURITY_HEADERS, noScripts: true } : { headers: SECURITY_HEADERS },
    ...(staticSite ? {} : ISR_RULES),
    '/account': { headers: privatePageHeaders },
    '/account/**': { headers: privatePageHeaders },
    '/es/account': { headers: privatePageHeaders },
    '/es/account/**': { headers: privatePageHeaders },
    '/drafts': { headers: privatePageHeaders },
    '/drafts/**': { headers: privatePageHeaders },
    '/es/drafts': { headers: privatePageHeaders },
    '/es/drafts/**': { headers: privatePageHeaders },
    '/newsletter/**': { headers: privatePageHeaders },
    '/es/newsletter/**': { headers: privatePageHeaders },
    '/account/reset-password': { headers: tokenPageHeaders },
    '/es/account/reset-password': { headers: tokenPageHeaders },
    '/confirm': { headers: tokenPageHeaders },
    '/es/confirm': { headers: tokenPageHeaders },
    '/newsletter/unsubscribe': { headers: tokenPageHeaders },
    '/es/newsletter/unsubscribe': { headers: tokenPageHeaders },
    '/_preview': { headers: tokenPageHeaders },
    '/api/preview/**': { headers: tokenPageHeaders },
    '/_theme': { headers: privatePageHeaders },
    '/es/_theme': { headers: privatePageHeaders },
    '/api/auth/**': { headers: { 'cache-control': 'private, no-store' } },
    '/api/newsletter/**': { headers: { 'cache-control': 'private, no-store' } },
    '/api/drafts': { headers: { 'cache-control': 'private, no-store' } },
    '/api/drafts/**': { headers: { 'cache-control': 'private, no-store' } },
  },
  future: {
    compatibilityVersion: 4,
  },
  experimental: {
    // Static and landing sites ship no JS: their cross-document opt-in is in base/view-transition.css, behind prefers-reduced-motion.
    // With the flag on, Nuxt 4.6 also injects an unconditional `@view-transition` on noScripts pages, which ignores reduced motion.
    viewTransition: !staticSite,
    // Prefetch a link's route on hover or focus, not when it scrolls into view (ADR 0006, section 3; docs/performance.md)
    defaults: { nuxtLink: { prefetchOn: { interaction: true, visibility: false } } },
    // Under noScripts the payload would still be written as _payload.json
    payloadExtraction: staticSite ? false : 'client',
  },
  nitro: {
    static: staticSite,
    typescript: { tsConfig: { extends: '@micelio/tsconfig' } },
    // Nuxt's page error handler without Nitro's free-text report (server/errorHandler.ts, ASVS V16.2.4)
    errorHandler: fileURLToPath(new URL('./server/errorHandler.ts', import.meta.url)),
    alias: { '#nuxt-error-handler': fileURLToPath(new URL('./runtime/handlers/error.mjs', import.meta.resolve('@nuxt/nitro-server'))) },
    // `nuxt generate` picks the static preset
    ...(staticSite ? {} : { preset: 'node-server' }),
    ...(staticSite && {
      prerender: {
        crawlLinks: true,
        routes: ['/', '/es', '/blog', '/es/blog'],
        ignore: STATIC_PRERENDER_IGNORE,
        // A dead link in the content is logged; routes Strapi lists must render (modules/static-routes.ts)
        failOnError: false,
      },
    }),
    compressPublicAssets: { gzip: true, brotli: true },
    externals: {
      inline: [/nodemailer/],
    },
    devStorage: {
      cache: { driver: 'memory' },
    },
  },
  vite: {
    // Lets dynamic builds drop code only static pages use (docs/performance.md); declared in app/types/static-build.d.ts
    define: { __STATIC_BUILD__: JSON.stringify(staticSite) },
    css: {
      transformer: 'lightningcss',
      lightningcss: { targets: LIGHTNINGCSS_TARGETS },
    },
    build: {
      cssTarget: ESBUILD_TARGETS,
      rollupOptions: {
        experimental: {
          // Merging pulled Mermaid's d3 chunk into every page; see docs/performance.md
          chunkOptimization: { mergeCommonChunks: false },
        },
      },
    },
  },
  // The theme packages' slots are checked with the app (ADR 0005, section 4)
  typescript: {
    tsConfig: { extends: '@micelio/tsconfig', include: ['../themes/**/*'] },
    nodeTsConfig: { extends: '@micelio/tsconfig' },
    sharedTsConfig: { extends: '@micelio/tsconfig' },
  },
  hooks: {
    'pages:extend'(pages) {
      for (const route of BLOG_FILTER_ROUTES) pages.push({ ...route, file: BLOG_LIST_PAGE })
    },
  },
  eslint: {
    config: {
      stylistic: {
        indent: 2,
        quotes: 'single',
        semi: false,
        braceStyle: '1tbs',
      },
    },
  },
  i18n: {
    locales: [
      { code: Locale.English, language: 'en-US', name: 'English', file: 'en.json' },
      {
        code: Locale.SpanishColombia,
        language: 'es',
        name: 'Español',
        file: 'es.json',
      },
    ],
    defaultLocale: Locale.English,
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: false,
      redirectOn: 'root',
    },
    // Messages reach the client precompiled (modules/precompile-messages.ts)
    bundle: { dropMessageCompiler: true },
    experimental: { optimizeMessageBundling: false },
  },
  image: {
    quality: 80,
    format: ['webp', 'avif'],
    ...(staticSite && { domains: imageDomains(process.env.NUXT_PUBLIC_STRAPI_URL, process.env.NUXT_MEDIA_URL) }),
  },
})
