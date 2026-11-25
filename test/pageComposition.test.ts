import { describe, expect, it } from 'vitest'
import { PAGE_SECTION_COMPONENTS } from '../app/interfaces'
import type { Page } from '../app/interfaces'
import { knownSections } from '../app/helpers/pages'
import { sectionAnchors } from '../app/helpers/landing'
import { pageSchema, pageSectionSchema } from '../app/schemas/pages'
import { parsePage, parseSection } from '../server/schemas/page'
import { pageFixtures } from '../e2e/fixtures/pages.mjs'

// Page composition (ADR-0022): the `group` key of a page section and the `reusable` block, as the plugin's content API answers them
const context = { render: (markdown: string): string => `<p>${markdown}</p>`, siteUrl: 'https://notes.example.com', mediaOrigins: [] }
const image = { id: 1, url: '/uploads/a.png', alternativeText: 'A', width: 800, height: 600, mime: 'image/png' }
// What the route sends: JSON, in which a key set to `undefined` is absent
const send = (value: unknown): unknown => JSON.parse(JSON.stringify(value))
const group = { id: 4, groupId: 'band-1', tone: 'accent' }

// The least each section that may carry a group needs, as Strapi sends it
const MEMBERS: Record<string, Record<string, unknown>> = {
  'section.hero': { variant: 'centered', title: 'T' },
  'section.feature-grid': { variant: 'grid', items: [{ title: 'A' }] },
  'section.media-showcase': { variant: 'left', media: image },
  'section.stats': { variant: 'row', items: [{ value: '1', label: 'a' }] },
  'section.logo-cloud': { variant: 'row', logos: [{ image, name: 'A' }] },
  'section.testimonials': { variant: 'grid', items: [{ quote: 'Q', author: 'A' }] },
  'section.pricing': { variant: 'cards', plans: [{ name: 'A', price: '$1' }] },
  'section.faq': { variant: 'list', items: [{ question: 'Q', answer: 'A' }] },
  'section.cta': { variant: 'card', title: 'T' },
  'section.post-list': { variant: 'cards', count: 1 },
  'section.newsletter': { variant: 'card' },
  'section.gallery': { variant: 'grid', images: [image] },
  'section.scene': { variant: 'inline', model: { ...image, url: '/uploads/m.glb' }, poster: image, alt: 'A' },
  'section.reusable': { reusableBlock: { id: 9, documentId: 'reusable-a' } },
}

function parsed(component: string, overrides: Record<string, unknown> = {}): { group?: unknown } {
  const section = parseSection({ id: 1, __component: component, ...MEMBERS[component], ...overrides }, context)
  expect(section, component).not.toBeNull()
  return section as { group?: unknown }
}

describe('the group key of a page section', () => {
  it('is kept, as its groupId and tone, by the thirteen sections that offer it and by reusable', () => {
    expect(Object.keys(MEMBERS)).toHaveLength(14)
    for (const component of Object.keys(MEMBERS)) expect(parsed(component, { group }).group, component).toEqual({ groupId: 'band-1', tone: 'accent' })
  })

  it('is optional: Strapi sends null for a block that is in no group, and a block stored before it has none', () => {
    for (const component of Object.keys(MEMBERS)) {
      expect(parsed(component, { group: null }).group, component).toBeUndefined()
      expect(parsed(component, { group: undefined }).group, component).toBeUndefined()
    }
  })

  it('drops the key alone when it has no groupId or a tone the contract does not know, and the block stays', () => {
    for (const component of Object.keys(MEMBERS)) {
      for (const bad of [{ groupId: '', tone: 'accent' }, { groupId: '  ', tone: 'accent' }, { tone: 'accent' }, { groupId: 'a', tone: 'loud' }, { groupId: 'a', tone: null }, { groupId: 'a' }, 'a', 7]) {
        expect(parsed(component, { group: bad }).group, `${component} ${JSON.stringify(bad)}`).toBeUndefined()
      }
    }
  })

  it('takes every value of the tone option, with no default', () => {
    for (const tone of ['default', 'raised', 'accent']) expect(parsed('section.cta', { group: { groupId: 'a', tone } }).group).toEqual({ groupId: 'a', tone })
  })

  it('is not read on the Markdown blocks, which take none', () => {
    for (const component of ['section.rich-text', 'shared.rich-text']) {
      const section = parseSection({ id: 1, __component: component, body: 'Text', group }, context)
      expect(section, component).not.toBeNull()
      expect((section as { group?: unknown }).group, component).toBeUndefined()
      expect(section, component).not.toHaveProperty('group')
    }
  })

  it('is kept as the groups of a page when a page is parsed: the members stay in order, flat', () => {
    const page = parsePage({
      documentId: 'p',
      title: 'P',
      slug: 'p',
      sections: [
        { __component: 'section.hero', ...MEMBERS['section.hero'], group },
        { __component: 'section.reusable', ...MEMBERS['section.reusable'], group },
        { __component: 'section.cta', ...MEMBERS['section.cta'], group: null },
      ],
    }, context)
    expect(page?.sections.map(section => [section.__component, 'group' in section ? section.group?.groupId : undefined])).toEqual([
      ['section.hero', 'band-1'],
      ['section.reusable', 'band-1'],
      ['section.cta', undefined],
    ])
  })
})

