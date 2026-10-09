import { afterEach, describe, it, expect, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { Component } from 'vue'
import type { Site, SocialLink } from '~/interfaces'
import { siteFromAppConfig } from '~/helpers/site'
import type { AppSiteConfig } from '~/helpers/site'
import RegionFooter from '~/theme/layout/footer/Columns.vue'
import RegionFooterMinimal from '~/theme/layout/footer/Minimal.vue'

const socialLinks: SocialLink[] = [
  { network: 'linkedin', url: 'https://www.linkedin.com/in/ada' },
  { network: 'github', url: 'https://github.com/ada' },
  { network: 'codeberg', url: 'https://codeberg.org/ada' },
  { network: 'mastodon', url: 'https://mastodon.social/@ada' },
  { network: 'x', url: 'https://x.com/ada' },
]

describe('RegionFooter', () => {
  let unregister: (() => void) | undefined

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
    await vi.waitFor(() => expect(wrapper.get('.bd-foot-legal span').text()).toBe(`© ${new Date().getFullYear()} Micelio · Grace`))
    expect(wrapper.get('a.bd-foot-brand').attributes('aria-label')).toBe('Micelio, home')
    expect(wrapper.findAll('a.bd-foot-soc').map(a => a.attributes('href'))).toEqual(['https://gitlab.com/micelio'])
    expect(wrapper.findAll('details.bd-acc')[2]!.findAll('a.bd-foot-row').at(-1)!.attributes('href')).toBe('https://www.buymeacoffee.com/micelio')
  })

  it('renders the brand, social links and desktop groups', async () => {
    unregister = registerEndpoint('/api/site', () => ({ ...siteFromAppConfig(useAppConfig().site as AppSiteConfig), socialLinks, supportHandle: 'ada' }))
    const wrapper = await mountSuspended(RegionFooter)
    await vi.waitFor(() => expect(wrapper.findAll('a.bd-foot-soc')).toHaveLength(4))
    expect(wrapper.get('a.bd-foot-brand').attributes('aria-label')).toBe('Micelio, home')
    const socials = wrapper.findAll('a.bd-foot-soc')
    expect(socials.map(a => a.text())).toEqual(['inLinkedIn↗', 'ghGitHub↗', 'cbCodeberg↗', 'mdMastodon↗'])
    expect(socials.every(a => a.attributes('rel') === 'noopener noreferrer me')).toBe(true)
    const navs = wrapper.findAll('nav.bd-foot-nav')
    expect(navs.map(nav => nav.get('h2').text())).toEqual(['Navigate', 'Topics', 'Subscribe'])
    expect(navs[0]!.findAll('a').map(a => a.attributes('href'))).toEqual(['/', '/blog', '/about'])
    expect(navs[1]!.findAll('a')[0]!.attributes('href')).toBe('/blog/category/privacidad')
    expect(navs[2]!.findAll('a').map(a => a.attributes('href'))).toEqual([
      '/feed.xml',
      '/#fediverso',
      '/#newsletter',
    ])
  })

  describe.each<[string, Component]>([['columns', RegionFooter], ['minimal', RegionFooterMinimal]])('with the neutral app.config defaults (%s)', (_name, Footer) => {
    it('shows the name alone, with no author separator, social links or support link', async () => {
      const wrapper = await mountSuspended(Footer)
      expect(wrapper.get('.bd-foot-legal span').text()).toBe(`© ${new Date().getFullYear()} Micelio`)
      expect(wrapper.find('a.bd-foot-soc').exists()).toBe(false)
      expect(wrapper.find('ul.bd-foot-socials').exists()).toBe(false)
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
    await vi.waitFor(() => expect(wrapper.findAll('nav.bd-foot-nav')[2]!.findAll('a').map(a => a.attributes('href'))).toEqual(['/feed.xml']))
    const subscribe = wrapper.findAll('details.bd-acc')[2]!
    expect(subscribe.get('.bd-acc-summary').text()).toBe('RSS')
    expect(subscribe.findAll('a.bd-foot-row').map(a => a.attributes('href'))).toEqual(['/feed.xml'])
  })

  it('folds the mobile groups with native details, topics open first', async () => {
    unregister = registerEndpoint('/api/site', () => ({ ...siteFromAppConfig(useAppConfig().site as AppSiteConfig), supportHandle: 'ada' }))
    const wrapper = await mountSuspended(RegionFooter)
    await vi.waitFor(() => expect(wrapper.findAll('details.bd-acc')[2]!.findAll('a.bd-foot-row').at(-1)!.attributes('href')).toBe('https://www.buymeacoffee.com/ada'))
    const groups = wrapper.findAll('details.bd-acc')
    expect(groups.map(group => group.get('.bd-acc-label').text())).toEqual(['Topics', 'Navigate', 'Subscribe'])
    expect(groups.map(group => group.attributes('open') !== undefined)).toEqual([true, false, false])
    expect(groups[0]!.get('.bd-acc-summary').text()).toBe('05')
    expect(groups[0]!.findAll('a.bd-foot-row')).toHaveLength(5)
    expect(groups[2]!.findAll('a.bd-foot-row').at(-1)!.attributes('href')).toBe('https://www.buymeacoffee.com/ada')
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
    const link = wrapper.get('.bd-foot-legal a.bd-foot-privacy')
    expect(link.text()).toBe('Privacy and cookies')
    expect(link.attributes('href')).toBe('/privacy')
  })

  describe.each<[string, Component]>([['columns', RegionFooter], ['minimal', RegionFooterMinimal]])('source link (%s)', (_name, Footer) => {
    it('links to the upstream repository by default, next to the privacy link', async () => {
      const wrapper = await mountSuspended(Footer)
      const link = wrapper.get('.bd-foot-legal a.bd-foot-source')
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
        expect(wrapper.get('a.bd-foot-source').attributes('href')).toBe('https://git.example.com/me/micelio')
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
        expect(wrapper.get('a.bd-foot-source').attributes('href')).toBe('https://github.com/bogd3v/micelio')
      } finally {
        config.sourceUrl = original
      }
    })
  })
})
