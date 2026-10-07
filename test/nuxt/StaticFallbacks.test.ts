import { afterEach, describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { Category } from '~/interfaces'
import BdTabBar from '~/components/bd/BdTabBar.vue'
import BdThemeSwitch from '~/components/bd/BdThemeSwitch.vue'
import BdLangSwitch from '~/components/bd/BdLangSwitch.vue'
import BlogFilters from '~/components/blog/Filters.vue'
import CopyLinkButton from '~/components/blog/CopyLinkButton.vue'
import SkipLinks from '~/components/layout/SkipLinks.vue'
import Header from '~/theme/layout/header/Bar.vue'
import Footer from '~/theme/layout/footer/Columns.vue'

// Static pages run no Vue (ADR 0006, section 3): shared controls fall back to plain HTML
function setMode(mode: 'dynamic' | 'static'): void {
  useRuntimeConfig().public.siteMode = mode
}

describe('static fallbacks', () => {
  afterEach(() => setMode('dynamic'))

  describe('tab bar', () => {
    it('keeps buttons in dynamic', async () => {
      const wrapper = await mountSuspended(BdTabBar)
      expect(wrapper.findAll('button.bd-tab')).toHaveLength(2)
    })

    it('links search to the blog and the menu to the footer navigation in static', async () => {
      setMode('static')
      const wrapper = await mountSuspended(BdTabBar)
      expect(wrapper.find('button').exists()).toBe(false)
      const links = wrapper.findAll('a.bd-tab')
      expect(links.map(link => link.attributes('href'))).toEqual(['/', '/blog', '/blog', '#bd-foot-nav'])
      expect(links.map(link => link.text())).toEqual(['Home', 'Blog', 'Search', 'Menu'])
      expect(links.some(link => link.attributes('aria-haspopup'))).toBe(false)
    })
  })

  describe('header', () => {
    it('keeps the search button, shortcut and theme switch in dynamic', async () => {
      const wrapper = await mountSuspended(Header, { props: { active: 'home' } })
      expect(wrapper.find('button.bd-chip[aria-keyshortcuts]').exists()).toBe(true)
      expect(wrapper.findAll('button.bd-iconbtn')).toHaveLength(2)
      expect(wrapper.find('[aria-label="Color theme"]').exists()).toBe(true)
    })

    it('has search and menu links, no theme switch and no dead buttons in static', async () => {
      setMode('static')
      const wrapper = await mountSuspended(Header, { props: { active: 'home' } })
      const search = wrapper.get('a.bd-chip[href="/blog"]')
      expect(search.text()).toBe('Search')
      expect(search.attributes('aria-keyshortcuts')).toBeUndefined()
      expect(wrapper.get('a.bd-iconbtn[aria-label="Search"]').attributes('href')).toBe('/blog')
      expect(wrapper.get('a.bd-iconbtn[aria-label="Open menu"]').attributes('href')).toBe('#bd-foot-nav')
      expect(wrapper.find('[aria-label="Color theme"]').exists()).toBe(false)
      expect(wrapper.findAll('button.bd-seg')).toHaveLength(0)
    })
  })

  describe('footer', () => {
    it('has the navigation anchor, open sections, language links and a top link in static only', async () => {
      const dynamic = await mountSuspended(Footer)
      expect(dynamic.find('#bd-foot-nav').exists()).toBe(false)
      expect(dynamic.find('button.bd-foot-top').exists()).toBe(true)

      setMode('static')
      const wrapper = await mountSuspended(Footer)
      const nav = wrapper.get('#bd-foot-nav')
      expect(nav.findAll('details').map(details => details.attributes('open') !== undefined)).toEqual([true, true, false])
      expect(nav.findAll('a.bd-seg').map(link => link.attributes('hreflang'))).toEqual(['es', 'en'])
      expect(wrapper.find('button').exists()).toBe(false)
      expect(wrapper.get('a.bd-foot-top').attributes('href')).toBe('#')
    })
  })

  describe('language and theme switches', () => {
    it('renders the language options as links in static', async () => {
      setMode('static')
      const wrapper = await mountSuspended(BdLangSwitch)
      expect(wrapper.findAll('button')).toHaveLength(0)
      const links = wrapper.findAll('a')
      expect(links.map(link => link.attributes('href'))).toEqual(['/es', '/'])
      expect(links.map(link => link.attributes('aria-current'))).toEqual([undefined, 'true'])
      expect(links.map(link => link.attributes('aria-label'))).toEqual(['Español', 'English'])
    })

    it('sends the other language of an article to its blog until the translation is known', async () => {
      setMode('static')
      const wrapper = await mountSuspended(BdLangSwitch, { route: '/blog/what-is-solarpunk' })
      expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual(['/es/blog', '/blog/what-is-solarpunk'])
    })

    it('hides the theme switch in static', async () => {
      expect((await mountSuspended(BdThemeSwitch)).findAll('button').length).toBeGreaterThan(1)
      setMode('static')
      expect((await mountSuspended(BdThemeSwitch)).find('button').exists()).toBe(false)
    })
  })

  describe('skip links', () => {
    it('drops the skip to search link in static', async () => {
      expect((await mountSuspended(SkipLinks)).findAll('a')).toHaveLength(2)
      setMode('static')
      expect((await mountSuspended(SkipLinks)).findAll('a')).toHaveLength(1)
    })
  })

  describe('blog filters and copy link', () => {
    const props = {
      total: 3,
      counts: { [Category.Software]: 2 },
      tags: [{ slug: 'vue', name: 'Vue' }],
      search: '',
      filters: { category: Category.Software, page: 1 },
    }

    it('keeps the search input and the removable chips as buttons in dynamic', async () => {
      const wrapper = await mountSuspended(BlogFilters, { props })
      expect(wrapper.find('input[type="search"]').exists()).toBe(true)
      expect(wrapper.find('button.bd-blog-active-chip').exists()).toBe(true)
    })

    it('has no search input and links the active chip back to the blog in static', async () => {
      setMode('static')
      const wrapper = await mountSuspended(BlogFilters, { props })
      expect(wrapper.find('input').exists()).toBe(false)
      expect(wrapper.find('button').exists()).toBe(false)
      const chip = wrapper.get('a.bd-blog-active-chip')
      expect(chip.attributes('href')).toBe('/blog')
      expect(chip.attributes('aria-label')).toBe('Remove filter Software')
    })

    it('hides the copy link button in static', async () => {
      const url = 'https://micelio.test/blog/a'
      expect((await mountSuspended(CopyLinkButton, { props: { url } })).find('button').exists()).toBe(true)
      setMode('static')
      expect((await mountSuspended(CopyLinkButton, { props: { url } })).find('button').exists()).toBe(false)
    })
  })
})
