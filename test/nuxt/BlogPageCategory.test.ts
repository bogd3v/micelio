import { afterEach, describe, it, expect } from 'vitest'
import { getQuery } from 'h3'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import BlogPage from '~/pages/blog/index.vue'

const postQueries: Array<Record<string, unknown>> = []
const categoryQueries: Array<Record<string, unknown>> = []

registerEndpoint('/api/posts', (event) => {
  postQueries.push(getQuery(event))
  return { data: [], meta: { pagination: { page: 1, pageSize: 6, pageCount: 1, total: 0 } } }
})
registerEndpoint('/api/categories', (event) => {
  categoryQueries.push(getQuery(event))
  return [{ id: 1, slug: 'garden', name: 'Garden', count: 0 }]
})
registerEndpoint('/api/tags', () => [])

afterEach(() => {
  clearError()
  postQueries.length = 0
  categoryQueries.length = 0
})

describe('the blog page and the category list of the CMS', () => {
  it('filters by a category the CMS has, whatever its slug', async () => {
    const wrapper = await mountSuspended(BlogPage, { route: '/blog/category/garden' })
    await flushPromises()
    expect(wrapper.find('h1').exists()).toBe(true)
    expect(postQueries.some(query => query.category === 'garden')).toBe(true)
    expect(useError().value).toBeFalsy()
  })

  it('raises a 404 for a category the CMS does not have', async () => {
    try {
      await mountSuspended(BlogPage, { route: '/blog/category/cooking' })
    } catch {
      // The shell renders with the setup that threw; the 404 is what counts
    }
    expect(useError().value).toMatchObject({ statusCode: 404 })
  })

  it('reads the list again when the language changes', async () => {
    await mountSuspended(BlogPage, { route: '/blog/category/garden' })
    await flushPromises()
    await useNuxtApp().$i18n.setLocale('es')
    await flushPromises()
    expect(categoryQueries.map(query => query.locale)).toContain('es')
    await useNuxtApp().$i18n.setLocale('en')
  })
})
