import { afterEach, describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import MycPrivacyNotice from '~/components/myc/MycPrivacyNotice.vue'

describe('MycPrivacyNotice', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('shows a labelled region with a link to the privacy page', async () => {
    const wrapper = await mountSuspended(MycPrivacyNotice)
    await flushPromises()
    const region = wrapper.get('section.myc-privacy-notice')
    expect(region.attributes('role')).toBe('region')
    expect(region.attributes('aria-label')).toBe('Privacy notice')
    expect(region.text()).toContain('No tracking cookies. We count visits anonymously with Umami.')
    expect(region.get('a').attributes('href')).toBe('/privacy')
    expect(region.get('button').text()).toBe('Got it')
  })

  it('closes and remembers the choice', async () => {
    const wrapper = await mountSuspended(MycPrivacyNotice)
    await flushPromises()
    await wrapper.get('button').trigger('click')
    expect(wrapper.find('section').exists()).toBe(false)
    expect(localStorage.getItem('micelio-privacy-notice')).toBe('1')
  })

  it('stays hidden once dismissed', async () => {
    localStorage.setItem('micelio-privacy-notice', '1')
    const wrapper = await mountSuspended(MycPrivacyNotice)
    await flushPromises()
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
