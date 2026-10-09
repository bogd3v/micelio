import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { READ_STORAGE_KEY } from '~/helpers/readArticles'

type ReadArticles = ReturnType<typeof useReadArticles>

async function mountReader(): Promise<ReadArticles> {
  let api: ReadArticles | undefined
  await mountSuspended(defineComponent({
    setup() {
      api = useReadArticles()
      return () => h('div')
    },
  }))
  await flushPromises()
  return api!
}

describe('useReadArticles', () => {
  beforeEach(() => {
    localStorage.clear()
    useState('myc-read-articles').value = []
    useState('myc-read-articles-loaded').value = false
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('loads the stored history after mounting', async () => {
    localStorage.setItem(READ_STORAGE_KEY, '["doc-rag"]')
    const reader = await mountReader()
    expect(reader.isRead('doc-rag')).toBe(true)
    expect(reader.isRead('doc-vue')).toBe(false)
    expect(reader.count.value).toBe(1)
  })

  it('marks articles as read and keeps them in the browser', async () => {
    const reader = await mountReader()
    reader.markRead('doc-vue')
    reader.markRead('doc-vue')
    expect(reader.count.value).toBe(1)
    expect(localStorage.getItem(READ_STORAGE_KEY)).toBe('["doc-vue"]')
  })

  it('clears the history', async () => {
    localStorage.setItem(READ_STORAGE_KEY, '["doc-rag","doc-vue"]')
    const reader = await mountReader()
    reader.clear()
    expect(reader.count.value).toBe(0)
    expect(localStorage.getItem(READ_STORAGE_KEY)).toBeNull()
  })

  it('keeps working in memory when localStorage is not available', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const reader = await mountReader()
    expect(reader.count.value).toBe(0)
    expect(() => reader.markRead('doc-rag')).not.toThrow()
    expect(reader.isRead('doc-rag')).toBe(true)
  })
})
