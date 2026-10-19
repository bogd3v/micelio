import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { Component } from 'vue'
import type { Site, SocialLink, AppSiteConfig } from '~/interfaces'
import { siteFromAppConfig } from '~/helpers/site'
import RegionFooter from '~/theme/layout/footer/Columns.vue'
import RegionFooterMinimal from '~/theme/layout/footer/Minimal.vue'
import { GARDEN_CATEGORIES, categoriesSettled, serveCategories } from './categoriesFixture'

const socialLinks: SocialLink[] = [
  { network: 'linkedin', url: 'https://www.linkedin.com/in/ada' },
  { network: 'github', url: 'https://github.com/ada' },
  { network: 'codeberg', url: 'https://codeberg.org/ada' },
  { network: 'mastodon', url: 'https://mastodon.social/@ada' },
  { network: 'x', url: 'https://x.com/ada' },
]

describe('RegionFooter', () => {
  let unregister: (() => void) | undefined

  beforeEach(() => serveCategories())

  afterEach(() => {
    unregister?.()
    unregister = undefined
    clearNuxtData()
  })

  it('takes the name, author, social links and support handle from the site', async () => {
    const site: Site = {
      ...siteFromAppConfig(useAppConfig().site as AppSiteConfig),
      name: 'Micelio',
      author: { name: 'Grace', url: 'https://micelio.test/about' },
      socialLinks: [
        { network: 'gitlab', url: 'https://gitlab.com/micelio' },
        { network: 'x', url: 'https://x.com/micelio' },
      ],
      supportHandle: 'micelio',
    }
    unregister = registerEndpoint('/api/site', () => site)
    const wrapper = await mountSuspended(RegionFooter)
    await vi.waitFor(() => expect(wrapper.get('.myc-foot-legal span').text()).toBe(`© ${new Date().getFullYear()} Micelio · Grace`))
    expect(wrapper.get('a.myc-foot-brand').attributes('aria-label')).toBe('Micelio, home')
    expect(wrapper.findAll('a.myc-foot-soc').map(a => a.attributes('href'))).toEqual(['https://gitlab.com/micelio'])
    expect(wrapper.findAll('details.myc-acc')[2]!.findAll('a.myc-foot-row').at(-1)!.attributes('href')).toBe('https://www.buymeacoffee.com/micelio')
  })

  it('renders the brand, social links and desktop groups', async () => {
    unregister = registerEndpoint('/api/site', () => ({ ...siteFromAppConfig(useAppConfig().site as AppSiteConfig), socialLinks, supportHandle: 'ada' }))
    const wrapper = await mountSuspended(RegionFooter)
    await vi.waitFor(() => expect(wrapper.findAll('a.myc-foot-soc')).toHaveLength(4))
    expect(wrapper.get('a.myc-foot-brand').attributes('aria-label')).toBe('Micelio, home')
    const socials = wrapper.findAll('a.myc-foot-soc')
    expect(socials.map(a => a.text())).toEqual(['inLinkedIn↗', 'ghGitHub↗', 'cbCodeberg↗', 'mdMastodon↗'])
    expect(socials.every(a => a.attributes('rel') === 'noopener noreferrer me')).toBe(true)
    await vi.waitFor(() => expect(wrapper.findAll('nav.myc-foot-nav')).toHaveLength(3))
    const navs = wrapper.findAll('nav.myc-foot-nav')
    expect(navs.map(nav => nav.get('h2').text())).toEqual(['Navigate', 'Topics', 'Subscribe'])
    expect(navs[0]!.findAll('a').map(a => a.attributes('href'))).toEqual(['/', '/blog', '/about'])
    // Only the categories with articles, named by the CMS and in its order; the empty `shed` is left out
    expect(navs[1]!.findAll('a').map(a => [a.text(), a.attributes('href')])).toEqual([
      ['Garden', '/blog/category/garden'],
      ['Kitchen', '/blog/category/kitchen'],
      ['Workshop', '/blog/category/workshop'],
      ['Cellar', '/blog/category/cellar'],
      ['Loft', '/blog/category/loft'],
    ])
    expect(navs[1]!.findAll('.myc-foot-dot').map(dot => dot.attributes('style'))).toEqual([
      expect.stringContaining('var(--category-1)'), expect.stringContaining('var(--category-2)'),
      expect.stringContaining('var(--category-4)'), expect.stringContaining('var(--category-5)'), expect.stringContaining('var(--category-1)'),
    ])
    expect(navs[2]!.findAll('a').map(a => a.attributes('href'))).toEqual([
      '/feed.xml',
      '/#fediverso',
      '/#newsletter',
    ])
  })

  describe.each<[string, Component]>([['columns', RegionFooter], ['minimal', RegionFooterMinimal]])('with the neutral app.config defaults (%s)', (_name, Footer) => {
    it('shows the name alone, with no author separator, social links or support link', async () => {
      const wrapper = await mountSuspended(Footer)
      expect(wrapper.get('.myc-foot-legal span').text()).toBe(`© ${new Date().getFullYear()} Micelio`)
      expect(wrapper.find('a.myc-foot-soc').exists()).toBe(false)
      expect(wrapper.find('ul.myc-foot-socials').exists()).toBe(false)
      expect(wrapper.find('a[href*="buymeacoffee"]').exists()).toBe(false)
    })
  })

  it('lists only RSS under Subscribe when the fediverse, newsletter and support modules are off', async () => {
    const site: Site = {
      ...siteFromAppConfig(useAppConfig().site as AppSiteConfig),
      modules: { newsletter: false, comments: false, accounts: false, drafts: false, fediverse: false, search: false, support: false },
    }
    unregister = registerEndpoint('/api/site', () => site)
    const wrapper = await mountSuspended(RegionFooter)
    await vi.waitFor(() => expect(wrapper.findAll('nav.myc-foot-nav')[2]!.findAll('a').map(a => a.attributes('href'))).toEqual(['/feed.xml']))
    const subscribe = wrapper.findAll('details.myc-acc')[2]!
    expect(subscribe.get('.myc-acc-summary').text()).toBe('RSS')
    expect(subscribe.findAll('a.myc-foot-row').map(a => a.attributes('href'))).toEqual(['/feed.xml'])
  })

  it('folds the mobile groups with native details, topics open first', async () => {
    unregister = registerEndpoint('/api/site', () => ({ ...siteFromAppConfig(useAppConfig().site as AppSiteConfig), supportHandle: 'ada' }))
    const wrapper = await mountSuspended(RegionFooter)
    await vi.waitFor(() => expect(wrapper.findAll('details.myc-acc')[2]!.findAll('a.myc-foot-row').at(-1)!.attributes('href')).toBe('https://www.buymeacoffee.com/ada'))
    const groups = wrapper.findAll('details.myc-acc')
    expect(groups.map(group => group.get('.myc-acc-label').text())).toEqual(['Topics', 'Navigate', 'Subscribe'])
    expect(groups.map(group => group.attributes('open') !== undefined)).toEqual([true, false, false])
    expect(groups[0]!.get('.myc-acc-summary').text()).toBe('05')
    expect(groups[0]!.findAll('a.myc-foot-row')).toHaveLength(5)
    expect(groups[2]!.findAll('a.myc-foot-row').at(-1)!.attributes('href')).toBe('https://www.buymeacoffee.com/ada')
  })

  it('leaves the topics group out when the site has no categories or none has articles', async () => {
    serveCategories([])
    const empty = await mountSuspended(RegionFooter)
    await categoriesSettled()
    expect(empty.findAll('nav.myc-foot-nav').map(nav => nav.get('h2').text())).toEqual(['Navigate', 'Subscribe'])
    expect(empty.findAll('details.myc-acc').map(group => group.get('.myc-acc-label').text())).toEqual(['Navigate', 'Subscribe'])

    serveCategories(GARDEN_CATEGORIES.filter(category => category.count === 0))
    const unused = await mountSuspended(RegionFooter)
    await categoriesSettled()
    expect(unused.findAll('nav.myc-foot-nav').map(nav => nav.get('h2').text())).toEqual(['Navigate', 'Subscribe'])
  })

  it('keeps the panorama decorative', async () => {
    const wrapper = await mountSuspended(RegionFooter)
    const layers = wrapper.findAll('.bogota-land svg')
    expect(layers).toHaveLength(4)
    expect(layers.every(svg => svg.attributes('aria-hidden') === 'true')).toBe(true)
    expect(wrapper.get('.bogota-land img').attributes('alt')).toBe('')
    expect(wrapper.text()).toContain('Monserrate · 3,152 m')
  })

  it('links to the privacy page next to the copyright', async () => {
    const wrapper = await mountSuspended(RegionFooter)
    const link = wrapper.get('.myc-foot-legal a.myc-foot-privacy')
    expect(link.text()).toBe('Privacy and cookies')
    expect(link.attributes('href')).toBe('/privacy')
  })

  describe.each<[string, Component]>([['columns', RegionFooter], ['minimal', RegionFooterMinimal]])('source link (%s)', (_name, Footer) => {
    it('links to the upstream repository by default, next to the privacy link', async () => {
      const wrapper = await mountSuspended(Footer)
      const link = wrapper.get('.myc-foot-legal a.myc-foot-source')
      expect(link.text()).toBe('Source code↗')
      expect(link.attributes('href')).toBe('https://github.com/bogd3v/micelio')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    })

    it('uses the configured sourceUrl', async () => {
      const config = useRuntimeConfig().public
      const original = config.sourceUrl
      config.sourceUrl = 'https://git.example.com/me/micelio'
      try {
        const wrapper = await mountSuspended(Footer)
        expect(wrapper.get('a.myc-foot-source').attributes('href')).toBe('https://git.example.com/me/micelio')
      } finally {
        config.sourceUrl = original
      }
    })

    it.each(['', 'javascript:alert(1)'])('falls back to upstream when sourceUrl is %j', async (value) => {
      const config = useRuntimeConfig().public
      const original = config.sourceUrl
      config.sourceUrl = value
      try {
        const wrapper = await mountSuspended(Footer)
        expect(wrapper.get('a.myc-foot-source').attributes('href')).toBe('https://github.com/bogd3v/micelio')
      } finally {
        config.sourceUrl = original
      }
    })
  })
})
