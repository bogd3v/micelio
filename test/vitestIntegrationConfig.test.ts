import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVitest } from 'vitest/node'

const config = fileURLToPath(new URL('../vitest.config.integration.ts', import.meta.url))

/** The workers vitest resolves for the integration config, without running any file. */
async function resolvedMaxWorkers(): Promise<number | undefined> {
  const vitest = await createVitest('test', { config, watch: false })
  try {
    return vitest.config.maxWorkers
  } finally {
    await vitest.close()
  }
}

// Also undoes what the config sets while it loads
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('vitest.config.integration.ts', () => {
  it('the integration config runs one file at a time when VITEST_MAX_WORKERS is 4', async () => {
    vi.stubEnv('VITEST_MAX_WORKERS', '4')
    expect(await resolvedMaxWorkers()).toBe(1)
  })

  it('the integration config runs one file at a time when VITEST_MAX_WORKERS is unset', async () => {
    vi.stubEnv('VITEST_MAX_WORKERS', undefined)
    expect(await resolvedMaxWorkers()).toBe(1)
  })
})
