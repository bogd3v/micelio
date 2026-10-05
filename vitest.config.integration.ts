import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    include: ['test/integration/**/*.test.ts'],
    // Each file builds the app: one at a time keeps memory and CI time predictable
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
