import { describe, expect, it, vi } from 'vitest'

type Hook = (html: { bodyPrepend: string[] }, context: { event: { context: Record<string, unknown> } }) => Promise<void>

async function hook(): Promise<Hook> {
  let registered: Hook | undefined
  vi.stubGlobal('defineNitroPlugin', (plugin: (app: unknown) => void) => plugin)
  vi.resetModules()
  const plugin = (await import('../server/plugins/iconSprite')).default as unknown as (app: unknown) => void
  plugin({ hooks: { hook: (_name: string, callback: Hook) => (registered = callback) } })
  return registered!
}

describe('the icon sprite plugin', () => {
  const theme = { entry: { files: new Map() } }

  it('leaves a page that used no icon byte for byte as it was', async () => {
    const run = await hook()
    for (const context of [{}, { iconSprite: new Map() }]) {
      const html = { bodyPrepend: ['<a>skip</a>'] }
      await run(html, { event: { context: { ...context, activeTheme: theme } } })
      expect(html.bodyPrepend).toEqual(['<a>skip</a>'])
    }
  })

  it('puts the sprite of the used names at the start of the body', async () => {
    const run = await hook()
    const html = { bodyPrepend: ['<a>skip</a>'] }
    await run(html, { event: { context: { activeTheme: theme, iconSprite: new Map([['myc-i-star', { name: 'star', style: 'outline' }]]) } } })
    expect(html.bodyPrepend).toHaveLength(2)
    expect(html.bodyPrepend[0]).toMatch(/^<svg [^>]*id="myc-icons"[^>]*><symbol id="myc-i-star"/)
    expect(html.bodyPrepend[1]).toBe('<a>skip</a>')
  })
})
