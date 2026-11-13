import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DRAFT_PAGE_POPULATE } from '../server/lib/constants'

// The components of the `sections` zone of the page, read from micelio-cms 0.8.0 (`src/api/page/content-types/page/schema.ts`, tag v0.8.0)
const SECTIONS_ZONE_0_8_0 = [
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
]

describe('the page draft populate', () => {
  it('the populate of a page draft names only components of the page sections zone', () => {
    const named = Object.keys(DRAFT_PAGE_POPULATE.sections.on)
    expect(named.filter(component => !SECTIONS_ZONE_0_8_0.includes(component))).toEqual([])
    expect(named).not.toContain('shared.playground')
  })

  it('the grant and the editor session ask for the same page populate', () => {
    const source = readFileSync('server/api/drafts/pages/[documentId].get.ts', 'utf8')
    // Both branches name the one constant, and neither builds a populate of its own
    expect(source.match(/populate: DRAFT_PAGE_POPULATE/g)).toHaveLength(2)
    expect(source.match(/populate:/g)).toHaveLength(2)
  })
})
