import { describe, it, expect, beforeEach } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { getQuery } from 'h3'
import BlogReadingPath from '~/components/blog/ReadingPath.vue'
import { Category } from '~/interfaces'
import { READ_STORAGE_KEY } from '~/helpers/readArticles'

registerEndpoint('/api/reading-path', (event) => {
  const { category } = getQuery(event)
  if (category === 'diy') {
    return { category, editorial: false, steps: [{ documentId: 'doc-solo', slug: 'solo', title: 'Solo article' }] }
  }
  return {
    category,
    editorial: true,
    steps: [
      { documentId: 'doc-start', slug: 'start-here', title: 'Start here' },
      { documentId: 'doc-rag', slug: 'rag', title: 'RAG explained' },
      { documentId: 'doc-agents', slug: 'agents', title: 'Agents' },
    ],
  }
})

async function mountPath(category: Category, currentDocumentId?: string) {
  const wrapper = await mountSuspended(BlogReadingPath, { props: { category, currentDocumentId } })
  await flushPromises()
  return wrapper
}

describe('BlogReadingPath', () => {
  beforeEach(() => {
    localStorage.clear()
    useState('myc-read-articles').value = []
    useState('myc-read-articles-loaded').value = false
  })

  it('lists the path in order as a numbered list with the progress', async () => {
    localStorage.setItem(READ_STORAGE_KEY, '["doc-start"]')
    const wrapper = await mountPath(Category.Ai)
    expect(wrapper.get('h2').text()).toBe('Reading path · AI')
    const steps = wrapper.findAll('ol > li')
    expect(steps.map(step => step.get('.myc-path-number').text())).toEqual(['01', '02', '03'])
    expect(steps.map(step => step.get('a').text())).toEqual(['Start here', 'RAG explained', 'Agents'])
    expect(steps[0]!.get('a').attributes('href')).toBe('/blog/start-here')
    expect(steps.map(step => step.find('.myc-path-read').exists())).toEqual([true, false, false])
    expect(wrapper.get('.myc-path-progress').text()).toBe('01 of 03 read · kept in your browser')
    expect(wrapper.find('[aria-current]').exists()).toBe(false)
    expect(wrapper.find('.myc-path-next').exists()).toBe(false)
  })

  it('marks the current article and links to the next one', async () => {
    const wrapper = await mountPath(Category.Ai, 'doc-rag')
    const current = wrapper.get('a[aria-current="page"]')
    expect(current.text()).toBe('RAG explained')
    const next = wrapper.get('.myc-path-next')
    expect(next.attributes('href')).toBe('/blog/agents')
    expect(next.text()).toContain('Next on the path')
    expect(next.text()).toContain('Agents')
  })

  it('says when the current article is the last one', async () => {
    const wrapper = await mountPath(Category.Ai, 'doc-agents')
    expect(wrapper.find('.myc-path-next').exists()).toBe(false)
    expect(wrapper.text()).toContain('Last article on the path')
  })

  it('stays hidden for an article off the path or a path with a single article', async () => {
    expect((await mountPath(Category.Ai, 'doc-other')).find('.myc-path').exists()).toBe(false)
    expect((await mountPath(Category.Diy)).find('.myc-path').exists()).toBe(false)
  })

  it('updates the progress when an article of the path is read', async () => {
    const wrapper = await mountPath(Category.Ai)
    useReadArticles().markRead('doc-rag')
    await flushPromises()
    expect(wrapper.get('.myc-path-progress').text()).toBe('01 of 03 read · kept in your browser')
  })
})
