import type { StrapiBlock } from '../interfaces/strapi-blocks'
import type {
  ApaSegment,
  CitationIndex,
  NumberedReference,
  ReferenceIdentifier,
  StrapiReference,
  StrapiReferenceType,
} from '../interfaces/strapi-reference'

const KEY = '[a-z0-9][a-z0-9-]*'
const GROUP = `\\[(@${KEY}(?:\\s*;\\s*@${KEY})*)\\](?!\\()`
const CITATION_PATTERN = new RegExp(GROUP, 'g')
const CODE_PATTERN = /^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?(?:^[ \t]*\1[ \t]*$|(?![\s\S]))|`+[^`\n]+`+/gm
const ARXIV_URL = /^https?:\/\/(?:www\.)?arxiv\.org\/(?:abs|pdf)\/([^?#]+?)(?:\.pdf)?\/?(?:[?#].*)?$/i
const ITALIC_CONTAINER: readonly StrapiReferenceType[] = ['journal', 'conference', 'chapter']
const CLOSING_PUNCTUATION = /[.?!]$/

/**
 * Matches a citation group at the start of a text, for the Markdown tokenizer.
 *
 * @remarks
 * A group is `[@key]` or `[@key1; @key2]`. A group followed by a parenthesis is a link and does not match.
 */
export const CITATION_RULE = new RegExp(`^${GROUP}`)

/** The key of a block in the citation and figure maps, made of its component and its id. */
export function citationBlockKey(block: StrapiBlock): string {
  return `${block.__component}-${block.id}`
}

/** The keys of one citation group, such as `@a; @b`, without their `@`. */
export function splitCitationGroup(group: string): string[] {
  return group.split(';').map(part => part.trim().slice(1))
}

/**
 * The keys cited in a Markdown text, in order of appearance.
 *
 * @remarks
 * Code spans and code blocks are not read, so a citation inside code does not count. A key cited twice appears twice.
 */
export function citedKeys(markdown: string): string[] {
  const prose = markdown.replace(CODE_PATTERN, '')
  const keys: string[] = []
  for (const match of prose.matchAll(CITATION_PATTERN)) keys.push(...splitCitationGroup(match[1]!))
  return keys
}

function citingBlocks(blocks: StrapiBlock[] | null | undefined): { key: string, body: string }[] {
  return (blocks ?? []).flatMap((block) => {
    if (block.__component !== 'shared.rich-text' && block.__component !== 'shared.quote') return []
    return block.body ? [{ key: citationBlockKey(block), body: block.body }] : []
  })
}

/**
 * The keys of the references cited in the blocks, in the order of their first citation.
 *
 * @remarks
 * A cited key without a matching reference is left out.
 */
export function citationOrder(blocks: StrapiBlock[] | null | undefined, references: StrapiReference[] | null | undefined): string[] {
  const known = new Set((references ?? []).map(reference => reference.key))
  const order = new Set<string>()
  for (const { body } of citingBlocks(blocks)) {
    for (const key of citedKeys(body)) if (known.has(key)) order.add(key)
  }
  return [...order]
}

/**
 * The references numbered in citation order, with the cited ones first and the uncited ones after them.
 *
 * @remarks
 * Every entry says whether it is `cited`; uncited references still get a number, in their own order.
 */
export function numberReferences(blocks: StrapiBlock[] | null | undefined, references: StrapiReference[] | null | undefined): NumberedReference[] {
  const order = citationOrder(blocks, references)
  const byKey = new Map((references ?? []).map(reference => [reference.key, reference]))
  const cited = order.map((key, index) => ({ number: index + 1, cited: true, reference: byKey.get(key)! }))
  const uncited = (references ?? [])
    .filter(reference => !order.includes(reference.key))
    .map((reference, index) => ({ number: order.length + index + 1, cited: false, reference }))
  return [...cited, ...uncited]
}

/**
 * The number of each cited reference and the keys that each block anchors.
 *
 * @remarks
 * A key is anchored to the first block that cites it. Blocks are keyed by `citationBlockKey`.
 */
export function buildCitationIndex(blocks: StrapiBlock[] | null | undefined, references: StrapiReference[] | null | undefined): CitationIndex {
  const numbers: Record<string, number> = {}
  for (const entry of numberReferences(blocks, references)) {
    if (entry.cited) numbers[entry.reference.key] = entry.number
  }
  const anchors: Record<string, string[]> = {}
  const anchored = new Set<string>()
  for (const { key: blockKey, body } of citingBlocks(blocks)) {
    for (const key of citedKeys(body)) {
      if (!(key in numbers) || anchored.has(key)) continue
      anchored.add(key)
      anchors[blockKey] = [...(anchors[blockKey] ?? []), key]
    }
  }
  return { numbers, anchors }
}

/** The link of a reference: its DOI resolver URL when it has a DOI, else its own URL, or undefined when it has neither. */
export function referenceHref(reference: StrapiReference): string | undefined {
  const doi = reference.doi?.trim()
  if (doi) return `https://doi.org/${doi}`
  return reference.url?.trim() || undefined
}

