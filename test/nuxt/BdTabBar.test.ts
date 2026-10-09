import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BdTabBar from '~/components/bd/BdTabBar.vue'

describe('BdTabBar', () => {
  it('renders home and blog links with the active tab marked', async () => {
    const wrapper = await mountSuspended(BdTabBar, { props: { active: 'blog' } })
    expect(wrapper.attributes('aria-label')).toBe('Bottom navigation')
    const links = wrapper.findAll('a.myc-tab')
    expect(links.map(link => link.attributes('href'))).toEqual(['/', '/blog'])
    expect(links.map(link => link.attributes('aria-current'))).toEqual([undefined, 'page'])
    expect(wrapper.findAll('svg').every(svg => svg.attributes('aria-hidden') === 'true')).toBe(true)
  })

  it('opens search and the menu dialog', async () => {
    const wrapper = await mountSuspended(BdTabBar, { props: { menuOpen: true } })
    const [search, menu] = wrapper.findAll('button.myc-tab')
    expect(search!.text()).toBe('Search')
    expect(search!.attributes('aria-haspopup')).toBe('dialog')
    expect(menu!.text()).toBe('Menu')
    expect(menu!.attributes('aria-haspopup')).toBe('dialog')
    expect(menu!.attributes('aria-expanded')).toBe('true')
    await search!.trigger('click')
    await menu!.trigger('click')
    expect(wrapper.emitted('search')).toHaveLength(1)
    expect(wrapper.emitted('menu')).toHaveLength(1)
  })
})
