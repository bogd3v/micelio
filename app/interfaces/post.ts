export interface Post {
  id: number
  title: string
  slug: string
  description: string
  content: string
  date: string
  readTime?: number
  tags: string[]
  cover?: string
}

/** Names a post's media and title take in a view transition (ADR 0005, section 10). */
export interface PostTransitionNames {
  media: string
  title: string
}
