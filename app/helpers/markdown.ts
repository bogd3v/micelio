// Server-only: the Markdown renderer stays out of the client bundle (docs/performance.md).
import { Marked } from 'marked'
import type { TokenizerAndRendererExtension, Tokens } from 'marked'
import sanitizeHtml from 'sanitize-html'
import { slugify } from './slugify'
import type { BlockCitations, CalloutTone, CitationIndex, StrapiBlock, StrapiReference } from '../interfaces'
import { escapeHtml, renderCodeBlockHtml } from './code'
import { parseCalloutMarker, renderCalloutHtml } from './callout'
import { renderMermaidBlockHtml } from './mermaid'
import { buildCitationIndex, citationBlockKey, CITATION_RULE, splitCitationGroup } from './citations'

export interface MarkdownLabels {
  callout: (tone: CalloutTone) => string
  cite: (n: number) => string
}

export interface MarkdownRenderer {
  renderMarkdown: (text: string, citations?: BlockCitations) => string
  renderInlineMarkdown: (text: string, citations?: BlockCitations) => string
}

const inlineSanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: ['a', 'strong', 'em', 'code', 'sup'],
  allowedAttributes: { a: ['href', 'title', 'target', 'rel', 'id', 'class', 'aria-label'] },
}

const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'iframe',
    'img',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'button',
    'sup',
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    'a': ['href', 'title', 'target', 'rel', 'aria-label'],
    'iframe': ['src', 'width', 'height', 'frameborder', 'allowfullscreen', 'allow', 'title', 'referrerpolicy'],
    'img': ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    'code': ['class'],
    'pre': ['class'],
    'button': ['type', 'class', 'data-bd-copy', 'hidden'],
    'aside': ['role'],
    '*': ['id', 'class'],
  },
  allowedIframeDomains: ['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'vimeo.com', 'player.vimeo.com'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
}

interface CitationState {
  citations?: BlockCitations
  emitted: Set<string>
}

interface CitationToken extends Tokens.Generic {
  keys: string[]
}

function createCitationExtension(state: CitationState, citeLabel: (n: number) => string): TokenizerAndRendererExtension {
  function renderCitation(key: string): string {
    const n = state.citations?.numbers[key]
    if (!n) return escapeHtml(`[@${key}]`)
    const anchored = state.citations?.anchored.includes(key) && !state.emitted.has(key)
    if (anchored) state.emitted.add(key)
    const id = anchored ? ` id="cite-${n}"` : ''
    return `<sup><a class="bd-cite"${id} href="#ref-${n}" aria-label="${escapeHtml(citeLabel(n))}">[${n}]</a></sup>`
  }

  return {
    name: 'citation',
    level: 'inline',
    start(src: string): number | undefined {
      const index = src.indexOf('[@')
      return index < 0 ? undefined : index
    },
    tokenizer(src: string): CitationToken | undefined {
      const match = CITATION_RULE.exec(src)
      if (!match) return undefined
      return { type: 'citation', raw: match[0], keys: splitCitationGroup(match[1]!) }
    },
    renderer(token: Tokens.Generic): string {
      return (token as CitationToken).keys.map(renderCitation).join('')
    },
  }
}

function buildMarked(
  calloutLabel: (tone: CalloutTone) => string,
  citeLabel: (n: number) => string,
  state: CitationState,
) {
  const marked = new Marked()
  marked.use({
    extensions: [createCitationExtension(state, citeLabel)],
    renderer: {
      heading(token: Tokens.Heading): string {
        const text = token.text
        const slug = slugify(text)
        return `<h${token.depth} id="${slug}">${text}</h${token.depth}>\n`
      },
      link(token: Tokens.Link): string {
        const href = token.href
        const title = token.title || ''
        const text = token.text
        const titleAttr = title ? ` title="${title}"` : ''
        const isExternal = href.startsWith('http://') || href.startsWith('https://')
        const attrs = isExternal
          ? ' target="_blank" rel="noopener noreferrer"'
          : ''
        return `<a href="${href}"${titleAttr}${attrs}>${text}</a>`
      },
      codespan(token: Tokens.Codespan): string {
        return `<code>${escapeHtml(token.text)}</code>`
      },
      code(token: Tokens.Code): string {
        if (token.lang === 'mermaid') return renderMermaidBlockHtml(token.text)
        return renderCodeBlockHtml(token.text, token.lang ?? '')
      },
      blockquote(token: Tokens.Blockquote): string {
        const callout = parseCalloutMarker(token.text)
        if (!callout) return `<blockquote>\n${this.parser.parse(token.tokens)}</blockquote>\n`
        const body = marked.parse(callout.body, { async: false })
        return renderCalloutHtml(callout.tone, callout.title ?? calloutLabel(callout.tone), body)
      },
    },
    gfm: true,
    breaks: true,
  })
  return marked
}

export function createMarkdownRenderer(labels: MarkdownLabels): MarkdownRenderer {
  const state: CitationState = { emitted: new Set() }
  const scopedMarked = buildMarked(labels.callout, labels.cite, state)

  function withCitations<T>(citations: BlockCitations | undefined, render: () => T): T {
    state.citations = citations
    state.emitted = new Set()
    try {
      return render()
    } finally {
      state.citations = undefined
    }
  }

  function renderMarkdown(text: string, citations?: BlockCitations): string {
    if (!text) return ''
    try {
      const html = withCitations(citations, () => scopedMarked.parse(text, { async: false }))
      return sanitizeHtml(html, sanitizeOptions)
    } catch {
      return escapeHtml(text)
    }
  }

  function renderInlineMarkdown(text: string, citations?: BlockCitations): string {
    if (!text) return ''
    try {
      const html = withCitations(citations, () => scopedMarked.parseInline(text, { async: false }))
      return sanitizeHtml(html, inlineSanitizeOptions)
    } catch {
      return escapeHtml(text)
    }
  }

  return { renderMarkdown, renderInlineMarkdown }
}

function blockCitations(index: CitationIndex | undefined, block: StrapiBlock): BlockCitations | undefined {
  if (!index) return undefined
  return { numbers: index.numbers, anchored: index.anchors[citationBlockKey(block)] ?? [] }
}

export function renderBlocks(blocks: StrapiBlock[] | null | undefined, renderer: MarkdownRenderer, index?: CitationIndex): StrapiBlock[] {
  return (blocks ?? []).map((block) => {
    switch (block.__component) {
      case 'shared.rich-text':
        return { ...block, html: renderer.renderMarkdown(block.body, blockCitations(index, block)) }
      case 'shared.quote':
        return { ...block, html: renderer.renderInlineMarkdown(block.body, blockCitations(index, block)) }
      case 'about.open-source':
        return { ...block, guide: block.guide?.map(item => ({ ...item, html: renderer.renderInlineMarkdown(item.text) })) }
      default:
        return block
    }
  })
}

export function renderArticleBlocks(
  blocks: StrapiBlock[] | null | undefined,
  references: StrapiReference[] | null | undefined,
  renderer: MarkdownRenderer,
): StrapiBlock[] {
  return renderBlocks(blocks, renderer, buildCitationIndex(blocks, references))
}