/**
 * The short identifier of a reference (its DOI, its arXiv id or its URL) with the link it points to, or null when it has neither a DOI nor a URL.
 *
 * @remarks
 * An arXiv abstract or PDF link shows as `arXiv:` followed by its id. Other URLs show without their scheme, `www.` or trailing slash.
 */
export function referenceIdentifier(reference: StrapiReference): ReferenceIdentifier | null {
  const doi = reference.doi?.trim()
  if (doi) return { text: `doi.org/${doi}`, href: `https://doi.org/${doi}` }
  const url = reference.url?.trim()
  if (!url) return null
  const arxiv = ARXIV_URL.exec(url)
  if (arxiv) return { text: `arXiv:${arxiv[1]}`, href: url }
  return { text: url.replace(/^https?:\/\/(?:www\.)?/i, '').replace(/\/$/, ''), href: url }
}

/** The venue of a reference in capitals: its venue label, or else its container and year joined by a middle dot. */
export function referenceVenue(reference: StrapiReference): string {
  const label = reference.venueLabel?.trim()
  const venue = label || [reference.container?.trim(), reference.year.trim()].filter(Boolean).join(' · ')
  return venue.toUpperCase()
}

function withPeriod(text: string): string {
  return CLOSING_PUNCTUATION.test(text) ? text : `${text}.`
}

/**
 * The APA 7 citation of a reference as text segments, so that the page can emphasise the container and link the title.
 *
 * @remarks
 * The title is linked when the reference has a DOI or a URL. Journal, conference and chapter references mark the container as its own `container` segment; other types keep it as plain text.
 */
export function formatApa(reference: StrapiReference): ApaSegment[] {
  const title = reference.title.trim()
  const container = reference.container?.trim()
  const volume = reference.volume?.trim()
  const issue = reference.issue?.trim()
  const pages = reference.pages?.trim()
  const volumeIssue = `${volume ?? ''}${issue ? `(${issue})` : ''}`
  const details = [volumeIssue, pages].filter(Boolean).join(', ')
  const segments: ApaSegment[] = [
    { kind: 'text', text: `${reference.authors.trim()} (${reference.year.trim()}). ` },
    { kind: 'title', text: title, href: referenceHref(reference) },
  ]
  if (!CLOSING_PUNCTUATION.test(title)) segments.push({ kind: 'text', text: '.' })
  if (container) {
    const kind = ITALIC_CONTAINER.includes(reference.type) ? 'container' : 'text'
    segments.push({ kind: 'text', text: ' ' })
    segments.push({ kind, text: container })
    const tail = details ? `, ${withPeriod(details)}` : withPeriod(container).slice(container.length)
    if (tail) segments.push({ kind: 'text', text: tail })
  } else if (details) {
    segments.push({ kind: 'text', text: ` ${withPeriod(details)}` })
  }
  return segments
}

/** The plain text of the APA citation of a reference, without links or emphasis. */
export function apaText(reference: StrapiReference): string {
  return formatApa(reference).map(segment => segment.text).join('')
}

/**
 * The latest access date of the references, as stored, or null when no reference has one.
 *
 * @remarks
 * The dates are compared as text, which orders ISO dates such as `2026-01-31` correctly.
 */
export function latestAccessedAt(references: StrapiReference[] | null | undefined): string | null {
  const dates = (references ?? []).map(reference => reference.accessedAt).filter((date): date is string => Boolean(date))
  return dates.length ? dates.reduce((latest, date) => (date > latest ? date : latest)) : null
}

/** Formats a date as `DD.MM.YYYY` in UTC, the way a reference shows its access date. */
export function formatAccessDate(date: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).formatToParts(new Date(date))
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find(p => p.type === type)?.value ?? ''
  return `${part('day')}.${part('month')}.${part('year')}`
}
