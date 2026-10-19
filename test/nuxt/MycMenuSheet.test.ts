import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MycMenuSheet from '~/components/myc/MycMenuSheet.vue'
import { categoriesSettled, serveCategories } from './categoriesFixture'

describe('MycMenuSheet', () => {
  beforeEach(() => serveCategories())

  it('lists sections, topics, theme and language', async () => {
    const wrapper = await mountSuspended(MycMenuSheet, { props: { open: false, active: 'about' } })
    const dialog = wrapper.get('dialog')
    expect(dialog.attributes('aria-label')).toBe('Menu')
    const sections = wrapper.get('nav.myc-sheet-nav')
    expect(sections.attributes('aria-label')).toBe('Sections')
    expect(sections.findAll('a').map(a => a.attributes('href'))).toEqual(['/', '/blog', '/about'])
    expect(sections.get('[aria-current="page"]').text()).toContain('About')
    await vi.waitFor(() => expect(wrapper.findAll('.myc-sheet-cat')).toHaveLength(6))
    const topics = wrapper.findAll('.myc-sheet-cat')
    // The CMS names in its order, only the categories with articles
    expect(topics.map(a => a.text())).toEqual(['Garden', 'Kitchen', 'Workshop', 'Cellar', 'Loft', '◆@bogdev'])
    expect(topics[0]!.attributes('href')).toBe('/blog/category/garden')
    expect(topics[5]!.attributes('href')).toBe('/#fediverso')
    expect(wrapper.find('[role="group"][aria-label="Color theme"]').exists()).toBe(true)
    expect(wrapper.find('[role="group"][aria-label="Language"]').exists()).toBe(true)
  })

  it('lists no topics for a site without categories', async () => {
    serveCategories([])
    const wrapper = await mountSuspended(MycMenuSheet, { props: { open: false } })
    await categoriesSettled()
    expect(wrapper.find('#myc-sheet-topics').exists()).toBe(false)
    expect(wrapper.findAll('.myc-sheet-cat').map(a => a.text())).toEqual(['◆@bogdev'])
  })

  it('opens as a modal and closes from the close button, Esc and the backdrop', async () => {
    const wrapper = await mountSuspended(MycMenuSheet, { props: { open: false } })
    const dialog = wrapper.get('dialog').element as HTMLDialogElement
    await wrapper.setProps({ open: true })
    expect(dialog.open).toBe(true)

    await wrapper.get('.myc-sheet-close').trigger('click')
    expect(wrapper.get('.myc-sheet-close').attributes('aria-label')).toBe('Close menu')
    await wrapper.get('dialog').trigger('cancel')
    await wrapper.get('dialog').trigger('click')
    await wrapper.get('.myc-sheet-panel').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(3)

    await wrapper.setProps({ open: false })
    expect(dialog.open).toBe(false)
  })

  it('closes when the grip is swiped down far enough', async () => {
    const wrapper = await mountSuspended(MycMenuSheet, { props: { open: true } })
    const grip = wrapper.get('.myc-sheet-grip')
    const element = grip.element as HTMLElement
    element.setPointerCapture = () => {}
    await grip.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await grip.trigger('pointermove', { clientY: 140, pointerId: 1 })
    expect(wrapper.get('.myc-sheet-panel').attributes('style')).toContain('translateY(40px)')
    await grip.trigger('pointerup', { pointerId: 1 })
    expect(wrapper.emitted('close')).toBeUndefined()

    await grip.trigger('pointerdown', { clientY: 100, pointerId: 1 })
    await grip.trigger('pointermove', { clientY: 220, pointerId: 1 })
    await grip.trigger('pointerup', { pointerId: 1 })
    expect(wrapper.emitted('close')).toHaveLength(1)
    // The exit starts from the drag offset; it resets when the sheet opens again
    expect(wrapper.get('.myc-sheet-panel').attributes('style')).toContain('translateY(120px)')
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    expect(wrapper.get('.myc-sheet-panel').attributes('style')).toBeUndefined()
  })
})
