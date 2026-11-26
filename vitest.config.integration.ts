import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Set while this file loads, because vitest reads it afterwards: see `fileParallelism` below
process.env.VITEST_MAX_WORKERS = '1'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    include: ['test/integration/**/*.test.ts'],
    // Each file builds the app: one at a time keeps memory and CI time predictable, and the files share one
    // built-in theme store. VITEST_MAX_WORKERS overrides this option, so it is set to 1 above too (#996)
    fileParallelism: false,
    testTimeout: 60_000,
    // The theme catalogue reads the registry in the background: a registry with no signer identity is never read, so no
    // server a test starts reaches ghcr.io (standard, section 8). A test may set its own registry over this one
    env: { MICELIO_THEME_REGISTRY: '127.0.0.1:9/micelio-themes' },
    hookTimeout: 60_000,
  },
})
