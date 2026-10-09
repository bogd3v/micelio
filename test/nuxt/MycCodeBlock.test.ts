import { describe, it, expect, vi, afterEach } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import MycCodeBlock from '~/components/myc/MycCodeBlock.vue'

describe('MycCodeBlock', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('marks prompt lines and shows language and filename', async () => {
    const wrapper = await mountSuspended(MycCodeBlock, {
      props: { code: '$ ollama run llama3.2\n>>> hola\n', lang: 'bash', filename: 'terminal' },
    })
    expect(wrapper.get('.myc-code-lang').text()).toBe('bash')
    expect(wrapper.text()).toContain('terminal')
    expect(wrapper.findAll('.myc-prompt')).toHaveLength(1)
    expect(wrapper.get('code').text()).toBe('$ ollama run llama3.2\n>>> hola')
  })

  it('copies the code without prompts and confirms it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const wrapper = await mountSuspended(MycCodeBlock, { props: { code: '$ npm install\n$ npm run dev' } })
    const button = wrapper.get('button.myc-code-copy')
    expect(button.text()).toBe('Copy')
    expect(button.attributes('aria-label')).toBe('Copy code')
    await button.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('npm install\nnpm run dev')
    expect(button.text()).toBe('Copied ✓')
  })

  it('hides the copy button when disabled', async () => {
    const wrapper = await mountSuspended(MycCodeBlock, { props: { code: 'x', showCopy: false } })
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
