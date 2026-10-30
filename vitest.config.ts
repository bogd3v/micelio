import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { fileURLToPath } from 'node:url'

// A second theme with a slot, so a component test can pick between two code themes (test/fixtures/code-themes/README.md).
// The Nuxt project reads it while its config loads; the unit tests must not see it.
const themeDirs = process.env.MICELIO_THEME_DIRS
process.env.MICELIO_THEME_DIRS = 'test/fixtures/code-themes'
const nuxtProject = await defineVitestProject({
  test: {
    name: 'nuxt',
    include: ['test/nuxt/**/*.test.ts'],
    environment: 'nuxt',
    setupFiles: ['test/nuxt/setup.ts'],
    environmentOptions: {
      nuxt: {
        domEnvironment: 'happy-dom',
        // BogDev's site values: the defaults in nuxt.config.ts are empty
        overrides: {
          // Tests switch the mode at runtime, so keep the static branches in the code
          vite: { define: { __STATIC_BUILD__: 'true' } },
          runtimeConfig: {
            public: {
              // The theme the core ships; the default one (bogota) is pulled from the registry (themes.lock.json)
              theme: 'starter',
              strapiUrl: 'https://api.bogdev.com.co',
              siteUrl: 'https://bogdev.com.co',
              fediverseHandle: '@bogdev@api.bogdev.com.co',
              fediverseActorUrl: 'https://api.bogdev.com.co/fediverse/user/devbog',
              fediverseArticlesUrl: 'https://api.bogdev.com.co/fediverse/articles',
            },
          },
        },
      },
    },
  },
})
if (themeDirs === undefined) delete process.env.MICELIO_THEME_DIRS
else process.env.MICELIO_THEME_DIRS = themeDirs

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,vue}', 'themes/**/*.{ts,vue}'],
      exclude: ['app/interfaces/**', 'app/**/*.d.ts'],
      reporter: ['text-summary', 'html', 'json-summary'],
      thresholds: {
        'statements': 63,
        'branches': 65,
        'functions': 60,
        'lines': 64,
        'app/helpers/**': {
          statements: 95,
          branches: 92,
          functions: 95,
          lines: 95,
        },
      },
    },
    projects: [
      {
        resolve: {
          alias: {
            '~': fileURLToPath(new URL('./app', import.meta.url)),
          },
        },
        test: {
          name: 'unit',
          include: ['test/*.test.ts'],
          environment: 'node',
        },
      },
      nuxtProject,
    ],
  },
})
