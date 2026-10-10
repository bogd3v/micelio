/**
 * A post with its plain fields. No code in this repository reads it yet.
 */
export interface Post {
  id: number
  title: string
  slug: string
  description: string
  content: string
  date: string
  /** Reading time in minutes, when the CMS gives one. */
  readTime?: number
  tags: string[]
  /** The cover image of the post, when it has one. */
  cover?: string
}

/**
 * Names a post's media and title take in a view transition (ADR 0005, section 10).
 *
 * @public
 */
export interface PostTransitionNames {
  media: string
  title: string
}
