import { afterEach, describe, it, expect, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MycLangSwitch from '~/components/myc/MycLangSwitch.vue'

// The first switch to Spanish loads its messages, which takes longer under load than the 1000 ms
// that `vi.waitFor` waits by default. A test runs to the end of its own timeout, never gives up first
const SWITCH_TIMEOUT_MS = 10_000
const TEST_TIMEOUT_MS = 15_000

describe('MycLangSwitch', () => {
  // Whether a test passes or fails, the next one starts on `/` in English
  afterEach(async () => {
    await useRouter().push('/')
    await useNuxtApp().$i18n.setLocale('en')
  })

  it('is a labelled group with the current language pressed', async () => {
    const wrapper = await mountSuspended(MycLangSwitch)
    expect(wrapper.attributes('role')).toBe('group')
    expect(wrapper.attributes('aria-label')).toBe('Language')
    const buttons = wrapper.findAll('button')
    expect(buttons.map(b => b.text())).toEqual(['ES', 'EN'])
    expect(buttons.map(b => b.attributes('lang'))).toEqual(['es', 'en'])
    expect(buttons.map(b => b.attributes('aria-label'))).toEqual(['ES Español', 'EN English'])
    expect(buttons.map(b => b.attributes('aria-pressed'))).toEqual(['false', 'true'])
  })

  it('ignores the current language', async () => {
    const wrapper = await mountSuspended(MycLangSwitch)
    await wrapper.findAll('button')[1]!.trigger('click')
    expect(wrapper.emitted('change')).toBeUndefined()
  })

  it('keeps the blog filters and the hash, but not the page, in the other language', async () => {
    const wrapper = await mountSuspended(MycLangSwitch, { route: '/blog/tag/llm/page/2?sort=fediverse#posts' })
    // The blog page lists the first page of the filter as the alternate
    useLocaleAlternates().setAlternates({ en: '/blog/tag/llm', es: '/es/blog/tag/llm' }, { hreflang: false })
    await wrapper.findAll('button')[0]!.trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('change')).toEqual([['es']]), { timeout: SWITCH_TIMEOUT_MS })
    const route = useRouter().currentRoute.value
    expect(route.path).toBe('/es/blog/tag/llm')
    expect(route.query).toEqual({ sort: 'fediverse' })
    expect(route.hash).toBe('#posts')
  }, TEST_TIMEOUT_MS)

  it('opens the translated article with its own slug, keeping the query and the hash but not the page', async () => {
    const wrapper = await mountSuspended(MycLangSwitch, { route: '/blog/what-is-solarpunk?ref=feed&page=2#intro' })
    useLocaleAlternates().setAlternates({ en: '/blog/what-is-solarpunk', es: '/es/blog/que-es-solarpunk' })
    await wrapper.findAll('button')[0]!.trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('change')).toEqual([['es']]), { timeout: SWITCH_TIMEOUT_MS })
    const route = useRouter().currentRoute.value
    expect(route.path).toBe('/es/blog/que-es-solarpunk')
    expect(route.query).toEqual({ ref: 'feed' })
    expect(route.hash).toBe('#intro')
    expect(useNuxtApp().$i18n.locale.value).toBe('es')
  }, TEST_TIMEOUT_MS)

  it('opens the blog of the other language when the article has no translation', async () => {
    const wrapper = await mountSuspended(MycLangSwitch, { route: '/blog/linux-server-hardening-guide' })
    useLocaleAlternates().setAlternates({ en: '/blog/linux-server-hardening-guide' })
    await wrapper.findAll('button')[0]!.trigger('click')
    await vi.waitFor(() => expect(wrapper.emitted('change')).toEqual([['es']]), { timeout: SWITCH_TIMEOUT_MS })
    expect(useRouter().currentRoute.value.path).toBe('/es/blog')
  }, TEST_TIMEOUT_MS)
})
