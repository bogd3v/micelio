import type { PageSection } from '../interfaces'
import { plainText } from './excerpt'

/** The JSON-LD `FAQPage` of a page: one `Question` per FAQ item, each with its answer as text. */
export interface FaqPageData {
  '@context': 'https://schema.org'
  '@type': 'FAQPage'
  'mainEntity': Array<{
    '@type': 'Question'
    'name': string
    'acceptedAnswer': { '@type': 'Answer', 'text': string }
  }>
}

const BLOCK_END = /<\/(?:p|li|ul|ol|h[1-6]|blockquote|pre|div|tr|table)>|<br\s*\/?>/gi

/** The text of a sanitized answer: tags dropped, entities decoded, one space where a block or a line ended. */
function answerText(html: string): string {
  return plainText(html.replace(BLOCK_END, match => ` ${match}`)).replace(/\s+/g, ' ').trim()
}

/**
 * The `FAQPage` of the `faq` blocks of a page, or `undefined` when it has no question with an answer.
 *
 * @remarks
 * Every `faq` block adds its questions to the one `FAQPage`, in page order. An item with no question or no answer text is left out. Answers come from the sanitized HTML the server renders from the Markdown, so no Markdown parser runs on the client.
 */
export function faqStructuredData(sections: readonly PageSection[] | undefined): FaqPageData | undefined {
  const mainEntity: FaqPageData['mainEntity'] = []
  for (const section of sections ?? []) {
    if (section.__component !== 'section.faq') continue
    for (const item of section.items) {
      const name = item.question.trim()
      const text = answerText(item.html)
      if (name && text) mainEntity.push({ '@type': 'Question', 'name': name, 'acceptedAnswer': { '@type': 'Answer', text } })
    }
  }
  return mainEntity.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity } : undefined
}

/** The JSON of `data` for the body of a `<script type="application/ld+json">`: `<` is escaped, so no text can close the script. */
export function jsonLd(data: FaqPageData): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
