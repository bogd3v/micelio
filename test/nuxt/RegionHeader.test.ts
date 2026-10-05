import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RegionHeader from '~/theme/layout/header/Bar.vue'

describe('RegionHeader', () => {
  it('marks the active link with aria-current', async () => {
    const wrapper = await mountSuspended(RegionHeader, { props: { active: 'blog' } })
    const links = wrapper.findAll('.bd-nav-link')
    expect(links.map(link => link.text())).toEqual(['Home', 'Blog', 'About'])
    expect(links.map(link => link.attributes('aria-current'))).toEqual([undefined, 'page', undefined])
    expect(wrapper.get('.bd-nav-main').attributes('aria-label')).toBe('Main')
    expect(wrapper.get('.bd-brand').attributes('aria-label')).toBe('BogDev, home')
  })

  it('shows the HUD strip with the fediverse chip, search and theme control', async () => {
    const wrapper = await mountSuspended(RegionHeader, { props: { active: 'home' } })
    expect(wrapper.get('.bd-hud').text()).toContain('Bogotá')
    expect(wrapper.get('.bd-hud').text()).toContain('4.61°N 74.08°W')
    const chip = wrapper.get('a.bd-chip')
    expect(chip.attributes('href')).toBe('/#fediverso')
    expect(chip.text()).toContain('@bogdev')
    const search = wrapper.get('button.bd-chip')
    expect(search.attributes('aria-keyshortcuts')).toBe('Control+K Meta+K')
    expect(search.get('kbd').attributes('aria-hidden')).toBe('true')
    const theme = wrapper.get('.bd-strip [role="group"]')
    expect(theme.attributes('aria-label')).toBe('Color theme')
    expect(wrapper.find('.bd-progress').exists()).toBe(false)
    expect(wrapper.find('.bd-crumbs').exists()).toBe(false)
  })

  it('emits search from both search buttons and menu from the menu button', async () => {
    const wrapper = await mountSuspended(RegionHeader, { props: { menuOpen: true } })
    await wrapper.get('button.bd-chip').trigger('click')
    const [searchIcon, menu] = wrapper.findAll('.bd-nav-mobile button')
    expect(searchIcon!.attributes('aria-label')).toBe('Search')
    await searchIcon!.trigger('click')
    expect(menu!.attributes('aria-label')).toBe('Open menu')
    expect(menu!.attributes('aria-expanded')).toBe('true')
    await menu!.trigger('click')
    expect(wrapper.emitted('search')).toHaveLength(2)
    expect(wrapper.emitted('menu')).toHaveLength(1)
  })

  it('switches to the reading strip with breadcrumbs and progress', async () => {
    const wrapper = await mountSuspended(RegionHeader, {
      props: { active: 'blog', reading: true, progress: 38.4, section: 'Linux and open source' },
    })
    expect(wrapper.find('.bd-hud').exists()).toBe(false)
    const crumbs = wrapper.get('.bd-crumbs')
    expect(crumbs.attributes('aria-label')).toBe('Breadcrumb')
    expect(crumbs.findAll('a').map(a => a.attributes('href'))).toEqual(['/', '/blog'])
    expect(crumbs.get('[aria-current="page"]').text()).toBe('Linux and open source')
    expect(wrapper.get('.bd-strip-read').text()).toBe('Read 38 %')
    const progress = wrapper.get('.bd-progress')
    expect(progress.attributes('aria-hidden')).toBe('true')
    expect(progress.attributes('style')).toContain('--bd-read: 0.38')
    expect(wrapper.classes()).not.toContain('bd-header-auto')
    expect(wrapper.get('.bd-strip [role="group"]').attributes('aria-label')).toBe('Color theme')
  })

  it('tracks the scroll itself when no progress is given', async () => {
    const wrapper = await mountSuspended(RegionHeader, { props: { reading: true } })
    expect(wrapper.classes()).toContain('bd-header-auto')
    expect(wrapper.get('.bd-strip-read').text()).toBe('Read 0 %')
    expect(wrapper.find('.bd-crumbs [aria-current]').exists()).toBe(false)
  })
})
