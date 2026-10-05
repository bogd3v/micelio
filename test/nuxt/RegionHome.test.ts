import { describe, it, expect } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import RegionHome from '~/theme/layout/home/Showcase.vue'

registerEndpoint('/api/posts', () => ({ data: [], meta: { pagination: { total: 0, page: 1, pageSize: 5, pageCount: 1 } } }))

describe('RegionHomeShowcase', () => {
  it('marks the home root with its layout and keeps the latest anchor', async () => {
    const wrapper = await mountSuspended(RegionHome, {
      props: { total: 0, counts: {}, topics: [] },
    })
    expect(wrapper.find('.bd-home').attributes('data-layout')).toBe('showcase')
    expect(wrapper.find('#latest').exists()).toBe(true)
  })

  it('renders the featured post card when there is one', async () => {
    const wrapper = await mountSuspended(RegionHome, {
      props: {
        total: 1,
        counts: {},
        topics: [],
        featuredPost: {
          id: 1,
          title: 'T',
          slug: 't',
          description: 'd',
          publishedAt: '2026-02-01T10:00:00.000Z',
          category: { name: 'Software', slug: 'software' },
        },
      },
    })
    const featured = wrapper.find('.bd-home-featured')
    expect(featured.exists()).toBe(true)
    expect(featured.attributes('aria-label')).toBeTruthy()
    expect(featured.findAll('article')).toHaveLength(1)
  })

  it('omits the featured section without a post', async () => {
    const wrapper = await mountSuspended(RegionHome, {
      props: { total: 0, counts: {}, topics: [] },
    })
    expect(wrapper.find('.bd-home-featured').exists()).toBe(false)
  })
})
