import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { StrapiBlock, StrapiPlayground } from '~/interfaces'
import StrapiBlocksRenderer from '~/components/strapi/BlocksRenderer.vue'
import StrapiPlaygroundBlock from '~/components/strapi/PlaygroundBlock.vue'

function playground(overrides: Partial<StrapiPlayground> = {}): StrapiPlayground {
  return {
    id: 1,
    __component: 'shared.playground',
    runtime: 'sql',
    code: 'SELECT 1 AS one;',
    expectedOutput: 'one\n---\n1',
    caption: 'The simplest query.',
    ...overrides,
  }
}

describe('StrapiPlaygroundBlock', () => {
  it.each([
    ['sql', 'SQL'],
    ['python', 'Python'],
    ['javascript', 'JavaScript'],
  ])('renders %s with its language, code, expected output and caption', async (runtime, label) => {
    const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground({ runtime }) } })
    const figure = wrapper.get('figure.myc-playground')
    expect(figure.attributes('data-runtime')).toBe(runtime)
    expect(figure.attributes('aria-label')).toBe(`Runnable code, ${label}`)
    expect(wrapper.get('.myc-code-lang').text()).toBe(runtime)
    expect(wrapper.get('code').classes()).toContain(`language-${runtime}`)
    expect(wrapper.get('code').attributes('data-playground-code')).toBeDefined()
    expect(wrapper.get('.myc-code code').text()).toBe('SELECT 1 AS one;')
    expect(wrapper.get('figure.myc-playground-expected > figcaption').text()).toBe('Expected output')
    expect(wrapper.get('pre.myc-playground-output').text()).toBe('one\n---\n1')
    expect(wrapper.get('pre.myc-playground-output').attributes('aria-labelledby')).toBeUndefined()
    const caption = wrapper.get('figure.myc-playground > figcaption')
    expect(caption.text()).toBe('The simplest query.')
    expect(figure.attributes('aria-describedby')).toBe(caption.attributes('id'))
  })

  it('ships a hidden Run button and an empty live region for the island', async () => {
    const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground() } })
    const run = wrapper.get('[data-playground-run]')
    expect(run.attributes('hidden')).toBeDefined()
    expect(run.text()).toBe('Run')
    const result = wrapper.get('output[data-playground-result]')
    expect(result.text()).toBe('')
    expect(result.attributes('role')).toBeUndefined()
    expect(run.attributes('aria-controls')).toBe(result.attributes('id'))
  })

  it('ships a hidden Stop button, a polite live region and every string the island shows', async () => {
    const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground() } })
    const stop = wrapper.get('[data-playground-stop]')
    expect(stop.attributes('hidden')).toBeDefined()
    expect(stop.text()).toBe('Stop')
    expect(stop.attributes('aria-label')).toBe('Stop the code')
    // The output can be 64 KB: it is not a live region, a short status next to it is
    expect(wrapper.get('output[data-playground-result]').attributes('aria-live')).toBeUndefined()
    const status = wrapper.get('p[data-playground-status]')
    expect(status.attributes('role')).toBe('status')
    expect(status.classes()).toContain('myc-sr')
    expect(status.text()).toBe('')
    const island = wrapper.get('micelio-playground')
    expect(island.attributes('data-timeout')).toBe('Stopped: the code ran for more than {seconds} seconds.')
    expect(island.attributes('data-error')).toBe('Error: {message}')
    expect(island.attributes('data-save-data-label')).toMatch(/^Run \(.+ download\)$/)
    expect(island.attributes('data-truncated')).toBe('[Output cut at {size}]')
    for (const name of ['loading', 'running', 'empty', 'stopped', 'unavailable']) expect(island.attributes(`data-${name}`), name).toBeTruthy()
    expect(island.find('figure.myc-playground').exists()).toBe(true)
    expect(island.find('.myc-playground-notice').text()).toBe('The code could not run in this browser.')
  })

  it('has no Stop button for a language it cannot run', async () => {
    const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground({ runtime: 'cobol' }) } })
    expect(wrapper.find('[data-playground-stop]').exists()).toBe(false)
    expect(wrapper.find('micelio-playground').exists()).toBe(false)
  })

  it('shows the code and output as text, with no script involved', async () => {
    const wrapper = await mountSuspended(StrapiPlaygroundBlock, {
      props: { block: playground({ code: '<script>alert(1)</script>', expectedOutput: '<b>x</b>', setup: 'CREATE TABLE t(a);' }) },
    })
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.html()).toContain('&lt;script&gt;')
  })

  it('keeps setup in a data attribute: available to the island, never visible', async () => {
    const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground({ setup: 'CREATE TABLE t(a);' }) } })
    expect(wrapper.get('figure.myc-playground').attributes('data-playground-setup')).toBe('CREATE TABLE t(a);')
    expect(wrapper.text()).not.toContain('CREATE TABLE')
    expect(wrapper.find('template').exists()).toBe(false)
    expect(wrapper.find('script').exists()).toBe(false)
    const without = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground() } })
    expect(without.get('figure.myc-playground').attributes('data-playground-setup')).toBeUndefined()
  })

  it('renders an unknown language as a plain code block with its output and no run controls', async () => {
    const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground({ runtime: 'cobol' }) } })
    expect(wrapper.get('figure.myc-playground').attributes('data-runtime')).toBeUndefined()
    expect(wrapper.get('.myc-code-lang').text()).toBe('cobol')
    expect(wrapper.find('[data-playground-setup]').exists()).toBe(false)
    expect(wrapper.get('pre.myc-playground-output').text()).toBe('one\n---\n1')
    expect(wrapper.find('[data-playground-run]').exists()).toBe(false)
    expect(wrapper.find('[data-playground-result]').exists()).toBe(false)
  })

  it('omits the expected output when there is none', async () => {
    for (const expectedOutput of [undefined, null, '', '  \n']) {
      const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground({ expectedOutput }) } })
      expect(wrapper.find('.myc-playground-expected').exists()).toBe(false)
      expect(wrapper.find('pre.myc-playground-output').exists()).toBe(false)
      expect(wrapper.find('.myc-code').exists()).toBe(true)
    }
  })

  it('omits the caption when there is none', async () => {
    for (const caption of [undefined, null, ' ']) {
      const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground({ caption }) } })
      expect(wrapper.find('figure.myc-playground > figcaption').exists()).toBe(false)
      expect(wrapper.get('figure.myc-playground').attributes('aria-describedby')).toBeUndefined()
    }
  })

  it('is dispatched by the blocks renderer', async () => {
    const blocks: StrapiBlock[] = [playground()]
    const wrapper = await mountSuspended(StrapiBlocksRenderer, { props: { blocks } })
    expect(wrapper.find('figure.myc-playground').exists()).toBe(true)
  })
})
