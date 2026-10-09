import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import BlogAuthorCard from '~/components/blog/AuthorCard.vue'
import BlogBuyMeACoffee from '~/components/blog/BuyMeACoffee.vue'
import PrivacyPage from '~/pages/privacy.vue'
import UnsubscribePage from '~/pages/newsletter/unsubscribe.vue'

// app.config.ts ships with empty values; an empty value renders as absent

describe('the app.config.ts defaults', () => {
  it('are neutral', () => {
    const site = useAppConfig().site as Record<string, unknown>
    expect(site.name).toBe('Micelio')
    expect(JSON.stringify(site)).not.toMatch(/bogdev|hotmail|ale9420|devbog/i)
  })
})

describe('BlogBuyMeACoffee without a handle', () => {
  it('renders nothing', async () => {
    const wrapper = await mountSuspended(BlogBuyMeACoffee)
    expect(wrapper.find('.myc-coffee').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
  })
})

describe('BlogAuthorCard', () => {
  it('shows the active theme\'s bio (Bogota keeps BogDev\'s text) and the author name', async () => {
    const wrapper = await mountSuspended(BlogAuthorCard, { props: { author: { name: 'Ada' } } })
    expect(wrapper.get('.myc-author-card-name').text()).toBe('Ada')
    expect(wrapper.get('.myc-author-card-bio').text()).toBe('Exploring privacy, DIY, AI, software and Linux from Bogotá.')
  })
})

describe('the privacy page without contact email or date', () => {
  it('has no mailto link and a plain eyebrow', async () => {
    const wrapper = await mountSuspended(PrivacyPage)
    await flushPromises()
    expect(wrapper.find('a[href^="mailto:"]').exists()).toBe(false)
    expect(wrapper.get('.myc-privacy-updated').text()).toBe('Legal')
    expect(wrapper.get('#rights p').text()).not.toContain('Write to')
    expect(wrapper.get('#rights p').text()).not.toContain('{email}')
  })
})

describe('the unsubscribe page without contact email', () => {
  it('shows the invalid-link lead without a mailto link', async () => {
    const wrapper = await mountSuspended(UnsubscribePage, { route: '/newsletter/unsubscribe' })
    await flushPromises()
    expect(wrapper.find('a[href^="mailto:"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Use the “Unsubscribe” link in one of our emails.')
    expect(wrapper.text()).not.toContain('write to')
  })
})
