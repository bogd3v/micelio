import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from '#app'
import { useSectionPage } from '~/composables/useSectionPage'

const LEAF = '<symbol id="myc-i-leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M1 1"/></symbol>'

registerEndpoint('/api/pages/with-icons', () => ({ documentId: 'p', title: 'T', slug: 'with-icons', sections: [], translations: [], iconSymbols: { 'myc-i-leaf': LEAF } }))
registerEndpoint('/api/pages/plain', () => ({ documentId: 'q', title: 'T', slug: 'plain', sections: [], translations: [] }))
registerEndpoint('/api/about', () => ({ id: 1, documentId: 'a', title: 'About', locale: 'en', blocks: [], iconSymbols: { 'myc-i-leaf': LEAF } }))

// What a page of the app does: fetch, and keep what the fetch returned
const results: { value?: object } = {}

describe('the page-data fetchers and the icon symbols of their response', () => {
  afterEach(() => {
    document.getElementById('myc-icons')?.remove()
    clearNuxtData()
    results.value = undefined
  })

  it('useSectionPage adds the symbols of /api/pages/:slug to the sprite and keeps them out of the page it returns', async () => {
    await mountSuspended(defineComponent({
      async setup() {
        results.value = (await useSectionPage('with-icons')).page.value
        return () => h('div')
      },
    }))
    expect(document.querySelector('#myc-icons #myc-i-leaf path')?.getAttribute('d')).toBe('M1 1')
    expect(results.value).toMatchObject({ slug: 'with-icons' })
    expect(results.value).not.toHaveProperty('iconSymbols')
  })

  it('useSectionPage leaves the document alone for a response with no symbols', async () => {
    await mountSuspended(defineComponent({
      async setup() {
        results.value = (await useSectionPage('plain')).page.value
        return () => h('div')
      },
    }))
    expect(results.value).toMatchObject({ slug: 'plain' })
    expect(document.getElementById('myc-icons')).toBeNull()
  })

  it('fetchAbout does the same for /api/about', async () => {
    await mountSuspended(defineComponent({
      async setup() {
        const { data } = await useStrapi().fetchAbout()
        results.value = data.value
        return () => h('div')
      },
    }))
    expect(document.querySelector('#myc-icons #myc-i-leaf')).not.toBeNull()
    expect(results.value).toMatchObject({ documentId: 'a' })
    expect(results.value).not.toHaveProperty('iconSymbols')
  })
})
