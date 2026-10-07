import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { Category } from '~/interfaces'
import BlogFilters from '~/components/blog/Filters.vue'

const baseProps = {
  total: 3,
  counts: { [Category.Software]: 2, [Category.Linux]: 1 },
  tags: [{ slug: 'vue', name: 'Vue' }, { slug: 'linux', name: 'Linux' }],
  search: '',
}

describe('BlogFilters', () => {
  it('renders category and tag chips as links with aria-current', async () => {
    const wrapper = await mountSuspended(BlogFilters, {
      props: { ...baseProps, filters: { category: Category.Software, page: 2, search: 'vue' } },
    })
    const categories = wrapper.get('[role="group"][aria-label="Filter by category"]').findAll('a')
    expect(categories.map(chip => chip.text())).toEqual(['All03', 'Privacy00', 'DIY00', 'AI00', 'Software02', 'Linux01'])
    expect(categories.map(chip => chip.attributes('aria-current'))).toEqual([undefined, undefined, undefined, undefined, 'page', undefined])
    expect(categories.map(chip => chip.attributes('href'))).toEqual([
      '/blog?search=vue',
      '/blog/category/privacidad?search=vue',
      '/blog/category/diy?search=vue',
      '/blog/category/ia?search=vue',
      '/blog/category/software?search=vue',
      '/blog/category/linux?search=vue',
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
    const categories = wrapper.get('[role="group"][aria-label="Filter by category"]').findAll('a')
    expect(categories[5]!.attributes('href')).toBe('/blog/category/linux')
  })

  it('shows removable active filters and the search count', async () => {
    const wrapper = await mountSuspended(BlogFilters, {
      props: { ...baseProps, search: 'vue', resultCount: 1, filters: { tag: 'vue', search: 'vue', page: 1 } },
    })
    expect(wrapper.get('.bd-blog-search-count').text()).toBe('01 result')
    expect(wrapper.get('.bd-blog-hint').text()).toBe('3 letters minimum · searches titles')
    const active = wrapper.findAll('.bd-blog-active-chip')
    expect(active.map(chip => chip.attributes('aria-label'))).toEqual(['Remove filter #Vue', 'Remove filter «vue»'])
    await active[1]!.trigger('click')
    await wrapper.get('.bd-blog-textbtn').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['search']])
    expect(wrapper.emitted('clear')).toHaveLength(1)
  })

  it('toggles the content search and explains what it covers', async () => {
    const wrapper = await mountSuspended(BlogFilters, { props: { ...baseProps, filters: { page: 1 } } })
    const checkbox = wrapper.get('input[type="checkbox"]')
    expect(wrapper.get('.bd-blog-content-toggle').text()).toBe('Also search the content')
    expect((checkbox.element as HTMLInputElement).checked).toBe(false)
    await checkbox.setValue(true)
    expect(wrapper.emitted('content')).toEqual([[true]])

    const enabled = await mountSuspended(BlogFilters, { props: { ...baseProps, filters: { page: 1, content: true } } })
    expect((enabled.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
    expect(enabled.get('.bd-blog-hint').text()).toBe('3 letters minimum · searches titles, summaries and content')
  })

  it('updates the search model as the reader types', async () => {
    const wrapper = await mountSuspended(BlogFilters, { props: { ...baseProps, filters: { page: 1 } } })
    await wrapper.get('input[type="search"]').setValue('linux')
    expect(wrapper.emitted('update:search')).toEqual([['linux']])
    expect(wrapper.find('.bd-blog-active').exists()).toBe(false)
  })
})
