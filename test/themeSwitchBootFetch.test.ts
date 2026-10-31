import { afterEach, describe, expect, it, vi } from 'vitest'
import { RegistryError } from '../modules/theme/registry/error'
import { startThemeSwitch } from '../server/lib/themeSwitch/boot'
import { builtInStore, cleanup, scratch } from './fixtures/themeSwitch'

const created = vi.hoisted(() => ({ options: [] as Array<{ fetch?: typeof fetch }> }))

vi.mock('../modules/theme/registry/client', async (original) => {
  const actual = await original<typeof import('../modules/theme/registry/client')>()
  return {
    ...actual,
    createRegistry: (options: { fetch?: typeof fetch }) => {
      created.options.push(options)
      return (actual.createRegistry as (options: unknown) => unknown)(options)
    },
  }
})

afterEach(() => {
  created.options.length = 0
  cleanup()
})

describe('the registry client the server builds', () => {
  // The switch tests build their own client; this one is the wiring of boot.ts
  it('reaches the network only through the guarded fetch: a host other than the registry\'s that resolves to a private address is refused', async () => {
    const builtInDir = await builtInStore()
    const started = startThemeSwitch({ builtInDir, configured: '', env: { MICELIO_THEME_STORE: scratch(), MICELIO_THEME_INSTALL: 'false' }, onSwitch: () => undefined, warn: () => undefined })
    await started.ready
    const options = created.options.at(-1)
    expect(options?.fetch).toBeTypeOf('function')
    // `localhost` resolves to loopback on every machine; the plain global fetch would try to connect and fail with a TypeError
    await expect(options!.fetch!('https://localhost/blob')).rejects.toBeInstanceOf(RegistryError)
  })
})
