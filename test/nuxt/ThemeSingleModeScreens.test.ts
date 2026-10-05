import { describe, it, expect, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import BdSearchPalette from '~/components/bd/BdSearchPalette.vue'
import PrivacyPage from '~/pages/privacy.vue'

vi.mock('#micelio/theme', () => {
  const modes = [{ id: 'paper', scheme: 'light', name: 'Paper' }]
  return { modes, default: { id: 'minimal', modes } }
})

registerEndpoint('/api/search', () => [])
registerEndpoint('/api/categories', () => [])

describe('a single-mode theme', () => {
  it('hides the theme action in the search palette', async () => {
    const wrapper = await mountSuspended(BdSearchPalette, { props: { open: false } })
    await wrapper.setProps({ open: true })
    const labels = wrapper.findAll('[role="option"] .bd-result-label').map(node => node.text())
    expect(labels.some(label => label.includes('theme'))).toBe(false)
  })

  it('drops the bd-theme item from the privacy page', async () => {
    const wrapper = await mountSuspended(PrivacyPage)
    const keys = wrapper.findAll('.bd-privacy-keys .bd-privacy-key').map(node => node.text())
    expect(keys).toEqual(['bd-privacy-notice', 'bd-read-articles'])
  })
})
