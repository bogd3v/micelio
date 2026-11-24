import { describe, expect, it, vi } from 'vitest'
import { sortKeys } from '~/helpers/payloadOrder'

describe('sortKeys', () => {
  it('writes a payload the same way whichever data call finished first', () => {
    const shared = { slug: 'linux' }
    const categoriesFirst = sortKeys({ 'categories-en': [shared], 'site-en': { name: 'Micelio' }, 'draft-page-doc-en': { category: shared } })!
    const pageFirst = sortKeys({ 'draft-page-doc-en': { category: shared }, 'site-en': { name: 'Micelio' }, 'categories-en': [shared] })!
    expect(Object.keys(categoriesFirst)).toEqual(['categories-en', 'draft-page-doc-en', 'site-en'])
    expect(JSON.stringify(pageFirst)).toBe(JSON.stringify(categoriesFirst))
  })

  it('keeps the values and the record itself, and leaves an absent one alone', () => {
    const entries = { b: 2, a: 1 }
    expect(sortKeys(entries)).toBe(entries)
    expect(entries).toEqual({ a: 1, b: 2 })
    expect(sortKeys(undefined)).toBeUndefined()
  })
})

type Rendered = (context: { ssrContext?: { payload?: { data?: Record<string, unknown>, state?: Record<string, unknown> } } }) => void

async function renderedHook(): Promise<Rendered> {
  let registered: Rendered | undefined
  vi.stubGlobal('defineNuxtPlugin', (plugin: unknown) => plugin)
  vi.resetModules()
  const plugin = (await import('../app/plugins/payload-order.server')).default as unknown as { setup: (nuxtApp: unknown) => void }
  plugin.setup({
    hooks: {
      hook: (name: string, callback: Rendered): void => {
        if (name === 'app:rendered') registered = callback
      },
    },
  })
  return registered!
}

describe('the payload order plugin', () => {
  it('sorts the data and the state of the payload when the page has rendered, whichever call finished first', async () => {
    const run = await renderedHook()
    const payload = { data: { 'site-en': 1, 'draft-page-doc-en': 2, 'categories-en': 3 }, state: { 'b-state': 1, 'a-state': 2 } }
    run({ ssrContext: { payload } })
    expect(Object.keys(payload.data)).toEqual(['categories-en', 'draft-page-doc-en', 'site-en'])
    expect(Object.keys(payload.state)).toEqual(['a-state', 'b-state'])
    expect(payload.data['site-en']).toBe(1)
  })

  it('leaves a render with no payload alone', async () => {
    const run = await renderedHook()
    expect(() => run({})).not.toThrow()
    expect(() => run({ ssrContext: { payload: {} } })).not.toThrow()
  })
})
