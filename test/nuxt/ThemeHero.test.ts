import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ThemeHero from '~~/themes/bogota/slots/ThemeHero.vue'

describe('ThemeHero', () => {
  it('renders a decorative photo per theme', async () => {
    const wrapper = await mountSuspended(ThemeHero)
    const photos = wrapper.findAll('img.bogota-hero-photo')
    expect(photos.map(photo => photo.classes())).toEqual([
      expect.arrayContaining(['bogota-hero-photo-night']),
      expect.arrayContaining(['bogota-hero-photo-day']),
    ])
    expect(photos.every(photo => photo.attributes('alt') === '' && photo.attributes('aria-hidden') === 'true')).toBe(true)
    expect(photos.every(photo => photo.attributes('loading') === 'lazy')).toBe(true)
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
