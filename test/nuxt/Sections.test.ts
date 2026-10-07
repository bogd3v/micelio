import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import SectionRenderer from '~/components/section/SectionRenderer.vue'
import type { PageLink, PageMedia, PageSection, PostListItem } from '~/interfaces'

function image(name: string, extra: Partial<PageMedia> = {}): PageMedia {
  return { url: `/uploads/${name}`, alternativeText: name, width: 1200, height: 630, mime: 'image/png', ...extra }
}

function link(label: string, url: string): PageLink {
  return { label, url }
}

const svg = (name: string): PageMedia => image(name, { mime: 'image/svg+xml', width: 64, height: 64 })

const post: PostListItem = {
  id: 1,
  documentId: 'post-1',
  title: 'Starting a balcony garden',
  slug: 'starting-a-balcony-garden',
  description: 'Four hours of sun are enough.',
  publishedAt: '2026-09-24T15:00:00.000Z',
  category: { slug: 'software', name: 'Software' },
}

const sections = {
  hero: (variant: 'centered' | 'split' | 'full-bleed'): PageSection => ({
    __component: 'section.hero',
    variant,
    title: 'Grow food where you live',
    text: 'A demo of every section.',
    primaryLink: link('Read the notes', '/blog'),
    secondaryLink: link('Micelio', 'https://github.com/bogd3v/micelio'),
    media: image('hero.png'),
  }),
  featureGrid: (variant: 'grid' | 'list' | 'bento'): PageSection => ({
    __component: 'section.feature-grid',
    variant,
    title: 'What you need',
    items: [
      { icon: svg('icon-light.svg'), title: 'Light', text: 'Four hours of sun.' },
      { title: 'Patience' },
    ],
  }),
  mediaShowcase: (variant: 'left' | 'right' | 'stacked'): PageSection => ({
    __component: 'section.media-showcase',
    variant,
    title: 'A balcony in spring',
    html: '<p>Lettuce, basil and <strong>cherry tomatoes</strong>.</p>',
    media: image('balcony.png'),
    link: link('How to start', '/blog/starting-a-balcony-garden'),
  }),
  stats: (variant: 'row' | 'cards'): PageSection => ({
    __component: 'section.stats',
    variant,
    title: 'One small garden',
    items: [{ value: '4 h', label: 'of sun a day' }, { value: '12', label: 'pots' }],
  }),
  logoCloud: (variant: 'row' | 'marquee'): PageSection => ({
    __component: 'section.logo-cloud',
    variant,
    title: 'Friends of the garden',
    logos: [
      { image: svg('logo-circle.svg'), name: 'Circle Seeds', url: 'https://circle.example.com' },
      { image: svg('logo-square.svg'), name: 'Square Soil' },
    ],
  }),
  testimonials: (variant: 'single' | 'grid'): PageSection => ({
    __component: 'section.testimonials',
    variant,
    title: 'What neighbors say',
    items: [
      { quote: 'The basil smells all the way to the street.', author: 'Sam', role: 'Neighbor', avatar: image('sam.png', { width: 96, height: 96 }) },
      { quote: 'I started my own pots.', author: 'Robin' },
    ],
  }),
  pricing: (variant: 'cards' | 'table'): PageSection => ({
    __component: 'section.pricing',
    variant,
    title: 'Seed boxes',
    plans: [
      { name: 'Starter', price: '$5', period: 'per season', features: ['3 seed packs', 'A planting guide'], recommended: false },
      { name: 'Gardener', price: '$12', features: ['8 seed packs'], recommended: true, link: link('Choose', '/') },
    ],
  }),
  faq: (variant: 'list' | 'two-columns'): PageSection => ({
    __component: 'section.faq',
    variant,
    title: 'Questions',
    items: [
      { question: 'Do I need a garden?', html: '<p>No: a balcony is enough.</p>' },
      { question: 'Is this site real?', html: '<p>It is a demo of <a href="https://github.com/bogd3v/micelio">Micelio</a>.</p>' },
    ],
  }),
  cta: (variant: 'banner' | 'card'): PageSection => ({
    __component: 'section.cta',
    variant,
    title: 'Start this weekend',
    text: 'One pot, one plant.',
    primaryLink: link('Read the guide', '/blog'),
  }),
  postList: (variant: 'cards' | 'list', posts: PostListItem[] = [post]): PageSection => ({
    __component: 'section.post-list',
    variant,
    title: 'From the garden',
    count: 3,
    posts,
  }),
  newsletter: (variant: 'inline' | 'card'): PageSection => ({
    __component: 'section.newsletter',
    variant,
    title: 'Notes by email',
    text: 'One email per season.',
    buttonLabel: 'Subscribe me',
  }),
  richText: (): PageSection => ({
    __component: 'section.rich-text',
    html: '<h2>About this page</h2><p>Every section appears once.</p>',
  }),
  gallery: (variant: 'grid' | 'masonry'): PageSection => ({
    __component: 'section.gallery',
    variant,
    title: 'Through the year',
    images: [image('balcony.png'), image('summer.png'), image('autumn.png')],
  }),
  scene: (variant: 'background' | 'inline'): PageSection => ({
    __component: 'section.scene',
    variant,
    model: image('triangle.glb', { mime: 'model/gltf-binary', width: undefined, height: undefined }),
    poster: image('triangle-poster.png'),
    alt: 'A green triangle',
    title: 'A scene',
    text: 'Static preview.',
  }),
}

