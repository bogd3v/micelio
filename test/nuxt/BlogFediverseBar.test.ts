import { describe, it, expect, vi, afterEach } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { createError } from 'h3'
import BlogFediverseBar from '~/components/blog/FediverseBar.vue'
import BlogCommentSection from '~/components/blog/CommentSection.vue'

registerEndpoint('/api/fediverse/stats/doc-fedi', () => ({ likes: 4, boosts: 1 }))

registerEndpoint('/api/fediverse/stats/doc-down', () => {
  throw createError({ statusCode: 502 })
})

registerEndpoint('/api/comments/flat', () => ({
  data: [
    { id: 1, content: 'From Mastodon.', blockedThread: false, removed: false, author: { name: 'Ana' }, createdAt: '2026-02-03T10:00:00.000Z', threadOf: null, fediverseActorHandle: '@ana@mastodon.social' },
    { id: 2, content: 'Thanks!', blockedThread: false, removed: false, author: { name: 'Alejandro Ramirez' }, createdAt: '2026-02-04T10:00:00.000Z', threadOf: { id: 1 }, fediverseActorHandle: null },
    { id: 3, content: 'Me too.', blockedThread: false, removed: false, author: { name: 'Bea' }, createdAt: '2026-02-05T10:00:00.000Z', threadOf: { id: 1 }, fediverseActorHandle: '@bea@fosstodon.org' },
  ],
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('BlogFediverseBar', () => {
  it('shows likes, boosts and the fediverse replies among the comments', async () => {
    await mountSuspended(BlogCommentSection, { props: { slug: 'rag', documentId: 'doc-fedi' } })
    const wrapper = await mountSuspended(BlogFediverseBar, { props: { slug: 'rag', documentId: 'doc-fedi' } })
    await flushPromises()
    const stats = wrapper.get('.myc-fedi-bar-stats').text().replace(/\s+/g, ' ')
    expect(stats).toContain('4 likes')
    expect(stats).toContain('1 boost')
    expect(stats).toContain('2 replies')
    expect(wrapper.get('.myc-fedi-bar-link').attributes('href')).toBe('#comments')
  })

  it('hides the counters when the stats service fails but keeps the reply block', async () => {
    const wrapper = await mountSuspended(BlogFediverseBar, { props: { slug: 'down', documentId: 'doc-down' } })
    await flushPromises()
    expect(wrapper.findAll('.myc-fedi-bar-count')).toHaveLength(0)
    expect(wrapper.get('.myc-fedi-bar-stats').text()).toBe('◆ On the fediverse')
    expect(wrapper.find('button[aria-controls="myc-fedi-reply"]').exists()).toBe(true)
  })

  it('opens the reply block with the article address, copy and open on the instance', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const wrapper = await mountSuspended(BlogFediverseBar, { props: { slug: 'rag', documentId: 'doc-fedi' } })
    const toggle = wrapper.get('button[aria-controls="myc-fedi-reply"]')
    const panel = wrapper.get('#myc-fedi-reply')

    expect(toggle.attributes('aria-expanded')).toBe('false')
    expect(panel.attributes('style')).toContain('display: none')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
    expect(panel.attributes('style') ?? '').not.toContain('display: none')

    expect(wrapper.get('.myc-fedi-reply-address').text()).toBe('https://api.bogdev.com.co/fediverse/articles/doc-fedi')
    await wrapper.get('.myc-fedi-reply-url button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('https://api.bogdev.com.co/fediverse/articles/doc-fedi')
    expect(wrapper.get('.myc-fedi-reply-url button').text()).toBe('Copied ✓')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('#myc-fedi-article-hint').text()).toContain('Type your instance')
    expect(open).not.toHaveBeenCalled()

    await wrapper.get('input').setValue('@ana@Mastodon.Social')
    expect(wrapper.get('#myc-fedi-article-hint').text()).toBe('The article will open on mastodon.social')
    await wrapper.get('form').trigger('submit')
    expect(open).toHaveBeenCalledWith(
      'https://mastodon.social/authorize_interaction?uri=https%3A%2F%2Fapi.bogdev.com.co%2Ffediverse%2Farticles%2Fdoc-fedi',
      '_blank',
      'noopener,noreferrer',
    )
    expect(wrapper.text()).toContain('Your reply arrives as a comment and is published after moderation.')
  })
})
