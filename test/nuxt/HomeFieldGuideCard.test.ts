import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { Category } from '~/interfaces'
import HomeFieldGuideCard from '~/components/home/FieldGuideCard.vue'

describe('HomeFieldGuideCard', () => {
  it('renders a pillar with its bird, note and empty count', async () => {
    const wrapper = await mountSuspended(HomeFieldGuideCard, { props: { category: Category.Privacy, count: 0, figure: 0 } })
    expect(wrapper.attributes('href')).toBe('/blog/category/privacidad')
    expect(wrapper.classes()).toContain('myc-guide-pillar')
    expect(wrapper.get('.myc-guide-label').text()).toBe('Pillar 01')
    expect(wrapper.get('.myc-guide-bird').text()).toBe('Masked flowerpiercer · Diglossa cyanea')
    expect(wrapper.find('.myc-guide-note').exists()).toBe(true)
    expect(wrapper.get('.myc-guide-foot').text()).toContain('No articles yet')
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
  })

  it('renders a figure card with its article count', async () => {
    const wrapper = await mountSuspended(HomeFieldGuideCard, { props: { category: Category.Ai, count: 2, figure: 2 } })
    expect(wrapper.classes()).not.toContain('myc-guide-pillar')
    expect(wrapper.get('.myc-guide-label').text()).toBe('Fig. 02')
    expect(wrapper.get('.myc-guide-title').text()).toBe('Artificial intelligence')
    expect(wrapper.find('.myc-guide-description').exists()).toBe(false)
    expect(wrapper.get('.myc-guide-foot').text()).toContain('02 articles')
  })
})
