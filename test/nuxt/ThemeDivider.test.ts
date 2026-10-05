import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ThemeDivider from '~~/themes/bogota/slots/ThemeDivider.vue'

describe('ThemeDivider', () => {
  it('draws the hill landmarks without the cable car', async () => {
    const wrapper = await mountSuspended(ThemeDivider)
    expect(wrapper.get('.bogota-monserrate title').text()).toBe('Basilica of the Lord of Monserrate')
    expect(wrapper.get('.bogota-guadalupe title').text()).toBe('Sanctuary and Virgin of Guadalupe')
    expect(wrapper.find('animateMotion').exists()).toBe(false)
  })

  it('names the skyline buildings from west to east', async () => {
    const wrapper = await mountSuspended(ThemeDivider)
    const titles = wrapper.findAll('.bogota-lay4 path > title').map(title => title.text())
    expect(titles).toEqual([
      'Atrio North Tower · 201 m · Rogers Stirk Harbour + El Equipo Mazzanti',
      'International Trade Center · 192 m',
      'Hotel Tequendama · International Center',
      'BD Bacatá · south tower 216 m',
      'BD Bacatá · north tower 167 m',
      'Avianca Building · 161 m',
      'Colpatria Tower · 196 m · LED façade with the flags of Palestine, Colombia and Bogotá',
      'Torres del Parque · Rogelio Salmona',
      'La Santamaría bullring',
    ])
  })

  it('clips the Colpatria flags to the LED strips', async () => {
    const wrapper = await mountSuspended(ThemeDivider)
    const led = wrapper.get('g.bogota-colpatria')
    const clipId = led.attributes('clip-path')!.match(/^url\(#(.+)\)$/)![1]
    const clip = wrapper.get(`clipPath[id="${clipId}"]`)
    expect(clip.findAll('rect')).toHaveLength(11)
    const flags = led.findAll(':scope > g')
    expect(flags.map(flag => flag.get('title').text())).toEqual(['Palestine', 'Colombia', 'Bogotá'])
    expect(flags.every(flag => flag.find('animate[dur="18s"][calcMode="discrete"]').exists())).toBe(true)
  })
})
