import { Locale } from './app/interfaces/locale'
import { SECURITY_HEADERS } from './app/helpers/securityHeaders'
import { UPSTREAM_SOURCE_URL } from './app/helpers/source'

const privatePageHeaders = {
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow',
}

// CSS browser targets, shared by the Lightning CSS transformer and the minifier (build.cssTarget)
const CSS_TARGETS: Record<string, [major: number, minor?: number]> = {
  chrome: [111],
  edge: [111],
  firefox: [114],
  safari: [16, 4],
  ios_saf: [16, 4],
}
// Lightning CSS encodes a version as (major << 16) | (minor << 8)
const LIGHTNINGCSS_TARGETS = Object.fromEntries(
  Object.entries(CSS_TARGETS).map(([browser, [major, minor = 0]]) => [browser, (major << 16) | (minor << 8)]),
)
const ESBUILD_TARGETS = Object.entries(CSS_TARGETS).map(
  ([browser, [major, minor]]) => `${browser === 'ios_saf' ? 'ios' : browser}${major}${minor ? `.${minor}` : ''}`,
)

export default defineNuxtConfig({
  // The theme goes first: @nuxt/image reads image.dirs when it is set up (modules/theme/assets.ts)
  modules: ['./modules/theme', '@nuxt/image', '@vueuse/nuxt', '@nuxtjs/i18n', '@nuxt/eslint'],
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
  runtimeConfig: {
    strapiApiToken: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    newsletterFrom: '',
    // Site-specific values come from NUXT_* variables (README); empty defaults keep the core neutral
    mediaUrl: '',
    umamiUrl: '',
    umamiCollectPath: '/api/bd',
    siteCacheSeconds: 60,
    public: {
      strapiUrl: '',
      siteUrl: '',
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
    '/**': { headers: SECURITY_HEADERS },
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
    viewTransition: true,
    payloadExtraction: 'client',
  },
  nitro: {
    static: false,
    preset: 'node-server',
    compressPublicAssets: { gzip: true, brotli: true },
    externals: {
      inline: [/nodemailer/],
    },
    devStorage: {
      cache: { driver: 'memory' },
    },
  },
  vite: {
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
    tsConfig: { include: ['../themes/**/*'] },
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
      { code: Locale.English, iso: 'en-US', name: 'English', file: 'en.json' },
      {
        code: Locale.SpanishColombia,
        iso: 'es',
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
  },
})
