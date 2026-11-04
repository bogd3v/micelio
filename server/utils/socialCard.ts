import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { cardStyleOf } from '../lib/cardStyle'
import { cardText, createCardCache } from '../lib/socialCard'
import type { Locale } from '~/interfaces'

// The social card of a draft (bogd3v/micelio#734): the words of the draft in the colours and the display font of the theme this process renders.

/** How long a card is kept, per document version. */
const CARD_CACHE_MS = 5 * 60 * 1000
/** The most cards kept at once. */
const CARD_CACHE_MAX = 50

const drawCard = createCardCache({ ttlMs: CARD_CACHE_MS, max: CARD_CACHE_MAX })

/**
 * The 1200×630 PNG of a draft's social card: its title and the site name on the theme's surface, in the theme's display font and accent.
 *
 * @param draft - The draft the CMS gave to the preview grant (`fetchPreviewDraft`); its `title` and `updatedAt` are read.
 * @param locale - The language of the draft, as the CMS named it: the site name is read in it, so it matches the title.
 *
 * @remarks
 * Kept 5 minutes per document version (`updatedAt`) and per look (the words, the colours and the font file), so saving the draft or changing the site or the theme draws it again.
 * Requests for a card in progress share it and a failed one is not kept.
 *
 * @throws The draft 404 when the draft has no title, and a 500 (`internalError`, logged as `render.card`) when the theme has no font file or the render fails.
 */
export async function previewSocialCard(event: H3Event, kind: 'article' | 'page', documentId: string, locale: Locale, draft: unknown): Promise<Buffer> {
  const { title, updatedAt } = draft as { title?: unknown, updatedAt?: unknown }
  if (typeof title !== 'string' || !cardText(title)) throw draftNotFound()
  const style = cardStyleOf(activeTheme(), await loadSiteCached(locale), title)
  if (!style) {
    logError('render.card', 'The active theme ships no font file to draw a social card with', { event })
    throw problem('internalError', { detail: 'The active theme ships no font file, so it cannot draw a card.' })
  }
  const look = createHash('sha256').update(JSON.stringify([style.title, style.siteName, style.surface, style.ink, style.accent])).update(style.fontFile).digest('hex').slice(0, 24)
  const key = `${kind}:${documentId}:${locale}:${typeof updatedAt === 'string' ? updatedAt : ''}:${look}`
  try {
    return await drawCard(key, style)
  } catch (error: unknown) {
    logError('render.card', 'The social card could not be drawn', { event, error })
    throw problem('internalError', { detail: 'The card could not be drawn.' })
  }
}
