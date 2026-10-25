import { z } from 'zod'
import type { DraftListItem, DraftListResponse, DraftPageResponse } from '~/interfaces/draft'
import { pageSchema } from './pages'
import { draftPreviewSchema } from './posts'
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

/** The draft of a page (`GET /api/drafts/pages/{documentId}`). */
export const draftPageResponseSchema = responseSchema<DraftPageResponse>()(
  z.strictObject({
    page: pageSchema,
    updatedAt: z.string().nullable().meta({ description: 'The `updatedAt` of the draft, which names the version the preview frame shows; null when the CMS sent none.' }),
    preview: draftPreviewSchema.optional().meta({ description: 'Present when the request came with a preview grant.' }),
  }).meta({ id: 'DraftPageResponse', description: 'A page draft for the preview page.' }),
)
