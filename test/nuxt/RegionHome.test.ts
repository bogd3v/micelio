import { describe, it, expect } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import RegionHome from '~/theme/layout/home/Showcase.vue'

registerEndpoint('/api/posts', () => ({ data: [], meta: { pagination: { total: 0, page: 1, pageSize: 5, pageCount: 1 } } }))

describe('RegionHome (showcase)', () => {
  it('marks the home root with its layout and keeps the latest anchor', async () => {
    const wrapper = await mountSuspended(RegionHome, {
      props: { total: 0, counts: {}, topics: [] },
    })
    expect(wrapper.find('.bd-home').attributes('data-layout')).toBe('showcase')
    expect(wrapper.find('#latest').exists()).toBe(true)
  })

  it('renders the featured section only when there is a post', async () => {
    const wrapper = await mountSuspended(RegionHome, {
      props: { total: 0, counts: {}, topics: [] },
    })
    expect(wrapper.find('.bd-home-featured').exists()).toBe(false)
  })
})
