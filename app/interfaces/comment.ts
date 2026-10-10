/**
 * The public author of a comment, as `toPublicComment` returns it.
 *
 * @public
 */
export interface CommentAuthor {
  id?: string | number
  name: string
  /** Kept for the server only: the public shape drops it. */
  email?: string
  /** Null when the author has no avatar. */
  avatar?: string | null
}

/**
 * A comment on an article, as the comments API returns it.
 *
 * @public
 */
export interface Comment {
  id: number
  /** Strapi's document id, stable across drafts and locales. */
  documentId?: string
  content: string
  /** Whether a moderator blocked the comment. */
  blocked: boolean | null
  /** Blocks replies to the comment and to its thread; the reply button stays hidden. */
  blockedThread: boolean
  /** The moderator's reason for the block, when one was given. */
  blockReason: string | null
  /** The account reference of a signed-in author; null for a guest. */
  authorUser: string | null
  /** The comment was removed, for example because its fediverse note was deleted; the text is replaced by a notice. */
  removed: boolean | null
  /** The moderation state from the CMS: `PENDING` and `REJECTED` are hidden, `APPROVED` is shown. */
  approvalStatus: string | null
  /** Whether the site's owner wrote the comment; the list shows an author badge. */
  isAdminComment?: boolean | null
  author: CommentAuthor
  createdAt: string
  updatedAt: string
  /** The article the comment belongs to. */
  related: {
    id: number
    documentId?: string
  }
  /** Reports readers sent about the comment. */
  reports: CommentReport[]
  /** The replies, nested; present only in the hierarchy view. */
  children?: Comment[]
  /** The parent comment of a reply; null or absent for a top-level comment. */
  threadOf?: {
    id: number
  } | null
  /** The handle of the remote author of a fediverse comment. */
  fediverseActorHandle?: string | null
  /** Link to the remote post of a fediverse comment; only http and https links survive `toPublicComment`. */
  fediverseUri?: string | null
}

/**
 * The sources the comment list can show: all comments, the site's own comments, or fediverse replies.
 *
 * @public
 */
export type CommentFilter = 'all' | 'blog' | 'fediverse'

/**
 * A report a reader sent about a comment.
 *
 * @public
 */
export interface CommentReport {
  id: number
  /** One of `BAD_WORDS`, `DISCRIMINATION` or `OTHER`; the `string` member lets an unknown code still type-check. */
  reason: 'BAD_WORDS' | 'DISCRIMINATION' | 'OTHER' | string
  content?: string
  createdAt: string
  related?: {
    id: number
  }
}

/**
 * What the comment form sends: the author's details, the text and the comment being replied to.
 *
 * @public
 */
export interface CommentFormData {
  author: {
    name: string
    email: string
    avatar?: string
  }
  content: string
  /** The id of the comment being replied to. */
  threadOf?: number
}

/**
 * A guest comment as the form sends it, with the locale of the page.
 *
 * @public
 */
export interface GuestCommentInput extends CommentFormData {
  /** The page's locale, for example `en`. */
  locale: string
}

/**
 * A guest comment as the server stores it: the author gets a generated id.
 *
 * @public
 */
export interface GuestComment {
  author: {
    id: string
    name: string
    email: string
    avatar?: string
  }
  content: string
  threadOf?: number
}

/**
 * A page of comments from the comments API.
 *
 * @public
 */
export interface CommentsResponse {
  data: Comment[]
  meta?: {
    pagination?: {
      page: number
      pageSize: number
      pageCount: number
      total: number
    }
  }
}

/**
 * The answer to posting a comment; `error` carries the message when the server reports one.
 *
 * @public
 */
export interface PostCommentResponse {
  data: Comment
  error?: string
}
