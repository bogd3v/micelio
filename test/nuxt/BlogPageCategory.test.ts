import { describe, it, expect } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import BlogPage from '~/pages/blog/index.vue'

registerEndpoint('/api/posts', () => ({ data: [], meta: { pagination: { page: 1, pageSize: 6, pageCount: 1, total: 0 } } }))
registerEndpoint('/api/categories', () => [{ id: 1, slug: 'garden', name: 'Garden', count: 0 }])
registerEndpoint('/api/tags', () => [])

describe('the blog page and the category list of the CMS', () => {
  it('renders a category the CMS has, whatever its slug', async () => {
    const wrapper = await mountSuspended(BlogPage, { route: '/blog/category/garden' })
    await flushPromises()
    expect(wrapper.find('h1').exists()).toBe(true)
  })

  it('raises a 404 for a category the CMS does not have', async () => {
    // The error is the app's, so the page shell is not rendered: the mount itself may fail
    try {
      await mountSuspended(BlogPage, { route: '/blog/category/cooking' })
    } catch {
      // The shell renders with the setup that threw; the 404 is what counts
    }
    expect(useError().value).toMatchObject({ statusCode: 404 })
    clearError()
  })
})
