import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SLOT_NAMES } from '../modules/theme/data'
import { resolveSlots, slotStyles, validateSlots } from '../modules/theme/slots'
import type { ThemeManifest } from '../modules/theme/themes'

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'bd-slots-'))
}

function slotsDir(dir: string, files: string[]): void {
  mkdirSync(join(dir, 'slots'), { recursive: true })
  for (const file of files) writeFileSync(join(dir, 'slots', file), '')
}

function manifest(slots: object): ThemeManifest {
  return { id: 'sample', contract: 1, fonts: [], modes: [], slots } as unknown as ThemeManifest
}

describe('slot resolution', () => {
  it('uses the core default for every slot a theme does not ship', () => {
    const dir = tmp()
    const resolved = resolveSlots(dir, '/core/defaults')
    expect(resolved.map(slot => slot.name)).toEqual([...SLOT_NAMES])
    expect(resolved.every(slot => slot.filePath === join('/core/defaults', `${slot.name}.vue`))).toBe(true)
  })

  it('prefers the theme file for the slots it ships', () => {
    const dir = tmp()
    slotsDir(dir, ['ThemeMark.vue', 'ThemeHero.vue'])
    const byName = Object.fromEntries(resolveSlots(dir, '/core/defaults').map(slot => [slot.name, slot.filePath]))
    expect(byName.ThemeMark).toBe(join(dir, 'slots', 'ThemeMark.vue'))
    expect(byName.ThemeHero).toBe(join(dir, 'slots', 'ThemeHero.vue'))
    expect(byName.ThemeDivider).toBe(join('/core/defaults', 'ThemeDivider.vue'))
  })

  it('imports the theme slot stylesheets in a fixed order', () => {
    const dir = tmp()
    expect(slotStyles(dir)).toBe('')
    slotsDir(dir, ['mark.css', 'divider.css', 'ThemeMark.vue', 'logo.ts'])
    expect(slotStyles(dir)).toBe(`@import "${join(dir, 'slots', 'divider.css')}";\n@import "${join(dir, 'slots', 'mark.css')}";`)
  })
})

describe('slot validation', () => {
  it('accepts the known slots with a boolean island', () => {
    const dir = tmp()
    slotsDir(dir, ['ThemeMark.vue'])
    expect(() => validateSlots(manifest({ ThemeDivider: { island: true }, ThemeMark: {} }), dir)).not.toThrow()
  })

  it('rejects a slot outside the list, in theme.json or in slots/', () => {
    const dir = tmp()
    expect(() => validateSlots(manifest({ ThemeFooter: {} }), dir)).toThrow(/"ThemeFooter".*not one of/)
    slotsDir(dir, ['ThemeFooter.vue'])
    expect(() => validateSlots(manifest({}), dir)).toThrow(/slots\/ThemeFooter\.vue is not a slot/)
  })

  it('rejects slot options that are not a plain object', () => {
    for (const options of [true, null, 'island', ['island']]) {
      expect(() => validateSlots(manifest({ ThemeDivider: options }), tmp())).toThrow(/Theme "sample": slots\.ThemeDivider must be an object/)
    }
  })

  it('rejects an island that is not a boolean', () => {
    expect(() => validateSlots(manifest({ ThemeDivider: { island: 'yes' } }), tmp())).toThrow(/slots\.ThemeDivider\.island/)
  })
})
