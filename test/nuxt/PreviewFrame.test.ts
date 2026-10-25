import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import type { PropType } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { PreviewFrame } from '~/interfaces'

const ADMIN = 'https://cms.example.com'
const frame: PreviewFrame = { adminOrigin: ADMIN, documentId: 'doc-1', locale: 'en', version: '2026-10-24T09:30:00.000Z' }
const loadDraft = { v: 1, type: 'load-draft', payload: { documentId: 'doc-1', locale: 'en' } }

const Frame = defineComponent({
  props: { locale: { type: String as PropType<string | null>, default: 'en' } },
  setup(props) {
    usePreviewFrame({ ...frame, locale: props.locale })
    return () => null
  },
})

describe('usePreviewFrame', () => {
  const posted: Array<{ message: unknown, origin: string }> = []
  const parent = { postMessage: (message: unknown, origin: string): number => posted.push({ message, origin }) } as unknown as Window
  let reload: ReturnType<typeof vi.fn>
  let original: PropertyDescriptor | undefined

  beforeEach(() => {
    posted.length = 0
    original = Object.getOwnPropertyDescriptor(window, 'parent')
    Object.defineProperty(window, 'parent', { value: parent, configurable: true })
    reload = vi.fn()
    Object.defineProperty(window.location, 'reload', { value: reload, configurable: true })
  })

  afterEach(() => {
    if (original) Object.defineProperty(window, 'parent', original)
    else Reflect.deleteProperty(window, 'parent')
  })

  function send(data: unknown, init: { origin?: string, source?: unknown } = {}): void {
    window.dispatchEvent(new MessageEvent('message', { data, origin: init.origin ?? ADMIN, source: ('source' in init ? init.source : parent) as MessageEventSource }))
  }

  it('says ready to the admin origin, never to any origin', async () => {
    const wrapper = await mountSuspended(Frame)
    expect(posted).toEqual([{ origin: ADMIN, message: { v: 1, type: 'ready', payload: { v: [1], documentId: 'doc-1', locale: 'en', version: frame.version } } }])
    wrapper.unmount()
  })

  it('loads the draft again on a load-draft for its own document and locale', async () => {
    const wrapper = await mountSuspended(Frame)
    send(loadDraft)
    expect(reload).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('drops a message from another origin or another window', async () => {
    const wrapper = await mountSuspended(Frame)
    send(loadDraft, { origin: 'https://evil.example.com' })
    send(loadDraft, { origin: 'http://cms.example.com' })
    send(loadDraft, { source: window })
    send(loadDraft, { source: null })
    expect(reload).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('drops a message that fails the schema, another document or locale, ready, and an unknown type', async () => {
    const wrapper = await mountSuspended(Frame)
    send({ ...loadDraft, v: 2 })
    send({ v: 1, type: 'load-draft', payload: { documentId: 'doc-1' } })
    send({ ...loadDraft, payload: { documentId: 'doc-2', locale: 'en' } })
    send({ ...loadDraft, payload: { documentId: 'doc-1', locale: 'es' } })
    send({ ...loadDraft, payload: { documentId: 'doc-1', locale: null } })
    send({ v: 1, type: 'ready', payload: { v: [1], documentId: 'doc-1', locale: 'en', version: 'x' } })
    send({ v: 1, type: 'block-select', payload: { zone: 'sections', index: 0, block: 'hero', version: 'x' } })
    send('load-draft')
    send(null)
    expect(reload).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('reads the load-draft of a draft that is not localised by its null locale, and says null in ready', async () => {
    const wrapper = await mountSuspended(Frame, { props: { locale: null } })
    expect(posted[0]?.message).toMatchObject({ payload: { documentId: 'doc-1', locale: null } })
    send({ ...loadDraft, payload: { documentId: 'doc-1', locale: 'en' } })
    expect(reload).not.toHaveBeenCalled()
    send({ ...loadDraft, payload: { documentId: 'doc-1', locale: null } })
    expect(reload).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('stops listening once the page is gone', async () => {
    const wrapper = await mountSuspended(Frame)
    wrapper.unmount()
    send(loadDraft)
    expect(reload).not.toHaveBeenCalled()
  })

  it('does nothing outside a frame', async () => {
    Object.defineProperty(window, 'parent', { value: window, configurable: true })
    const wrapper = await mountSuspended(Frame)
    send(loadDraft, { source: window })
    expect(posted).toEqual([])
    expect(reload).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
