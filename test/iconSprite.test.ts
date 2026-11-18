import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuiltInTheme } from '../server/lib/types'
import { iconSymbol } from '../app/helpers/icons'
import { iconSources, resetReportedIcons, spriteFor, withIconSymbols } from '../server/utils/iconSprite'

const THEME_LEAF = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 1"/></svg>'

function themeWith(files: Record<string, string>): BuiltInTheme {
  return { entry: { manifest: {}, files: new Map(Object.entries(files).map(([path, text]) => [path, Buffer.from(text)])) }, runtime: {} } as unknown as BuiltInTheme
}

describe('spriteFor', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  beforeEach(() => {
    resetReportedIcons()
    warn.mockClear()
  })
  afterEach(() => resetReportedIcons())

  it('draws the core\'s glyph for a name, outline and filled, and each symbol once', async () => {
    const sprite = await spriteFor([{ name: 'heart', style: 'outline' }, { name: 'heart', style: 'filled' }, { name: 'heart', style: 'outline' }], iconSources())
    expect(sprite.match(/<symbol /g)).toHaveLength(2)
    expect(sprite).toContain('<symbol id="myc-i-heart" viewBox="0 0 24 24" fill="none" stroke="currentColor"')
    expect(sprite).toContain('<symbol id="myc-i-heart-filled" viewBox="0 0 24 24" fill="currentColor"')
  })

  it('falls back to outline in the filled symbol of a name with no filled alternate', async () => {
    const sprite = await spriteFor([{ name: 'abacus', style: 'filled' }], iconSources())
    expect(sprite).toContain('<symbol id="myc-i-abacus-filled" viewBox="0 0 24 24" fill="none" stroke="currentColor"')
  })

  it('prefers the active theme\'s icons/<name>.svg over the core\'s', async () => {
    const sprite = await spriteFor([{ name: 'leaf', style: 'outline' }, { name: 'heart', style: 'outline' }], iconSources(themeWith({ 'icons/leaf.svg': THEME_LEAF })))
    expect(sprite).toContain('<symbol id="myc-i-leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 1"/></symbol>')
    expect(sprite).toContain('id="myc-i-heart"')
  })

  it('leaves out a theme glyph that is not a glyph, and reports it', async () => {
    const sprite = await spriteFor([{ name: 'leaf', style: 'outline' }], iconSources(themeWith({ 'icons/leaf.svg': '<svg viewBox="0 0 24 24"><script>alert(1)</script></svg>' })))
    expect(sprite).toBe('')
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('is empty for no request and for names that resolve to nothing, logging each unknown name once', async () => {
    expect(await spriteFor([], iconSources())).toBe('')
    expect(await spriteFor([{ name: 'no-such-icon', style: 'outline' }], iconSources())).toBe('')
    expect(await spriteFor([{ name: 'no-such-icon', style: 'filled' }, { name: 'no-such-icon', style: 'outline' }], iconSources())).toBe('')
    expect(warn).toHaveBeenCalledTimes(1)
    const line = JSON.parse(String(warn.mock.calls[0]?.[0]))
    expect(line).toMatchObject({ level: 'warn', event: 'icons.unknown', cause: 'no-such-icon' })
    await spriteFor([{ name: 'other-missing', style: 'outline' }], iconSources())
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('never writes a value that is not a name into the log', async () => {
    await spriteFor([{ name: '../etc/passwd\n{"forged":1}', style: 'outline' }], iconSources())
    const line = JSON.parse(String(warn.mock.calls[0]?.[0]))
    expect(line.cause).toBe('invalid name')
  })

  it('leaves the page up when a glyph cannot be read, and logs the first failure only', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const broken = { core: () => Promise.reject(Object.assign(new Error('ENOENT: /srv/glyphs/outline/star.svg'), { code: 'ENOENT' })) }
    expect(await spriteFor([{ name: 'star', style: 'outline' }, { name: 'leaf', style: 'outline' }], broken)).toBe('')
    expect(error).toHaveBeenCalledTimes(1)
    expect(JSON.parse(String(error.mock.calls[0]?.[0]))).toMatchObject({ level: 'error', event: 'icons.read' })
    expect(String(error.mock.calls[0]?.[0])).not.toContain('/srv/glyphs')
    expect(warn).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('keeps the rest of the sprite when one name is unknown', async () => {
    const sprite = await spriteFor([{ name: 'no-such-icon', style: 'outline' }, { name: 'star', style: 'outline' }], iconSources())
    expect(sprite).toContain('id="myc-i-star"')
    expect(sprite).not.toContain('no-such-icon')
  })
})

describe('the core\'s set', () => {
  it('is made only of glyphs the sprite accepts', () => {
    const root = join(dirname(createRequire(import.meta.url).resolve('@micelio/icons/package.json')), 'glyphs')
    let count = 0
    for (const style of ['outline', 'filled']) {
      for (const file of readdirSync(join(root, style))) {
        expect(iconSymbol('myc-i-x', readFileSync(join(root, style, file), 'utf8')), `${style}/${file}`).toBeDefined()
        count++
      }
    }
    expect(count).toBeGreaterThan(6000)
  })
})

describe('withIconSymbols', () => {
  const event = { context: { activeTheme: themeWith({}) } } as unknown as Parameters<typeof withIconSymbols>[1]

  it('adds the symbols of the icons a response uses, and nothing else', async () => {
    const body = { title: 'Page', sections: [{ icon: 'heart' }, { icon: 'heart', iconStyle: 'filled' }, { icon: 'leaf' }] }
    const sent = await withIconSymbols(body, event)
    expect(Object.keys(sent.iconSymbols ?? {}).sort()).toEqual(['myc-i-heart', 'myc-i-heart-filled', 'myc-i-leaf'])
    expect(sent.iconSymbols?.['myc-i-leaf']).toMatch(/^<symbol id="myc-i-leaf" viewBox="0 0 24 24"/)
    expect(sent.title).toBe('Page')
  })

  it('answers the very response it was given when it uses no icon, or when none resolves', async () => {
    const plain = { title: 'Page', sections: [{ label: 'a' }] }
    expect(await withIconSymbols(plain, event)).toBe(plain)
    const unknown = { sections: [{ icon: 'no-such-icon' }] }
    expect(await withIconSymbols(unknown, event)).toBe(unknown)
  })

  it('draws a name from the theme of the request first', async () => {
    const themed = { context: { activeTheme: themeWith({ 'icons/leaf.svg': THEME_LEAF }) } } as unknown as Parameters<typeof withIconSymbols>[1]
    const sent = await withIconSymbols({ icon: 'leaf' }, themed)
    expect(sent.iconSymbols?.['myc-i-leaf']).toContain('<path d="M1 1"/>')
  })
})
