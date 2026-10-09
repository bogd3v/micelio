import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery } from 'h3'
import { flushPromises } from '@vue/test-utils'
import HomeLatest from '~/components/home/Latest.vue'

const requests: Record<string, unknown>[] = []

const article = {
  id: 1,
  title: 'Understanding Vue Composables',
  slug: 'understanding-vue-composables',
  description: 'A deep dive.',
  publishedAt: '2026-02-01T10:00:00.000Z',
  category: { name: 'Software', slug: 'software' },
}

registerEndpoint('/api/posts', (event) => {
  const query = getQuery(event)
  requests.push(query)
  const data = !query.category || query.category === 'software' ? [article] : []
  return { data, meta: { pagination: { total: data.length, page: 1, pageSize: 5, pageCount: 1 } } }
})

describe('HomeLatest', () => {
  beforeEach(() => {
    requests.length = 0
  })

  it('lists the latest articles with topic filters and the archive card', async () => {
    const wrapper = await mountSuspended(HomeLatest, { props: { total: 1, counts: { software: 1 } } })
    await flushPromises()
    const chips = wrapper.findAll('.myc-latest-filters .myc-chip')
    expect(chips.map(chip => chip.text())).toEqual(['All01', 'Privacy00', 'DIY00', 'AI00', 'Software01', 'Linux00'])
    expect(chips[0]!.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.myc-home-eyebrow').text()).toBe('Index · 01 article')
    expect(wrapper.findAll('.myc-card-title').map(title => title.text())).toEqual(['Understanding Vue Composables'])
    expect(wrapper.get('a.myc-latest-archive').attributes('href')).toBe('/blog')
  })

  it('filters by topic and shows the empty nest with a way back', async () => {
    const wrapper = await mountSuspended(HomeLatest, { props: { total: 1, counts: { software: 1 } } })
    await flushPromises()
    await wrapper.findAll('.myc-latest-filters .myc-chip')[1]!.trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.myc-latest-empty-title').exists()).toBe(true))
    expect(requests.at(-1)).toMatchObject({ category: 'privacidad', pageSize: '5' })
    expect(wrapper.get('.myc-latest-empty-title').text()).toBe('No articles on privacy yet')
    expect(wrapper.find('a.myc-latest-archive').exists()).toBe(false)
    await wrapper.get('.myc-latest-empty .myc-chip').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.myc-latest-empty').exists()).toBe(false))
    expect(wrapper.findAll('.myc-card-title')).toHaveLength(1)
  })
})
