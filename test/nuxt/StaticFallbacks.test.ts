import { afterEach, describe, it, expect } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { Category } from '~/interfaces'
import BdTabBar from '~/components/bd/BdTabBar.vue'
import BdThemeSwitch from '~/components/bd/BdThemeSwitch.vue'
import BdLangSwitch from '~/components/bd/BdLangSwitch.vue'
import BlogFilters from '~/components/blog/Filters.vue'
import CopyLinkButton from '~/components/blog/CopyLinkButton.vue'
import SkipLinks from '~/components/layout/SkipLinks.vue'
import HomeLatest from '~/components/home/Latest.vue'
import OpenSourceBlock from '~/components/strapi/OpenSourceBlock.vue'
import SliderBlock from '~/components/strapi/SliderBlock.vue'
import BlogPage from '~/pages/blog/index.vue'
import HeaderCentered from '~/theme/layout/header/Centered.vue'
import FooterMinimal from '~/theme/layout/footer/Minimal.vue'
import type { StrapiMediaFile, StrapiOpenSource, StrapiSlider } from '~/interfaces'
import Header from '~/theme/layout/header/Bar.vue'
import Footer from '~/theme/layout/footer/Columns.vue'

registerEndpoint('/api/posts', () => ({ data: [], meta: { pagination: { page: 1, pageSize: 6, pageCount: 1, total: 0 } } }))
registerEndpoint('/api/categories', () => [])
registerEndpoint('/api/tags', () => [])

// Static pages run no Vue (ADR 0006, section 3): shared controls fall back to plain HTML
function setMode(mode: 'dynamic' | 'static'): void {
  useRuntimeConfig().public.siteMode = mode
}

