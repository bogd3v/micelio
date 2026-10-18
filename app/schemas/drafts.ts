import { z } from 'zod'
import type { DraftListItem, DraftListResponse } from '~/interfaces/draft'
import { responseSchema } from './response'

// The article of a draft (`draftArticleResponseSchema`) is in posts.ts, next to `articleSchema`, which it wraps. The list rows are rebuilt by
// `publicDraftRow` (server/lib/publicShapes.ts), so a key the CMS adds never leaves the server.

/**
 * A draft in the list.
 *
 * @internal Exported for the tests.
 */
export const draftListItemSchema = responseSchema<DraftListItem>()(
  z.strictObject({
    documentId: z.string(),
    title: z.string(),
    slug: z.string().nullable(),
    locale: z.string(),
    updatedAt: z.string(),
    publishedAt: z.string().nullable().meta({ description: 'Null when the article was never published.' }),
    state: z.enum(['never-published', 'modified']),
    category: z.strictObject({ name: z.string().nullish(), slug: z.string().nullish() }).nullable(),
    author: z.strictObject({ name: z.string().nullish() }).nullable(),
  }).meta({ id: 'DraftListItem', description: 'A draft in the drafts list.' }),
)

/** The drafts list (`GET /api/drafts`). */
export const draftListResponseSchema = responseSchema<DraftListResponse>()(
  z.strictObject({ data: z.array(draftListItemSchema), meta: z.strictObject({ count: z.int().min(0) }) }).meta({ id: 'DraftListResponse', description: 'The drafts, most recently updated first, with their count.' }),
)
