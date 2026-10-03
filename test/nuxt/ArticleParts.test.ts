import { describe, it, expect, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import BlogTableOfContents from '~/components/blog/TableOfContents.vue'
import BlogCopyLinkButton from '~/components/blog/CopyLinkButton.vue'
import BlogCommentSection from '~/components/blog/CommentSection.vue'
import StrapiRichTextBlock from '~/components/strapi/RichTextBlock.vue'
import StrapiQuoteBlock from '~/components/strapi/QuoteBlock.vue'
import BlogReferences from '~/components/blog/References.vue'
import { numberReferences } from '~/helpers/citations'
import type { StrapiBlock, StrapiQuote, StrapiReference, StrapiRichText } from '~/interfaces'

registerEndpoint('/api/comments/flat', () => ({
  data: [
    { id: 1, content: 'Great article.', blockedThread: false, removed: false, author: { name: 'Ana Reader' }, createdAt: '2026-02-03T10:00:00.000Z', threadOf: null },
    { id: 2, content: 'Thanks!', blockedThread: false, removed: false, author: { name: 'Alejandro Ramirez' }, createdAt: '2026-02-04T10:00:00.000Z', threadOf: { id: 1 } },
  ],
}))

describe('BlogTableOfContents', () => {
  it('links every heading and marks the first as current', async () => {
    const wrapper = await mountSuspended(BlogTableOfContents, {
      props: { headings: [{ id: 'que-es', text: 'Qué es', level: 2 }, { id: 'retrieval', text: 'Retrieval', level: 3 }] },
    })
    expect(wrapper.get('nav').attributes('aria-label')).toBe('In this article')
    const links = wrapper.findAll('a')
    expect(links.map(link => link.attributes('href'))).toEqual(['#que-es', '#retrieval'])
    expect(links[0]!.attributes('aria-current')).toBe('true')
    expect(links[1]!.classes()).toContain('bd-toc-sub')
    await links[1]!.trigger('click')
    expect(links[1]!.attributes('aria-current')).toBe('true')
  })

  it('renders nothing without headings', async () => {
    const wrapper = await mountSuspended(BlogTableOfContents, { props: { headings: [] } })
    expect(wrapper.find('nav').exists()).toBe(false)
  })
})

describe('BlogCopyLinkButton', () => {
  it('copies the link and announces it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = await mountSuspended(BlogCopyLinkButton, { props: { url: 'https://bogdev.com.co/blog/rag' } })
    expect(wrapper.get('button').text()).toBe('Copy link')
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('https://bogdev.com.co/blog/rag')
    expect(wrapper.get('button').text()).toBe('Link copied ✓')
    expect(wrapper.get('[aria-live="polite"]').text()).toBe('Link copied ✓')
  })
})

describe('BlogCommentSection', () => {
  it('shows replies under their comment with dotted dates', async () => {
    const wrapper = await mountSuspended(BlogCommentSection, { props: { slug: 'rag', documentId: 'doc-rag' } })
    await vi.waitFor(() => expect(wrapper.findAll('.bd-comment')).toHaveLength(2))
    expect(wrapper.get('.bd-home-eyebrow').text()).toBe('Conversation · 2 comments')
    const group = wrapper.get('.bd-comment-group')
    expect(group.get('.bd-comment-name').text()).toBe('Ana Reader')
    expect(group.get('.bd-comment-thread .bd-comment-name').text()).toBe('Alejandro Ramirez')
    expect(group.get('.bd-comment-date').text()).toBe('03.02.2026')
    expect(group.get('.bd-comment-thread').find('button').exists()).toBe(false)
  })
})

