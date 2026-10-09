import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BdHighlight from '~/components/bd/BdHighlight.vue'

async function render(text: string, query?: string): Promise<HTMLElement> {
  const wrapper = await mountSuspended({
    components: { BdHighlight },
    props: { text: String, query: String },
    template: '<p><BdHighlight :text="text" :query="query" /></p>',
  }, { props: { text, query } })
  return wrapper.element as HTMLElement
}

describe('BdHighlight', () => {
  it('wraps each match in a mark', async () => {
    const element = await render('RAG explained: rag in practice', 'rag')
    expect(Array.from(element.querySelectorAll('mark.myc-mark')).map(mark => mark.textContent)).toEqual(['RAG', 'rag'])
    expect(element.textContent).toBe('RAG explained: rag in practice')
  })

  it('renders markup in the snippet as text', async () => {
    const element = await render('…<img src=x onerror=alert(1)> and vue…', 'vue')
    expect(element.querySelector('img')).toBeNull()
    expect(element.textContent).toBe('…<img src=x onerror=alert(1)> and vue…')
    expect(element.querySelector('mark')?.textContent).toBe('vue')
  })

  it('shows the plain text without a query', async () => {
    const element = await render('Linux hardening')
    expect(element.querySelector('mark')).toBeNull()
    expect(element.textContent).toBe('Linux hardening')
  })
})
