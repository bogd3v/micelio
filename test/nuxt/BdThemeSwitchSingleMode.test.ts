import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BdThemeSwitch from '~/components/bd/BdThemeSwitch.vue'
import BdMenuSheet from '~/components/bd/BdMenuSheet.vue'

vi.mock('#micelio/theme', () => {
  const modes = [{ id: 'paper', scheme: 'light', name: 'Paper' }]
  return { modes, default: { id: 'minimal', modes } }
})

describe('BdThemeSwitch with a single-mode theme', () => {
  it('renders nothing', async () => {
    const wrapper = await mountSuspended(BdThemeSwitch)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('[role="group"]').exists()).toBe(false)
  })

  it('starts in the first mode, light', () => {
    const { theme, isDark } = useTheme()
    expect(theme.value).toBe('paper')
    expect(isDark.value).toBe(false)
  })

  it('hides the theme row of the menu sheet', async () => {
    const wrapper = await mountSuspended(BdMenuSheet, { props: { open: true } })
    expect(wrapper.find('[data-mode]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Theme')
  })
})
