import type { PostTransitionNames } from '../interfaces/post'

/** Stable and collision-free: letters, digits and `-` stay, anything else (including `_`) becomes `_<hex>_`, so the result is a valid ident after the prefix. */
export function postTransitionNames(slug: string): PostTransitionNames {
  const key = slug.replace(/[^a-zA-Z0-9-]/gu, char => `_${char.codePointAt(0)!.toString(16)}_`)
  return { media: `myc-post-media-${key}`, title: `myc-post-title-${key}` }
}
