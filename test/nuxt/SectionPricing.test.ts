import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SectionPricing from '~/components/section/SectionPricing.vue'
import type { PricingSection } from '~/interfaces'

function section(variant: PricingSection['variant']): PricingSection {
  return {
    __component: 'section.pricing',
    variant,
    title: 'Seed boxes',
    plans: [
      { name: 'Starter', price: '$5', period: 'per season', features: ['3 seed packs'], recommended: false },
      { name: 'Gardener', price: '$12', features: ['8 seed packs'], recommended: true },
    ],
  }
}

describe('SectionPricing', () => {
  it.each(['cards', 'table'] as const)('keeps the space between price and period (%s)', async (variant) => {
    const wrapper = await mountSuspended(SectionPricing, { props: { section: section(variant) } })
    expect(wrapper.get('.myc-section-plan-price').text()).toBe('$5 per season')
  })

  it('marks the recommended plan without a stray separator in the table', async () => {
    const wrapper = await mountSuspended(SectionPricing, { props: { section: section('table') } })
    const title = wrapper.get('.myc-section-plan-recommended .myc-section-item-title')
    expect(title.text().replace(/\s+/g, ' ')).toBe('Gardener Recommended')
  })
})
