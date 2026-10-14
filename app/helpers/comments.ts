import type { Comment, CommentAuthor, CommentFilter } from '../interfaces/comment'

const HIDDEN_STATUSES = new Set(['PENDING', 'REJECTED'])
const WEB_PROTOCOLS = new Set(['https:', 'http:'])
const RELATION_PATTERN = /^api::article\.article:[\w-]{1,128}$/

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** The trimmed value as a normalised URL when it is an http or https address, or null otherwise. */
export function webUrlOrNull(value: unknown): string | null {
  const text = textOrNull(value)
  if (!text) return null
  try {
    const url = new URL(text)
    return WEB_PROTOCOLS.has(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

function toPublicAuthor(author: CommentAuthor | undefined): CommentAuthor {
  return {
    id: author?.id,
    name: author?.name ?? '',
    avatar: author?.avatar ?? null,
  }
}

/** Whether a comment is shown to the public. Pending and rejected comments are not. */
export function isVisibleComment(comment: Comment): boolean {
  return !HIDDEN_STATUSES.has(comment.approvalStatus ?? '')
}

// The fields of a comment that may leave the server. Anything else the CMS sends (an email in the parent of a reply, the reports readers
// wrote, a field a later version of the plugin adds) stays behind: the public shape is built from this list, not by spreading the answer
const PUBLIC_FIELDS = ['id', 'documentId', 'content', 'blocked', 'blockedThread', 'blockReason', 'authorUser', 'removed', 'approvalStatus', 'related', 'createdAt', 'updatedAt'] as const

/**
 * A comment ready for the public: its author, admin flag and fediverse handle and link are normalised, and its replies are made public the same way.
 *
 * @remarks
 * Built from a list of public fields, not from a copy of what the CMS sent. The parent of a reply (`threadOf`) is reduced to its `id`, because the plugin answers it as the whole parent comment, author email included, and the `reports` readers sent are never returned (the list is empty).
 */
export function toPublicComment(comment: Comment): Comment {
  const picked = Object.fromEntries(PUBLIC_FIELDS.filter(field => comment[field] !== undefined).map(field => [field, comment[field]]))
  return {
    ...(picked as Pick<Comment, typeof PUBLIC_FIELDS[number]>),
    reports: [],
    threadOf: comment.threadOf ? { id: comment.threadOf.id } : null,
    author: toPublicAuthor(comment.author),
    isAdminComment: comment.isAdminComment === true,
    fediverseActorHandle: textOrNull(comment.fediverseActorHandle),
    fediverseUri: webUrlOrNull(comment.fediverseUri),
    ...(comment.children ? { children: toPublicComments(comment.children) } : {}),
  }
}

/**
 * The visible comments of a list, made public with `toPublicComment`.
 *
 * @remarks
 * Replies are filtered and made public in the same way.
 */
export function toPublicComments(comments: Comment[]): Comment[] {
  return comments.filter(isVisibleComment).map(toPublicComment)
}

/** Whether a comment came from the fediverse, which means it has an actor handle or a link. */
export function isFediverseComment(comment: Comment): boolean {
  return Boolean(comment.fediverseActorHandle || comment.fediverseUri)
}

/** Whether a comment belongs to a filter: `all` matches every comment, `fediverse` only the fediverse comments and `blog` only the others. */
export function matchesCommentFilter(comment: Comment, filter: CommentFilter): boolean {
  if (filter === 'all') return true
  return isFediverseComment(comment) === (filter === 'fediverse')
}

/** Whether a value is the Strapi relation of an article: `api::article.article:` followed by an id of 1 to 128 letters, digits, underscores or hyphens. */
export function isCommentRelation(value: unknown): value is string {
  return typeof value === 'string' && RELATION_PATTERN.test(value)
}
