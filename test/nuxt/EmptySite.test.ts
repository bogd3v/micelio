import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import BlogAuthorCard from '~/components/blog/AuthorCard.vue'
import BlogBuyMeACoffee from '~/components/blog/BuyMeACoffee.vue'
import PrivacyPage from '~/pages/privacy.vue'
import UnsubscribePage from '~/pages/newsletter/unsubscribe.vue'
import { mergeThemeMessages } from './themeData'

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
  it('shows the active theme\'s bio when it has one, else the core\'s, and the author name', async () => {
    const wrapper = await mountSuspended(BlogAuthorCard, { props: { author: { name: 'Ada' } } })
    expect(wrapper.get('.myc-author-card-name').text()).toBe('Ada')
    expect(wrapper.get('.myc-author-card-bio').text()).toBe('Writing about the topics covered on this blog.')
    mergeThemeMessages({ author: { bio: 'Notes from the garden.' } })
    const themed = await mountSuspended(BlogAuthorCard, { props: { author: { name: 'Ada' } } })
    expect(themed.get('.myc-author-card-bio').text()).toBe('Notes from the garden.')
  })
})

describe('the privacy page without contact email or date', () => {
  it('has no mailto link and a plain eyebrow', async () => {
    const wrapper = await mountSuspended(PrivacyPage)
    await flushPromises()
    expect(wrapper.find('a[href^="mailto:"]').exists()).toBe(false)
    expect(wrapper.get('.myc-privacy-updated').text()).toBe('Legal')
    expect(wrapper.get('#rights p:not(.myc-eyebrow)').text()).toBe('You can access, update, correct and ask for the deletion of your personal data.')
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
