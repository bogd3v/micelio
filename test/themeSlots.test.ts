import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SLOT_NAMES } from '../modules/theme/data'
import { resolveSlots, slotStyles } from '../modules/theme/slots'

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'myc-slots-'))
}

function slotsDir(dir: string, files: string[]): void {
  mkdirSync(join(dir, 'slots'), { recursive: true })
  for (const file of files) writeFileSync(join(dir, 'slots', file), '')
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
