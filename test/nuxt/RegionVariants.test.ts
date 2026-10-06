import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Centered from '~/theme/layout/header/Centered.vue'
import Minimal from '~/theme/layout/footer/Minimal.vue'

describe('RegionHeaderCentered', () => {
  it('keeps the brand, navigation and actions in reading order under its own data-layout', async () => {
    const wrapper = await mountSuspended(Centered, { props: { active: 'blog', label: 'Main, centered' } })
    expect(wrapper.get('header').attributes('data-layout')).toBe('centered')
    const order = wrapper.findAll('.bd-brand, .bd-nav-main, .bd-nav-lang, .bd-nav-mobile, .bd-strip').map(element => element.classes().find(name => ['bd-brand', 'bd-nav-main', 'bd-nav-mobile', 'bd-strip'].includes(name)))
    expect(order).toEqual(['bd-brand', 'bd-nav-main', undefined, 'bd-nav-mobile', 'bd-strip'])
    expect(wrapper.get('.bd-nav-main').attributes('aria-label')).toBe('Main, centered')
    expect(wrapper.findAll('.bd-nav-link').map(link => link.attributes('aria-current'))).toEqual([undefined, 'page', undefined])
  })

  it('shows breadcrumbs and the reading progress on articles', async () => {
    const wrapper = await mountSuspended(Centered, { props: { reading: true, progress: 40, section: 'Intro' } })
    expect(wrapper.find('.bd-crumbs').exists()).toBe(true)
    expect(wrapper.find('.bd-progress').exists()).toBe(true)
  })

  it('emits search and menu', async () => {
    const wrapper = await mountSuspended(Centered)
    await wrapper.get('button.bd-chip').trigger('click')
    await wrapper.findAll('.bd-nav-mobile button').at(-1)!.trigger('click')
    expect(wrapper.emitted('search')).toHaveLength(1)
    expect(wrapper.emitted('menu')).toHaveLength(1)
  })
})

describe('RegionFooterMinimal', () => {
  it('renders one row of links, socials and the legal line, without accordions', async () => {
    const wrapper = await mountSuspended(Minimal, { props: { label: 'Navigate, minimal' } })
    expect(wrapper.get('footer').attributes('data-layout')).toBe('minimal')
    expect(wrapper.get('nav').attributes('aria-label')).toBe('Navigate, minimal')
    expect(wrapper.findAll('nav .bd-foot-link').map(link => link.text())).toEqual(['Home', 'Blog', 'About'])
    expect(wrapper.find('.bd-acc').exists()).toBe(false)
    expect(wrapper.get('.bd-foot-privacy').attributes('href')).toBe('/privacy')
    expect(wrapper.find('a[href="/feed.xml"]').exists()).toBe(true)
  })
})
