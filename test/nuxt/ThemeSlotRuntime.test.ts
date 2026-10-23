import { beforeEach, describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import ThemeMark from '~/theme/slots/ThemeMark'
import ThemeHero from '~/theme/slots/ThemeHero'

import { setThemeData } from './themeData'

beforeEach(() => {
  setThemeData()
})

describe('a slot component', () => {
  it('renders the build theme\'s own component for the build theme', async () => {
    const wrapper = await mountSuspended(ThemeMark, { props: { context: 'footer' } })
    expect(wrapper.find('.bogota-mark-footer').exists()).toBe(true)
  })

  it('renders another theme\'s own component when that theme is active', async () => {
    setThemeData({ id: 'starter' })
    const wrapper = await mountSuspended(ThemeMark, { props: { context: 'footer' } })
    await flushPromises()
    expect(wrapper.find('.starter-mark-footer').exists()).toBe(true)
    expect(wrapper.find('.bogota-mark').exists()).toBe(false)
  })

  it('renders the core default for a theme that does not ship the slot', async () => {
    setThemeData({ id: 'starter' })
    const wrapper = await mountSuspended(ThemeHero)
    await flushPromises()
    expect(wrapper.html()).toBe('<div aria-hidden="true"></div>')
  })

  it('renders the core default for a theme the build does not carry', async () => {
    setThemeData({ id: 'unknown-theme' })
    const wrapper = await mountSuspended(ThemeMark)
    await flushPromises()
    expect(wrapper.find('.bogota-mark, .starter-mark').exists()).toBe(false)
    expect(wrapper.find('span[aria-hidden="true"]').exists()).toBe(true)
  })
})
