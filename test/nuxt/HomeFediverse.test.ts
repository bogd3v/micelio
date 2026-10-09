import { describe, it, expect, vi, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import HomeFediverse from '~/components/home/Fediverse.vue'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('HomeFediverse', () => {
  it('shows the configured handle and announces the copy', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = await mountSuspended(HomeFediverse)
    expect(wrapper.attributes('id')).toBe('fediverso')
    expect(wrapper.get('.myc-fedi-handle').text()).toBe('@bogdev@api.bogdev.com.co')
    await wrapper.get('.myc-fedi-copy button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('@bogdev@api.bogdev.com.co')
    expect(wrapper.get('.myc-fedi-copy button').text()).toBe('Copied ✓')
    expect(wrapper.get('.myc-fedi-copy [aria-live="polite"]').text()).toBe('@bogdev@api.bogdev.com.co copied')
  })

  it('explains invalid instances and opens the follow flow for valid ones', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const wrapper = await mountSuspended(HomeFediverse)
    const input = wrapper.get('input')
    const hint = (): string => wrapper.get('#myc-fedi-hint').text()

    await wrapper.get('form').trigger('submit')
    expect(hint()).toContain('Type your instance')
    expect(input.attributes('aria-invalid')).toBe('true')

    await input.setValue('mastodon social')
    await wrapper.get('form').trigger('submit')
    expect(hint()).toContain('does not look like a domain')
    expect(open).not.toHaveBeenCalled()

    await input.setValue('https://Fosstodon.org/@ana')
    expect(hint()).toBe('fosstodon.org will open to confirm')
    expect(input.attributes('aria-invalid')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    expect(open).toHaveBeenCalledWith(
      'https://fosstodon.org/authorize_interaction?uri=https%3A%2F%2Fapi.bogdev.com.co%2Ffediverse%2Fuser%2Fdevbog',
      '_blank',
      'noopener,noreferrer',
    )
    expect((input.element as HTMLInputElement).value).toBe('fosstodon.org')
  })

  it('shows the Mastodon logo with an accessible name and its own gradient', async () => {
    const wrapper = await mountSuspended(HomeFediverse)
    const logo = wrapper.get('.myc-masto-logo')
    expect(logo.attributes('role')).toBe('img')
    expect(logo.attributes('aria-label')).toBe('Mastodon logo')
    const gradient = logo.get('linearGradient').attributes('id')
    expect(gradient).toBeTruthy()
    expect(logo.find(`path[fill="url(#${gradient})"]`).exists()).toBe(true)
    expect(wrapper.get('h2').text()).toBe('Follow the blog from Mastodon')
  })

  it('explains the fediverse with three cards that use the configured address', async () => {
    const wrapper = await mountSuspended(HomeFediverse)
    const cards = wrapper.get('[role="region"][aria-label="How the fediverse works"]')
    expect(cards.findAll('h3').map(title => title.text())).toEqual(['It works like email', 'Your address has two parts', 'Many apps, one network'])
    expect(cards.findAll('svg').every(svg => svg.attributes('aria-hidden') === 'true')).toBe(true)
    expect(cards.text()).toContain('@bogdev')
    expect(cards.text()).toContain('The blog\'s is @bogdev on the server api.bogdev.com.co.')
    expect(cards.text()).not.toContain('devbog')
  })

  it('points to joinmastodon.org in the page language', async () => {
    const link = (await mountSuspended(HomeFediverse)).get('.myc-fedi-join a')
    expect(link.attributes()).toMatchObject({
      'href': 'https://joinmastodon.org/servers',
      'target': '_blank',
      'rel': 'noopener noreferrer',
      'aria-label': 'Pick a server on joinmastodon.org (opens in a new tab)',
    })

    const spanish = await mountSuspended(HomeFediverse, { route: '/es' })
    expect(spanish.get('.myc-fedi-join a').attributes('href')).toBe('https://joinmastodon.org/es/servers')
    expect(spanish.get('.myc-masto-logo').attributes('aria-label')).toBe('Logo de Mastodon')
    await useNuxtApp().$i18n.setLocale('en')
  })

  it('lists the steps to join, what happens after following and a glossary', async () => {
    const wrapper = await mountSuspended(HomeFediverse)
    expect(wrapper.findAll('.myc-fedi-join li').map(step => step.text())).toEqual([
      '01Pick a server on joinmastodon.org. Any will do: from every server you can follow everyone.',
      '02Sign up with your email. It is free and ad-free.',
      '03Come back here, type your server and press “Follow”.',
    ])
    expect(wrapper.findAll('.myc-fedi-step-title').map(step => step.text())).toEqual(['Follow', 'Read it in your home feed', 'Reply or like it'])
    expect(wrapper.get('.myc-fedi-step-text').text()).toContain('@bogdev@api.bogdev.com.co')
    expect(wrapper.findAll('.myc-fedi-glossary dt').map(term => term.text())).toEqual(['Fediverse', 'Server or instance', 'Follow', 'Boost'])
  })
})
