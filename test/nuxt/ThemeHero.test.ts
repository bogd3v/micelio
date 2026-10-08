import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ThemeHero from '~~/themes/bogota/slots/ThemeHero.vue'

describe('ThemeHero', () => {
  it('renders the photos as pictures that pick by breakpoint and system scheme', async () => {
    const wrapper = await mountSuspended(ThemeHero)
    const pictures = wrapper.findAll('picture.bogota-hero-picture')
    expect(pictures.map(picture => picture.classes())).toEqual([
      expect.arrayContaining(['bogota-hero-picture-auto']),
      expect.arrayContaining(['bogota-hero-picture-alt']),
    ])
    const [auto, alt] = pictures.map(picture => picture.findAll('source').map(source => [source.attributes('media'), source.attributes('srcset')]))
    expect(auto).toEqual([
      ['(min-width: 1024px) and (prefers-color-scheme: dark)', expect.stringMatching(/^\S+w_760&f_webp&q_80\S+sumapaz-night\.jpg 1x, \S+w_1520\S+sumapaz-night\.jpg 2x$/)],
      ['(min-width: 1024px)', expect.stringMatching(/sumapaz-day\.jpg 1x, .+ 2x$/)],
    ])
    expect(alt![0]![1]).toMatch(/sumapaz-day/)
    expect(alt![1]![1]).toMatch(/sumapaz-night/)
  })

  it('loads only the picture that follows the system scheme, with high priority', async () => {
    const wrapper = await mountSuspended(ThemeHero)
    const [auto, alt] = wrapper.findAll('img.bogota-hero-photo')
    expect(auto!.attributes('loading')).toBe('eager')
    expect(auto!.attributes('fetchpriority')).toBe('high')
    expect(alt!.attributes('loading')).toBe('lazy')
    for (const photo of [auto!, alt!]) {
      expect(photo.attributes('alt')).toBe('')
      expect(photo.attributes('aria-hidden')).toBe('true')
      expect(photo.attributes('src')).toBeUndefined()
    }
  })

  it('serves the compact copy at 1x and only below the breakpoint', async () => {
    const wrapper = await mountSuspended(ThemeHero, { props: { compact: true } })
    const sources = wrapper.findAll('picture source')
    expect(sources.every(source => source.attributes('media')!.startsWith('(max-width: 1023.98px)'))).toBe(true)
    expect(sources.every(source => /^\S+w_390&f_webp&q_80\S+ 1x$/.test(source.attributes('srcset')!))).toBe(true)
  })

  it('marks Sumapaz on desktop and drops the species marks', async () => {
    const wrapper = await mountSuspended(ThemeHero)
    expect(wrapper.get('.bogota-flight-place text').text()).toBe('Sumapaz NP · Frailejones')
    expect(wrapper.findAll('.bogota-flight-place rect')).toHaveLength(1)
    expect(wrapper.findAll('.bd-flight-route')).toHaveLength(3)
    expect(wrapper.findAll('.bogota-flyer')).toHaveLength(9)
  })

  it('leaves the place mark out of the compact variant', async () => {
    const wrapper = await mountSuspended(ThemeHero, { props: { compact: true } })
    expect(wrapper.find('.bogota-flight-place').exists()).toBe(false)
    expect(wrapper.get('svg.bogota-flight-map').attributes('viewBox')).toBe('0 0 390 300')
  })

  it('credits the photo with accessible links in a boxed caption', async () => {
    const wrapper = await mountSuspended(ThemeHero)
    expect(wrapper.attributes('aria-hidden')).toBeUndefined()
    const caption = wrapper.get('p.bogota-flight-caption')
    expect(caption.text()).toBe('Fig. 01 — Sumapaz National Park · Photo: Danielfjio · Wikimedia Commons · CC BY-SA 4.0 · Cropped and color graded')
    const [author, license] = caption.findAll('a')
    expect(author!.attributes('href')).toBe('https://commons.wikimedia.org/wiki/File:Paisaje_Sumapaz,_Colombia.jpg')
    expect(author!.attributes('aria-label')).toBe('Photo by Danielfjio · Wikimedia Commons (opens in a new tab)')
    expect(license!.attributes('href')).toBe('https://creativecommons.org/licenses/by-sa/4.0/deed.en')
    expect(license!.attributes('rel')).toBe('license noopener noreferrer')
    expect(license!.attributes('aria-label')).toBe('License CC BY-SA 4.0 (opens in a new tab)')
    for (const link of [author!, license!]) {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toContain('noopener')
    }
  })
})
