import { describe, it, expect } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { getQuery } from 'h3'
import BlogCommentSection from '~/components/blog/CommentSection.vue'
import BlogFediverseBar from '~/components/blog/FediverseBar.vue'

const threads: Record<string, unknown[]> = {
  'api::article.article:doc-thread': [
    { id: 1, content: 'Left from the blog form.', blockedThread: false, removed: false, author: { name: 'Nora' }, createdAt: '2026-02-03T10:00:00.000Z', threadOf: null, isAdminComment: false, fediverseActorHandle: null, fediverseUri: null },
    { id: 2, content: '<b>Sent</b> from Mastodon.', blockedThread: false, removed: false, author: { name: 'Bea' }, createdAt: '2026-02-04T10:00:00.000Z', threadOf: null, isAdminComment: false, fediverseActorHandle: '@bea@mastodon.social', fediverseUri: 'https://mastodon.social/users/bea/statuses/1' },
    { id: 3, content: 'Thanks, Bea!', blockedThread: false, removed: false, author: { name: 'Alejandro Ramirez' }, createdAt: '2026-02-05T10:00:00.000Z', threadOf: { id: 2 }, isAdminComment: true, fediverseActorHandle: null, fediverseUri: null },
  ],
  'api::article.article:doc-blog-only': [
    { id: 4, content: 'Only blog here.', blockedThread: false, removed: false, author: { name: 'Nora' }, createdAt: '2026-02-03T10:00:00.000Z', threadOf: null, isAdminComment: false, fediverseActorHandle: null, fediverseUri: null },
  ],
}

const threadRequests: Array<Record<string, unknown>> = []

registerEndpoint('/api/comments/flat', (event) => {
  const query = getQuery(event)
  threadRequests.push(query)
  return { data: threads[String(query.relation)] ?? [] }
})
registerEndpoint('/api/fediverse/stats/doc-thread', () => ({ likes: 0, boosts: 0 }))

async function mountSection(documentId: string, federated = false) {
  const wrapper = await mountSuspended(BlogCommentSection, { props: { slug: documentId, documentId, federated } })
  await flushPromises()
  return wrapper
}

describe('BlogCommentSection', () => {
  it('labels fediverse replies with the handle and a link to their instance, and marks the author', async () => {
    const wrapper = await mountSection('doc-thread')
    const items = wrapper.findAll('.myc-comment')
    expect(items).toHaveLength(3)

    const [blog, fediverse, author] = items
    expect(blog!.find('.myc-comment-badge').exists()).toBe(false)
    expect(blog!.find('.myc-comment-instance-link').exists()).toBe(false)

    expect(fediverse!.classes()).toContain('myc-comment-fediverse')
    expect(fediverse!.get('.myc-comment-badge-fediverse').text()).toBe('◆ Fediverse · @bea@mastodon.social')
    const link = fediverse!.get('.myc-comment-instance-link')
    expect(link.attributes()).toMatchObject({
      href: 'https://mastodon.social/users/bea/statuses/1',
      target: '_blank',
      rel: 'noopener noreferrer nofollow ugc',
    })
    expect(link.text()).toContain('View on their instance')

    expect(author!.get('.myc-comment-badge-author').text()).toBe('Author')
    expect(author!.find('.myc-comment-badge-fediverse').exists()).toBe(false)
  })

  it('shows the content as plain text', async () => {
    const wrapper = await mountSection('doc-thread')
    const text = wrapper.findAll('.myc-comment-text')[1]!
    expect(text.text()).toBe('<b>Sent</b> from Mastodon.')
    expect(text.find('b').exists()).toBe(false)
  })

  it('asks for the thread in the current language', async () => {
    await mountSection('doc-thread')
    expect(threadRequests.at(-1)).toEqual({ relation: 'api::article.article:doc-thread', locale: 'en' })
  })

  it('filters the thread between the blog and the fediverse', async () => {
    const wrapper = await mountSection('doc-thread', true)
    const buttons = wrapper.get('[role="group"]').findAll('button')
    expect(buttons.map(button => button.text())).toEqual(['All', 'From the blog', 'From the fediverse'])
    expect(buttons[0]!.attributes('aria-pressed')).toBe('true')

    await buttons[2]!.trigger('click')
    expect(buttons[2]!.attributes('aria-pressed')).toBe('true')
    expect(buttons[0]!.attributes('aria-pressed')).toBe('false')
    expect(wrapper.findAll('.myc-comment-group')).toHaveLength(1)
    expect(wrapper.text()).toContain('<b>Sent</b> from Mastodon.')
    expect(wrapper.text()).toContain('Thanks, Bea!')

    await buttons[1]!.trigger('click')
    expect(wrapper.findAll('.myc-comment-group')).toHaveLength(1)
    expect(wrapper.text()).toContain('Left from the blog form.')
    expect(wrapper.text()).not.toContain('Thanks, Bea!')
  })

  it('says so when no fediverse reply has arrived yet', async () => {
    const wrapper = await mountSection('doc-blog-only', true)
    await wrapper.get('[role="group"]').findAll('button')[2]!.trigger('click')
    expect(wrapper.findAll('.myc-comment')).toHaveLength(0)
    expect(wrapper.get('.myc-comments-empty').text()).toBe('No replies from the fediverse on this article yet.')
  })

  it('explains how fediverse replies are moderated', async () => {
    const wrapper = await mountSection('doc-blog-only', true)
    const note = wrapper.get('.myc-comments-moderation')
    expect(note.get('#myc-comments-moderation-title').text()).toBe('Moderation')
    expect(note.findAll('li').map(item => item.text().replace(/\s+/g, ' '))).toEqual([
      '✓ Fediverse replies are published after review',
      '✓ If its author edits it on Mastodon, it goes back to review',
      '✓ If they delete it, it is removed from here',
      '✓ They are stored as plain text',
    ])
  })

  it('leaves the origin filter and the moderation note out of non-federated articles', async () => {
    const wrapper = await mountSection('doc-thread')
    expect(wrapper.find('[role="group"]').exists()).toBe(false)
    expect(wrapper.find('.myc-comments-moderation').exists()).toBe(false)
    expect(wrapper.findAll('.myc-comment')).toHaveLength(3)
  })

  it('offers replying from Mastodon only on federated articles and opens the fediverse reply block', async () => {
    const plain = await mountSection('doc-blog-only')
    expect(plain.find('button[aria-controls="myc-fedi-reply"]').exists()).toBe(false)
    expect(plain.get('.myc-comments-intro').text()).toBe('Leave a comment or reply to other readers.')

    const bar = await mountSuspended(BlogFediverseBar, { props: { slug: 'doc-thread', documentId: 'doc-thread' } })
    const federated = await mountSection('doc-thread', true)
    expect(federated.get('.myc-comments-intro').text()).toContain('both conversations come together in this thread')
    expect(bar.get('button[aria-controls="myc-fedi-reply"]').attributes('aria-expanded')).toBe('false')

    const reply = federated.get('.myc-comment-submit button[aria-controls="myc-fedi-reply"]')
    expect(reply.text()).toContain('Have a Mastodon account? Reply from there')
    await reply.trigger('click')
    await flushPromises()
    expect(bar.get('button[aria-controls="myc-fedi-reply"]').attributes('aria-expanded')).toBe('true')
  })
})
