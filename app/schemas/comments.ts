import { z } from 'zod'
import type { Comment, CommentAuthor, CommentReport, CommentsResponse } from '~/interfaces/comment'
import { paginationMetaSchema } from './posts'
import { responseSchema } from './response'

// What the comment routes send: every comment goes through `toPublicComment` (app/helpers/comments.ts), which builds it from a list of
// public fields, so every object is strict. The envelope of the flat list is rebuilt by `publicCommentsPage` (server/lib/publicShapes.ts).

/** The author of a comment. */
const commentAuthorSchema = responseSchema<CommentAuthor>()(
  z.strictObject({
    id: z.union([z.string(), z.number()]).optional().meta({ description: 'A user id, a `guest-<uuid>` or the actor URL of a fediverse author.' }),
    name: z.string(),
    avatar: z.string().nullish(),
  }).meta({ id: 'CommentAuthor', description: 'The public author of a comment.' }),
)

/** A report a reader sent about a comment; the server never sends one. */
const commentReportSchema = responseSchema<CommentReport>()(
  z.strictObject({
    id: z.number(),
    reason: z.string(),
    content: z.string().optional(),
    createdAt: z.string(),
    related: z.strictObject({ id: z.number() }).optional(),
  }).meta({ id: 'CommentReport', description: 'A report a reader sent about a comment.' }),
)

// Every field of a comment but its replies. It is tied to the interface on its own, because a schema that refers to itself cannot be
// tied by `responseSchema` (its type is circular); `children` is then added with an annotation, which checks it one way only.
const commentFieldsSchema = responseSchema<Omit<Comment, 'children'>>()(
  z.strictObject({
    id: z.number(),
    documentId: z.string().optional(),
    content: z.string(),
    blocked: z.boolean().nullable(),
    blockedThread: z.boolean(),
    blockReason: z.string().nullable(),
    authorUser: z.string().nullish().meta({ description: 'The comments plugin does not return it, so it is usually absent.' }),
    removed: z.boolean().nullable(),
    approvalStatus: z.string().nullable().meta({ description: 'Only `APPROVED` comments are listed, but a comment just posted may be `PENDING`.' }),
    isAdminComment: z.boolean().nullish(),
    author: commentAuthorSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
    related: z.union([z.strictObject({ id: z.number(), documentId: z.string().optional() }), z.string()]).optional().meta({ description: 'A relation string such as `api::article.article:<documentId>`; absent in the hierarchy.' }),
    reports: z.array(commentReportSchema).meta({ description: 'Always empty: the reports readers sent are never returned.' }),
    threadOf: z.strictObject({ id: z.number() }).nullish().meta({ description: 'The parent of a reply, reduced to its id.' }),
    fediverseActorHandle: z.string().nullish(),
    fediverseUri: z.string().nullish().meta({ description: 'An http(s) link only.' }),
  }),
)

/**
 * A comment, with its replies nested in `children` in the hierarchy view.
 *
 * @remarks
 * Recursive: `children` holds comments of the same shape. Pending and rejected comments are left out of every list.
 */
export const commentSchema: z.ZodType<Comment> = commentFieldsSchema.extend({
  get children(): z.ZodOptional<z.ZodArray<z.ZodType<Comment>>> {
    return z.array(commentSchema).optional()
  },
}).meta({ id: 'Comment', description: 'A comment on an article, as the comments API returns it.' })

/** The comments of an article as a tree (`GET /api/comments`). */
export const commentTreeSchema = responseSchema<Comment[]>()(
  z.array(commentSchema).meta({ id: 'CommentTree', description: 'The top-level comments of an article, with their replies nested in `children`.' }),
)

/** A flat page of comments (`GET /api/comments/flat`). */
export const commentsResponseSchema = responseSchema<CommentsResponse>()(
  z.strictObject({
    data: z.array(commentSchema),
    pagination: paginationMetaSchema.optional(),
  }).meta({ id: 'CommentsResponse', description: 'A page of comments and its pagination.' }),
)
