import { afterEach, describe, it, expect, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import BdSearchTrigger from '~/components/bd/BdSearchTrigger.vue'
import BdTabBar from '~/components/bd/BdTabBar.vue'
import SectionRenderer from '~/components/section/SectionRenderer.vue'
import Header from '~/theme/layout/header/Bar.vue'
import Footer from '~/theme/layout/footer/Columns.vue'
import FooterMinimal from '~/theme/layout/footer/Minimal.vue'
import type { PageSection } from '~/interfaces'

// A landing (ADR 0006, section 1): navigation from the sections of the home page; with no articles, no link to the blog
const sections: PageSection[] = [
  { __component: 'section.hero', variant: 'centered', title: 'Welcome', primaryLink: { label: 'Start', url: '/privacy' } },
  { __component: 'section.feature-grid', variant: 'grid', title: 'Features', items: [] },
  { __component: 'section.faq', variant: 'list', title: 'Questions', items: [] },
  { __component: 'section.post-list', variant: 'cards', title: 'Latest', count: 3, posts: [] },
]

registerEndpoint('/api/site', () => ({
  name: 'Field Notes',
  author: { name: 'Sam' },
  socialLinks: [],
  modules: { newsletter: false, comments: false, accounts: false, drafts: false, fediverse: false, search: true, support: false },
  homePage: { slug: 'home' },
}))
registerEndpoint('/api/pages/home', () => ({ documentId: 'home', title: 'Home', slug: 'home', sections, translations: [] }))

function setBuild(mode: 'dynamic' | 'landing', blogEnabled: boolean): void {
  const config = useRuntimeConfig().public
  config.siteMode = mode
  config.blogEnabled = blogEnabled
}

describe('landing without a blog', () => {
  afterEach(() => {
    setBuild('dynamic', true)
    clearNuxtData()
  })

  it('has no blog tab, and the search tab goes to the site navigation', async () => {
    setBuild('landing', false)
    const wrapper = await mountSuspended(BdTabBar)
    expect(wrapper.findAll('a.myc-tab').map(link => link.attributes('href'))).toEqual(['/', '/#myc-site-nav', '#myc-site-nav'])
  })

  it('sends the search control to the site navigation, not to a blog list', async () => {
    setBuild('landing', false)
    const wrapper = await mountSuspended(BdSearchTrigger)
    expect(wrapper.get('a').attributes('href')).toBe('/#myc-site-nav')
    setBuild('landing', true)
    expect((await mountSuspended(BdSearchTrigger)).get('a').attributes('href')).toBe('/blog')
  })

  it('shows anchors to the titled sections in the header, once the home page has loaded', async () => {
    setBuild('landing', false)
    const wrapper = await mountSuspended(Header, { props: { active: 'home' } })
    await vi.waitFor(() => expect(wrapper.get('.myc-nav-main').text()).toContain('Features'))
    const links = wrapper.get('.myc-nav-main').findAll('a')
    expect(links.map(link => [link.text(), link.attributes('href')])).toEqual([
      ['Features', '/#section-features'],
      ['Questions', '/#section-questions'],
      ['Start', '/privacy'],
    ])
    expect(links.some(link => link.attributes('aria-current'))).toBe(false)
  })

  it('lists them in the footer, without categories or the feed', async () => {
    setBuild('landing', false)
    const wrapper = await mountSuspended(Footer)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Features'))
    const hrefs = wrapper.findAll('a').map(link => link.attributes('href') ?? '')
    expect(hrefs).toContain('/#section-features')
    expect(hrefs.filter(href => /\/blog|\/feed/.test(href))).toEqual([])
    expect(wrapper.find('.myc-foot-nav-topics').exists()).toBe(false)
    expect(wrapper.findAll('details').map(group => group.get('.myc-acc-label').text())).not.toContain('Topics')
    const minimal = await mountSuspended(FooterMinimal)
    await vi.waitFor(() => expect(minimal.text()).toContain('Features'))
    expect(minimal.findAll('a').map(link => link.attributes('href') ?? '').filter(href => /\/blog|\/feed/.test(href))).toEqual([])
  })

  it('keeps the blog in the navigation of a landing that has articles', async () => {
    setBuild('landing', true)
    const wrapper = await mountSuspended(Header, { props: { active: 'home' } })
    await vi.waitFor(() => expect(wrapper.get('.myc-nav-main').text()).toContain('Features'))
    expect(wrapper.get('.myc-nav-main').findAll('a').map(link => link.text())).toEqual(['Features', 'Questions', 'Start', 'Blog'])
  })

  it('gives the sections the ids the navigation links to, and only in a landing', async () => {
    setBuild('landing', false)
    const landing = await mountSuspended(SectionRenderer, { props: { sections } })
    expect(landing.findAll('section[id]').map(section => section.attributes('id'))).toEqual(['section-features', 'section-questions'])
    setBuild('dynamic', true)
    const dynamic = await mountSuspended(SectionRenderer, { props: { sections } })
    expect(dynamic.findAll('section[id]')).toHaveLength(0)
  })
})
