import { vi } from 'vitest'

/** What the clipboard mock records: the plain text of every item written. */
export interface ClipboardMock {
  /** Plain-text payloads written through `navigator.clipboard.write`, in order. */
  written: string[]
}

/**
 * Replaces the Clipboard API, `ClipboardItem` and the permissions query so VueUse's `useClipboard` (14.4+, which writes
 * a `ClipboardItem` and only then falls back to `execCommand`) takes the modern path in happy-dom.
 */
export function mockClipboard(): ClipboardMock {
  const mock: ClipboardMock = { written: [] }
  class FakeClipboardItem {
    constructor(public readonly data: Record<string, string>) {}
  }
  vi.stubGlobal('ClipboardItem', FakeClipboardItem)
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      write: vi.fn(async (items: FakeClipboardItem[]): Promise<void> => {
        for (const item of items) mock.written.push(item.data['text/plain'] ?? '')
      }),
    },
    configurable: true,
  })
  Object.defineProperty(navigator, 'permissions', {
    value: { query: vi.fn(async () => ({ state: 'granted', onchange: null, addEventListener() {}, removeEventListener() {} })) },
    configurable: true,
  })
  return mock
}
