import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { Category } from '~/interfaces'
import BlogPagination from '~/components/blog/Pagination.vue'

describe('BlogPagination', () => {
  it('links pages inside a labelled nav and keeps the filters', async () => {
    const wrapper = await mountSuspended(BlogPagination, {
      props: { filters: { category: Category.Linux, page: 2 }, totalPages: 3, pageSize: 6 },
    })
    const nav = wrapper.get('nav')
    expect(nav.attributes('aria-label')).toBe('Pagination')
    const pages = wrapper.findAll('.bd-page-list a')
    expect(pages.map(page => page.text())).toEqual(['01', '02', '03'])
    expect(pages.map(page => page.attributes('href'))).toEqual([
      '/blog/category/linux',
      '/blog/category/linux/page/2',
      '/blog/category/linux/page/3',
    ])
    expect(pages[1]!.attributes('aria-current')).toBe('page')
    expect(wrapper.get('a[aria-label="Previous page"]').attributes('href')).toBe('/blog/category/linux')
    expect(wrapper.get('a[aria-label="Next page"]').attributes('href')).toBe('/blog/category/linux/page/3')
    expect(wrapper.get('.bd-page-status').text()).toBe('Page 02 of 03 · 6 per page')
  })

  it('disables the steps on a single page', async () => {
    const wrapper = await mountSuspended(BlogPagination, { props: { filters: { page: 1 }, totalPages: 1, pageSize: 6 } })
    expect(wrapper.findAll('[aria-disabled="true"]')).toHaveLength(2)
    expect(wrapper.findAll('a.bd-page-step')).toHaveLength(0)
  })
})
