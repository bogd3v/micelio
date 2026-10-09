import { describe, it, expect, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import BlogSidebar from '~/components/blog/Sidebar.vue'
import { READ_STORAGE_KEY } from '~/helpers/readArticles'

describe('BlogSidebar reading history', () => {
  beforeEach(() => {
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
    expect(wrapper.get('.myc-blog-feeds-label').text()).toBe('One feed per category:')
    const links = wrapper.findAll('.myc-blog-feed-link')
    expect(links.map(link => link.attributes('href'))).toEqual([
      '/feed/privacidad.xml', '/feed/diy.xml', '/feed/ia.xml', '/feed/software.xml', '/feed/linux.xml',
    ])
    expect(links.map(link => link.text())).toEqual(['Privacy ↗', 'DIY ↗', 'AI ↗', 'Software ↗', 'Linux ↗'])
    expect(links[2]!.attributes('aria-label')).toBe('RSS feed for AI')
    expect(wrapper.get('a[href="/feed.xml"]').text()).toContain('RSS')
  })
})
