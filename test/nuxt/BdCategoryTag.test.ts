import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BdCategoryTag from '~/components/bd/BdCategoryTag.vue'
import { Category } from '~/interfaces/design'

describe('BdCategoryTag', () => {
  it('shows the translated category name with its color class', async () => {
    const wrapper = await mountSuspended(BdCategoryTag, { props: { category: Category.Privacy } })
    expect(wrapper.element.tagName).toBe('SPAN')
    expect(wrapper.classes()).toContain('myc-tag-privacidad')
    expect(wrapper.text()).toBe('Privacy')
    expect(wrapper.get('.myc-tag-dot').attributes('aria-hidden')).toBe('true')
  })

  it('renders a link and accepts a custom label', async () => {
    const wrapper = await mountSuspended(BdCategoryTag, {
      props: { category: Category.Diy, href: `/blog/category/${Category.Diy}` },
      slots: { default: () => 'DIY' },
    })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/blog/category/diy')
    expect(wrapper.text()).toBe('DIY')
  })
})
