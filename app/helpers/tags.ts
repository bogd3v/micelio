import type { StrapiTagRef, TagCount } from '../interfaces/strapi-post'

/** Sorts tags by use, the most used first, then by name, in a copy. */
export function sortTags(tags: TagCount[]): TagCount[] {
  return [...tags].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/**
 * The first `limit` tags, plus the `active` tag when it is not among them, so the filter in use stays visible.
 *
 * @remarks
 * `tags` must already be sorted (`sortTags()`, as `/api/tags` returns them): the first `limit` are taken as they come.
 */
export function popularTags(tags: TagCount[], limit: number, active?: string): TagCount[] {
  const top = tags.slice(0, limit)
  if (!active || top.some(tag => tag.slug === active)) return top
  const current = tags.find(tag => tag.slug === active)
  return current ? [...top, current] : top
}

/** The name of the tag with `slug`, or the slug itself when no tag has it. */
export function tagLabel(tags: StrapiTagRef[], slug: string): string {
  return tags.find(tag => tag.slug === slug)?.name ?? slug
}
