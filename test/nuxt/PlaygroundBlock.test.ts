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
    const figure = wrapper.get('figure.bd-playground')
    expect(figure.attributes('data-runtime')).toBe(runtime)
    expect(figure.attributes('aria-label')).toBe(`Runnable code, ${label}`)
    expect(wrapper.get('.bd-code-lang').text()).toBe(label)
    expect(wrapper.get('.bd-code code').text()).toBe('SELECT 1 AS one;')
    expect(wrapper.get('.bd-playground-label').text()).toBe('Expected output')
    const output = wrapper.get('pre.bd-playground-output')
    expect(output.text()).toBe('one\n---\n1')
    expect(output.attributes('aria-labelledby')).toBe(wrapper.get('.bd-playground-label').attributes('id'))
    expect(wrapper.get('figcaption').text()).toBe('The simplest query.')
  })

  it('ships a hidden Run button and an empty live region for the island', async () => {
    const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground() } })
    const run = wrapper.get('[data-playground-run]')
    expect(run.attributes('hidden')).toBeDefined()
    expect(run.text()).toBe('Run')
    const result = wrapper.get('[data-playground-output]')
    expect(result.text()).toBe('')
    expect(result.attributes('aria-live')).toBe('polite')
  })

  it('shows the code and output as text, with no script involved', async () => {
    const wrapper = await mountSuspended(StrapiPlaygroundBlock, {
      props: { block: playground({ code: '<script>alert(1)</script>', expectedOutput: '<b>x</b>', setup: 'CREATE TABLE t(a);' }) },
    })
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.html()).toContain('&lt;script&gt;')
    // `setup` is hidden code: never rendered
    expect(wrapper.text()).not.toContain('CREATE TABLE')
  })

  it('renders an unknown language as a plain code block with its output and no run controls', async () => {
    const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground({ runtime: 'cobol' }) } })
    expect(wrapper.get('figure.bd-playground').attributes('data-runtime')).toBeUndefined()
    expect(wrapper.get('.bd-code-lang').text()).toBe('cobol')
    expect(wrapper.get('pre.bd-playground-output').text()).toBe('one\n---\n1')
    expect(wrapper.find('[data-playground-run]').exists()).toBe(false)
    expect(wrapper.find('[data-playground-output]').exists()).toBe(false)
  })

  it('omits the expected output when there is none', async () => {
    for (const expectedOutput of [undefined, null, '', '  \n']) {
      const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground({ expectedOutput }) } })
      expect(wrapper.find('.bd-playground-label').exists()).toBe(false)
      expect(wrapper.find('pre.bd-playground-output').exists()).toBe(false)
      expect(wrapper.find('.bd-code').exists()).toBe(true)
    }
  })

  it('omits the caption when there is none', async () => {
    for (const caption of [undefined, null, ' ']) {
      const wrapper = await mountSuspended(StrapiPlaygroundBlock, { props: { block: playground({ caption }) } })
      expect(wrapper.find('figcaption').exists()).toBe(false)
    }
  })

  it('is dispatched by the blocks renderer', async () => {
    const blocks: StrapiBlock[] = [playground()]
    const wrapper = await mountSuspended(StrapiBlocksRenderer, { props: { blocks } })
    expect(wrapper.find('figure.bd-playground').exists()).toBe(true)
  })
})
