import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BdPostCard from '~/components/bd/BdPostCard.vue'
import { Category } from '~/interfaces/design'

const base = {
  title: 'Soberanía digital y laboratorios locales',
  href: '/blog/soberania-digital',
  excerpt: 'Primer artículo de este blog.',
  category: Category.Privacy,
  date: '24.09.2026',
  dateTime: '2026-09-24T15:00:00.000Z',
  author: 'Alejandro Ramírez',
  readTime: '5 min',
}

describe('BdPostCard', () => {
  it('exposes a single link named by the title', async () => {
    const wrapper = await mountSuspended(BdPostCard, { props: base })
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]!.attributes('href')).toBe('/blog/soberania-digital')
    expect(links[0]!.text()).toBe(base.title)
    expect(wrapper.get('h3.bd-card-title').text()).toBe(base.title)
    expect(wrapper.get('.bd-card-more').attributes('aria-hidden')).toBe('true')
  })

  it('renders category, date, excerpt and byline', async () => {
    const wrapper = await mountSuspended(BdPostCard, { props: base })
    expect(wrapper.get('.bd-tag').classes()).toContain('bd-tag-privacidad')
    const time = wrapper.get('time')
    expect(time.text()).toBe('24.09.2026')
    expect(time.attributes('datetime')).toBe(base.dateTime)
    expect(wrapper.get('.bd-card-excerpt').text()).toBe(base.excerpt)
    expect(wrapper.get('.bd-card-foot .bd-meta').text()).toBe('Alejandro Ramírez · 5 min')
    expect(wrapper.get('.bd-card-more').text()).toBe('Read more →')
  })

  it('shows scanlines tinted by the category when there is no image', async () => {
    const wrapper = await mountSuspended(BdPostCard, { props: base })
    const media = wrapper.get('.bd-card-media')
    expect(media.classes()).toContain('bd-card-media-empty')
    expect(media.attributes('aria-hidden')).toBe('true')
    expect(wrapper.attributes('style')).toContain('--cat: var(--category-1)')
  })

  it('loads images lazily unless the card has priority', async () => {
    const lazy = await mountSuspended(BdPostCard, { props: { ...base, image: 'https://cdn.test/a.png' } })
    expect(lazy.get('img').attributes('loading')).toBe('lazy')
    expect(lazy.get('img').attributes('fetchpriority')).toBeUndefined()
    expect(lazy.get('img').attributes('alt')).toBe('')

    const eager = await mountSuspended(BdPostCard, {
      props: { ...base, image: 'https://cdn.test/a.png', imageAlt: 'Portada', priority: true },
    })
    expect(eager.get('img').attributes('loading')).toBe('eager')
    expect(eager.get('img').attributes('fetchpriority')).toBe('high')
    expect(eager.get('img').attributes('alt')).toBe('Portada')
  })

  it('renders the featured variant with eyebrow, h2 and custom labels', async () => {
    const wrapper = await mountSuspended(BdPostCard, {
      props: { ...base, featured: true, moreLabel: 'Leer artículo' },
    })
    expect(wrapper.classes()).toContain('bd-card-featured')
    expect(wrapper.get('.bd-card-eyebrow').text()).toBe('Featured article')
    expect(wrapper.find('h2.bd-card-title').exists()).toBe(true)
    expect(wrapper.get('.bd-card-more').text()).toBe('Leer artículo →')

    const custom = await mountSuspended(BdPostCard, { props: { ...base, featured: true, eyebrow: 'Destacado' } })
    expect(custom.get('.bd-card-eyebrow').text()).toBe('Destacado')
  })

  it('omits optional parts when they are missing', async () => {
    const wrapper = await mountSuspended(BdPostCard, { props: { title: 'Sin datos', href: '/blog/sin-datos' } })
    expect(wrapper.find('.bd-card-meta').exists()).toBe(false)
    expect(wrapper.find('.bd-card-excerpt').exists()).toBe(false)
    expect(wrapper.find('.bd-card-eyebrow').exists()).toBe(false)
    expect(wrapper.attributes('style')).toBeUndefined()
  })

  it('marks articles the reader already read', async () => {
    const unread = await mountSuspended(BdPostCard, { props: base })
    expect(unread.find('.bd-read-mark').exists()).toBe(false)
    const read = await mountSuspended(BdPostCard, { props: { ...base, read: true } })
    expect(read.get('.bd-card-meta .bd-read-mark').text()).toBe('✓ Read')
    expect(read.get('.bd-read-mark [aria-hidden="true"]').text()).toBe('✓')
  })

  it('shows the highlighted snippet instead of the excerpt', async () => {
    const wrapper = await mountSuspended(BdPostCard, { props: { ...base, snippet: '…laboratorios locales y soberanía…', highlight: 'locales' } })
    expect(wrapper.find('.bd-card-snippet').exists()).toBe(true)
    expect(wrapper.get('.bd-card-snippet mark').text()).toBe('locales')
    expect(wrapper.text()).not.toContain('Primer artículo de este blog.')
  })
})