async function render(section: PageSection, route?: string) {
  const wrapper = await mountSuspended(SectionRenderer, { props: { sections: [section] }, route })
  return wrapper
}

function root(wrapper: Awaited<ReturnType<typeof render>>) {
  return wrapper.get('section.bd-section')
}

describe('SectionRenderer', () => {
  it('renders nothing for no sections, an unknown component or a missing list', async () => {
    for (const value of [[], null, undefined, [{ __component: 'section.carousel' } as unknown as PageSection]]) {
      const wrapper = await mountSuspended(SectionRenderer, { props: { sections: value } })
      expect(wrapper.find('section').exists()).toBe(false)
    }
  })

  it('renders known sections in order and skips unknown ones', async () => {
    const wrapper = await mountSuspended(SectionRenderer, {
      props: { sections: [sections.cta('banner'), { __component: 'section.carousel' } as unknown as PageSection, sections.richText()] },
    })
    const rendered = wrapper.findAll('section.bd-section')
    expect(rendered.map(node => node.attributes('data-section'))).toEqual(['cta', 'rich-text'])
  })

  it('labels each section with its heading', async () => {
    const wrapper = await render(sections.cta('banner'))
    const heading = wrapper.get('h2.bd-section-title')
    expect(root(wrapper).attributes('aria-labelledby')).toBe(heading.attributes('id'))
  })
})

describe('hero', () => {
  it.each(['centered', 'split', 'full-bleed'] as const)('renders the %s variant', async (variant) => {
    const wrapper = await render(sections.hero(variant))
    expect(root(wrapper).attributes('data-section')).toBe('hero')
    expect(root(wrapper).attributes('data-variant')).toBe(variant)
    expect(wrapper.get('h2.bd-section-title').text()).toBe('Grow food where you live')
    expect(wrapper.findAll('h1')).toHaveLength(0)
    expect(wrapper.get('.bd-section-text').text()).toBe('A demo of every section.')
    expect(wrapper.findAll('.bd-section-actions a')).toHaveLength(2)
  })

  it('loads its image first, with dimensions, AVIF and WebP', async () => {
    const wrapper = await render(sections.hero('split'))
    const img = wrapper.get('.bd-section-media img')
    expect(img.attributes('loading')).toBe('eager')
    expect(img.attributes('fetchpriority')).toBe('high')
    expect(img.attributes('alt')).toBe('hero.png')
    expect(img.attributes('width')).toBe('1200')
    expect(img.attributes('height')).toBe('630')
    expect(wrapper.get('.bd-section-media').attributes('style')).toContain('aspect-ratio: 1200 / 630')
    const types = wrapper.findAll('picture source').map(source => source.attributes('type'))
    expect(types).toContain('image/avif')
    expect(types).toContain('image/webp')
    expect(img.attributes('srcset')).toBeTruthy()
  })

  it('keeps a video playable except as a full-bleed background, where it is left out', async () => {
    const video = (variant: 'centered' | 'full-bleed'): PageSection => ({ ...sections.hero(variant), media: image('clip.mp4', { mime: 'video/mp4' }) } as PageSection)
    expect((await render(video('centered'))).find('video[controls]').exists()).toBe(true)
    const background = await render(video('full-bleed'))
    expect(background.find('video').exists()).toBe(false)
    expect(background.find('.bd-section-media').exists()).toBe(false)
    expect(background.get('h2').text()).toBe('Grow food where you live')
  })

  it('puts the full-bleed image behind the text', async () => {
    const wrapper = await render(sections.hero('full-bleed'))
    expect(root(wrapper).element.firstElementChild?.classList.contains('bd-section-media')).toBe(true)
  })

  it('localizes site paths and opens other sites with rel noopener and no target', async () => {
    const wrapper = await render(sections.hero('centered'))
    const [primary, secondary] = wrapper.findAll('.bd-section-actions a')
    expect(primary!.attributes('href')).toBe('/blog')
    expect(secondary!.attributes('href')).toBe('https://github.com/bogd3v/micelio')
    expect(secondary!.attributes('rel')).toBe('noopener')
    expect(secondary!.attributes('target')).toBeUndefined()
    expect(primary!.attributes('rel')).toBeUndefined()
  })

  it('prefixes site paths with the locale, once', async () => {
    const section = sections.hero('centered') as Extract<PageSection, { __component: 'section.hero' }>
    section.primaryLink = link('Leer', '/blog')
    section.secondaryLink = link('Ya con prefijo', '/es/blog')
    const wrapper = await render(section, '/es')
    const [primary, secondary] = wrapper.findAll('.bd-section-actions a')
    expect(primary!.attributes('href')).toBe('/es/blog')
    expect(secondary!.attributes('href')).toBe('/es/blog')
  })

  it('keeps mailto links as they are and drops unsafe ones', async () => {
    const section = sections.hero('centered') as Extract<PageSection, { __component: 'section.hero' }>
    section.primaryLink = link('Write', 'mailto:hola@example.com')
    section.secondaryLink = link('Evil', '//evil.example.com')
    const wrapper = await render(section)
    const links = wrapper.findAll('.bd-section-actions a')
    expect(links).toHaveLength(1)
    expect(links[0]!.attributes('href')).toBe('mailto:hola@example.com')
  })

  it('renders without media and without links', async () => {
    const section = { __component: 'section.hero', variant: 'centered', title: 'Only a title' } as PageSection
    const wrapper = await render(section)
    expect(wrapper.find('.bd-section-media').exists()).toBe(false)
    expect(wrapper.find('.bd-section-actions').exists()).toBe(false)
  })
})

