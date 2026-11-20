import { describe, expect, it } from 'vitest'
import { createMarkdownRenderer, renderArticleBlocks, renderBlocks } from '../app/helpers/markdown'
import type { StrapiBlock, StrapiOpenSource, StrapiQuote, StrapiReference, StrapiRichText } from '../app/interfaces'

const renderer = createMarkdownRenderer({
  callout: tone => ({ note: 'Note', warning: 'Warning', danger: 'Danger' })[tone],
  cite: n => `Reference ${n}`,
})

function richText(body: string, id = 1): StrapiRichText {
  return { id, __component: 'shared.rich-text', body }
}

describe('renderMarkdown', () => {
  it('forces tabindex="0" on pre and strips it elsewhere', () => {
    const html = renderer.renderMarkdown('<pre TABINDEX="-1" tabindex="5">a</pre><div tabindex="3"><p tabindex="-1">x</p></div>')
    expect(html).toContain('<pre tabindex="0">')
    expect(html.match(/tabindex/gi)).toHaveLength(1)
  })

  it('renders GitHub alerts as design system callouts', () => {
    const html = renderer.renderMarkdown('> [!NOTE] Analogy\n> A **recipe**.\n\n> [!WARNING]\n> Careful.\n\n> Plain quote.')
    expect(html.match(/<aside class="myc-callout[^"]*" role="note"/g)).toHaveLength(2)
    expect(html).toContain('<span>◆ </span>Analogy')
    expect(html).toContain('<strong>recipe</strong>')
    expect(html).toContain('<span>▲ </span>Warning')
    expect(html).toContain('<blockquote>\n<p>Plain quote.</p>\n</blockquote>')
  })

  it('gives headings an id from their text', () => {
    expect(renderer.renderMarkdown('## Qué es RAG')).toContain('<h2 id="que-es-rag">Qué es RAG</h2>')
  })

  it('gives every heading an anchor id and keeps the output sanitized', () => {
    const levels = renderer.renderMarkdown('## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six')
    expect([...levels.matchAll(/<h([2-6]) id="([^"]+)"/g)].map(match => [match[1], match[2]])).toEqual([['2', 'two'], ['3', 'three'], ['4', 'four'], ['5', 'five'], ['6', 'six']])
    // The same text twice in a body, and a text with nothing a slug keeps: no id is empty or repeated
    expect([...renderer.renderMarkdown('## Same\n\n## Same\n\n## Same\n\n## ???\n\n## ¿¿').matchAll(/ id="([^"]*)"/g)].map(match => match[1])).toEqual(['same', 'same-2', 'same-3', 'heading', 'heading-2'])
    // A heading inside a callout is still a heading of the body
    expect([...renderer.renderMarkdown('## Intro\n\n> [!NOTE]\n> ## Intro').matchAll(/<h2 id="([^"]*)"/g)].map(match => match[1])).toEqual(['intro', 'intro-2'])
    // Each render starts again: a second body has its own first `same`
    expect(renderer.renderMarkdown('## Same')).toContain('<h2 id="same">')
    // What the sanitizer refuses stays refused next to the anchors
    const html = renderer.renderMarkdown('## Safe\n\n<script>alert(1)</script>\n\n<h2 id="raw" onclick="alert(1)" style="x:y">Raw</h2>\n\n<iframe src="https://evil.test/x"></iframe>')
    expect(html).toContain('<h2 id="safe">Safe</h2>')
    expect(html).toContain('<h2 id="raw">Raw</h2>')
    expect(html).not.toMatch(/<script|onclick|style=|evil\.test/)
    // A Mermaid fence keeps its source in the block the island reads
    expect(renderer.renderMarkdown('## Flow\n\n```mermaid\ngraph TD; A-->B\n```')).toMatch(/<h2 id="flow">Flow<\/h2>[\s\S]*<micelio-mermaid class="myc-mermaid not-prose">[\s\S]*A--&gt;B/)
  })

  it('opens external links in a new tab and keeps internal ones', () => {
    const html = renderer.renderMarkdown('[out](https://example.com "Example") and [in](/blog)')
    expect(html).toContain('<a href="https://example.com" title="Example" target="_blank" rel="noopener noreferrer">out</a>')
    expect(html).toContain('<a href="/blog" rel="noopener noreferrer">in</a>')
  })

  it('escapes inline code and renders code and Mermaid blocks', () => {
    expect(renderer.renderMarkdown('Use `<div>`')).toContain('<code>&lt;div&gt;</code>')
    expect(renderer.renderMarkdown('```ts\nconst a = 1\n```')).toContain('myc-code')
    expect(renderer.renderMarkdown('```\nplain\n```')).toContain('plain')
    expect(renderer.renderMarkdown('```mermaid\ngraph TD; A-->B\n```')).toContain('<micelio-mermaid class="myc-mermaid not-prose">')
  })

  it('keeps the copy button hidden until the script shows it', () => {
    expect(renderer.renderMarkdown('```ts\nconst a = 1\n```')).toContain('<button type="button" class="myc-code-copy" data-myc-copy hidden></button>')
  })

  it('removes raw HTML that is not allowed', () => {
    const html = renderer.renderMarkdown('Hi <img src=x onerror=alert(1)> <script>alert(1)</script>')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<script')
  })

  it('returns an empty string for empty text', () => {
    expect(renderer.renderMarkdown('')).toBe('')
    expect(renderer.renderInlineMarkdown('')).toBe('')
  })
})

describe('renderInlineMarkdown', () => {
  it('keeps inline formatting and drops other tags', () => {
    const html = renderer.renderInlineMarkdown('Hi <img src=x onerror=alert(1)> **there**')
    expect(html).not.toContain('<img')
    expect(html).toContain('<strong>there</strong>')
  })
})

const references: StrapiReference[] = [
  { key: 'ji-2023', type: 'journal', authors: 'Ji, Z., et al.', year: '2023', title: 'Survey of Hallucination' },
  { key: 'lewis-2020', type: 'conference', authors: 'Lewis, P., et al.', year: '2020', title: 'Retrieval-Augmented Generation' },
]
const citingText = richText('RAG [@lewis-2020] hallucinates [@ji-2023; @lewis-2020] `[@code]` [@missing].')
const citingQuote: StrapiQuote = { id: 2, __component: 'shared.quote', body: 'Quoted [@ji-2023].' }

describe('renderArticleBlocks', () => {
  it('numbers citations and anchors only the first appearance', () => {
    const [text, quote] = renderArticleBlocks([citingText, citingQuote], references, renderer) as [StrapiRichText, StrapiQuote]
    const cites = [...text.html!.matchAll(/<sup><a class="myc-cite"( id="[^"]+")? href="([^"]+)" aria-label="([^"]+)"[^>]*>(\[\d\])<\/a><\/sup>/g)]
    expect(cites.map(cite => cite[4])).toEqual(['[1]', '[2]', '[1]'])
    expect(cites.map(cite => cite[2])).toEqual(['#ref-1', '#ref-2', '#ref-1'])
    expect(cites.map(cite => cite[1])).toEqual([' id="cite-1"', ' id="cite-2"', undefined])
    expect(cites[0]![3]).toBe('Reference 1')
    expect(text.html).toContain('[@missing]')
    expect(text.html).toContain('<code>[@code]</code>')
    expect(quote.html).toContain('<sup><a class="myc-cite" href="#ref-2"')
  })

  it('accepts an article without blocks', () => {
    expect(renderArticleBlocks(null, references, renderer)).toEqual([])
  })
})

describe('renderBlocks', () => {
  it('leaves citations as text outside an article', () => {
    const [text] = renderBlocks([citingText], renderer) as [StrapiRichText]
    expect(text.html).not.toContain('myc-cite')
    expect(text.html).toContain('[@lewis-2020]')
  })

  it('renders the guide of the open source block and passes other blocks through', () => {
    const openSource: StrapiOpenSource = { id: 3, __component: 'about.open-source', guide: [{ id: 1, text: 'Read [the blog](/blog)' }] }
    const other = { id: 4, __component: 'about.contact' } as StrapiBlock
    const [rendered, untouched] = renderBlocks([openSource, other, { ...openSource, id: 5, guide: undefined }], renderer) as [StrapiOpenSource, StrapiBlock, StrapiOpenSource]
    expect(rendered.guide![0]!.html).toBe('Read <a href="/blog">the blog</a>')
    expect(untouched).toBe(other)
  })

  it('keeps the original fields', () => {
    const [text] = renderBlocks([richText('**a**', 7)], renderer) as [StrapiRichText]
    expect(text).toMatchObject({ id: 7, __component: 'shared.rich-text', body: '**a**', html: '<p><strong>a</strong></p>\n' })
  })

  it('renders an empty rich text and quote whose body the CMS sent as null', () => {
    const quote: StrapiQuote = { id: 8, __component: 'shared.quote', body: null, title: null }
    const [text, rendered] = renderBlocks([{ ...richText('', 7), body: null }, quote], renderer) as [StrapiRichText, StrapiQuote]
    expect(text.html).toBe('')
    expect(rendered.html).toBe('')
  })
})
