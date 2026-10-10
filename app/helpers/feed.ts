import type { Category } from '../interfaces/design'

/** Path of a locale's feed, or of one category's feed; the Spanish feeds carry the `/es` prefix. */
export function feedPath(locale: string, category?: Category): string {
  const prefix = locale === 'es' ? '/es' : ''
  return `${prefix}${category ? `/feed/${category}.xml` : '/feed.xml'}`
}
