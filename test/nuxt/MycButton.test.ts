import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MycButton from '~/components/myc/MycButton.vue'

describe('MycButton', () => {
  it('renders a primary button by default', async () => {
    const wrapper = await mountSuspended(MycButton, { slots: { default: () => 'Leer' } })
    expect(wrapper.element.tagName).toBe('BUTTON')
    expect(wrapper.attributes('type')).toBe('button')
    expect(wrapper.classes()).toEqual(['myc-btn', 'myc-btn-primary'])
    expect(wrapper.find('.myc-btn-arrow').exists()).toBe(false)
  })

  it('applies variant, size, type and arrow', async () => {
    const wrapper = await mountSuspended(MycButton, {
      props: { variant: 'accent', size: 'sm', type: 'submit', arrow: true },
      slots: { default: () => 'Suscribirme' },
    })
    expect(wrapper.attributes('type')).toBe('submit')
    expect(wrapper.classes()).toContain('myc-btn-accent')
    expect(wrapper.classes()).toContain('myc-btn-sm')
    expect(wrapper.get('.myc-btn-arrow').attributes('aria-hidden')).toBe('true')
  })

  it('renders a link when href is given', async () => {
    const wrapper = await mountSuspended(MycButton, {
      props: { href: '/blog', variant: 'secondary' },
      slots: { default: () => 'Blog' },
    })
    expect(wrapper.element.tagName).toBe('A')
    expect(wrapper.attributes('href')).toBe('/blog')
    expect(wrapper.classes()).toContain('myc-btn-secondary')
  })

  it('emits native clicks and respects disabled', async () => {
    const clicks: number[] = []
    const wrapper = await mountSuspended(MycButton, {
      props: { onClick: () => clicks.push(1) },
      attrs: { disabled: true },
      slots: { default: () => 'Enviar' },
    })
    expect(wrapper.attributes('disabled')).toBeDefined()
    await wrapper.trigger('click')
    expect(clicks).toHaveLength(0)
  })
})
