import { describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MycThemeSwitch from '~/components/myc/MycThemeSwitch.vue'
import MycMenuSheet from '~/components/myc/MycMenuSheet.vue'

vi.mock('#micelio/theme', () => {
  const modes = [{ id: 'paper', scheme: 'light', name: 'Paper' }]
  return { modes, images: {}, default: { id: 'minimal', modes, images: {} } }
})

describe('MycThemeSwitch with a single-mode theme', () => {
  it('renders nothing', async () => {
    const wrapper = await mountSuspended(MycThemeSwitch)
    expect(wrapper.find('button').exists()).toBe(false)
    expect(wrapper.find('[role="group"]').exists()).toBe(false)
  })

  it('starts in the first mode, light', () => {
    const { theme, isDark } = useTheme()
    expect(theme.value).toBe('paper')
    expect(isDark.value).toBe(false)
  })

  it('hides the theme row of the menu sheet', async () => {
    const wrapper = await mountSuspended(MycMenuSheet, { props: { open: true } })
    expect(wrapper.find('[data-mode]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Theme')
  })
})
