import { SLUG_PATTERN } from './constants'
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
 * A category without a slug of `SLUG_PATTERN` is dropped, because no route can address it. A missing `name` falls back to the slug. `featured` is the CMS `featured` when it sends one, else `pillar` (ADR 0016, section 10).
 */
export function shapeCategories(raw: readonly RawCategory[]): LoadedCategory[] {
  const categories: LoadedCategory[] = []
  for (const item of raw) {
    const slug = item.slug?.trim()
    if (!slug || !SLUG_PATTERN.test(slug)) continue
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

/**
 * Merges the categories of the default locale with those of another one into the list of that locale.
 *
 * @remarks
 * The default locale gives the list, its order and its description. A category the other locale does not have keeps its slug as its name (ADR 0016, trade-offs) and has no articles there; one that only the other locale has is added. Name, description and count otherwise come from the other locale.
 *
 * @param base - The shaped categories of the default locale.
 * @param localized - The shaped categories of the requested locale.
 */
export function mergeLocalized(base: readonly LoadedCategory[], localized: readonly LoadedCategory[]): LoadedCategory[] {
  const own = new Map(localized.map(category => [category.slug, category]))
  const merged = base.map((category): LoadedCategory => {
    const translated = own.get(category.slug)
    if (!translated) return { ...category, name: category.slug, count: 0 }
    return { ...category, name: translated.name, description: translated.description ?? category.description, count: translated.count }
  })
  const known = new Set(base.map(category => category.slug))
  return sortCategories([...merged, ...localized.filter(category => !known.has(category.slug))])
}
