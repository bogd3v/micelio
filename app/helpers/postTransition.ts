/** Names a post's media and title take in a view transition (ADR 0005, section 10). */
export interface PostTransitionNames {
  media: string
  title: string
}

/** Stable and collision-free: letters, digits and `-` stay, anything else (including `_`) becomes `_<hex>_`, so the result is a valid ident after the prefix. */
export function postTransitionNames(slug: string): PostTransitionNames {
  const key = slug.replace(/[^a-zA-Z0-9-]/gu, char => `_${char.codePointAt(0)!.toString(16)}_`)
  return { media: `bd-post-media-${key}`, title: `bd-post-title-${key}` }
}
