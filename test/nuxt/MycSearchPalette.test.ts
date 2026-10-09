import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { getQuery } from 'h3'
import MycSearchPalette from '~/components/myc/MycSearchPalette.vue'

const searches: Record<string, unknown>[] = []

registerEndpoint('/api/search', (event) => {
  const query = getQuery(event)
  searches.push(query)
  if (query.q === 'nada que ver') return []
  if (query.content === '1') {
    return [
      { documentId: 'doc-vue', title: 'Understanding Vue Composables', slug: 'understanding-vue-composables', description: null, publishedAt: '2026-02-01T10:00:00.000Z', category: { name: 'Software', slug: 'software' }, matchedIn: 'content', snippet: '…share stateful logic across components…' },
    ]
  }
  return [
    { documentId: 'doc-vue', title: 'Understanding Vue Composables', slug: 'understanding-vue-composables', description: null, publishedAt: '2026-02-01T10:00:00.000Z', category: { name: 'Software', slug: 'software' }, matchedIn: 'title', snippet: 'Understanding Vue Composables' },
  ]
})

registerEndpoint('/api/categories', () => [
  { id: 1, slug: 'software', name: 'Software', count: 2 },
  { id: 2, slug: 'linux', name: 'Linux', count: 1 },
])

async function mountOpen() {
  const wrapper = await mountSuspended(MycSearchPalette, { props: { open: false } })
  await wrapper.setProps({ open: true })
  return wrapper
}

function labels(wrapper: Awaited<ReturnType<typeof mountOpen>>): string[] {
  return wrapper.findAll('[role="option"] .myc-result-label').map(node => node.text())
}

describe('MycSearchPalette', () => {
  beforeEach(() => {
    searches.length = 0
    useTheme().sync('noche')
  })

  it('opens as a modal combobox with topics and actions', async () => {
    const wrapper = await mountOpen()
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(true)
    const input = wrapper.get('input')
    expect(input.attributes('role')).toBe('combobox')
    expect(input.attributes('aria-controls')).toBe('myc-palette-list')
    expect(input.attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('label').attributes('for')).toBe(input.attributes('id'))
    expect(wrapper.get('#myc-palette-list').attributes('role')).toBe('listbox')
    expect(wrapper.findAll('[role="group"]').map(group => group.get('.myc-palette-heading').text())).toEqual(['Topics', 'Actions'])
    expect(labels(wrapper)).toEqual([
      'Privacy', 'DIY · Do it yourself', 'Artificial intelligence', 'Software development', 'Linux and open source',
      'Switch to the Day theme', 'Follow on the fediverse',
    ])
    await vi.waitFor(() => expect(wrapper.get('#topic-software .myc-result-hint').text()).toBe('02'))
    expect(wrapper.get('.myc-palette-note').text()).toBe('Type 3 or more letters to search articles')
  })

  it('filters topics locally without calling the API for short queries', async () => {
    const wrapper = await mountOpen()
    await wrapper.get('input').setValue('ux')
    expect(labels(wrapper)).toEqual(['Linux and open source', 'Switch to the Day theme', 'Follow on the fediverse'])
    expect(searches).toHaveLength(0)
  })

  it('searches articles with the locale and announces the result count', async () => {
    const wrapper = await mountOpen()
    await wrapper.get('input').setValue('composables')
    expect(wrapper.get('.myc-palette-note').text()).toBe('Searching…')
    await vi.waitFor(() => expect(wrapper.find('#article-doc-vue').exists()).toBe(true), { timeout: 2000 })
    expect(searches).toEqual([{ q: 'composables', locale: 'en' }])
    expect(wrapper.get('#article-doc-vue .myc-result-label').text()).toBe('Understanding Vue Composables')
    expect(wrapper.get('#article-doc-vue .myc-result-hint').text()).toBe('01.02.2026')
    expect(wrapper.get('[role="status"]').text()).toBe('1 result')
    expect(wrapper.get('[role="status"]').attributes('aria-live')).toBe('polite')
  })

  it('highlights the title match and leaves out the snippet for title matches', async () => {
    const wrapper = await mountOpen()
    await wrapper.get('input').setValue('composables')
    await vi.waitFor(() => expect(wrapper.find('#article-doc-vue').exists()).toBe(true), { timeout: 2000 })
    expect(wrapper.get('#article-doc-vue .myc-result-label mark').text()).toBe('Composables')
    expect(wrapper.find('#article-doc-vue .myc-result-snippet').exists()).toBe(false)
  })

  it('also searches the content when asked and shows the highlighted snippet', async () => {
    const wrapper = await mountOpen()
    const toggle = wrapper.get('.myc-palette-content input')
    expect(wrapper.get('.myc-palette-content').text()).toBe('Also search the content')
    await wrapper.get('input').setValue('stateful')
    await vi.waitFor(() => expect(searches).toHaveLength(1), { timeout: 2000 })
    await toggle.setValue(true)
    await vi.waitFor(() => expect(wrapper.find('#article-doc-vue .myc-result-snippet').exists()).toBe(true), { timeout: 2000 })
    expect(searches.at(-1)).toEqual({ q: 'stateful', locale: 'en', content: '1' })
    expect(wrapper.get('#article-doc-vue .myc-result-snippet').text()).toBe('…share stateful logic across components…')
    expect(wrapper.get('#article-doc-vue .myc-result-snippet mark').text()).toBe('stateful')
  })

  it('shows the empty state', async () => {
    const wrapper = await mountOpen()
    await wrapper.get('input').setValue('nada que ver')
    await vi.waitFor(() => expect(wrapper.find('.myc-palette-note').text()).toBe('No results for “nada que ver”'), { timeout: 2000 })
    expect(wrapper.get('[role="status"]').text()).toBe('No results for “nada que ver”')
    expect(labels(wrapper)).toEqual(['Switch to the Day theme', 'Follow on the fediverse'])
  })

  it('moves the active option with the arrows and runs the theme action with Enter', async () => {
    const wrapper = await mountOpen()
    const input = wrapper.get('input')
    expect(input.attributes('aria-activedescendant')).toBeUndefined()
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(input.attributes('aria-activedescendant')).toBe('topic-privacidad')
    expect(wrapper.get('#topic-privacidad').attributes('aria-selected')).toBe('true')
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'ArrowUp' })
    expect(input.attributes('aria-activedescendant')).toBe('action-theme')
    await input.trigger('keydown', { key: 'Enter' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('dia')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('closes with Esc, the Esc button and the backdrop, and resets when it opens again', async () => {
    const wrapper = await mountOpen()
    await wrapper.get('dialog').trigger('cancel')
    await wrapper.get('.myc-palette-esc').trigger('click')
    await wrapper.get('dialog').trigger('click')
    await wrapper.get('.myc-palette-panel').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(3)

    await wrapper.get('input').setValue('li')
    await wrapper.setProps({ open: false })
    expect((wrapper.get('dialog').element as HTMLDialogElement).open).toBe(false)
    // It keeps its content while it fades out, and starts empty when it opens again
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('li')
    await wrapper.setProps({ open: true })
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('')
  })
})
