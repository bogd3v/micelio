import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import BlogSidebar from '~/components/blog/Sidebar.vue'
import { READ_STORAGE_KEY } from '~/helpers/readArticles'
import { categoriesSettled, serveCategories } from './categoriesFixture'

describe('BlogSidebar reading history', () => {
  beforeEach(() => {
    serveCategories()
    localStorage.clear()
    useState('myc-read-articles').value = []
    useState('myc-read-articles-loaded').value = false
  })

  it('hides the section while nothing has been read', async () => {
    const wrapper = await mountSuspended(BlogSidebar, { props: { recentPosts: [] } })
    await flushPromises()
    expect(wrapper.find('#myc-blog-read').exists()).toBe(false)
  })

  it('counts the read articles and clears the history', async () => {
    localStorage.setItem(READ_STORAGE_KEY, '["doc-rag","doc-vue"]')
    const wrapper = await mountSuspended(BlogSidebar, { props: { recentPosts: [] } })
    await flushPromises()
    expect(wrapper.get('#myc-blog-read').text()).toBe('Your reading')
    expect(wrapper.get('.myc-blog-read-note').text()).toBe('02 articles read · kept in your browser')

    await wrapper.get('button.myc-blog-textbtn').trigger('click')
    expect(localStorage.getItem(READ_STORAGE_KEY)).toBeNull()
    expect(wrapper.get('.myc-blog-read-note').text()).toBe('History cleared')
    expect(wrapper.find('button.myc-blog-textbtn').exists()).toBe(false)
  })

  it('links the full feed and one feed per category', async () => {
    const wrapper = await mountSuspended(BlogSidebar, { props: { recentPosts: [] } })
    await vi.waitFor(() => expect(wrapper.findAll('.myc-blog-feed-link')).toHaveLength(5))
    expect(wrapper.get('.myc-blog-feeds-label').text()).toBe('One feed per category:')
    const links = wrapper.findAll('.myc-blog-feed-link')
    // The empty `shed` has no feed link
    expect(links.map(link => link.attributes('href'))).toEqual([
      '/feed/garden.xml', '/feed/kitchen.xml', '/feed/workshop.xml', '/feed/cellar.xml', '/feed/loft.xml',
    ])
    expect(links.map(link => link.text())).toEqual(['Garden ↗', 'Kitchen ↗', 'Workshop ↗', 'Cellar ↗', 'Loft ↗'])
    expect(links[1]!.attributes('aria-label')).toBe('RSS feed for Kitchen')
    expect(wrapper.get('a[href="/feed.xml"]').text()).toContain('RSS')
  })

  it('has no per-category feeds for a site without categories, only the full feed', async () => {
    serveCategories([])
    const wrapper = await mountSuspended(BlogSidebar, { props: { recentPosts: [] } })
    await categoriesSettled()
    expect(wrapper.find('.myc-blog-feeds').exists()).toBe(false)
    expect(wrapper.get('a[href="/feed.xml"]').text()).toContain('RSS')
  })
})