describe('media paths', () => {
  it('renders media from Strapi uploads and absolute URLs only', async () => {
    const hero = (url: string): PageSection => ({ ...sections.hero('split'), media: image('x.png', { url }) } as PageSection)
    for (const url of ['/uploads/x.png', 'https://api.bogdev.com.co/uploads/x.png']) {
      expect((await render(hero(url))).find('.bd-section-media img').exists(), url).toBe(true)
    }
    for (const url of ['/theme/images/x.png', '/uploads/../x.png', '//evil.example.com/x.png', 'javascript:alert(1)', 'data:image/png;base64,AA']) {
      expect((await render(hero(url))).find('.bd-section-media').exists(), url).toBe(false)
    }
  })
})

describe('item headings', () => {
  it('uses h3 under a section title and h2 without one', async () => {
    const without = <T extends PageSection>(section: T): T => ({ ...section, title: undefined })
    for (const make of [sections.featureGrid('grid'), sections.pricing('cards'), sections.postList('list'), sections.postList('cards')]) {
      const titled = await render(make)
      expect(titled.findAll('h2'), make.__component).toHaveLength(1)
      expect(titled.findAll('h3').length, make.__component).toBeGreaterThan(0)
      const untitled = await render(without(make))
      expect(untitled.findAll('h3'), make.__component).toHaveLength(0)
      expect(untitled.findAll('h2').length, make.__component).toBeGreaterThan(0)
    }
  })
})

describe('feature grid', () => {
  it.each(['grid', 'list', 'bento'] as const)('renders the %s variant', async (variant) => {
    const wrapper = await render(sections.featureGrid(variant))
    expect(root(wrapper).attributes('data-variant')).toBe(variant)
    expect(wrapper.get('h2').text()).toBe('What you need')
    const items = wrapper.findAll('ul.bd-section-items > li.bd-section-item')
    expect(items).toHaveLength(2)
    expect(items[0]!.get('h3.bd-section-item-title').text()).toBe('Light')
    expect(items[0]!.get('.bd-section-item-text').text()).toBe('Four hours of sun.')
    expect(items[1]!.find('.bd-section-item-text').exists()).toBe(false)
  })

  it('serves SVG icons straight, as decorative images', async () => {
    const wrapper = await render(sections.featureGrid('grid'))
    const icon = wrapper.get('.bd-section-icon img')
    expect(icon.attributes('src')).toMatch(/\/uploads\/icon-light\.svg$/)
    expect(icon.attributes('alt')).toBe('')
    expect(wrapper.find('.bd-section-icon picture').exists()).toBe(false)
  })

  it('loads items lazily', async () => {
    const section = sections.featureGrid('grid') as Extract<PageSection, { __component: 'section.feature-grid' }>
    section.items[0]!.icon = image('icon.png')
    const wrapper = await render(section)
    expect(wrapper.get('.bd-section-icon img').attributes('loading')).toBe('lazy')
    expect(wrapper.get('.bd-section-icon img').attributes('fetchpriority')).toBeUndefined()
  })
})

