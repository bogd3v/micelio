import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BlogFilters from '~/components/blog/Filters.vue'
import { categoriesSettled, serveCategories } from './categoriesFixture'

const baseProps = {
  total: 3,
  tags: [{ slug: 'vue', name: 'Vue' }, { slug: 'linux', name: 'Linux' }],
  search: '',
}

describe('BlogFilters', () => {
  beforeEach(() => serveCategories())

  it('renders category and tag chips as links with aria-current', async () => {
    const wrapper = await mountSuspended(BlogFilters, {
      props: { ...baseProps, filters: { category: 'cellar', page: 2, search: 'vue' } },
    })
    await vi.waitFor(() => expect(wrapper.findAll('.myc-blog-chips')[0]!.findAll('a')).toHaveLength(6))
    const categories = wrapper.get('[role="group"][aria-label="Filter by category"]').findAll('a')
    expect(categories.map(chip => chip.text())).toEqual(['All03', 'Garden03', 'Kitchen02', 'Workshop01', 'Cellar04', 'Loft05'])
    expect(categories.map(chip => chip.attributes('aria-current'))).toEqual([undefined, undefined, undefined, undefined, 'page', undefined])
    expect(categories.map(chip => chip.attributes('href'))).toEqual([
      '/blog?search=vue',
      '/blog/category/garden?search=vue',
      '/blog/category/kitchen?search=vue',
      '/blog/category/workshop?search=vue',
      '/blog/category/cellar?search=vue',
      '/blog/category/loft?search=vue',
    ])
    const tags = wrapper.get('[role="group"][aria-label="Filter by tag"]').findAll('a')
    expect(tags.map(chip => chip.text())).toEqual(['#Vue', '#Linux'])
    expect(tags.map(chip => chip.attributes('href'))).toEqual(['/blog/tag/vue?search=vue', '/blog/tag/linux?search=vue'])
  })

  it('replaces the other filter and toggles the active tag off', async () => {
    const wrapper = await mountSuspended(BlogFilters, { props: { ...baseProps, filters: { tag: 'vue', page: 1 } } })
    const tags = wrapper.get('[role="group"][aria-label="Filter by tag"]').findAll('a')
    expect(tags.map(chip => chip.attributes('aria-current'))).toEqual(['page', undefined])
    expect(tags[0]!.attributes('href')).toBe('/blog')
    await vi.waitFor(() => expect(wrapper.get('[role="group"][aria-label="Filter by category"]').findAll('a')).toHaveLength(6))
    const categories = wrapper.get('[role="group"][aria-label="Filter by category"]').findAll('a')
    expect(categories[5]!.attributes('href')).toBe('/blog/category/loft')
  })

  it('keeps the category being viewed as a chip when it has no articles', async () => {
    const wrapper = await mountSuspended(BlogFilters, { props: { ...baseProps, filters: { category: 'shed', page: 1 } } })
    await vi.waitFor(() => expect(wrapper.findAll('[aria-label="Filter by category"] a')).toHaveLength(7))
    const current = wrapper.get('[aria-label="Filter by category"] a[aria-current="page"]')
    expect(current.text()).toBe('Shed00')
    expect(wrapper.get('.myc-blog-active-chip').attributes('aria-label')).toBe('Remove filter Shed')
  })

  it('renders no category chips for a site without categories', async () => {
    serveCategories([])
    const wrapper = await mountSuspended(BlogFilters, { props: { ...baseProps, filters: { page: 1 } } })
    await categoriesSettled()
    expect(wrapper.find('[aria-label="Filter by category"]').exists()).toBe(false)
    expect(wrapper.find('[aria-label="Filter by tag"]').exists()).toBe(true)
  })

  it('shows removable active filters and the search count', async () => {
    const wrapper = await mountSuspended(BlogFilters, {
      props: { ...baseProps, search: 'vue', resultCount: 1, filters: { tag: 'vue', search: 'vue', page: 1 } },
    })
    expect(wrapper.get('.myc-blog-search-count').text()).toBe('01 result')
    expect(wrapper.get('.myc-blog-hint').text()).toBe('3 letters minimum · searches titles')
    const active = wrapper.findAll('.myc-blog-active-chip')
    expect(active.map(chip => chip.attributes('aria-label'))).toEqual(['Remove filter #Vue', 'Remove filter «vue»'])
    await active[1]!.trigger('click')
    await wrapper.get('.myc-blog-textbtn').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['search']])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('toggles the content search and explains what it covers', async () => {
    const wrapper = await mountSuspended(BlogFilters, { props: { ...baseProps, filters: { page: 1 } } })
    const checkbox = wrapper.get('input[type="checkbox"]')
    expect(wrapper.get('.myc-blog-content-toggle').text()).toBe('Also search the content')
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
    await checkbox.setValue(true)
    expect(wrapper.emitted('content')).toEqual([[true]])

    const enabled = await mountSuspended(BlogFilters, { props: { ...baseProps, filters: { page: 1, content: true } } })
    expect((enabled.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
    expect(enabled.get('.myc-blog-hint').text()).toBe('3 letters minimum · searches titles, summaries and content')
  })

  it('updates the search model as the reader types', async () => {
    const wrapper = await mountSuspended(BlogFilters, { props: { ...baseProps, filters: { page: 1 } } })
    await wrapper.get('input[type="search"]').setValue('linux')
    expect(wrapper.emitted('update:search')).toEqual([['linux']])
    expect(wrapper.find('.myc-blog-active').exists()).toBe(false)
  })
})
