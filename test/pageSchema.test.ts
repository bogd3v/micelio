import { describe, expect, it } from 'vitest'
import { PAGE_SECTION_COMPONENTS } from '../app/interfaces'
import { pageParamsSchema, parsePage, parseSection } from '../server/schemas/page'

const render = (markdown: string): string => `<p>${markdown}</p>`
const image = { id: 1, url: '/uploads/a.png', alternativeText: null, width: 800, height: 600, mime: 'image/png', formats: { thumbnail: {} } }
const link = { id: 2, label: 'Read', url: '/blog' }

// One valid section per component of the catalog, as Strapi sends them (nulls included)
const valid: Record<string, Record<string, unknown>> = {
  'section.hero': { variant: 'split', title: 'Hi', text: null, primaryLink: link, secondaryLink: null, media: image },
  'section.feature-grid': { variant: 'bento', title: null, items: [{ icon: image, title: 'One', text: 'x' }] },
  'section.media-showcase': { variant: 'stacked', text: 'Some **text**', media: image, link },
  'section.stats': { variant: 'cards', items: [{ value: '4 h', label: 'sun' }] },
  'section.logo-cloud': { variant: 'marquee', logos: [{ image, name: 'Seeds', url: 'https://seeds.test' }] },
  'section.testimonials': { variant: 'grid', items: [{ quote: 'Nice', author: 'Sam', role: null, avatar: null }] },
  'section.pricing': { variant: 'table', plans: [{ name: 'Starter', price: '$5', features: 'A\n\n B ', recommended: null, link }] },
  'section.faq': { variant: 'two-columns', items: [{ question: 'Q?', answer: 'A.' }] },
  'section.cta': { variant: 'card', title: 'Go', primaryLink: link },
  'section.post-list': { variant: 'list', category: { slug: 'linux' }, tag: null, count: 5 },
  'section.newsletter': { variant: 'card', buttonLabel: 'Subscribe' },
  'section.rich-text': { body: '## About' },
  'section.gallery': { variant: 'masonry', images: [image, image] },
  'section.scene': { variant: 'inline', model: { ...image, url: '/uploads/model.glb', mime: 'model/gltf-binary' }, poster: image, alt: 'A triangle' },
}

// For each component, a change that makes the section invalid
const invalid: Record<string, Record<string, unknown>> = {
  'section.hero': { title: '' },
  'section.feature-grid': { items: [{ icon: image }] },
  'section.media-showcase': { media: null },
  'section.stats': { items: [] },
  'section.logo-cloud': { logos: [{ name: 'No image' }] },
  'section.testimonials': { items: [{ quote: 'No author' }] },
  'section.pricing': { plans: null },
  'section.faq': { items: [{ question: 'No answer' }] },
  'section.cta': { title: null },
  'section.post-list': { variant: 'carousel' },
  'section.newsletter': { variant: 'popup' },
  'section.rich-text': { body: '   ' },
  'section.gallery': { images: [] },
  'section.scene': { model: { ...image, url: '/uploads/model.png' } },
}

function section(component: string, overrides: Record<string, unknown> = {}): unknown {
  return { id: 9, __component: component, ...valid[component], ...overrides }
}

