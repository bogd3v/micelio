import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BdMenuSheet from '~/components/bd/BdMenuSheet.vue'

describe('BdMenuSheet', () => {
  it('lists sections, topics, theme and language', async () => {
    const wrapper = await mountSuspended(BdMenuSheet, { props: { open: false, active: 'about' } })
    const dialog = wrapper.get('dialog')
    expect(dialog.attributes('aria-label')).toBe('Menu')
    const sections = wrapper.get('nav.bd-sheet-nav')
    expect(sections.attributes('aria-label')).toBe('Sections')
    expect(sections.findAll('a').map(a => a.attributes('href'))).toEqual(['/', '/blog', '/about'])
    expect(sections.get('[aria-current="page"]').text()).toContain('About')
    const topics = wrapper.findAll('.bd-sheet-cat')
    expect(topics.map(a => a.text())).toEqual(['Privacy', 'DIY', 'AI', 'Software', 'Linux', '◆@bogdev'])
    expect(topics[0]!.attributes('href')).toBe('/blog/category/privacidad')
    expect(topics[5]!.attributes('href')).toBe('/#fediverso')
    expect(wrapper.find('[role="group"][aria-label="Color theme"]').exists()).toBe(true)
    expect(wrapper.find('[role="group"][aria-label="Language"]').exists()).toBe(true)
  })

  it('opens as a modal and closes from the close button, Esc and the backdrop', async () => {
    const wrapper = await mountSuspended(BdMenuSheet, { props: { open: false } })
    const dialog = wrapper.get('dialog').element as HTMLDialogElement
    await wrapper.setProps({ open: true })
    expect(dialog.open).toBe(true)

    await wrapper.get('.bd-sheet-close').trigger('click')
    expect(wrapper.get('.bd-sheet-close').attributes('aria-label')).toBe('Close menu')
    await wrapper.get('dialog').trigger('cancel')
    await wrapper.get('dialog').trigger('click')
    await wrapper.get('.bd-sheet-panel').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(3)

    await wrapper.setProps({ open: false })
    expect(dialog.open).toBe(false)
  })

  it('closes when the grip is swiped down far enough', async () => {
    const wrapper = await mountSuspended(BdMenuSheet, { props: { open: true } })
    const grip = wrapper.get('.bd-sheet-grip')
    const element = grip.element as HTMLElement
    element.setPointerCapture = () => {}
    await grip.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await grip.trigger('pointermove', { clientY: 140, pointerId: 1 })
    expect(wrapper.get('.bd-sheet-panel').attributes('style')).toContain('translateY(40px)')
    await grip.trigger('pointerup', { pointerId: 1 })
    expect(wrapper.emitted('close')).toBeUndefined()

    await grip.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await grip.trigger('pointermove', { clientY: 220, pointerId: 1 })
    await grip.trigger('pointerup', { pointerId: 1 })
    expect(wrapper.emitted('close')).toHaveLength(1)
    expect(wrapper.get('.bd-sheet-panel').attributes('style')).toBeUndefined()
  })
})
