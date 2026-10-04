import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import type { Site } from '~/interfaces'

const SiteName = defineComponent({
  setup() {
    const site = useSite()
    return () => h('p', `${site.value.name} · ${site.value.modules.comments ? 'comments' : 'no comments'}`)
  },
})

describe('useSite', () => {
  afterEach(() => clearNuxtData())

  it('returns the site from /api/site for the current locale', async () => {
    registerEndpoint('/api/site', (event) => {
      const locale = new URL(event.path, 'http://localhost').searchParams.get('locale')
      return { name: `Micelio ${locale}`, modules: { comments: false } } as Partial<Site>
    })
    const wrapper = await mountSuspended(SiteName)
    await vi.waitFor(() => expect(wrapper.text()).toBe('Micelio en · no comments'))
  })

  it('falls back to app.config when /api/site fails', async () => {
    let failed = false
    registerEndpoint('/api/site', () => {
      failed = true
      throw createError({ statusCode: 500 })
    })
    const wrapper = await mountSuspended(SiteName)
    await vi.waitFor(() => expect(failed).toBe(true))
    await flushPromises()
    expect(wrapper.text()).toBe('BogDev · comments')
  })
})
