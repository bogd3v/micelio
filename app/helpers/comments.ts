import type { Comment, CommentAuthor, CommentFilter } from '../interfaces/comment'

const HIDDEN_STATUSES = new Set(['PENDING', 'REJECTED'])
const WEB_PROTOCOLS = new Set(['https:', 'http:'])
const RELATION_PATTERN = /^api::article\.article:[\w-]{1,128}$/

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

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

export function isVisibleComment(comment: Comment): boolean {
  return !HIDDEN_STATUSES.has(comment.approvalStatus ?? '')
}

export function toPublicComment(comment: Comment): Comment {
  return {
    ...comment,
    author: toPublicAuthor(comment.author),
    isAdminComment: comment.isAdminComment === true,
    fediverseActorHandle: textOrNull(comment.fediverseActorHandle),
    fediverseUri: webUrlOrNull(comment.fediverseUri),
    ...(comment.children ? { children: toPublicComments(comment.children) } : {}),
  }
}

export function toPublicComments(comments: Comment[]): Comment[] {
  return comments.filter(isVisibleComment).map(toPublicComment)
}

export function isFediverseComment(comment: Comment): boolean {
  return Boolean(comment.fediverseActorHandle || comment.fediverseUri)
}

export function matchesCommentFilter(comment: Comment, filter: CommentFilter): boolean {
  if (filter === 'all') return true
  return isFediverseComment(comment) === (filter === 'fediverse')
}

export function isCommentRelation(value: unknown): value is string {
  return typeof value === 'string' && RELATION_PATTERN.test(value)
}