describe('media showcase', () => {
  it.each(['left', 'right', 'stacked'] as const)('renders the %s variant', async (variant) => {
    const wrapper = await render(sections.mediaShowcase(variant))
    expect(root(wrapper).attributes('data-variant')).toBe(variant)
    expect(wrapper.get('.bd-section-media img').attributes('alt')).toBe('balcony.png')
    expect(wrapper.get('.bd-section-media img').attributes('loading')).toBe('lazy')
    expect(wrapper.get('h2').text()).toBe('A balcony in spring')
    expect(wrapper.get('.bd-section-text strong').text()).toBe('cherry tomatoes')
    expect(wrapper.get('.bd-section-actions a').attributes('href')).toBe('/blog/starting-a-balcony-garden')
  })

  it('plays a video only when asked: controls, muted, no autoplay', async () => {
    const section = sections.mediaShowcase('left') as Extract<PageSection, { __component: 'section.media-showcase' }>
    section.media = image('clip.mp4', { mime: 'video/mp4' })
    const wrapper = await render(section)
    const video = wrapper.get('video')
    expect(video.attributes('controls')).toBeDefined()
    expect(video.attributes('playsinline')).toBeDefined()
    expect(video.attributes('preload')).toBe('metadata')
    expect(video.attributes('autoplay')).toBeUndefined()
    expect(video.attributes('loop')).toBeUndefined()
    expect(video.element.muted || video.attributes('muted') !== undefined).toBe(true)
    expect(video.get('source').attributes('type')).toBe('video/mp4')
    expect(wrapper.find('picture').exists()).toBe(false)
  })
})

describe('stats', () => {
  it.each(['row', 'cards'] as const)('renders the %s variant as a description list', async (variant) => {
    const wrapper = await render(sections.stats(variant))
    expect(root(wrapper).attributes('data-variant')).toBe(variant)
    const list = wrapper.get('dl.bd-section-items')
    expect(list.findAll('.bd-section-item')).toHaveLength(2)
    expect(list.findAll('dt.bd-section-stat-value').map(node => node.text())).toEqual(['4 h', '12'])
    expect(list.findAll('dd.bd-section-stat-label').map(node => node.text())).toEqual(['of sun a day', 'pots'])
  })
})

describe('logo cloud', () => {
  it('renders the row variant with one list and names the logos', async () => {
    const wrapper = await render(sections.logoCloud('row'))
    expect(root(wrapper).attributes('data-variant')).toBe('row')
    expect(wrapper.get('.bd-section-logo-track').attributes('data-variant')).toBe('row')
    expect(wrapper.findAll('.bd-section-items')).toHaveLength(1)
    const linked = wrapper.get('a[href="https://circle.example.com"]')
    expect(linked.attributes('rel')).toBe('noopener')
    expect(linked.get('img').attributes('alt')).toBe('logo-circle.svg')
    expect(wrapper.findAll('.bd-section-item')[1]!.find('a').exists()).toBe(false)
  })

  it('links logos to http(s) URLs only', async () => {
    const section = sections.logoCloud('row') as Extract<PageSection, { __component: 'section.logo-cloud' }>
    section.logos[0]!.url = 'javascript:alert(1)'
    section.logos[1]!.url = '/blog'
    const wrapper = await render(section)
    expect(wrapper.find('a').exists()).toBe(false)
  })

  it('falls back to the logo name as alt text', async () => {
    const section = sections.logoCloud('row') as Extract<PageSection, { __component: 'section.logo-cloud' }>
    section.logos[1]!.image = { ...svg('x.svg'), alternativeText: undefined }
    const wrapper = await render(section)
    expect(wrapper.findAll('.bd-section-item')[1]!.get('img').attributes('alt')).toBe('Square Soil')
  })

  it('duplicates the marquee track out of the accessibility tree and the focus order', async () => {
    const wrapper = await render(sections.logoCloud('marquee'))
    expect(wrapper.get('.bd-section-logo-track').attributes('data-variant')).toBe('marquee')
    const lists = wrapper.findAll('.bd-section-logo-track > .bd-section-items')
    expect(lists).toHaveLength(2)
    expect(lists[0]!.attributes('aria-hidden')).toBeUndefined()
    expect(lists[1]!.attributes('aria-hidden')).toBe('true')
    expect(lists[1]!.attributes('inert')).toBeDefined()
    expect(lists[1]!.find('a').exists()).toBe(false)
    expect(lists[1]!.findAll('img').every(img => img.attributes('alt') === '')).toBe(true)
  })
})

