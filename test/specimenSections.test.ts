import { describe, expect, it } from 'vitest'
import hooks from '../app/theme/hooks.json'
import { PAGE_SECTION_COMPONENTS } from '../app/interfaces/page'
import { PAGE_SECTIONS } from '../modules/theme/specimen/fixtures'
import en from '../modules/theme/specimen/locales/en.json'
import es from '../modules/theme/specimen/locales/es.json'

// "hero: centered, split, full-bleed" -> { hero: ['centered', 'split', 'full-bleed'] }
function declaredVariants(): Record<string, string[]> {
  const entry = hooks.attributes['data-variant'] as { values: string[] }
  return Object.fromEntries(entry.values.map((value) => {
    const [kind, list] = value.split(': ') as [string, string]
    return [kind, list.split(', ')]
  }))
}

describe('the /_theme page sections', () => {
  const kinds = (hooks.attributes['data-section'] as { values: string[] }).values
  const variants = declaredVariants()

  it('shows every section of data-section in hooks.json', () => {
    expect([...new Set(PAGE_SECTIONS.map(entry => entry.kind))].sort()).toEqual([...kinds].sort())
    expect([...PAGE_SECTION_COMPONENTS].sort()).toEqual([...kinds].sort())
  })

  it('shows every variant of data-variant in hooks.json once, and rich-text without one', () => {
    for (const kind of kinds) {
      const shown = PAGE_SECTIONS.filter(entry => entry.kind === kind).map(entry => entry.variant)
      expect(shown.sort(), kind).toEqual((variants[kind] ?? ['']).sort())
    }
  })

  it('renders each fixture with the section and variant it is listed under', () => {
    for (const entry of PAGE_SECTIONS) {
      expect(entry.section.__component).toBe(`section.${entry.kind}`)
      expect('variant' in entry.section ? entry.section.variant : '').toBe(entry.variant)
    }
  })

  it('has a title per section in both locales (the group ids are `page-<kind>`, see sections.ts)', () => {
    for (const kind of kinds) {
      expect((en.specimen.pageSections.kinds as Record<string, string>)[kind], kind).toBeTruthy()
      expect((es.specimen.pageSections.kinds as Record<string, string>)[kind], kind).toBeTruthy()
    }
  })
})
