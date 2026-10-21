import { beforeEach, describe, it, expect } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import BlogPage from '~/pages/blog/index.vue'

import { BOGOTA_THEME_DATA, setThemeData } from './themeData'

beforeEach(() => {
  setThemeData({ layout: { ...BOGOTA_THEME_DATA.layout, postList: 'list' } })
})

registerEndpoint('/api/posts', () => ({
  data: [{ id: 1, documentId: 'doc-1', title: 'A post', slug: 'a-post', description: 'Lead', publishedAt: '2026-01-01T10:00:00.000Z', category: null }],
  meta: { pagination: { page: 1, pageSize: 9, pageCount: 1, total: 1 } },
}))
registerEndpoint('/api/categories', () => [])
registerEndpoint('/api/tags', () => [])

describe('the blog page with the list post list variant', () => {
  it('hides the grid and log switch but keeps the sort control', async () => {
    const wrapper = await mountSuspended(BlogPage, { route: '/blog?view=log' })
    await flushPromises()
    expect(wrapper.find('.myc-blog-views').exists()).toBe(false)
    expect(wrapper.find('.myc-sort, #myc-blog-sort').exists()).toBe(true)
  })
})
