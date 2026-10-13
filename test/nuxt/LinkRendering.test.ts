import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LinkButton from '~/components/strapi/LinkButton.vue'
import ContactBlock from '~/components/strapi/ContactBlock.vue'
import type { StrapiContact, StrapiLink } from '~/interfaces'

function link(url: string): StrapiLink {
  return { id: 1, label: 'Go', url, variant: 'primary' }
}

describe('LinkButton', () => {
  it('renders an https link and a site path', async () => {
    const external = await mountSuspended(LinkButton, { props: { link: link('https://example.com/a') } })
    expect(external.get('a').attributes('href')).toBe('https://example.com/a')
    const internal = await mountSuspended(LinkButton, { props: { link: link('/blog') } })
    expect(internal.get('a').attributes('href')).toBe('/blog')
  })

  it('renders nothing for a URL the site may not render', async () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.example']) {
      const wrapper = await mountSuspended(LinkButton, { props: { link: link(url) } })
      expect(wrapper.find('a').exists(), url).toBe(false)
    }
  })
})

describe('ContactBlock socials', () => {
  it('lists the web and mail links and drops the rest', async () => {
    const block: StrapiContact = {
      id: 1,
      __component: 'about.contact',
      socials: [
        { id: 1, network: 'Web', handle: 'example', url: 'https://example.com/me' },
        { id: 2, network: 'Mail', handle: 'hi', url: 'mailto:hi@example.com' },
        { id: 3, network: 'Bad', handle: 'x', url: 'javascript:alert(1)' },
      ],
    }
    const wrapper = await mountSuspended(ContactBlock, { props: { block } })
    const hrefs = wrapper.findAll('a.myc-contact-row').map(item => item.attributes('href'))
    expect(hrefs).toEqual(['https://example.com/me', 'mailto:hi@example.com'])
  })
})