describe('testimonials', () => {
  it.each(['single', 'grid'] as const)('renders the %s variant as figures with a quotation', async (variant) => {
    const wrapper = await render(sections.testimonials(variant))
    expect(root(wrapper).attributes('data-variant')).toBe(variant)
    const figures = wrapper.findAll('li.bd-section-item > figure')
    expect(figures).toHaveLength(variant === 'single' ? 1 : 2)
    expect(figures[0]!.get('blockquote.bd-section-quote').text()).toBe('The basil smells all the way to the street.')
    expect(figures[0]!.get('figcaption.bd-section-author').text()).toContain('Sam · Neighbor')
    expect(figures[0]!.get('figcaption img').attributes('alt')).toBe('')
    if (variant === 'grid') expect(figures[1]!.get('figcaption').text()).toBe('Robin')
  })
})

describe('pricing', () => {
  it('renders the cards variant and marks the recommended plan with text', async () => {
    const wrapper = await render(sections.pricing('cards'))
    expect(root(wrapper).attributes('data-variant')).toBe('cards')
    const plans = wrapper.findAll('li.bd-section-plan')
    expect(plans).toHaveLength(2)
    expect(plans[0]!.classes()).not.toContain('bd-section-plan-recommended')
    expect(plans[0]!.get('h3').text()).toBe('Starter')
    expect(plans[0]!.get('.bd-section-plan-price strong').text()).toBe('$5')
    expect(plans[0]!.findAll('.bd-section-plan-features li').map(node => node.text())).toEqual(['3 seed packs', 'A planting guide'])
    expect(plans[1]!.classes()).toContain('bd-section-plan-recommended')
    expect(plans[1]!.text()).toContain('Recommended')
    expect(plans[1]!.get('a').attributes('href')).toBe('/')
  })

  it('renders the table variant as a real table', async () => {
    const wrapper = await render(sections.pricing('table'))
    expect(root(wrapper).attributes('data-variant')).toBe('table')
    const table = wrapper.get('table')
    expect(table.get('caption').text()).toBe('Seed boxes')
    expect(table.findAll('thead th[scope="col"]').length).toBeGreaterThanOrEqual(3)
    const rows = table.findAll('tbody tr.bd-section-plan')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('th[scope="row"]').text()).toBe('Starter')
    expect(rows[1]!.classes()).toContain('bd-section-plan-recommended')
    expect(rows[1]!.text()).toContain('Recommended')
    expect(rows[1]!.get('a').text()).toBe('Choose')
  })

  it('captions an untitled table', async () => {
    const section = sections.pricing('table') as Extract<PageSection, { __component: 'section.pricing' }>
    section.title = undefined
    const wrapper = await render(section)
    expect(wrapper.get('caption').text()).toBe('Plans and prices')
  })
})

describe('faq', () => {
  it.each(['list', 'two-columns'] as const)('renders the %s variant with native details', async (variant) => {
    const wrapper = await render(sections.faq(variant))
    expect(root(wrapper).attributes('data-variant')).toBe(variant)
    const items = wrapper.findAll('details.bd-section-item')
    expect(items).toHaveLength(2)
    expect(items[0]!.get('summary.bd-section-question').text()).toBe('Do I need a garden?')
    expect(items[0]!.attributes('open')).toBeUndefined()
    expect(items[0]!.get('.bd-section-answer').text()).toBe('No: a balcony is enough.')
    expect(items[1]!.get('.bd-section-answer a').attributes('href')).toBe('https://github.com/bogd3v/micelio')
  })
})

