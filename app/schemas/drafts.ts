import { z } from 'zod'
import type { DraftListItem, DraftListResponse } from '~/interfaces/draft'
import { responseSchema } from './response'

// The article of a draft (`draftArticleResponseSchema`) is in posts.ts, next to `articleSchema`, which it wraps. The list rows are the CMS rows as they
// come: the CMS builds each by hand and its `articles.drafts` response-fields check pins the keys, but the route has no allow-list yet, so a key the
// CMS added would be sent. The schema is strict so a test notices it.

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
