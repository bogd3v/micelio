import { describe, expect, it } from 'vitest'
import { heroLeadsPage, knownSections, PAGE_SLUG_PATTERN } from '~/helpers/pages'
import type { PageSection } from '~/interfaces'

const hero = { __component: 'section.hero', variant: 'centered', title: 'Hi' } as PageSection
const cta = { __component: 'section.cta', variant: 'banner', title: 'Go' } as PageSection
const unknown = { __component: 'section.carousel' } as unknown as PageSection

describe('page sections', () => {
  it('skips unknown components', () => {
    expect(knownSections([unknown, cta])).toEqual([cta])
    expect(knownSections(null)).toEqual([])
  })

  it('lets a hero lead only when it is the first known section', () => {
    expect(heroLeadsPage([hero, cta])).toBe(true)
    expect(heroLeadsPage([unknown, hero])).toBe(true)
    expect(heroLeadsPage([cta, hero])).toBe(false)
    expect(heroLeadsPage([])).toBe(false)
  })

  it('accepts uids and rejects the rest', () => {
    expect(PAGE_SLUG_PATTERN.test('muestra')).toBe(true)
    expect(PAGE_SLUG_PATTERN.test('Showcase')).toBe(false)
  })
})