describe('cta', () => {
  it.each(['banner', 'card'] as const)('renders the %s variant', async (variant) => {
    const wrapper = await render(sections.cta(variant))
    expect(root(wrapper).attributes('data-variant')).toBe(variant)
    expect(wrapper.get('h2').text()).toBe('Start this weekend')
    expect(wrapper.get('.bd-section-text').text()).toBe('One pot, one plant.')
    expect(wrapper.get('.bd-section-actions a.bd-btn-primary').attributes('href')).toBe('/blog')
  })
})

describe('post list', () => {
  it('renders the cards variant with post cards', async () => {
    const wrapper = await render(sections.postList('cards'))
    expect(root(wrapper).attributes('data-variant')).toBe('cards')
    const card = wrapper.get('li.bd-section-item article.bd-card')
    expect(card.get('a').attributes('href')).toBe('/blog/starting-a-balcony-garden')
    expect(card.get('h3').text()).toBe('Starting a balcony garden')
  })

  it('renders the list variant with a title link and a date', async () => {
    const wrapper = await render(sections.postList('list'))
    expect(root(wrapper).attributes('data-variant')).toBe('list')
    const item = wrapper.get('li.bd-section-item')
    expect(item.get('h3 a').attributes('href')).toBe('/blog/starting-a-balcony-garden')
    expect(item.get('time').attributes('datetime')).toBe('2026-09-24T15:00:00.000Z')
    expect(item.get('.bd-section-item-text').text()).toBe('Four hours of sun are enough.')
  })

  it.each(['cards', 'list'] as const)('renders nothing for the %s variant without posts', async (variant) => {
    const wrapper = await render(sections.postList(variant, []))
    expect(wrapper.find('section').exists()).toBe(false)
    expect(wrapper.find('h2').exists()).toBe(false)
  })
})

describe('newsletter', () => {
  let unregister: (() => void) | undefined

  afterEach(() => {
    unregister?.()
    unregister = undefined
    clearNuxtData()
  })

  it.each(['inline', 'card'] as const)('renders the %s variant with the newsletter form', async (variant) => {
    const wrapper = await render(sections.newsletter(variant))
    expect(root(wrapper).attributes('data-variant')).toBe(variant)
    expect(wrapper.get('h2').text()).toBe('Notes by email')
    expect(wrapper.find('form.bd-news').exists()).toBe(true)
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
    expect(wrapper.get('form button[type="submit"]').text()).toContain('Subscribe me')
    expect(wrapper.get('form p').text()).toBe('One email per season.')
    // One heading: the section's h2, not the form's own eyebrow and h3
    expect(wrapper.findAll('h2, h3')).toHaveLength(1)
    expect(wrapper.find('.bd-news-eyebrow').exists()).toBe(false)
  })

  it('renders nothing when the newsletter module is off', async () => {
    unregister = registerEndpoint('/api/site', () => ({ name: 'Micelio', modules: { newsletter: false } }))
    const wrapper = await render(sections.newsletter('card'))
    await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(false))
    expect(wrapper.find('section').exists()).toBe(false)
  })
})

describe('rich text', () => {
  it('renders the sanitized html without a variant', async () => {
    const wrapper = await render(sections.richText())
    expect(root(wrapper).attributes('data-section')).toBe('rich-text')
    expect(root(wrapper).attributes('data-variant')).toBeUndefined()
    expect(wrapper.get('.bd-section-text h2').text()).toBe('About this page')
    expect(wrapper.get('.bd-section-text p').text()).toBe('Every section appears once.')
  })
})

describe('gallery', () => {
  it.each(['grid', 'masonry'] as const)('renders the %s variant with lazy images and alt text', async (variant) => {
    const wrapper = await render(sections.gallery(variant))
    expect(root(wrapper).attributes('data-variant')).toBe(variant)
    const images = wrapper.findAll('li.bd-section-item img')
    expect(images.map(img => img.attributes('alt'))).toEqual(['balcony.png', 'summer.png', 'autumn.png'])
    expect(images.every(img => img.attributes('loading') === 'lazy' && img.attributes('width') === '1200')).toBe(true)
  })
})

describe('scene', () => {
  it.each(['background', 'inline'] as const)('renders the %s variant as a static poster', async (variant) => {
    const wrapper = await render(sections.scene(variant))
    expect(root(wrapper).attributes('data-variant')).toBe(variant)
    expect(wrapper.get('.bd-section-media img').attributes('alt')).toBe('A green triangle')
    expect(wrapper.get('h2').text()).toBe('A scene')
    expect(wrapper.get('.bd-section-text').text()).toBe('Static preview.')
    expect(wrapper.find('canvas').exists()).toBe(false)
  })
})
