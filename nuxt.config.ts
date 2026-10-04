import { Locale } from './app/interfaces/locale'
import { themeInitScript } from './app/helpers/theme'
import { SECURITY_HEADERS } from './app/helpers/securityHeaders'

const privatePageHeaders = {
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, nofollow',
}

export default defineNuxtConfig({
  modules: ['@nuxt/ui', '@nuxt/image', '@vueuse/nuxt', '@nuxtjs/i18n', '@nuxt/eslint'],
  ssr: true,
  devtools: { enabled: false },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'BogDev - Personal Blog',
      viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
      meta: [
        { name: 'author', content: 'BogDev' },
        { property: 'og:site_name', content: 'BogDev' },
        { property: 'og:type', content: 'website' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@devbog' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/bogdev.svg' },
        {
          rel: 'alternate',
          type: 'application/rss+xml',
          title: 'BogDev RSS Feed',
          href: '/feed.xml',
        },
        {
          rel: 'preload',
          href: '/fonts/archivo-latin-var.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: '',
        },
        {
          rel: 'preload',
          href: '/fonts/jetbrains-mono-latin-var.woff2',
          as: 'font',
          type: 'font/woff2',
          crossorigin: '',
        },
      ],
      script: [
        {
          innerHTML: themeInitScript,
          tagPosition: 'head',
          tagPriority: 'critical',
        },
      ],
    },
  },
  css: ['~/assets/css/main.css'],
  ui: {
    colorMode: false,
    fonts: false,
  },
  runtimeConfig: {
    strapiApiToken: '',
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPass: '',
    newsletterFrom: '',
    mediaUrl: 'https://resources.bogdev.com.co',
    umamiUrl: '',
    umamiCollectPath: '/api/bd',
    public: {
      strapiUrl: 'https://api.bogdev.com.co',
      siteUrl: 'https://bogdev.com.co',
      umamiWebsiteId: '',
      umamiScriptPath: '/bd.js',
      fediverseHandle: '@bogdev@api.bogdev.com.co',
      fediverseActorUrl: 'https://api.bogdev.com.co/fediverse/user/devbog',
      fediverseArticlesUrl: 'https://api.bogdev.com.co/fediverse/articles',
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
    build: {
      rollupOptions: {
        experimental: {
          // Merging pulled Mermaid's d3 chunk into every page; see docs/performance.md
          chunkOptimization: { mergeCommonChunks: false },
        },
      },
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
