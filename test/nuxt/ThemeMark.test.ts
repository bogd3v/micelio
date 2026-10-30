import { describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StarterMark from '~~/themes/starter/slots/ThemeMark.vue'
import DefaultMark from '~/theme/defaults/ThemeMark.vue'

describe('ThemeMark (core default)', () => {
  it('shows the site name as text', async () => {
    const wrapper = await mountSuspended(DefaultMark, { props: { size: 30, context: 'header' } })
    expect(wrapper.text()).toBe('Micelio')
    expect(wrapper.find('svg').exists()).toBe(false)
  })
})

describe('ThemeMark (starter)', () => {
  it('draws the monogram through <use> so it is not the link text, with distinct ids per instance', async () => {
    // Two marks in one app, as the header and the footer are: useId() is unique per app, not across apps
    const Page = defineComponent({
      render: () => h('div', [h(StarterMark, { context: 'header' }), h(StarterMark, { context: 'footer' })]),
    })
    const wrapper = await mountSuspended(Page)
    const marks = wrapper.findAll('.starter-mark')
    expect(marks).toHaveLength(2)
    const ids = marks.map((mark) => {
      expect(mark.get('svg').attributes('aria-hidden')).toBe('true')
      const letter = mark.get('defs text')
      expect(letter.text()).toBe('M')
      expect(mark.get('use').attributes('href')).toBe(`#${letter.attributes('id')}`)
      expect(mark.find('svg > text').exists()).toBe(false)
      return letter.attributes('id')
    })
    expect(ids[0]).toBeTruthy()
    expect(ids[0]).not.toBe(ids[1])
  })
})