describe('parseSection', () => {
  it('has a case for every component of the catalog', () => {
    expect(Object.keys(valid)).toEqual(PAGE_SECTION_COMPONENTS.map(name => `section.${name}`))
    expect(Object.keys(invalid)).toEqual(Object.keys(valid))
  })

  it.each(Object.keys(valid))('accepts a valid %s', (component) => {
    expect(parseSection(section(component), render)?.__component).toBe(component)
  })

  it.each(Object.keys(invalid))('rejects an invalid %s', (component) => {
    expect(parseSection(section(component, invalid[component]), render)).toBeNull()
  })

  it('drops unknown components, prototype keys and non-objects', () => {
    for (const raw of [{ __component: 'section.carousel' }, { __component: 'shared.rich-text' }, { __component: 'constructor' }, { __component: 'toString' }, {}, null, 'hero', 7]) {
      expect(parseSection(raw, render)).toBeNull()
    }
  })

  it('defaults a missing variant and rejects an unknown one', () => {
    expect(parseSection(section('section.hero', { variant: undefined }), render)).toMatchObject({ variant: 'centered' })
    expect(parseSection(section('section.hero', { variant: null }), render)).toMatchObject({ variant: 'centered' })
    expect(parseSection(section('section.hero', { variant: 'wide' }), render)).toBeNull()
  })

  it('normalizes media and drops what Strapi adds', () => {
    expect(parseSection(section('section.hero'), render)).toMatchObject({
      media: { url: '/uploads/a.png', width: 800, height: 600, mime: 'image/png' },
    })
    const hero = parseSection(section('section.hero'), render) as { media: Record<string, unknown>, id?: number, text?: string }
    expect(hero.media).not.toHaveProperty('formats')
    expect(hero.media.alternativeText).toBeUndefined()
    expect(hero).not.toHaveProperty('id')
    expect(hero.text).toBeUndefined()
  })

  it('drops an invalid optional field alone, not the section', () => {
    const hero = parseSection(section('section.hero', {
      primaryLink: { label: 'Bad', url: 'javascript:alert(1)' },
      secondaryLink: { label: 'Protocol relative', url: '//evil.test' },
      media: { url: 'data:image/png;base64,AA' },
    }), render)
    expect(hero).toMatchObject({ title: 'Hi' })
    expect(JSON.parse(JSON.stringify(hero))).toEqual({ __component: 'section.hero', variant: 'split', title: 'Hi' })
  })

  it('accepts http(s), mailto and site-path links', () => {
    for (const url of ['https://a.test/x', 'http://a.test', 'mailto:hi@a.test', '/', '/es/blog']) {
      expect(parseSection(section('section.cta', { primaryLink: { label: 'L', url } }), render)).toMatchObject({ primaryLink: { url } })
    }
  })

  it('keeps only http(s) logo links', () => {
    const logos = [{ image, name: 'A', url: '/internal' }]
    const cloud = parseSection(section('section.logo-cloud', { logos }), render) as { logos: Array<{ name: string, url?: string }> }
    expect(cloud.logos[0]).toMatchObject({ name: 'A' })
    expect(cloud.logos[0]!.url).toBeUndefined()
  })

  it('drops invalid items one by one', () => {
    const stats = parseSection(section('section.stats', { items: [{ value: '1' }, { value: '2', label: 'two' }] }), render)
    expect(stats).toMatchObject({ items: [{ value: '2', label: 'two' }] })
  })

  it('renders Markdown to HTML on the server', () => {
    expect(parseSection(section('section.rich-text'), render)).toEqual({ __component: 'section.rich-text', html: '<p>## About</p>' })
    expect(parseSection(section('section.media-showcase'), render)).toMatchObject({ html: '<p>Some **text**</p>' })
    expect(parseSection(section('section.faq'), render)).toMatchObject({ items: [{ question: 'Q?', html: '<p>A.</p>' }] })
  })

  it('splits plan features by line', () => {
    expect(parseSection(section('section.pricing'), render)).toMatchObject({ plans: [{ features: ['A', 'B'], recommended: false }] })
  })

  it('clamps the post list count and keeps one filter', () => {
    expect(parseSection(section('section.post-list', { count: 99 }), render)).toMatchObject({ count: 12, category: 'linux', posts: [] })
    expect(parseSection(section('section.post-list', { count: 0 }), render)).toMatchObject({ count: 1 })
    expect(parseSection(section('section.post-list', { count: null }), render)).toMatchObject({ count: 3 })
    const both = parseSection(section('section.post-list', { tag: { slug: 'vue' } }), render)
    expect(both).toMatchObject({ category: 'linux' })
    expect(both).not.toHaveProperty('tag')
    expect(parseSection(section('section.post-list', { category: null, tag: { slug: 'vue' } }), render)).toMatchObject({ tag: 'vue' })
  })
})

describe('parsePage', () => {
  const raw = {
    id: 1,
    documentId: 'page-1',
    title: 'Showcase',
    slug: 'showcase',
    locale: 'en',
    seo: { id: 3, metaTitle: 'T', metaDescription: 'D', metaImage: image, metaSocial: [] },
    sections: [section('section.hero'), { __component: 'section.carousel' }, section('section.cta', { title: '' }), section('section.rich-text')],
    localizations: [{ slug: 'muestra', locale: 'es' }, { slug: 'x', locale: 'fr' }, { slug: 'BAD SLUG', locale: 'es' }],
  }

  it('drops invalid and unknown sections alone, keeping order', () => {
    const page = parsePage(raw, render)
    expect(page?.sections.map(item => item.__component)).toEqual(['section.hero', 'section.rich-text'])
  })

  it('returns the SEO, the locale and the translations for hreflang', () => {
    expect(parsePage(raw, render)).toMatchObject({
      documentId: 'page-1',
      title: 'Showcase',
      slug: 'showcase',
      locale: 'en',
      seo: { metaTitle: 'T', metaDescription: 'D', metaImage: { url: '/uploads/a.png' } },
      translations: [{ slug: 'muestra', locale: 'es' }],
    })
  })

  it('accepts a page without sections, SEO or localizations', () => {
    expect(parsePage({ documentId: 'p', title: 'T', slug: 't', sections: null, seo: null }, render)).toEqual({
      documentId: 'p',
      title: 'T',
      slug: 't',
      sections: [],
      translations: [],
    })
  })

  it('drops an invalid SEO alone', () => {
    expect(parsePage({ ...raw, seo: { metaTitle: '' } }, render)).not.toHaveProperty('seo')
  })

  it('is null without a title or a valid slug', () => {
    expect(parsePage({ ...raw, title: '' }, render)).toBeNull()
    expect(parsePage({ ...raw, slug: 'Bad Slug' }, render)).toBeNull()
    expect(parsePage(null, render)).toBeNull()
  })
})

describe('pageParamsSchema', () => {
  it('accepts uid-shaped slugs only', () => {
    for (const slug of ['showcase', 'muestra', 'a', 'my-page_2', 'v1.0']) expect(pageParamsSchema.safeParse({ slug }).success).toBe(true)
    for (const slug of ['', 'Showcase', 'a b', '../x', '-x', 'a/b', 'x'.repeat(65), undefined]) expect(pageParamsSchema.safeParse({ slug }).success).toBe(false)
  })
})
