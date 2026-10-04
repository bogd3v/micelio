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
  let unregister: (() => void) | undefined

  afterEach(() => {
    unregister?.()
    unregister = undefined
    clearNuxtData()
  })

  it('returns the site from /api/site for the current locale', async () => {
    unregister = registerEndpoint('/api/site', (event) => {
      const locale = new URL(event.path, 'http://localhost').searchParams.get('locale')
      return { name: `Micelio ${locale}`, modules: { comments: false } } as Partial<Site>
    })
    const wrapper = await mountSuspended(SiteName)
    await vi.waitFor(() => expect(wrapper.text()).toBe('Micelio en · no comments'))
  })

  it('falls back to app.config when /api/site fails', async () => {
    let failed = false
    unregister = registerEndpoint('/api/site', () => {
      failed = true
      throw createError({ statusCode: 500 })
    })
    const wrapper = await mountSuspended(SiteName)
    await vi.waitFor(() => expect(failed).toBe(true))
    await flushPromises()
    expect(wrapper.text()).toBe('BogDev · comments')
  })

  it('fetches once per locale however many components read it', async () => {
    let calls = 0
    unregister = registerEndpoint('/api/site', (event) => {
      calls++
      const locale = new URL(event.path, 'http://localhost').searchParams.get('locale')
      return { name: `Micelio ${locale}`, modules: { comments: true } } as Partial<Site>
    })
    const Many = defineComponent({ setup: () => () => h('div', [h(SiteName), h(SiteName), h(SiteName), h(SiteName)]) })
    const wrapper = await mountSuspended(Many)
    await vi.waitFor(() => expect(wrapper.text()).toContain('Micelio en'))
    const before = calls
    await useNuxtApp().$i18n.setLocale('es')
    await vi.waitFor(() => expect(wrapper.findAll('p').every(p => p.text().startsWith('Micelio es'))).toBe(true))
    await flushPromises()
    expect(calls - before).toBe(1)
    await useNuxtApp().$i18n.setLocale('en')
  })
})
