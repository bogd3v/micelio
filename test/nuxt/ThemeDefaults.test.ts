import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ThemeDivider from '~/theme/defaults/ThemeDivider.vue'
import ThemeEmptyState from '~/theme/defaults/ThemeEmptyState.vue'
import ThemeHero from '~/theme/defaults/ThemeHero.vue'

describe('core slot defaults', () => {
  it('keeps the hero a decorative block that takes the caller class', async () => {
    const wrapper = await mountSuspended(ThemeHero, { props: { compact: true }, attrs: { class: 'bd-hero-art-compact' } })
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.classes()).toEqual(['bd-hero-art-compact'])
    expect(wrapper.text()).toBe('')
  })

  it('renders no divider', async () => {
    const wrapper = await mountSuspended(ThemeDivider, { props: { placement: 'footer' } })
    expect(wrapper.html()).not.toContain('<svg')
    expect(wrapper.text()).toBe('')
  })

  it('shows the caller content in the empty state', async () => {
    const wrapper = await mountSuspended(ThemeEmptyState, { slots: { default: 'No articles yet' } })
    expect(wrapper.text()).toBe('No articles yet')
  })
})
