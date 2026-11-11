import { z } from 'zod'
import type { DraftListItem, DraftListResponse, DraftPage, DraftPageResponse, DraftPlaygroundSection } from '~/interfaces/draft'
import { pageSchema, pageSectionSchema } from './pages'
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

/** The Playground block of a page draft, with the language and the code that `micelio:run` runs. */
export const draftPlaygroundSchema = responseSchema<DraftPlaygroundSection>()(
  z.strictObject({
    __component: z.literal('shared.playground'),
    runtime: z.string(),
    code: z.string(),
    setup: z.string().optional(),
    position: z.int().min(0),
  }).meta({ id: 'DraftPlaygroundSection', description: 'A Playground block among the sections of a page draft. The preview runs its saved code on `micelio:run`; the page does not render it.' }),
)

/** A page draft: a page whose sections may include Playground blocks. */
export const draftPageSchema = responseSchema<DraftPage>()(
  z.strictObject({
    ...pageSchema.shape,
    sections: z.array(z.union([pageSectionSchema, draftPlaygroundSchema])).meta({ description: 'The sections that passed validation, in order, and the Playground blocks with a language and code; an invalid or unknown one is left out.' }),
  }).meta({ id: 'DraftPage', description: 'A page as its draft route returns it after validation.' }),
)

/** The draft of a page (`GET /api/drafts/pages/{documentId}`). */
export const draftPageResponseSchema = responseSchema<DraftPageResponse>()(
  z.strictObject({
    page: draftPageSchema,
    updatedAt: z.string().nullable().meta({ description: 'The `updatedAt` of the draft, which names the version the preview frame shows; null when the CMS sent none.' }),
    preview: draftPreviewSchema.optional().meta({ description: 'Present when the request came with a preview grant.' }),
  }).meta({ id: 'DraftPageResponse', description: 'A page draft for the preview page.' }),
)
