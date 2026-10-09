import { describe, it, expect } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { getQuery } from 'h3'
import BlogLog from '~/components/blog/Log.vue'
import type { PostListItem } from '~/interfaces'

const requested: string[] = []

registerEndpoint('/api/fediverse/stats', (event) => {
  requested.push(String(getQuery(event).documentIds))
  return { 'doc-rag': { likes: 4, boosts: 1 } }
})

const posts: PostListItem[] = [
  { id: 1, documentId: 'doc-rag', title: 'RAG explained', slug: 'rag', description: 'How retrieval helps.', publishedAt: '2026-09-12T10:00:00.000Z', category: { id: 1, documentId: 'cat-ia', name: 'IA', slug: 'ia' } },
  { id: 2, documentId: 'doc-vue', title: 'Vue composables', slug: 'vue', description: null, publishedAt: '2026-09-02T10:00:00.000Z', category: null },
  { id: 3, documentId: 'doc-linux', title: 'Linux hardening', slug: 'linux', description: 'SSH first.', publishedAt: '2026-08-20T10:00:00.000Z', category: { id: 2, documentId: 'cat-linux', name: 'Linux', slug: 'linux' } },
]

describe('BlogLog', () => {
  it('groups the posts by month with a heading and a count', async () => {
    const wrapper = await mountSuspended(BlogLog, { props: { posts } })
    const months = wrapper.findAll('.bd-log-month')
    expect(months).toHaveLength(2)
    expect(months[0]!.get('h2').text()).toBe('September 2026')
    expect(months[0]!.get('.bd-log-month-count').text()).toBe('02 articles')
    expect(months[1]!.get('h2').text()).toBe('August 2026')
    expect(months[1]!.get('.bd-log-month-count').text()).toBe('01 article')
    expect(months[0]!.attributes('aria-labelledby')).toBe(months[0]!.get('h2').attributes('id'))
  })

  it('lists date, category, linked title and excerpt for each post', async () => {
    const wrapper = await mountSuspended(BlogLog, { props: { posts } })
    const row = wrapper.findAll('.bd-log-row')[0]!
    expect(row.get('time').text()).toBe('12.09.2026')
    expect(row.get('time').attributes('datetime')).toBe('2026-09-12T10:00:00.000Z')
    expect(row.find('.bd-tag-ia').exists()).toBe(true)
    expect(row.get('.bd-log-link').attributes('href')).toBe('/blog/rag')
    expect(row.get('.bd-log-link').text()).toBe('RAG explained')
    expect(row.get('.bd-log-excerpt').text()).toBe('How retrieval helps.')
    expect(wrapper.findAll('.bd-log-row')[1]!.find('.bd-tag').exists()).toBe(false)
  })

  it('shows fediverse likes and boosts on federated articles with one request', async () => {
    requested.length = 0
    const wrapper = await mountSuspended(BlogLog, { props: { posts, federated: true } })
    await flushPromises()
    expect(requested).toEqual(['doc-rag,doc-vue,doc-linux'])
    const stats = wrapper.findAll('.bd-log-stats')
    expect(stats).toHaveLength(1)
    expect(stats[0]!.text().replace(/\s+/g, ' ')).toBe('◆ 4 likes · 1 boost')
  })

  it('does not ask for stats when the locale is not federated', async () => {
    requested.length = 0
    const wrapper = await mountSuspended(BlogLog, { props: { posts } })
    await flushPromises()
    expect(requested).toEqual([])
    expect(wrapper.find('.bd-log-stats').exists()).toBe(false)
  })

  it('marks the posts already read in this browser', async () => {
    localStorage.setItem('micelio-read-articles', '["doc-linux"]')
    useState('bd-read-articles-loaded').value = false
    const wrapper = await mountSuspended(BlogLog, { props: { posts } })
    await flushPromises()
    const marks = wrapper.findAll('.bd-log-row').map(row => row.find('.bd-read-mark').exists())
    expect(marks).toEqual([false, false, true])
    expect(wrapper.get('.bd-read-mark').text()).toBe('✓ Read')
    localStorage.clear()
  })
})
