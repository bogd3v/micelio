import { describe, it, expect, beforeEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MycThemeSwitch from '~/components/myc/MycThemeSwitch.vue'

describe('MycThemeSwitch', () => {
  beforeEach(() => {
    useTheme().sync('noche')
  })

  it('is a labelled group of pressed toggle buttons', async () => {
    const wrapper = await mountSuspended(MycThemeSwitch)
    expect(wrapper.attributes('role')).toBe('group')
    expect(wrapper.attributes('aria-label')).toBe('Color theme')
    const buttons = wrapper.findAll('button')
    expect(buttons.map(b => b.text())).toEqual(['Night', 'Day'])
    expect(buttons.map(b => b.attributes('aria-pressed'))).toEqual(['true', 'false'])
    expect(buttons.map(b => b.attributes('data-mode'))).toEqual(['noche', 'dia'])
  })

  it('applies and emits the chosen theme', async () => {
    const wrapper = await mountSuspended(MycThemeSwitch)
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dia')
    expect(document.documentElement.getAttribute('data-scheme')).toBe('light')
    expect(wrapper.emitted('change')).toEqual([['dia']])
    expect(wrapper.findAll('button').map(b => b.attributes('aria-pressed'))).toEqual(['false', 'true'])

    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('change')).toHaveLength(1)
  })
})
