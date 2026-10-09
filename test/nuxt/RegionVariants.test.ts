import { describe, it, expect } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import Centered from '~/theme/layout/header/Centered.vue'
import Minimal from '~/theme/layout/footer/Minimal.vue'
import HomeIndex from '~/theme/layout/home/Index.vue'
import List from '~/theme/layout/postList/List.vue'
import ArticleCentered from '~/theme/layout/article/Centered.vue'
import type { PostListItem, StrapiPost } from '~/interfaces'

describe('RegionHeaderCentered', () => {
  it('keeps the brand, navigation and actions in reading order under its own data-layout', async () => {
    const wrapper = await mountSuspended(Centered, { props: { active: 'blog', label: 'Main, centered' } })
    expect(wrapper.get('header').attributes('data-layout')).toBe('centered')
    const order = wrapper.findAll('.myc-brand, .myc-nav-main, .myc-nav-lang, .myc-nav-mobile, .myc-strip').map(element => element.classes().find(name => ['myc-brand', 'myc-nav-main', 'myc-nav-mobile', 'myc-strip'].includes(name)))
    expect(order).toEqual(['myc-brand', 'myc-nav-main', undefined, 'myc-nav-mobile', 'myc-strip'])
    expect(wrapper.get('.myc-nav-main').attributes('aria-label')).toBe('Main, centered')
    expect(wrapper.findAll('.myc-nav-link').map(link => link.attributes('aria-current'))).toEqual([undefined, 'page', undefined])
  })

  it('shows breadcrumbs and the reading progress on articles', async () => {
    const wrapper = await mountSuspended(Centered, { props: { reading: true, progress: 40, section: 'Intro' } })
    expect(wrapper.find('.myc-crumbs').exists()).toBe(true)
    expect(wrapper.find('.myc-progress').exists()).toBe(true)
  })

  it('emits search and menu', async () => {
    const wrapper = await mountSuspended(Centered)
    await wrapper.get('button.myc-chip').trigger('click')
    await wrapper.findAll('.myc-nav-mobile button').at(-1)!.trigger('click')
    expect(wrapper.emitted('search')).toHaveLength(1)
    expect(wrapper.emitted('menu')).toHaveLength(1)
  })
})

describe('RegionFooterMinimal', () => {
  it('renders one row of links, socials and the legal line, without accordions', async () => {
    const wrapper = await mountSuspended(Minimal, { props: { label: 'Navigate, minimal' } })
    expect(wrapper.get('footer').attributes('data-layout')).toBe('minimal')
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Navigate, minimal')
    expect(wrapper.findAll('nav .myc-foot-link').map(link => link.text())).toEqual(['Home', 'Blog', 'About'])
    expect(wrapper.find('.myc-acc').exists()).toBe(false)
    expect(wrapper.get('.myc-foot-privacy').attributes('href')).toBe('/privacy')
    expect(wrapper.find('a[href="/feed.xml"]').exists()).toBe(true)
  })
})

const POST = {
  id: 1,
  documentId: 'doc-1',
  title: 'A post',
  slug: 'a-post',
  description: 'Lead',
  publishedAt: '2026-01-01T10:00:00.000Z',
  readTime: 3,
  blocks: [{ __component: 'shared.rich-text', id: 1, body: '## First\n\nText\n\n## Second\n\nMore' }],
  tags: [{ id: 1, name: 'Vue', slug: 'vue' }],
  author: { name: 'Ada' },
} as unknown as StrapiPost

registerEndpoint('/api/fediverse/stats', () => ({ 'doc-1': { likes: 4, boosts: 1 } }))

describe('RegionHomeIndex', () => {
  it('has no hero: the introduction comes first, then the latest articles', async () => {
    const wrapper = await mountSuspended(HomeIndex, { props: { total: 0, counts: {}, topics: [] } })
    expect(wrapper.get('.myc-home').attributes('data-layout')).toBe('index')
    expect(wrapper.find('.myc-hero').exists()).toBe(false)
    expect(wrapper.find('.myc-home-featured').exists()).toBe(false)
    expect(wrapper.findAll('h1')).toHaveLength(1)
    const order = wrapper.findAll('.myc-home-lede, #latest').map(element => element.attributes('id') ?? element.classes()[0])
    expect(order).toEqual(['myc-home-lede', 'latest'])
    expect(wrapper.get('.myc-home-lede a').attributes('href')).toBe('/about')
  })
})

describe('RegionPostListList', () => {
  const posts = [POST, { ...POST, id: 2, slug: 'b', title: 'B', description: undefined, snippet: 'a <mark>hit</mark>' }] as unknown as PostListItem[]

  it('renders rows of date, title and excerpt in that reading order, whatever the view', async () => {
    for (const view of ['grid', 'log'] as const) {
      const wrapper = await mountSuspended(List, { props: { posts, view, federated: false } })
      expect(wrapper.get('div').attributes('data-layout')).toBe('list')
      expect(wrapper.find('.myc-blog-grid').exists()).toBe(false)
      const rows = wrapper.findAll('ol > li')
      expect(rows).toHaveLength(2)
      const order = rows[0]!.findAll('time, h3, p').map(element => element.element.tagName)
      expect(order).toEqual(['TIME', 'H3', 'P'])
      expect(rows[0]!.get('h3 a').attributes('href')).toBe('/blog/a-post')
    }
  })

  it('shows fediverse likes and boosts in the row meta when federated', async () => {
    const wrapper = await mountSuspended(List, { props: { posts, view: 'grid', federated: true } })
    await flushPromises()
    expect(wrapper.findAll('.myc-post-row')[0]!.get('.myc-post-row-meta').text().replace(/\s+/g, ' ')).toContain('◆ 4 likes · 1 boost')
  })

  it('highlights the search snippet', async () => {
    const wrapper = await mountSuspended(List, { props: { posts, view: 'grid', federated: false, highlight: 'hit' } })
    expect(wrapper.findAll('.myc-post-row')[1]!.get('.myc-post-row-excerpt').text()).toContain('hit')
  })
})

describe('RegionArticleCentered', () => {
  it('collapses the table of contents in a native details above the content, with everything else after it', async () => {
    const wrapper = await mountSuspended(ArticleCentered, { props: { post: POST, shareUrl: 'https://example.com/a-post' } })
    expect(wrapper.get('.myc-article-page').attributes('data-layout')).toBe('centered')
    const details = wrapper.get('details.myc-article-toc')
    expect(details.attributes('open')).toBeUndefined()
    expect(details.get('summary').text()).toBe('In this article')
    expect(details.findAll('.myc-toc-link')).toHaveLength(2)
    const order = wrapper.findAll('.myc-article-head, .myc-article-toc, .myc-article-content, .myc-article-after, .myc-article-share').map(element => element.classes().find(name => name.startsWith('myc-article-') && !name.endsWith('toc-summary')))
    expect(order).toEqual(['myc-article-head', 'myc-article-toc', 'myc-article-content', 'myc-article-after', 'myc-article-share'])
    expect(wrapper.find('.myc-article-after .myc-article-tags').exists()).toBe(true)
  })

  it('omits sharing and the table of contents in draft mode and without headings', async () => {
    const wrapper = await mountSuspended(ArticleCentered, { props: { post: { ...POST, blocks: [] } as StrapiPost, draft: true } })
    expect(wrapper.find('details').exists()).toBe(false)
    expect(wrapper.find('.myc-article-share').exists()).toBe(false)
  })
})
