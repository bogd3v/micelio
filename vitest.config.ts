import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { fileURLToPath } from 'node:url'

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
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.test.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              domEnvironment: 'happy-dom',
              // BogDev's site values: the defaults in nuxt.config.ts are empty
              overrides: {
                runtimeConfig: {
                  public: {
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
      }),
    ],
  },
})
