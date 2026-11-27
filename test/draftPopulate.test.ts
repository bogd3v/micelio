import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DRAFT_PAGE_POPULATE, PAGE_POPULATE } from '../server/lib/constants'

// The components of the `sections` zone of the page, read from micelio-cms `src/api/page/content-types/page/schema.ts` (tag v0.8.0, `shared.rich-text` since micelio-cms #502 and `section.reusable` since micelio-cms #527)
const SECTIONS_ZONE = [
  'section.hero',
  'section.feature-grid',
  'section.media-showcase',
  'section.stats',
  'section.logo-cloud',
  'section.testimonials',
  'section.pricing',
  'section.faq',
  'section.cta',
  'section.post-list',
  'section.newsletter',
  'section.rich-text',
  'section.gallery',
  'section.scene',
  'shared.rich-text',
  'section.reusable',
]

// The components of that zone that carry the optional `group` key (micelio-cms #527, `a966bd46`): every block of the catalogue and the reference, but the two text components
const GROUPED = [
  'section.hero',
  'section.feature-grid',
  'section.media-showcase',
  'section.stats',
  'section.logo-cloud',
  'section.testimonials',
  'section.pricing',
  'section.faq',
  'section.cta',
  'section.post-list',
  'section.newsletter',
  'section.gallery',
  'section.scene',
  'section.reusable',
]

describe('the page draft populate', () => {
  it('the populate of a page draft names only components of the page sections zone', () => {
    const named = Object.keys(DRAFT_PAGE_POPULATE.sections.on)
    expect(named.filter(component => !SECTIONS_ZONE.includes(component))).toEqual([])
    expect(named).not.toContain('shared.playground')
  })

  it('the populate of a page names both Markdown components, section.rich-text and shared.rich-text', () => {
    expect(Object.keys(PAGE_POPULATE.sections.on)).toEqual(expect.arrayContaining(['section.rich-text', 'shared.rich-text']))
    expect(Object.keys(DRAFT_PAGE_POPULATE.sections.on)).toContain('shared.rich-text')
  })

  it('the page populate asks for group on each section that has it, and for the reference\'s document id only', () => {
    const fragments = PAGE_POPULATE.sections.on as Record<string, unknown>
    const asksForGroup = (name: string): boolean => (fragments[name] as { populate?: Record<string, unknown> } | undefined)?.populate?.group === true
    expect(GROUPED.filter(name => !asksForGroup(name))).toEqual([])
    // The two text components have no `group`, and a fragment that names one the component lacks is a 400
    expect(Object.keys(fragments).filter(name => !GROUPED.includes(name) && asksForGroup(name))).toEqual([])
    // The relation is reduced to the target's document id: the target itself is read apart, published and in the page's locale
    expect(PAGE_POPULATE.sections.on['section.reusable']).toEqual({ populate: { group: true, reusableBlock: { fields: ['documentId'] } } })
    expect(DRAFT_PAGE_POPULATE.sections.on['section.reusable']).toEqual(PAGE_POPULATE.sections.on['section.reusable'])
  })

  it('the grant and the editor session ask for the same page populate', () => {
    const source = readFileSync('server/api/drafts/pages/[documentId].get.ts', 'utf8')
    // Both branches name the one constant, and neither builds a populate of its own
    expect(source.match(/populate: DRAFT_PAGE_POPULATE/g)).toHaveLength(2)
    expect(source.match(/populate:/g)).toHaveLength(2)
  })
})
