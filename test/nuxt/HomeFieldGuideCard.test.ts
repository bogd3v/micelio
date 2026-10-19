import { beforeEach, describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import HomeFieldGuideCard from '~/components/home/FieldGuideCard.vue'
import { serveCategories } from './categoriesFixture'

describe('HomeFieldGuideCard', () => {
  beforeEach(() => serveCategories())

  it('renders a pillar with the name and description of the CMS and no bird', async () => {
    const wrapper = await mountSuspended(HomeFieldGuideCard, { props: { category: 'garden', count: 3, figure: 0, pillar: 1 } })
    await vi.waitFor(() => expect(wrapper.get('.myc-guide-title').text()).toBe('Garden'))
    expect(wrapper.attributes('href')).toBe('/blog/category/garden')
    expect(wrapper.classes()).toContain('myc-guide-pillar')
    expect(wrapper.get('.myc-guide-label').text()).toBe('Pillar 01')
    expect(wrapper.get('.myc-guide-description').text()).toBe('About Garden')
    expect(wrapper.find('.myc-guide-bird').exists()).toBe(false)
    expect(wrapper.find('.myc-guide-note').exists()).toBe(false)
    expect(wrapper.get('.myc-guide-foot').text()).toContain('03 articles')
  })

  it('keeps the bird and note the theme keys by slug', async () => {
    const wrapper = await mountSuspended(HomeFieldGuideCard, { props: { category: 'privacidad', count: 0, figure: 0, pillar: 1 } })
    expect(wrapper.attributes('href')).toBe('/blog/category/privacidad')
    expect(wrapper.classes()).toContain('myc-guide-pillar')
    expect(wrapper.get('.myc-guide-label').text()).toBe('Pillar 01')
    expect(wrapper.get('.myc-guide-bird').text()).toBe('Masked flowerpiercer · Diglossa cyanea')
    expect(wrapper.find('.myc-guide-note').exists()).toBe(true)
    expect(wrapper.get('.myc-guide-foot').text()).toContain('No articles yet')
    expect(wrapper.get('svg').attributes('aria-hidden')).toBe('true')
  })

  it('renders a figure card with its article count and no description', async () => {
    const wrapper = await mountSuspended(HomeFieldGuideCard, { props: { category: 'kitchen', count: 2, figure: 2 } })
    await vi.waitFor(() => expect(wrapper.get('.myc-guide-title').text()).toBe('Kitchen'))
    expect(wrapper.classes()).not.toContain('myc-guide-pillar')
    expect(wrapper.get('.myc-guide-label').text()).toBe('Fig. 02')
    expect(wrapper.find('.myc-guide-description').exists()).toBe(false)
    expect(wrapper.get('.myc-guide-foot').text()).toContain('02 articles')
  })
})
