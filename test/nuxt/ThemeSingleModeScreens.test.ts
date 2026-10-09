import { describe, it, expect, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import MycSearchPalette from '~/components/myc/MycSearchPalette.vue'
import PrivacyPage from '~/pages/privacy.vue'

vi.mock('#micelio/theme', () => {
  const modes = [{ id: 'paper', scheme: 'light', name: 'Paper' }]
  return { modes, images: {}, default: { id: 'minimal', modes, images: {} } }
})

registerEndpoint('/api/search', () => [])
registerEndpoint('/api/categories', () => [])

describe('a single-mode theme', () => {
  it('hides the theme action in the search palette', async () => {
    const wrapper = await mountSuspended(MycSearchPalette, { props: { open: false } })
    await wrapper.setProps({ open: true })
    const labels = wrapper.findAll('[role="option"] .myc-result-label').map(node => node.text())
    expect(labels.some(label => label.includes('theme'))).toBe(false)
  })

  it('drops the bd-theme item from the privacy page', async () => {
    const wrapper = await mountSuspended(PrivacyPage)
    const keys = wrapper.findAll('.myc-privacy-keys .myc-privacy-key').map(node => node.text())
    expect(keys).toEqual(['micelio-privacy-notice', 'micelio-read-articles'])
  })
})