describe('static fallbacks', () => {
  afterEach(() => setMode('dynamic'))

  describe('tab bar', () => {
    it('keeps buttons in dynamic', async () => {
      const wrapper = await mountSuspended(BdTabBar)
      expect(wrapper.findAll('button.myc-tab')).toHaveLength(2)
    })

    it('links search to the blog and the menu to the footer navigation in static', async () => {
      setMode('static')
      const wrapper = await mountSuspended(BdTabBar)
      expect(wrapper.find('button').exists()).toBe(false)
      const links = wrapper.findAll('a.myc-tab')
      expect(links.map(link => link.attributes('href'))).toEqual(['/', '/blog', '/blog', '#myc-site-nav'])
      expect(links.map(link => link.text())).toEqual(['Home', 'Blog', 'Search', 'Menu'])
      expect(links.some(link => link.attributes('aria-haspopup'))).toBe(false)
    })
  })

  describe('header', () => {
    it('keeps the search button, shortcut and theme switch in dynamic', async () => {
      const wrapper = await mountSuspended(Header, { props: { active: 'home' } })
      expect(wrapper.find('button.myc-chip[aria-keyshortcuts]').exists()).toBe(true)
      expect(wrapper.findAll('button.myc-iconbtn')).toHaveLength(2)
      expect(wrapper.find('[aria-label="Color theme"]').exists()).toBe(true)
    })

    it('has search and menu links, no theme switch and no dead buttons in static', async () => {
      setMode('static')
      const wrapper = await mountSuspended(Header, { props: { active: 'home' } })
      const search = wrapper.get('a.myc-chip[href="/blog"]')
      expect(search.text()).toBe('Search')
      expect(search.attributes('aria-keyshortcuts')).toBeUndefined()
      expect(wrapper.get('a.myc-iconbtn[aria-label="Search"]').attributes('href')).toBe('/blog')
      expect(wrapper.get('a.myc-iconbtn[aria-label="Menu"]').attributes('href')).toBe('#myc-site-nav')
      expect(wrapper.find('[aria-label="Color theme"]').exists()).toBe(false)
      expect(wrapper.findAll('button.myc-seg')).toHaveLength(0)
    })
  })

  describe('footer', () => {
    it('has the navigation anchor, open sections, language links and a top link in static only', async () => {
      const dynamic = await mountSuspended(Footer)
      expect(dynamic.find('#myc-site-nav').exists()).toBe(false)
      expect(dynamic.find('button.myc-foot-top').exists()).toBe(true)

      setMode('static')
      const wrapper = await mountSuspended(Footer)
      const nav = wrapper.get('#myc-site-nav')
      expect(nav.findAll('details').map(details => details.attributes('open') !== undefined)).toEqual([true, true, false])
      expect(nav.findAll('a.myc-seg').map(link => link.attributes('hreflang'))).toEqual(['es', 'en'])
      expect(wrapper.find('button').exists()).toBe(false)
      expect(wrapper.get('a.myc-foot-top').attributes('href')).toBe('#main-content')
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

    it('falls back to the blog of the other language on blog pages, until the build rewrites the href', async () => {
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
      expect(wrapper.find('button.myc-blog-active-chip').exists()).toBe(true)
    })

    it('has no search input and links the active chip back to the blog in static', async () => {
      setMode('static')
      const wrapper = await mountSuspended(BlogFilters, { props })
      expect(wrapper.find('input').exists()).toBe(false)
      expect(wrapper.find('button').exists()).toBe(false)
      const chip = wrapper.get('a.myc-blog-active-chip')
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

  describe('other variants and blocks', () => {
    it('gives the centered header the same links', async () => {
      setMode('static')
      const wrapper = await mountSuspended(HeaderCentered, { props: { active: 'home' } })
      expect(wrapper.find('button').exists()).toBe(false)
      expect(wrapper.get('a.myc-iconbtn[aria-label="Menu"]').attributes('href')).toBe('#myc-site-nav')
      expect(wrapper.get('a.myc-chip[href="/blog"]').text()).toBe('Search')
    })

    it('puts the anchor and the language links in the minimal footer in static only', async () => {
      expect((await mountSuspended(FooterMinimal)).find('.myc-lang').exists()).toBe(false)
      setMode('static')
      const wrapper = await mountSuspended(FooterMinimal)
      expect(wrapper.find('nav#myc-site-nav').exists()).toBe(true)
      expect(wrapper.findAll('.myc-lang a').map(link => link.attributes('data-myc-lang'))).toEqual(['es', 'en'])
    })

    it('links the home topic chips to the blog and its categories in static', async () => {
      setMode('static')
      const wrapper = await mountSuspended(HomeLatest, { props: { total: 1, counts: {} } })
      await flushPromises()
      expect(wrapper.find('.myc-latest-filters button').exists()).toBe(false)
      const hrefs = wrapper.findAll('.myc-latest-filters a.myc-chip').map(chip => chip.attributes('href'))
      expect(hrefs[0]).toBe('/blog')
      expect(hrefs[1]).toBe('/blog/category/privacidad')
    })

    it('links "clear filters" and has no view, sort or search controls on the blog in static', async () => {
      setMode('static')
      const wrapper = await mountSuspended(BlogPage, { route: '/blog/category/ia' })
      await flushPromises()
      expect(wrapper.find('.myc-blog-controls').exists()).toBe(false)
      expect(wrapper.find('input[type="search"]').exists()).toBe(false)
      expect(wrapper.find('.myc-blog-empty button').exists()).toBe(false)
      expect(wrapper.get('.myc-blog-empty a.myc-chip').attributes('href')).toBe('/blog')
    })

    it('sends the search link of the open-source guide to the blog in static', async () => {
      const block = {
        id: 1,
        __component: 'about.open-source',
        guide: [{ id: 1, text: 'Search', html: '<a href="#search">Search</a>' }],
      } as unknown as StrapiOpenSource
      expect((await mountSuspended(OpenSourceBlock, { props: { block } })).get('.myc-guide-list a').attributes('href')).toBe('#search')
      setMode('static')
      expect((await mountSuspended(OpenSourceBlock, { props: { block } })).get('.myc-guide-list a').attributes('href')).toBe('/blog')
    })

    it('drops the slider controls in static', async () => {
      const file = { id: 1, url: '/a.jpg', alternativeText: 'A' } as unknown as StrapiMediaFile
      const block: StrapiSlider = { id: 1, __component: 'shared.slider', files: [file, { ...file, url: '/b.jpg' }] }
      expect((await mountSuspended(SliderBlock, { props: { block } })).findAll('button').length).toBeGreaterThan(0)
      setMode('static')
      expect((await mountSuspended(SliderBlock, { props: { block } })).find('button').exists()).toBe(false)
    })
  })
})
