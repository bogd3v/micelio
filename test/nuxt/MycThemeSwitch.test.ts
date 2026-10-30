import { describe, it, expect, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MycThemeSwitch from '~/components/myc/MycThemeSwitch.vue'

describe('MycThemeSwitch', () => {
  beforeEach(() => {
    useTheme().sync('light')
  })

  it('is a labelled group of pressed toggle buttons', async () => {
    const wrapper = await mountSuspended(MycThemeSwitch)
    expect(wrapper.attributes('role')).toBe('group')
    expect(wrapper.attributes('aria-label')).toBe('Color theme')
    const buttons = wrapper.findAll('button')
    expect(buttons.map(b => b.text())).toEqual(['Light', 'Dark'])
    expect(buttons.map(b => b.attributes('aria-pressed'))).toEqual(['true', 'false'])
    expect(buttons.map(b => b.attributes('data-mode'))).toEqual(['light', 'dark'])
  })

  it('applies and emits the chosen theme', async () => {
    const wrapper = await mountSuspended(MycThemeSwitch)
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(document.documentElement.getAttribute('data-scheme')).toBe('dark')
    expect(wrapper.emitted('change')).toEqual([['dark']])
    expect(wrapper.findAll('button').map(b => b.attributes('aria-pressed'))).toEqual(['false', 'true'])

    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('change')).toHaveLength(1)
  })
})
