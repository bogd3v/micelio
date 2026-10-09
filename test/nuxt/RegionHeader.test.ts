import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import RegionHeader from '~/theme/layout/header/Bar.vue'

describe('RegionHeader', () => {
  it('marks the active link with aria-current', async () => {
    const wrapper = await mountSuspended(RegionHeader, { props: { active: 'blog' } })
    const links = wrapper.findAll('.myc-nav-link')
    expect(links.map(link => link.text())).toEqual(['Home', 'Blog', 'About'])
    expect(links.map(link => link.attributes('aria-current'))).toEqual([undefined, 'page', undefined])
    expect(wrapper.get('.myc-nav-main').attributes('aria-label')).toBe('Main')
    expect(wrapper.get('.myc-brand').attributes('aria-label')).toBe('Micelio, home')
  })

  it('shows the HUD strip with the fediverse chip, search and theme control', async () => {
    const wrapper = await mountSuspended(RegionHeader, { props: { active: 'home' } })
    expect(wrapper.get('.myc-hud').text()).toContain('Bogotá')
    expect(wrapper.get('.myc-hud').text()).toContain('4.61°N 74.08°W')
    const chip = wrapper.get('a.myc-chip')
    expect(chip.attributes('href')).toBe('/#fediverso')
    expect(chip.text()).toContain('@bogdev')
    const search = wrapper.get('button.myc-chip')
    expect(search.attributes('aria-keyshortcuts')).toBe('Control+K Meta+K')
    expect(search.get('kbd').attributes('aria-hidden')).toBe('true')
    const theme = wrapper.get('.myc-strip [role="group"]')
    expect(theme.attributes('aria-label')).toBe('Color theme')
    expect(wrapper.find('.myc-progress').exists()).toBe(false)
    expect(wrapper.find('.myc-crumbs').exists()).toBe(false)
  })

  it('emits search from both search buttons and menu from the menu button', async () => {
    const wrapper = await mountSuspended(RegionHeader, { props: { menuOpen: true } })
    await wrapper.get('button.myc-chip').trigger('click')
    const [searchIcon, menu] = wrapper.findAll('.myc-nav-mobile button')
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
    expect(wrapper.find('.myc-hud').exists()).toBe(false)
    const crumbs = wrapper.get('.myc-crumbs')
    expect(crumbs.attributes('aria-label')).toBe('Breadcrumb')
    expect(crumbs.findAll('a').map(a => a.attributes('href'))).toEqual(['/', '/blog'])
    expect(crumbs.get('[aria-current="page"]').text()).toBe('Linux and open source')
    // The unit project builds as static: CSS draws the number from data-percent
    expect(wrapper.get('.myc-strip-read').text()).toBe('Read  %')
    expect(wrapper.get('.myc-strip-read-num').attributes('data-percent')).toBe('38')
    const progress = wrapper.get('.myc-progress')
    expect(progress.attributes('aria-hidden')).toBe('true')
    expect(progress.attributes('style')).toContain('--myc-read: 0.38')
    expect(wrapper.classes()).not.toContain('myc-header-auto')
    expect(wrapper.get('.myc-strip [role="group"]').attributes('aria-label')).toBe('Color theme')
  })

  it('tracks the scroll itself when no progress is given', async () => {
    const wrapper = await mountSuspended(RegionHeader, { props: { reading: true } })
    expect(wrapper.classes()).toContain('myc-header-auto')
    expect(wrapper.get('.myc-strip-read-num').attributes('data-percent')).toBe('0')
    expect(wrapper.find('.myc-crumbs [aria-current]').exists()).toBe(false)
  })
})