describe('the reusable block', () => {
  it('keeps its blockId and the document id of the block it references, and nothing else of the relation', () => {
    expect(send(parseSection({ id: 3, __component: 'section.reusable', blockId: 'p-b3', reusableBlock: { id: 9, documentId: 'reusable-a', name: 'Internal', blocks: [{ __component: 'section.cta' }] } }, context)))
      .toEqual({ __component: 'section.reusable', blockId: 'p-b3', reusableBlock: { documentId: 'reusable-a' } })
  })

  it('stays with no relation when it is empty or not populated, and drops a relation without a document id alone', () => {
    for (const reusableBlock of [null, undefined, {}, { id: 9 }, { documentId: '' }, 'reusable-a']) {
      expect(send(parseSection({ id: 3, __component: 'section.reusable', reusableBlock }, context)), JSON.stringify(reusableBlock)).toEqual({ __component: 'section.reusable' })
    }
  })

  it('has no presentation options: tone and align stored on it are not read', () => {
    expect(send(parseSection({ id: 3, __component: 'section.reusable', reusableBlock: { documentId: 'reusable-a' }, tone: 'accent', align: 'center', variant: 'card' }, context)))
      .toEqual({ __component: 'section.reusable', reusableBlock: { documentId: 'reusable-a' } })
  })

  it('is not one of the sections the renderer draws: it has no data-section of its own, so it is not in PAGE_SECTION_COMPONENTS', () => {
    expect(PAGE_SECTION_COMPONENTS as readonly string[]).not.toContain('reusable')
    const reusable = parsed('section.reusable') as { __component: string }
    const cta = parsed('section.cta') as { __component: string }
    expect(knownSections([reusable, cta])).toEqual([cta])
    // What `SectionRenderer` draws is `knownSections` of the page: the sections around a reference stay in order, and a page of references alone draws nothing
    expect(knownSections([cta, reusable, cta])).toEqual([cta, cta])
    expect(knownSections([reusable])).toEqual([])
  })

  it('has no anchor in the landing navigation', () => {
    const reusable = parsed('section.reusable') as never
    expect(sectionAnchors([reusable], { newsletterOn: true, blogEnabled: true })).toEqual([])
  })
})

describe('the response schema of a page with groups and references', () => {
  it('accepts the fixture page of the mock Strapi as parsePage builds it, group and reusable included', () => {
    const fixture = pageFixtures.find(candidate => candidate.slug === 'composition')
    if (!fixture) throw new Error('the composition fixture is missing')
    const page = parsePage(fixture, context) as Page
    expect(page.sections.map(section => section.__component)).toEqual(['section.hero', 'section.stats', 'section.reusable', 'section.cta', 'section.reusable', 'section.reusable'])
    expect(pageSchema.parse(send(page)).sections.map(section => 'group' in section ? section.group?.groupId : undefined)).toEqual(['band-1', 'band-1', 'band-1', undefined, undefined, undefined])
  })

  it('refuses a group that is not a groupId and a tone, and a key the server never sends', () => {
    const reusable = { __component: 'section.reusable', reusableBlock: { documentId: 'a' } }
    expect(pageSectionSchema.safeParse({ ...reusable, group: { groupId: 'a', tone: 'accent' } }).success).toBe(true)
    for (const bad of [{ groupId: 'a' }, { groupId: 'a', tone: 'loud' }, { groupId: 'a', tone: 'accent', id: 4 }, { tone: 'accent' }]) {
      expect(pageSectionSchema.safeParse({ ...reusable, group: bad }).success, JSON.stringify(bad)).toBe(false)
    }
    expect(pageSectionSchema.safeParse({ ...reusable, reusableBlock: { documentId: 'a', id: 9 } }).success).toBe(false)
    expect(pageSectionSchema.safeParse({ ...reusable, tone: 'accent' }).success).toBe(false)
  })
})
