import qs from 'qs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { heroLeadsPage, knownSections } from '~/helpers/pages'
import { PAGE_SLUG_PATTERN } from '~/constants/pages'
import type { PageSection } from '~/interfaces'

const hero = { __component: 'section.hero', variant: 'centered', title: 'Hi' } as PageSection
const cta = { __component: 'section.cta', variant: 'banner', title: 'Go' } as PageSection
const unknown = { __component: 'section.carousel' } as unknown as PageSection

describe('page sections', () => {
  it('skips unknown components', () => {
    expect(knownSections([unknown, cta])).toEqual([cta])
    expect(knownSections(null)).toEqual([])
  })

  it('keeps the prose block of the catalogue among the known sections', () => {
    const prose = { __component: 'shared.rich-text', html: '<p>x</p>' } as const
    expect(knownSections([unknown, prose, cta])).toEqual([prose, cta])
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

describe('the published page', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('the published render never shows a reusable block\'s draft', async () => {
    // A reference whose relation carries a block, as the answer to a grant bound to a reference does (ADR 0019, amendment of 2026-11-23)
    const draftBlock = { __component: 'section.cta', variant: 'banner', title: 'The block\'s draft' }
    const page = { documentId: 'page-1', title: 'Home', slug: 'home', sections: [{ __component: 'section.reusable', blockId: 'b1', reusableBlock: { documentId: 'reusable-a', blocks: [draftBlock] } }] }
    const strapiFetch = vi.fn(async () => ({ data: [page] }))
    vi.stubGlobal('strapiFetch', strapiFetch)
    vi.stubGlobal('logError', vi.fn())
    vi.stubGlobal('defineCachedFunction', (fetch: unknown) => fetch)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { siteUrl: 'https://notes.example.com', strapiUrl: 'https://cms.example.com' }, mediaUrl: '' }))
    vi.stubGlobal('markdownRenderer', () => ({ renderMarkdown: (markdown: string) => `<p>${markdown}</p>` }))
    const { loadPage } = await import('../server/utils/pageSections')
    const loaded = await loadPage('home', 'en')
    // The reference keeps only the document id of its target: the block's draft is never drawn on the page a visitor gets
    expect(loaded?.sections).toEqual([{ __component: 'section.reusable', blockId: 'b1', reusableBlock: { documentId: 'reusable-a' } }])
    expect(JSON.stringify(loaded)).not.toContain('The block\'s draft')
    // Nor is it asked for: the page's populate reduces the relation to the target's document id, and the target is read published
    const [path] = strapiFetch.mock.calls[0] as unknown as [string]
    const query = qs.parse(path.split('?')[1]!, { depth: 20 }) as { populate: { sections: { on: Record<string, unknown> } } }
    expect(query.populate.sections.on['section.reusable']).toEqual({ populate: { group: 'true', reusableBlock: { fields: ['documentId'] } } })
  })
})
