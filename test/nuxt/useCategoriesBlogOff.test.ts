import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { CATEGORIES_SOURCE, useCategories } from '~/composables/useCategories'
import { categoryRequestCount, serveCategories } from './categoriesFixture'

const Probe = defineComponent({
  setup() {
    const { listed } = useCategories()
    return () => h('p', String(listed.value.length))
  },
})

describe('useCategories with a fixed list', () => {
  it('reads the injected list instead of asking the CMS, as the specimen page does', async () => {
    const fixed = [{ id: 1, slug: 'one', name: 'One', description: null, order: 1, featured: false, count: 2 }]
    serveCategories([])
    const before = categoryRequestCount()
    const wrapper = await mountSuspended(Probe, { global: { provide: { [CATEGORIES_SOURCE as symbol]: fixed } } })
    await flushPromises()
    expect(categoryRequestCount()).toBe(before)
    expect(wrapper.text()).toBe('1')
  })
})

describe('useCategories without a blog', () => {
  let original: unknown

  beforeEach(() => {
    original = useRuntimeConfig().public.blogEnabled
    serveCategories()
  })
  afterEach(() => {
    useRuntimeConfig().public.blogEnabled = original as boolean
  })

  it('makes no request and lists nothing when the build has no blog', async () => {
    useRuntimeConfig().public.blogEnabled = false
    const before = categoryRequestCount()
    const wrapper = await mountSuspended(Probe)
    await flushPromises()
    expect(categoryRequestCount()).toBe(before)
    expect(wrapper.text()).toBe('0')
  })

  it('asks for the list when the blog is enabled', async () => {
    useRuntimeConfig().public.blogEnabled = true
    const before = categoryRequestCount()
    await mountSuspended(Probe)
    await flushPromises()
    expect(categoryRequestCount()).toBeGreaterThan(before)
  })
})
