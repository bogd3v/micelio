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
    hookTimeout: 60_000,
  },
})
