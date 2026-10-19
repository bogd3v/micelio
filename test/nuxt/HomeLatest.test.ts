import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery } from 'h3'
import HomeLatest from '~/components/home/Latest.vue'
import { categoriesSettled, serveCategories } from './categoriesFixture'

const requests: Record<string, unknown>[] = []

const article = {
  id: 1,
  title: 'Understanding Vue Composables',
  slug: 'understanding-vue-composables',
  description: 'A deep dive.',
  publishedAt: '2026-02-01T10:00:00.000Z',
  category: { name: 'Garden', slug: 'garden' },
}

registerEndpoint('/api/posts', (event) => {
  const query = getQuery(event)
  requests.push(query)
  const data = !query.category || query.category === 'garden' ? [article] : []
  return { data, meta: { pagination: { total: data.length, page: 1, pageSize: 5, pageCount: 1 } } }
})

describe('HomeLatest', () => {
  beforeEach(() => {
    serveCategories()
    requests.length = 0
  })

  it('lists the latest articles with topic filters and the archive card', async () => {
    const wrapper = await mountSuspended(HomeLatest, { props: { total: 1, counts: { garden: 1 } } })
    await vi.waitFor(() => expect(wrapper.findAll('.myc-latest-filters .myc-chip')).toHaveLength(6))
    const chips = wrapper.findAll('.myc-latest-filters .myc-chip')
    // Only the categories with articles; the count of a slug in `counts` wins, the others use the CMS list
    expect(chips.map(chip => chip.text())).toEqual(['All01', 'Garden01', 'Kitchen02', 'Workshop01', 'Cellar04', 'Loft05'])
    expect(chips.map(chip => chip.get('.myc-latest-dot').attributes('style'))).toEqual([
      expect.stringContaining('var(--ink-muted)'), expect.stringContaining('var(--category-1)'), expect.stringContaining('var(--category-2)'),
      expect.stringContaining('var(--category-4)'), expect.stringContaining('var(--category-5)'), expect.stringContaining('var(--category-1)'),
    ])
    expect(chips[0]!.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.myc-home-eyebrow').text()).toBe('Index · 01 article')
    expect(wrapper.findAll('.myc-card-title').map(title => title.text())).toEqual(['Understanding Vue Composables'])
    expect(wrapper.get('a.myc-latest-archive').attributes('href')).toBe('/blog')
  })

  it('renders no filters for a site without categories', async () => {
    serveCategories([])
    const wrapper = await mountSuspended(HomeLatest, { props: { total: 1, counts: {} } })
    await categoriesSettled()
    expect(wrapper.find('.myc-latest-filters').exists()).toBe(false)
    await vi.waitFor(() => expect(wrapper.findAll('.myc-card-title')).toHaveLength(1))
  })

  it('filters by topic and shows the empty nest with a way back', async () => {
    const wrapper = await mountSuspended(HomeLatest, { props: { total: 1, counts: {} } })
    await vi.waitFor(() => expect(wrapper.findAll('.myc-latest-filters .myc-chip')).toHaveLength(6))
    await wrapper.findAll('.myc-latest-filters .myc-chip')[2]!.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.myc-latest-empty-title').exists()).toBe(true))
    expect(requests.at(-1)).toMatchObject({ category: 'kitchen', pageSize: '5' })
    expect(wrapper.get('.myc-latest-empty-title').text()).toBe('No articles in Kitchen yet')
    expect(wrapper.find('a.myc-latest-archive').exists()).toBe(false)
    await wrapper.get('.myc-latest-empty .myc-chip').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.myc-latest-empty').exists()).toBe(false))
    expect(wrapper.findAll('.myc-card-title')).toHaveLength(1)
  })
})
