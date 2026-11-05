import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { setup, useTestContext } from '@nuxt/test-utils/e2e'

// The real build, not a stand-in: modules/stable-keys.ts rewrites what Nuxt's own keyed-functions transform injects, so a Nuxt upgrade
// that changes the marker, the shape of the key or the order of the hooks must fail here instead of silently disabling the module (#314).
process.env.NUXT_PUBLIC_THEME = 'starter'

await setup({
  server: false,
  setupTimeout: 600_000,
  nuxtConfig: {
    nitro: { prerender: { crawlLinks: false } },
  },
})

function keyOf(file: string, call: number): string {
  return `$${createHash('sha256').update(`${file}-${call}`).digest('base64url').slice(0, 10)}`
}

describe('the auto keys of a real build', () => {
  const scripts = (): string => {
    const dir = join(useTestContext().nuxt!.options.nitro.output!.dir!, 'public/_nuxt')
    return readdirSync(dir).filter(name => name.endsWith('.js')).map(name => readFileSync(join(dir, name), 'utf8')).join('\n')
  }

  it('derives the key of a data call from its path inside the project, not from where the project sits', () => {
    // app/composables/usePostStats.ts holds one useFetch without a key of its own
    expect(scripts()).toContain(`\`${keyOf('app/composables/usePostStats.ts', 1)}\``)
  })
})
