import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ThemeMark from '~~/themes/bogota/slots/ThemeMark.vue'
import DefaultMark from '~/theme/defaults/ThemeMark.vue'

describe('ThemeMark (Bogotá)', () => {
  it('has a single root that takes the caller class', async () => {
    const wrapper = await mountSuspended(ThemeMark, { attrs: { class: 'from-layout' } })
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['bogota-lockup', 'from-layout']))
    expect(wrapper.html()).not.toContain('<!--[-->')
  })

  it('renders the mark with the official proportions and label', async () => {
    const wrapper = await mountSuspended(ThemeMark, { props: { size: 40 } })
    const svg = wrapper.get('svg')
    expect(svg.attributes('width')).toBe('52')
    expect(svg.attributes('height')).toBe('40')
    expect(svg.attributes('role')).toBe('img')
    expect(svg.attributes('aria-label')).toBe('Micelio')
    expect(wrapper.findAll('path.bogota-mark-a')).toHaveLength(2)
    expect(wrapper.findAll('path.bogota-mark-b')).toHaveLength(2)
  })

  it('sizes the mark by context and hides the wordmark from assistive tech', async () => {
    const header = await mountSuspended(ThemeMark, { props: { size: 30, context: 'header' } })
    expect(header.get('.bogota-mark').classes()).toContain('bogota-mark-header')
    const footer = await mountSuspended(ThemeMark, { props: { size: 56, context: 'footer' } })
    expect(footer.get('.bogota-mark').classes()).toContain('bogota-mark-footer')
    expect(footer.get('.bogota-word').attributes('aria-hidden')).toBe('true')
    expect(footer.get('.bogota-word').text()).toBe('BogDev')
    expect(footer.get('.bogota-word-dev').text()).toBe('Dev')
  })
})

describe('ThemeMark (core default)', () => {
  it('shows the site name as text', async () => {
    const wrapper = await mountSuspended(DefaultMark, { props: { size: 30, context: 'header' } })
    expect(wrapper.text()).toBe('Micelio')
    expect(wrapper.find('svg').exists()).toBe(false)
  })
})
