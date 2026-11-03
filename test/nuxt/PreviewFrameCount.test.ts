import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { PreviewFrame } from '~/interfaces'

// The count of the messages the frame ignores is the development aid the issue asks for: this file pins that the frame calls it
const { count } = vi.hoisted(() => ({ count: vi.fn<() => number>() }))

vi.mock('~/helpers/previewBlocks', async (importOriginal) => {
  const original = await importOriginal<typeof import('~/helpers/previewBlocks')>()
  return { ...original, droppedCounter: (): (() => number) => count }
})

const ADMIN = 'https://cms.example.com'
const frame: PreviewFrame = { adminOrigin: ADMIN, documentId: 'doc-1', locale: 'en', version: '2026-10-24T09:30:00.000Z' }
const grid = { zone: 'sections', index: 0, block: 'hero', version: frame.version }
const patch = vi.fn<(patch: unknown) => boolean>()

const Frame = defineComponent({
  setup() {
    usePreviewFrame(frame, { patch })
    return () => null
  },
})

describe('usePreviewFrame counts what it ignores', () => {
  const parent = { postMessage: vi.fn() } as unknown as Window
  let original: PropertyDescriptor | undefined
  let zone: HTMLElement

  beforeEach(() => {
    count.mockReset()
    patch.mockReset().mockReturnValue(true)
    original = Object.getOwnPropertyDescriptor(window, 'parent')
    Object.defineProperty(window, 'parent', { value: parent, configurable: true })
    vi.stubGlobal('ResizeObserver', class {
      observe(): void {}
      disconnect(): void {}
    })
    zone = document.createElement('div')
    zone.setAttribute('data-myc-zone', 'sections')
    document.body.append(zone)
  })

  afterEach(() => {
    zone.remove()
    vi.unstubAllGlobals()
    if (original) Object.defineProperty(window, 'parent', original)
    else Reflect.deleteProperty(window, 'parent')
  })

  function send(data: unknown, init: { origin?: string, source?: unknown } = {}): void {
    window.dispatchEvent(new MessageEvent('message', { data, origin: init.origin ?? ADMIN, source: ('source' in init ? init.source : parent) as MessageEventSource }))
  }

  const envelope = (type: string, payload: unknown, v = 1): unknown => ({ v, type, payload })

  it('counts a load-draft that fails its schema, once', async () => {
    const wrapper = await mountSuspended(Frame)
    send(envelope('load-draft', { documentId: 'doc-1' }))
    expect(count).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('counts a value that is not an envelope, and a stale version, once each', async () => {
    const wrapper = await mountSuspended(Frame)
    send('micelio:select')
    expect(count).toHaveBeenCalledTimes(1)
    send(envelope('micelio:select', { address: { ...grid, version: 'older' } }))
    expect(count).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('counts a patch the page refuses, once, and a patch it takes not at all', async () => {
    const wrapper = await mountSuspended(Frame)
    send(envelope('micelio:patch', { address: grid, content: { title: 'x' }, items: [] }))
    expect(patch).toHaveBeenCalledTimes(1)
    expect(count).not.toHaveBeenCalled()
    patch.mockReturnValue(false)
    send(envelope('micelio:patch', { address: grid, content: { title: 'x' }, items: [] }))
    expect(count).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('counts nothing for what is well formed but not for it, or does not come from the admin', async () => {
    const wrapper = await mountSuspended(Frame)
    send(envelope('block-select', {}))
    send(envelope('micelio:select', { address: null }, 2))
    send(envelope('load-draft', { documentId: 'doc-1', locale: 'en' }, 2))
    send(envelope('micelio:select', { address: grid }), { origin: 'https://evil.example.com' })
    send(envelope('micelio:select', { address: grid }), { source: window })
    send('not an envelope', { origin: 'https://evil.example.com' })
    expect(count).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