describe('StrapiRichTextBlock', () => {
  it('renders the HTML the server rendered', async () => {
    const wrapper = await mountSuspended(StrapiRichTextBlock, {
      props: { block: { id: 1, __component: 'shared.rich-text', body: '**a**', html: '<p><strong>a</strong></p>' } },
    })
    expect(wrapper.get('strong').text()).toBe('a')
  })

  it('renders nothing without server HTML', async () => {
    const wrapper = await mountSuspended(StrapiRichTextBlock, { props: { block: { id: 1, __component: 'shared.rich-text', body: '**a**' } } })
    expect(wrapper.text()).toBe('')
  })
})

describe('StrapiQuoteBlock', () => {
  it('renders the server HTML and the source', async () => {
    const wrapper = await mountSuspended(StrapiQuoteBlock, {
      props: { block: { id: 2, __component: 'shared.quote', body: 'Quoted', html: 'Quoted <sup><a class="bd-cite" href="#ref-2">[2]</a></sup>', title: 'Ji' } },
    })
    expect(wrapper.get('blockquote sup > a.bd-cite').text()).toBe('[2]')
    expect(wrapper.get('cite').text()).toBe('— Ji')
  })
})

const citationReferences: StrapiReference[] = [
  { key: 'ji-2023', type: 'journal', authors: 'Ji, Z., et al.', year: '2023', title: 'Survey of Hallucination', container: 'ACM Computing Surveys', volume: '55', issue: '12', doi: '10.1145/3571730', accessedAt: '2026-09-11' },
  { key: 'lewis-2020', type: 'conference', authors: 'Lewis, P., et al.', year: '2020', title: 'Retrieval-Augmented Generation', venueLabel: 'NeurIPS 2020', url: 'https://arxiv.org/abs/2005.11401', accessedAt: '2026-09-02' },
  { key: 'extra', type: 'web', authors: 'Doe, J.', year: '2024', title: 'Uncited', url: 'https://example.com/post' },
]

const citingText: StrapiRichText = { id: 1, __component: 'shared.rich-text', body: 'RAG [@lewis-2020] hallucinates [@ji-2023; @lewis-2020] `[@code]` [@missing].' }
const citingQuote: StrapiQuote = { id: 2, __component: 'shared.quote', body: 'Quoted [@ji-2023].' }
const citationBlocks: StrapiBlock[] = [citingText, citingQuote]

describe('BlogReferences', () => {
  it('lists cited sources first with a way back to the text', async () => {
    const wrapper = await mountSuspended(BlogReferences, {
      props: { entries: numberReferences(citationBlocks, citationReferences) },
    })
    expect(wrapper.get('section').attributes('id')).toBe('references')
    expect(wrapper.get('h2').text()).toBe('References')
    expect(wrapper.get('.bd-refs-count').text()).toBe('3 sources · APA 7')
    const items = wrapper.findAll('li.bd-ref')
    expect(items.map(item => item.attributes('id'))).toEqual(['ref-1', 'ref-2', 'ref-3'])
    expect(items[0]!.get('.bd-ref-venue').text()).toBe('NEURIPS 2020')
    expect(items[1]!.get('.bd-ref-text').text()).toBe('Ji, Z., et al. (2023). Survey of Hallucination. ACM Computing Surveys, 55(12).')
    expect(items[1]!.get('.bd-ref-text a').attributes()).toMatchObject({ href: 'https://doi.org/10.1145/3571730', target: '_blank' })
    expect(items[1]!.get('em').text()).toBe('ACM Computing Surveys')
    expect(items[1]!.get('.bd-ref-id').text()).toBe('doi.org/10.1145/3571730')
    expect(items[0]!.get('.bd-ref-back').attributes('href')).toBe('#cite-1')
    expect(items[2]!.find('.bd-ref-back').exists()).toBe(false)
    expect(wrapper.get('.bd-refs-note').text()).toBe('Links open the original source in a new tab. Accessed on 11.09.2026.')
  })

  it('renders nothing without references', async () => {
    const wrapper = await mountSuspended(BlogReferences, { props: { entries: [] } })
    expect(wrapper.find('section').exists()).toBe(false)
  })
})
