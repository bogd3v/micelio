import type { LoadedCategory } from './types'

/** A category as the CMS returns it; every field but `id` may be missing. */
export interface RawCategory {
  id: number
  name?: string | null
  slug?: string | null
  description?: string | null
  order?: number | null
  featured?: boolean | number | null
  pillar?: boolean | number | null
  articles?: Array<{ id: number }> | null
}

const SLUG_SHAPE = /^[a-z0-9-]+$/

/**
 * Orders categories by `order` ascending, those without one last, then by `name`.
 *
 * @returns A new array; the input is not changed.
 */
export function sortCategories<T extends { order: number | null, name: string }>(categories: readonly T[]): T[] {
  return [...categories].sort((a, b) => {
    const left = a.order ?? Number.POSITIVE_INFINITY
    const right = b.order ?? Number.POSITIVE_INFINITY
    if (left !== right) return left < right ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Turns the CMS answer into the sorted list of usable categories.
 *
 * @remarks
 * A category without a slug of lowercase letters, digits and hyphens is dropped, because no route can address it. A missing `name` falls back to the slug. `featured` is the CMS `featured` when it sends one, else `pillar` (ADR 0016, section 10).
 */
export function shapeCategories(raw: readonly RawCategory[]): LoadedCategory[] {
  const categories: LoadedCategory[] = []
  for (const item of raw) {
    const slug = item.slug?.trim()
    if (!slug || !SLUG_SHAPE.test(slug)) continue
    categories.push({
      id: item.id,
      slug,
      name: item.name?.trim() || slug,
      description: item.description?.trim() || null,
      order: typeof item.order === 'number' && Number.isFinite(item.order) ? item.order : null,
      featured: Boolean(item.featured ?? item.pillar),
      count: item.articles?.length ?? 0,
    })
  }
  return sortCategories(categories)
}
