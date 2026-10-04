import { afterEach, describe, it, expect, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { Site } from '~/interfaces'
import { siteFromAppConfig } from '~/helpers/site'
import type { AppSiteConfig } from '~/helpers/site'
import BdFooter from '~/components/bd/BdFooter.vue'

describe('BdFooter', () => {
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
    const wrapper = await mountSuspended(BdFooter)
    await vi.waitFor(() => expect(wrapper.get('.bd-foot-legal span').text()).toBe(`© ${new Date().getFullYear()} Micelio · Grace`))
    expect(wrapper.get('a.bd-foot-brand').attributes('aria-label')).toBe('Micelio, home')
    expect(wrapper.findAll('a.bd-foot-soc').map(a => a.attributes('href'))).toEqual(['https://gitlab.com/micelio'])
    expect(wrapper.findAll('details.bd-acc')[2]!.findAll('a.bd-foot-row').at(-1)!.attributes('href')).toBe('https://www.buymeacoffee.com/micelio')
  })

  it('renders the brand, social links and desktop groups', async () => {
    const wrapper = await mountSuspended(BdFooter)
    expect(wrapper.get('a.bd-foot-brand').attributes('aria-label')).toBe('BogDev, home')
    const socials = wrapper.findAll('a.bd-foot-soc')
    expect(socials.map(a => a.text())).toEqual(['inLinkedIn↗', 'ghGitHub↗', 'cbCodeberg↗', 'mdMastodon↗'])
    expect(socials.every(a => a.attributes('rel') === 'noopener noreferrer me')).toBe(true)
    const navs = wrapper.findAll('nav.bd-foot-nav')
    expect(navs.map(nav => nav.get('h2').text())).toEqual(['Navigate', 'Topics', 'Subscribe'])
    expect(navs[0]!.findAll('a').map(a => a.attributes('href'))).toEqual(['/', '/blog', '/about'])
    expect(navs[1]!.findAll('a')[0]!.attributes('href')).toBe('/blog?category=privacidad')
    expect(navs[2]!.findAll('a').map(a => a.attributes('href'))).toEqual([
      '/feed.xml',
      '/#fediverso',
      '/#newsletter',
    ])
  })

  it('folds the mobile groups with native details, topics open first', async () => {
    const wrapper = await mountSuspended(BdFooter)
    const groups = wrapper.findAll('details.bd-acc')
    expect(groups.map(group => group.get('.bd-acc-label').text())).toEqual(['Topics', 'Navigate', 'Subscribe'])
    expect(groups.map(group => group.attributes('open') !== undefined)).toEqual([true, false, false])
    expect(groups[0]!.get('.bd-acc-summary').text()).toBe('05')
    expect(groups[0]!.findAll('a.bd-foot-row')).toHaveLength(5)
    expect(groups[2]!.findAll('a.bd-foot-row').at(-1)!.attributes('href')).toBe('https://www.buymeacoffee.com/ale9420')
  })

  it('keeps the panorama decorative', async () => {
    const wrapper = await mountSuspended(BdFooter)
    const layers = wrapper.findAll('.bd-land svg')
    expect(layers).toHaveLength(4)
    expect(layers.every(svg => svg.attributes('aria-hidden') === 'true')).toBe(true)
    expect(wrapper.get('.bd-land img').attributes('alt')).toBe('')
    expect(wrapper.text()).toContain('Monserrate · 3,152 m')
  })

  it('links to the privacy page next to the copyright', async () => {
    const wrapper = await mountSuspended(BdFooter)
    const link = wrapper.get('.bd-foot-legal a.bd-foot-privacy')
    expect(link.text()).toBe('Privacy and cookies')
    expect(link.attributes('href')).toBe('/privacy')
  })
})
