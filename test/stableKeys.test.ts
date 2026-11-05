import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

// `defineNuxtModule` needs a running Nuxt; the definition itself is what is under test
vi.mock('nuxt/kit', () => ({ defineNuxtModule: (definition: unknown) => definition }))

const { default: stableKeysModule, stableKeys } = await import('../modules/stable-keys')

const MARKER = '/* nuxt-injected */'
const CODE = `const a = useFetch('/api/a', { key: 'a' }, '$AAAAAAAAAA' ${MARKER}); const b = useAsyncData(() => x, '$BBBBBBBBBB' ${MARKER})`

describe('stableKeys', () => {
  it('gives the same keys to one module in two checkouts at other paths', () => {
    const a = stableKeys(CODE, '/__w/micelio/micelio/app/components/Reading.vue', '/__w/micelio/micelio')
    const b = stableKeys(CODE, '/__w/micelio-themes/micelio-themes/app/components/Reading.vue', '/__w/micelio-themes/micelio-themes')
    expect(a).toBeDefined()
    expect(a).not.toBe(CODE)
    expect(a).toBe(b)
  })

  it('keeps the shape Nuxt injects and tells the calls of a module apart', () => {
    const out = stableKeys(CODE, '/r/app/pages/x.vue', '/r')!
    const keys = [...out.matchAll(/'\$([\w-]{10})' \/\* nuxt-injected \*\//g)].map(match => match[1])
    expect(keys).toHaveLength(2)
    expect(new Set(keys).size).toBe(2)
    expect(keys).not.toContain('AAAAAAAAAA')
  })

  it('gives other modules and other queries of one module other keys', () => {
    const one = stableKeys(CODE, '/r/app/pages/one.vue', '/r')
    expect(stableKeys(CODE, '/r/app/pages/two.vue', '/r')).not.toBe(one)
    expect(stableKeys(CODE, '/r/app/pages/one.vue?vue&type=script', '/r')).not.toBe(one)
  })

  it('leaves a module without an injected key alone', () => {
    expect(stableKeys('const a = useFetch(\'/api/a\', { key: \'a\' })', '/r/app/pages/x.vue', '/r')).toBeUndefined()
  })
})

describe('the stable-keys module', () => {
  type Plugin = { name: string, enforce?: string, transform?: { handler: (code: string, id: string) => { code: string } | undefined } }

  function setup(): { extend: (config: { plugins?: Plugin[] }) => void } {
    let extend: (config: { plugins?: Plugin[] }) => void = () => {}
    const hook = (name: string, callback: typeof extend): void => {
      if (name === 'vite:extendConfig') extend = callback
    }
    const nuxt = { options: { rootDir: '/r' }, hook }
    ;(stableKeysModule as unknown as { setup: (options: unknown, nuxt: unknown) => void }).setup({}, nuxt)
    return { extend }
  }

  it('puts its plugin after the ones in the list, once per config, so that it sees the keys Nuxt injects', () => {
    const { extend } = setup()
    const nuxtPlugin: Plugin = { name: 'nuxt:compiler:keyed-functions', enforce: 'post' }
    const config = { plugins: [nuxtPlugin] }
    extend(config)
    extend(config)
    expect(config.plugins.map(plugin => plugin.name)).toEqual(['nuxt:compiler:keyed-functions', 'micelio:stable-keys'])
    expect(config.plugins[1]!.enforce).toBe('post')
  })

  it('derives the keys from the path relative to the project root', () => {
    const { extend } = setup()
    const config: { plugins?: Plugin[] } = {}
    extend(config)
    const handler = config.plugins![0]!.transform!.handler
    expect(handler(CODE, '/r/app/pages/x.vue')?.code).toBe(stableKeys(CODE, '/r/app/pages/x.vue', '/r'))
    expect(handler('const a = 1', '/r/app/pages/x.vue')).toBeUndefined()
  })

  it('is listed in nuxt.config.ts', () => {
    expect(readFileSync(new URL('../nuxt.config.ts', import.meta.url), 'utf8')).toContain('\'./modules/stable-keys\'')
  })
})
